## 1. プロジェクトの雛形作成

- [x] 1.1 Workerプロジェクトの構成を作成する（`package.json`, `tsconfig.json`, `wrangler.toml`/`wrangler.jsonc`, `src/`）
- [x] 1.2 `wrangler.toml`にKV namespaceを定義し、`wrangler kv namespace create`で実際のnamespaceを作成する（spookies root accountに`kujaku-unfurl-cache`を作成し、idを反映済み）
- [x] 1.3 `wrangler.toml`に`ESA_TEAM_NAME`, `ESA_MAX_ARTICLE_LINES`, `ESA_MAX_COMMENT_LINES`の変数を定義する

## 2. コアとなるunfurlロジック（esa-url-unfurl）

- [x] 2.1 Workerの`fetch`ハンドラを実装する: 受信したSlackペイロードをパースし、`type`で分岐する
- [x] 2.2 `url_verification`のハンドリングを実装する（`challenge`をそのまま返す）
- [x] 2.3 `event.links`に対するesa投稿/コメントURLの正規表現マッチングを移植する
- [x] 2.4 esa APIクライアント（`get_post`, `get_comment`）を`fetch`を使ってesa REST APIに対して実装し、Rubyの`esa` gemを置き換える
- [x] 2.5 `article_text`/`comment_text`の行数切り詰めと`unescape`（`&#35;`, `&#47;`）ヘルパーを移植する
- [x] 2.6 `generate_footer`（Updated by / Created by / Created by unknown）のロジックを移植する
- [x] 2.7 Slackの`chat.unfurl` API呼び出しを実装し、`SlackApiClient`を置き換える
- [x] 2.8 全体を結線する: イベント内の全リンクに対する`unfurls`マップを構築し、1回の`chat.unfurl`リクエストとして送信する

## 3. キャッシュ層（unfurl-cache）

- [x] 3.1 `get(key)`/`set(key, info, ttl)`を持つKVベースのキャッシュモジュールを実装し、既存の1時間TTLの挙動に合わせる
- [x] 3.2 投稿用とコメント用で異なるキー接頭辞を使用し（既存の`comment-<id>` と `<post_number>` の使い分けに合わせる）、衝突を避ける
- [x] 3.3 `get_post`/`get_comment`にesa API呼び出し前のキャッシュ参照と、取得成功後のキャッシュ書き込みを組み込む

## 4. シークレットと設定

- [x] 4.1 `SLACK_OAUTH_ACCESS_TOKEN`と`ESA_ACCESS_TOKEN`を`wrangler secret put`でWorkerのシークレットとして設定する（`.dev.vars`の値を用いて本番シークレットとして登録済み）
- [x] 4.2 Heroku専用のファイルを削除する: `Procfile`, `app.json`, `.profile`, `Gemfile`, `Gemfile.lock`, `config.ru`, `main.rb`, `lib/*.rb`

## 5. ローカルでの動作確認

- [x] 5.1 `wrangler dev`でWorkerをローカル起動し、`url_verification`リクエストをシミュレートする（実機確認済み。加えて自動テスト`test/index.test.ts`でも検証）
- [x] 5.2 esa投稿URL・esaコメントURLに対するunfurlアタッチメント構築を確認する（実際のesa/Slackトークンがないため、`test/esaClient.test.ts`・`test/index.test.ts`でesa APIレスポンスをモックした自動テストとして検証。実トークンでの最終確認はリポジトリ管理者が[7章](#7-切り替え本リポジトリ外の手動作業)で実施）
- [x] 5.3 キャッシュのヒット/ミス挙動を確認する（`test/cache.test.ts`・`test/esaClient.test.ts`の自動テストで、TTL内の2回目の呼び出しでesa APIが呼ばれないことを検証）

## 6. デプロイ（カスタムドメイン利用、CI/CDは今回構築しない）

- [x] 6.1 `wrangler deploy`でWorkerをデプロイする（`https://kujaku.spookies.workers.dev` に本番デプロイ済み。`url_verification`応答を実機確認済み）
- [x] 6.2 カスタムドメインを設定する（当初検討していた`kujaku.spookies.co.jp`ではなく、既にCloudflareにゾーンが存在する`kujaku.spookies.tech`を採用。`wrangler.toml`の`[[routes]]`に設定し、`wrangler deploy`で有効化・実機確認済み）
- [x] 6.3 （スコープ外のため対応不要）CI/CDによる自動デプロイは今回のスコープでは構築しない。将来必要になった場合に別途検討する

## 7. 切り替え（本リポジトリ外の手動作業）

- [x] 7.1 （リポジトリ管理者）Slack App管理画面から実際の`url_verification`チャレンジを送信し、デプロイ済みWorkerが正しく応答することを確認する
- [x] 7.2 （リポジトリ管理者）Slack Appの Event Subscriptions の「Request URL」を新しいCloudflare Worker（カスタムドメイン）のURLに更新する
- [x] 7.3 （リポジトリ管理者）Slackに実際のesa URLを投稿し、unfurlがエンドツーエンドで正しく表示されることを確認する
- [x] 7.4 （リポジトリ管理者）切り替え直後の期間、エラーを監視する（[9章](#9-エラー監視sentry)のSentry導入により、未処理エラーが自動通知されるようになったため継続的な監視体制を確保）

## 8. Herokuの廃止

- [x] 8.1 （リポジトリ管理者）Heroku RedisおよびPapertrailのアドオンを削除する
- [x] 8.2 （リポジトリ管理者）Cloudflareデプロイの安定稼働を確認した後、Herokuアプリを削除または停止する
- [x] 8.3 `README.md`からHerokuの「Deploy」ボタンと無料枠終了の警告を削除し、代わりにCloudflareでのセットアップ手順を記載する

## 9. エラー監視（Sentry）

- [x] 9.1 `@sentry/cloudflare`を依存に追加し、`wrangler.toml`に`compatibility_flags = ["nodejs_compat"]`を設定する
- [x] 9.2 `src/index.ts`の`fetch`ハンドラを`Sentry.withSentry`でラップし、未処理エラーを自動捕捉する（esa API失敗時の無音スキップなど明示的なイベント送信は今回のスコープ外とし、未処理エラーのみを対象とした）
- [x] 9.3 `SENTRY_DSN`を`wrangler.toml`の`[vars]`に設定する（DSNは公開情報のため非シークレット）
- [x] 9.4 ローカル(`wrangler dev`)で不正なペイロードを送り例外を発生させ、Sentryダッシュボードにイベントが届くことを確認する
- [x] 9.5 本番へデプロイし、`url_verification`が壊れていないことを確認する
