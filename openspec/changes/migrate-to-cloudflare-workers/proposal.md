## Why

Heroku が無料枠を終了する（Heroku Redis の無料アドオンを含む）ため、現在 Heroku の無料 Ruby dyno と Heroku Redis アドオンでキャッシュを行っている Kujaku は、有料プランへの移行を迫られる前にホスティング先を変更する必要がある。今回は移行先として Cloudflare を選ぶ。Cloudflare Workers は Ruby をネイティブ実行できないため、TypeScript/JavaScript による全面書き換えとなる。

## What Changes

- **BREAKING**: Sinatra/Ruby アプリケーション（`main.rb`, `lib/esa_client.rb`, `lib/slack_api_client.rb`, `lib/cache.rb`）を TypeScript による Cloudflare Worker として書き換える。既存と同じ Slack の `url_verification` および `event_callback`（リンク展開）イベントを処理する。
- **BREAKING**: Redis/Firestore の二重キャッシュ機構を、単一の Workers KV namespace に置き換える（TTLベース、既存の1時間の有効期限を踏襲）。
- Heroku固有の成果物を削除: `Procfile`, `app.json`（HerokuのDeployボタン・アドオン設定）, `.profile`（Google認証情報ファイルの書き出し）, `Gemfile`/`Gemfile.lock`, `config.ru`
- Cloudflare固有のプロジェクトファイルを追加: `wrangler.toml`/`wrangler.jsonc`, `package.json`, TypeScript設定, KV namespaceバインディング
- シークレット（`SLACK_OAUTH_ACCESS_TOKEN`, `ESA_ACCESS_TOKEN`）を Heroku の config vars から Cloudflare Worker のシークレット（`wrangler secret put`）へ移行
- Papertrail アドオンを Cloudflare 標準のロギング（Workers Logs / `wrangler tail`）に置き換える。Papertrail は Heroku アドオンであり Cloudflare に直接の相当物がないため。
- **カスタムドメインを利用する**（`workers.dev` のデフォルトサブドメインではなく、Cloudflareに追加したカスタムドメイン/DNSでWorkerを公開する）
- CI/CD の自動デプロイは今回のスコープに含めない。デプロイは `wrangler deploy` を手動実行する
- Slack App の Event Subscriptions の Request URL を、新しい Cloudflare Workers のエンドポイントに更新する（このリポジトリの外で行う手動作業）

## Capabilities

### New Capabilities
- `esa-url-unfurl`: Slack Events API のコールバックを受け取り、esa.ioの投稿/コメントURLを検出してesa APIから内容を取得し、Slackの`chat.unfurl`でレスポンスを返す。既存のRubyの挙動をCloudflare Workersランタイム上で再実装する。
- `unfurl-cache`: 同一URLの短時間repeated unfurlによるesaのレート制限を避けるため、esa APIの検索結果を投稿/コメント単位でCloudflare Workers KVに1時間キャッシュする。

### Modified Capabilities
（なし — `openspec/specs/` に既存エントリがないため、本アプリの既存機能をゼロから仕様化するグリーンフィールド扱い）

## Impact

- **コード**: アプリケーション全体をRubyからTypeScriptへ書き換え。`lib/`配下と`main.rb`/`config.ru`はすべて置き換え。
- **実行環境/ホスティング**: Herokuのdyno → Cloudflare Workers（V8 isolate、エッジ実行）。
- **データ/キャッシュ**: Heroku Redisアドオン および/または Google Cloud Firestore → Cloudflare Workers KV。既存のキャッシュ内容は移行しない（短TTLのため安全に再構築される）。
- **シークレット/設定**: Herokuのconfig vars → Cloudflare Workerのシークレットおよび`wrangler.toml`の変数。
- **ロギング**: Papertrailアドオン → Cloudflare Workers Logs。
- **外部連携**: Slack Appの設定を新しいWorker URLに更新する必要がある（本リポジトリ外の手動作業）。
- **依存関係**: `google-cloud-firestore`, `redis`, `sinatra`, `puma`, `esa` のRuby gemを廃止。Slack/esaへのHTTP呼び出し用に新たなnpm依存関係を導入する（もしくは`fetch`を直接利用する。詳細はdesign.mdで決定）。
- **デプロイ**: 今回はCI/CDを構築せず、`wrangler deploy`を手動実行する。
