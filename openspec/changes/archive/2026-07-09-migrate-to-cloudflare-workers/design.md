## Context

Kujakuは単一のPOST `/`エンドポイントを持つ小さなRuby/Sinatraアプリで、以下を行う。

1. Slack Events APIの`url_verification`チャレンジを検証する。
2. `event_callback`イベントに対して、`event.links`内のesa.io投稿/コメントURLを検出し、esa APIから該当の投稿/コメントを取得し、結果のアタッチメントでSlackの`chat.unfurl` APIを呼び出す。
3. 同一URLが短時間に繰り返しunfurlされた際にesa APIのレート制限に達しないよう、esa APIの検索結果を1時間キャッシュする（Redisおよび/またはGoogle Cloud Firestore）。

現在はHeroku（無料dyno）上でホストし、キャッシュにHeroku Redis（無料アドオン）および/またはFirestoreを利用し、ログにPapertrailを利用している。このアプリが依存しているHerokuの無料枠が終了するため、ホスティング変更を余儀なくされている。移行先としてCloudflareを選定した。Cloudflare WorkersはRubyを実行できないため、TypeScriptによる全面書き換えが必要となる。

このアプリには外部から依存されている面が一つある。Slack Appの Event Subscriptions の「Request URL」であり、これはコードがどこでホストされていてもそこを指すよう更新する必要がある。ホスティング変更に伴い、このURLをSlackの管理画面で更新する必要がある。

## Goals / Non-Goals

**Goals:**
- 既存の挙動（URL検証、esaリンクのunfurl、1時間キャッシュ）をCloudflare Workers上のTypeScriptとして再実装する。
- Redis/FirestoreのキャッシュをひとつのWorkers KV namespaceに置き換える。
- 運用面をシンプルに保つ: Workerひとつ、KV namespaceひとつ、トークン類はWorkerのシークレットで管理する。
- 既存の外部挙動を完全に維持する（同じSlackペイロード形式、同じesa URLマッチングルール、同じキャッシュTTL）ことで、Slack App側の設定変更をURLの変更のみで済むようにする。
- Cloudflareのカスタムドメイン上でWorkerを公開する（`workers.dev`のデフォルトサブドメインではなく）。

**Non-Goals:**
- esa.ioのURLマッチングロジックやunfurlの内容/フォーマットは、ランタイム移植に必要な範囲を超えて変更しない。
- 今回の移行の一部として新機能（新しいSlackコマンドや追加の連携など）を追加しない。
- 他のCloudflareコンピュートモデル（Containers）の評価は行わない — JS/TSによるWorkers書き換えは既に選定済み。
- Slack Appの設定を自動同期する仕組みは構築しない — Event Subscriptions URLの更新はリポジトリ管理者による手動の一回限りの作業とする。
- 今回のスコープではCI/CDによる自動デプロイは構築しない — デプロイは`wrangler deploy`の手動実行で行う。

## Decisions

### 実行環境・言語: Cloudflare Workers + TypeScript
本アプリはesa API・Slack APIへの2つの外部HTTP呼び出しとキャッシュ参照を行うだけの、ステートレスなWebhookハンドラであり、Node.js互換シムなしでもWorkerで十分実現可能。TypeScriptはSlack/esaのペイロード形状に型安全性を持たせるために採用する。素のJSも検討したが、既存のRubyコードが暗黙的にこれらのペイロード形状をモデル化しており、型付けすることで移植時のミスを減らせるため却下した。

### キャッシュ: Workers KV、単一namespace、キー = `esa:<post_number>[:<comment_number>]`
KVはキーごとのTTL（`expirationTtl`）をネイティブサポートしており、既存の`REDIS_TTL`/`FIRE_STORE_TTL`（1時間）の挙動に直接対応する。検討した代替案:
- **Cache API（`caches.default`）**: エッジキャッシュに紐づいており、任意のキーに対してすべてのCloudflare PoP間で永続性・一貫性が保証されない。esaのレート制限回避という正確性が重要なユースケースにはKVより予測性が劣る。
- **Durable Objects**: 強い一貫性や協調動作を必要としない単純なTTL付きキーバリューキャッシュにはオーバースペック。
KVの結果整合性（最大60秒程度の伝播遅延）は、このキャッシュがレート制限に対する安全策であり正確性の要件ではないため許容できる。

### シークレット: `wrangler secret put` によるCloudflare Workerシークレット
`SLACK_OAUTH_ACCESS_TOKEN`と`ESA_ACCESS_TOKEN`は、Herokuのconfig varsからWrangler CLIまたはCloudflareダッシュボード経由で設定するWorkerシークレットへ移行する。`ESA_TEAM_NAME`やキャッシュTTLは、非シークレットな`wrangler.toml`の変数とする。

