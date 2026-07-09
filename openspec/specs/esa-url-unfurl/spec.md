# esa-url-unfurl

## Purpose

Slack上で共有されたesaの投稿・コメントURLを検出し、esa APIから取得した内容をもとにSlackのunfurlアタッチメントを構築して返す機能。SlackのEvents API（`event_callback`）を経由してリンク共有イベントを受け取り、esaチームのURLパターンに一致するリンクのみを処理し、結果を`chat.unfurl`で一括送信する。

## Requirements

### Requirement: SlackのURL検証ハンドシェイク
Workerは、`type: "url_verification"`を含むSlack Events APIのリクエストを受け取った場合、受信した`challenge`の値をJSONでそのまま返さなければならない(SHALL)。

#### Scenario: Slackが検証チャレンジを送信する
- **WHEN** Workerが`{"type": "url_verification", "challenge": "<token>"}`というボディのPOSTリクエストを受信したとき
- **THEN** Workerは`{"challenge": "<token>"}`というJSONを応答する

### Requirement: esa投稿URLのunfurl
Workerは、`event.links`を含む`event_callback`イベントに対して、各リンクURLを`https://<ESA_TEAM_NAME>.esa.io/posts/<post_number>`のパターン（`#comment-<n>`のフラグメントを含まないもの）と照合し、一致した場合はesa APIから該当の投稿を取得してSlackのunfurlアタッチメントを構築しなければならない(SHALL)。

#### Scenario: 単一のesa投稿URLが共有される
- **WHEN** `event_callback`イベントの`links`に`https://myteam.esa.io/posts/123`が含まれるとき
- **THEN** Workerはesa APIから投稿`123`を取得し、そのURLに対して、タイトルを`post['full_name']`、タイトルリンクを`post['url']`、投稿者名/アイコンを`post['created_by']`から、本文を`ESA_MAX_ARTICLE_LINES`行に切り詰めて`&#35;`/`&#47;`をアンエスケープしたもの、フッターを`Updated by <name>`（無ければ`Created by <name>`、それも無ければ`Created by unknown`）、タイムスタンプを`post['updated_at']`とするunfurlアタッチメントを含める

#### Scenario: WIP投稿が共有される
- **WHEN** 一致したesa投稿が`wip: true`であるとき
- **THEN** unfurlアタッチメントのタイトルの先頭に`[WIP] `が付与される

#### Scenario: esa投稿が存在しない
- **WHEN** 一致した投稿番号に対してesa APIが投稿を返さないとき
- **THEN** WorkerはそのURLに対するunfurlエントリを省略する（リクエスト全体をエラーにしない）

### Requirement: esaコメントURLのunfurl
Workerは、各リンクURLを`https://<ESA_TEAM_NAME>.esa.io/posts/<post_number>#comment-<comment_number>`のパターンと照合し、一致した場合はesa APIから該当のコメントを取得してSlackのunfurlアタッチメントを構築しなければならない(SHALL)。

#### Scenario: 単一のesaコメントURLが共有される
- **WHEN** `event_callback`イベントの`links`に`https://myteam.esa.io/posts/123#comment-456`が含まれるとき
- **THEN** Workerはesa APIから投稿`123`（コメント込み）を取得し、コメント`456`を特定し、タイトルを`<投稿のfull_name> へのコメント`、タイトルリンクを`comment['url']`、投稿者名/アイコンを`comment['created_by']`から、本文を`ESA_MAX_COMMENT_LINES`行に切り詰めて`&#35;`/`&#47;`をアンエスケープしたもの、フッターを`Updated by <name>`/`Created by <name>`/`Created by unknown`、タイムスタンプを`comment['updated_at']`とするunfurlアタッチメントを含める

#### Scenario: コメントが投稿のコメント一覧に含まれていない
- **WHEN** 指定されたコメント番号が、取得した投稿の`comments`配列に存在しないとき
- **THEN** Workerはunfurlを構築する前に、そのコメントをコメント番号でesa APIから直接取得する

#### Scenario: コメントが存在しない
- **WHEN** （投稿のコメント一覧からの検索、直接取得のいずれでも）一致したコメント番号に対してesa APIがコメントを返さないとき
- **THEN** WorkerはそのURLに対するunfurlエントリを省略する

### Requirement: 一致しないリンクは無視する
`event.links`内のリンクのうち、設定された`ESA_TEAM_NAME`のesa投稿/コメントURLパターンに一致しないものは無視し、unfurlエントリを生成してはならない(SHALL)。

#### Scenario: 異なるesaチームや非esaドメインのリンクが共有される
- **WHEN** `event_callback`イベントの`links`に`https://<ESA_TEAM_NAME>.esa.io/posts/...`に一致しないURLが含まれるとき
- **THEN** WorkerはそのURLに対してesa APIを呼び出さず、unfurlエントリも生成しない

### Requirement: Slackへのunfurl一括送信
`event_callback`イベント内のすべてのリンクを処理した後、Workerはイベントの`channel`と`message_ts`（`ts`として）を用いて、結果となるすべてのunfurlを1回のSlack `chat.unfurl` APIリクエストにまとめて送信しなければならない(SHALL)。

#### Scenario: 1つのメッセージに複数のesaリンクが含まれる
- **WHEN** `event_callback`イベントの`links`に一致する2つのesa URLが含まれるとき
- **THEN** Workerは、元のURLをキーとした両方のunfurlアタッチメントを含む1回の`chat.unfurl`リクエストを、そのイベントの`channel`と`message_ts`を使って送信する
