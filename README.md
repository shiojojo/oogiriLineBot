# oogiriLineBot（GAS）

LINE 大喜利ボット。スプレッドシートをカタログ／回答台帳にし、回答は tsukkomi-v2 に同期する。

画像お題の正本は **Supabase Storage の公開 URL**（シート「画像」B列）。Google Drive 一覧は使わない。

## Script Properties（必須）

Apps Script → プロジェクトの設定 → **スクリプト プロパティ**。

| プロパティ | 用途 |
|------------|------|
| `CHANNEL_ACCESS_TOKEN` | LINE チャネルアクセストークン（push / reply 共用） |
| `LINE_USERID` | push 先のグループ ID（例: `C…`） |
| `SUPABASE_SECRET_KEY` | Supabase server-side secret key（GAS Script Propertiesにのみ保存） |

任意:

| プロパティ | 用途 |
|------------|------|
| `TSUKKOMI_GROUP_SHEET` | 回答シート名（省略時は `LINE_USERID`） |
| `SUPABASE_URL` | Supabase project URL（省略時は `src/secret/secret.js` の公開URLを使用） |
| `STORAGE_BUCKET` | 画像Storage bucket（省略時は `images`） |
| `STORAGE_FOLDER` | 主画像フォルダー（省略時は `line-sync`） |
| `STORAGE_EXTRA_FOLDERS` | 追加で一覧するフォルダー（カンマ区切り、省略可） |
| `LINE_ENDPOINT` | LINE Push API URL（省略時は公式デフォルト） |
| `BOSYU_BUNSYOU` / `BOSYU_SYASHIN` | 「募集」返信の Forms URL（省略時は `secret.js` の定数） |

読み取りは `getScriptConfig_`（Properties 優先 → 同名グローバルのフォールバック）。

## トリガーに設定するもの（これだけ）

Apps Script → トリガー → 次の **4つ** を time-driven で登録する。

| 関数名 | 推奨頻度 | 役割 |
|--------|----------|------|
| `cronSyncTextTopicsToTsukkomi` | 数分おき | 回答をSupabaseへ直接同期 |
| `linePush` | 任意（お題配信） | 「お題」シートからテキストお題を LINE に push（直前に同期） |
| `linePushImage` | 任意（写真配信） | 「画像」シートから未使用 URL をランダム pick → LINE に push（直前に同期） |
| `cronRebuildUnusedImageSheet` | 月1回など | Supabase Storageとtopicsを直接照合し、「画像」シートを全置換 |

Web アプリとして公開している場合のエントリは従来どおり `doPost`（トリガーではなくデプロイ）。

## 手動実行してよいもの

| 関数名 | いつ使う |
|--------|----------|
| `rebuildUnusedImageSheet` | 月次の前に今すぐシートを作り直すとき（`cronRebuild…` と同じ本体） |
| `syncTextTopicAnswersToTsukkomi` | 同期だけ試すとき |
| `appendImagePublicUrl` | `pnpm upload:images` で得た `publicUrl` を「画像」に1行足すとき（エディタから呼ぶ／一時スクリプト） |

## トリガーに載せないもの（内部）

`OdaiMessage` / `OdaisyasinMessage` / `OdaiImage` / `OdaiMessageCron`、`fetchUnusedImageUrlsFromSupabase`、`kaitou` / `sendPushToLine` など。push／`doPost`／rebuild から呼ばれるだけ。

## Supabase直接接続の設定

1. Apps Scriptの「プロジェクトの設定」→「スクリプト プロパティ」に`SUPABASE_SECRET_KEY`を登録する。
2. `SUPABASE_URL` が `.env.local` の `VITE_SUPABASE_URL` と同じSupabase projectを指していることを確認する。
3. `SUPABASE_SECRET_KEY`はコード、シート、ログに書かない。`testScriptConfig`は値の内容を出力せず、設定済みかだけを確認する。
4. 必要に応じて`STORAGE_BUCKET`、`STORAGE_FOLDER`、`STORAGE_EXTRA_FOLDERS`を設定する。
5. `testScriptConfig`を実行し、必須設定を確認する。
6. `testSupabaseDirectConnection`を実行し、画像URLをログに出さずに読み取り接続と件数を確認する。
7. `rebuildUnusedImageSheet`を手動実行し、画像シートの結果を確認する。
8. `testLineSyncPreflight`を実行する。既存の画像URL・トピック・プロフィール検索と入力検証を確認し、DBへは書き込まない。
9. LINE同期はテスト用お題・回答で`syncTextTopicAnswersToTsukkomi`を実行し、DBへの書き込みと再実行時の重複防止を確認する。

VercelのLINE APIは不要になり、tsukkomi-v2から削除済み。旧Script Properties（`TSUKKOMI_API_ENDPOINT`、`TSUKKOMI_API_KEY`、`TSUKKOMI_UNUSED_IMAGE_URLS_ENDPOINT`と日付付きの退避名）が残っていれば、現在のGASコードでは参照されないため削除できる。`TSUKKOMI_LAST_SYNC_ANSWER_ID`は同期位置として現在も使用するので削除しない。`clasp push`ではScript Propertiesは変更されない。

GASはSupabaseのREST APIとStorage APIを直接呼び出す。LINE同期の管理キーは強い権限を持つため、Apps Scriptの編集権限も自分だけに限定し、漏洩時はSupabaseでキーをローテーションする。

## 画像の流れ（直接接続）

1. 画像を `local-images/inbox/` に置き、tsukkomi-v2 で `pnpm upload:images`（Storage へ。成功後は `done/<hash>.ext` に移動）
2. 公開 URL を「画像」B列に載せる（手動なら `appendImagePublicUrl`、定期なら月次 rebuild）
3. 日次の「写真」／`linePushImage` はシートからランダム pick のみ（API は叩かない）
4. 回答が付いたお題はsyncでtopicsになり、次の月次rebuildがSupabaseから直接取得してシートから落とす

LINE botの同期と画像一覧はGASからSupabaseへ直接接続する。tsukkomi-v2のVercel APIルートは削除済み。
