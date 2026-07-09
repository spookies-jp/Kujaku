![logo](logo.png)

Slackに貼られたesaのURLを展開するSlack Appです。

## 構成

Cloudflare Workers（TypeScript）上で動作します。esa APIの検索結果は、短時間に同一のesa URLがUnfurlされた場合にesaのAPIを叩きすぎてRateLimitedにならないよう、Cloudflare Workers KVに1時間キャッシュします。

## セットアップ

1. 依存パッケージをインストールする
   ```sh
   npm install
   ```
2. KV namespaceを作成し、発行された `id` を `wrangler.toml` の `UNFURL_CACHE` に設定する
   ```sh
   npx wrangler kv namespace create kujaku-unfurl-cache
   ```
3. `wrangler.toml` の `[vars]` に `ESA_TEAM_NAME` などを設定する
4. ローカル開発用に `.dev.vars.example` を `.dev.vars` としてコピーし、`SLACK_OAUTH_ACCESS_TOKEN` / `ESA_ACCESS_TOKEN` を設定する（`.dev.vars` はコミットしない）
   ```sh
   npx wrangler dev
   ```
5. 本番用のシークレットを設定する
   ```sh
   npx wrangler secret put SLACK_OAUTH_ACCESS_TOKEN
   npx wrangler secret put ESA_ACCESS_TOKEN
   ```
6. カスタムドメインで公開する場合は、Cloudflareアカウントにドメインのゾーンを追加し、`wrangler.toml` の `routes` を設定する
7. デプロイする
   ```sh
   npx wrangler deploy
   ```
8. Slack Appの Event Subscriptions の Request URL を、デプロイ先のURLに設定する

## LICENSE
[MIT](LICENSE)

## Note
Icon made by Freepik from [www.flaticon.com](https://www.flaticon.com)
