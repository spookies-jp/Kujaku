# unfurl-cache

## Purpose

esa投稿・コメントのunfurl結果をWorkers KVにキャッシュし、同一の投稿・コメントに対する短時間内の再unfurlでesa APIへの呼び出しを避けることで、レスポンス速度とesa APIのレート制限への配慮を両立させる機能。

## Requirements

### Requirement: esa投稿検索結果のKVキャッシュ
Workerは、esa投稿に対して構築したunfurl情報を、投稿番号から導出したキーでWorkers KVに1時間の有効期限でキャッシュし、有効なキャッシュエントリが存在する場合はesa APIを呼び出す代わりにそのキャッシュ値を返さなければならない(SHALL)。

#### Scenario: 投稿の初回unfurl
- **WHEN** esa投稿URLがunfurlされ、その投稿番号に対するキャッシュエントリが存在しないとき
- **THEN** Workerはesa APIを呼び出し、結果のunfurl情報をその投稿のキャッシュキーでTTL1時間としてKVに保存し、それを返す

#### Scenario: TTL内での同一投稿の再unfurl
- **WHEN** キャッシュエントリの有効期限が切れる前に、同じesa投稿URLが再度unfurlされたとき
- **THEN** Workerはキャッシュされたunfurl情報を返し、esa APIを呼び出さない

#### Scenario: TTL経過後の同一投稿の再unfurl
- **WHEN** キャッシュエントリの有効期限が切れた後に、同じesa投稿URLが再度unfurlされたとき
- **THEN** Workerは再度esa APIを呼び出し、キャッシュエントリを更新する

### Requirement: esaコメント検索結果のKVキャッシュ
Workerは、esaコメントに対して構築したunfurl情報を、コメント番号から導出した（投稿のキャッシュキーとは区別される）キーでWorkers KVに1時間の有効期限でキャッシュし、有効なキャッシュエントリが存在する場合はesa APIを呼び出す代わりにそのキャッシュ値を返さなければならない(SHALL)。

#### Scenario: コメントの初回unfurl
- **WHEN** esaコメントURLがunfurlされ、そのコメント番号に対するキャッシュエントリが存在しないとき
- **THEN** Workerはesa APIを呼び出し、結果のunfurl情報をそのコメントのキャッシュキーでTTL1時間としてKVに保存し、それを返す

#### Scenario: TTL内での同一コメントの再unfurl
- **WHEN** キャッシュエントリの有効期限が切れる前に、同じesaコメントURLが再度unfurlされたとき
- **THEN** Workerはキャッシュされたunfurl情報を返し、esa APIを呼び出さない

#### Scenario: 投稿キャッシュとコメントキャッシュが衝突しない
- **WHEN** 投稿とそのコメントの一つが、数値として同じ`post_number`/`comment_number`の値を持つとき
- **THEN** それぞれのキャッシュエントリは異なるキーで保存され、互いに上書きしない