### ロギング: Cloudflare Workers Logs（Papertrailを置き換え）
PapertrailはHerokuのアドオンでありCloudflareに直接の相当物がない。Workers Logs（およびライブ監視用の`wrangler tail`）がCloudflare標準の相当機能であり、サードパーティのアカウントを必要としない。Cloudflareダッシュボードを超える長期ログ保存/検索が将来必要になれば、それは別途のフォローアップ（例: Logpushによる外部シンクへの転送）とし、今回のスコープ外とする。

### ドメイン: カスタムドメインを利用
`workers.dev`のデフォルトサブドメインではなく、Cloudflareアカウントに追加したカスタムドメイン（DNS）上でWorkerを公開する。カスタムドメインのゾーンをCloudflareアカウントに追加し、Workerのルートを設定するのはリポジトリ管理者の作業となる（[Migration Plan](#migration-plan)参照）。

### デプロイ/CI: 今回はCI/CDを構築せず手動デプロイ
初回移行では`wrangler deploy`を手動実行する。CI/CD（GitHub Actionsなど）による自動デプロイの構築は、今回のスコープには含めない。将来必要になれば別のフォローアップとする。

## Risks / Trade-offs

- **[リスク] 全面書き換えにより、esa URLマッチングやunfurlのフォーマットにリグレッションが生じる可能性がある。** → 対策: 既存の正規表現やesa/Slackのペイロード構築ロジックを可能な限りそのまま移植し、切り替え前に実際のSlackイベントペイロードやesa URLで手動テストを行う。
- **[リスク] KVの結果整合性により、Redisの即時一貫性と異なり、別PoPでのキャッシュ書き込み後60秒程度は同じesa APIコールが重複する可能性がある。** → 対策: キャッシュは正確性ではなく最適化のためのものであり、esaのレート制限は多少の重複読み取りを許容できるため問題ない。
- **[リスク] 切り替えの間隙: WorkerのVerificationが十分でない状態でSlackのEvent Subscriptions URLを更新すると、Slackのunfurlが静かに失敗する可能性がある。** → 対策: Slackの Request URL を切り替える前に、`workers.dev`のURL（またはカスタムドメイン）に対してWorkerをデプロイし、`url_verification`のハンドシェイクを含めて手動で検証する。また、新エンドポイントの動作確認が済むまでHerokuアプリは稼働させたままにする。
- **[トレードオフ] Firestoreサポートの廃止** により、Google Cloudを既に利用しているセルフホスト利用者向けのキャッシュ経路がなくなり、Cloudflareネイティブな単一キャッシュに一本化される。本リポジトリ自身のデプロイ（今回の主目的）はFirestoreに依存していないため許容でき、コードベースも単純化される。Cloudflare上でセルフホストする場合はKVのみで動作する。

## Migration Plan

1. Workerをビルドし、既存のHerokuデプロイと並行してCloudflareのカスタムドメイン（またはテスト用に`workers.dev`）にデプロイする。
2. 手動で検証する: Slackの`url_verification`チャレンジへの応答、実際のesa投稿/コメントURLのエンドツーエンドunfurl、キャッシュのヒット/ミス挙動。
3. 対象のCloudflare環境にWorkerシークレット（`SLACK_OAUTH_ACCESS_TOKEN`, `ESA_ACCESS_TOKEN`）と設定変数（`ESA_TEAM_NAME`など）を設定する。
4. Cloudflareアカウントにカスタムドメインのゾーンを追加し、DNSレコードとWorkerのルートを設定する。
5. Slack Appの Event Subscriptions の Request URL を新しいWorkerのURL（カスタムドメイン）に更新する（リポジトリ管理者による手動作業）。
6. 切り替え後、Workers Logsでエラーを監視する。
7. Cloudflareデプロイの安定稼働を確認したら、Herokuアプリおよびそのredis/Firestoreアドオンを廃止する。

**ロールバック**: Herokuのデプロイはステップ7まで稼働させたまま残すため、ロールバックはSlackのEvent Subscriptions URLをHerokuのエンドポイントに戻すだけで済む。

## Open Questions

（解消済み）
- ~~カスタムドメインを使うか、デフォルトの`workers.dev`サブドメインを使うか~~ → カスタムドメインを使用する（2026-07-09、リポジトリ管理者確認済み）
- ~~今回の変更にCI/CD（GitHub Actions）を含めるか~~ → 今回は不要。`wrangler deploy`を手動実行する（2026-07-09、リポジトリ管理者確認済み）
