# oogiriLineBot（GAS）

LINE 大喜利ボット。スプレッドシートをカタログ／回答台帳にし、回答は tsukkomi-v2 に同期する。

画像お題の正本は **Supabase Storage の公開 URL**（シート「画像」B列）。Google Drive 一覧は使わない。

## Script Properties（必須）

Apps Script → プロジェクトの設定 → **スクリプト プロパティ**。

| プロパティ | 用途 |
|------------|------|
| `CHANNEL_ACCESS_TOKEN` | LINE チャネルアクセストークン（push / reply 共用） |
| `LINE_USERID` | push 先のグループ ID（例: `C…`） |
| `TSUKKOMI_API_ENDPOINT` | `https://<host>/api/line-ingest` |
| `TSUKKOMI_API_KEY` | tsukkomi の `LINE_SYNC_API_KEY` と同じ |

任意:

| プロパティ | 用途 |
|------------|------|
| `TSUKKOMI_GROUP_SHEET` | 回答シート名（省略時は `LINE_USERID`） |
| `TSUKKOMI_UNUSED_IMAGE_URLS_ENDPOINT` | unused API のフル URL（省略時は ingest URL から導出） |
| `LINE_ENDPOINT` | LINE Push API URL（省略時は公式デフォルト） |
| `BOSYU_BUNSYOU` / `BOSYU_SYASHIN` | 「募集」返信の Forms URL（省略時は `secret.js` の定数） |

読み取りは `getScriptConfig_`（Properties 優先 → 同名グローバルのフォールバック）。

## トリガーに設定するもの（これだけ）

Apps Script → トリガー → 次の **4つ** を time-driven で登録する。

| 関数名 | 推奨頻度 | 役割 |
|--------|----------|------|
| `cronSyncTextTopicsToTsukkomi` | 数分おき | 回答を tsukkomi `/api/line-ingest` へ同期 |
| `linePush` | 任意（お題配信） | 「お題」シートからテキストお題を LINE に push（直前に同期） |
| `linePushImage` | 任意（写真配信） | 「画像」シートから未使用 URL をランダム pick → LINE に push（直前に同期） |
| `cronRebuildUnusedImageSheet` | 月1回など | 「画像」シートを unused API の結果で全置換 |

Web アプリとして公開している場合のエントリは従来どおり `doPost`（トリガーではなくデプロイ）。

## 手動実行してよいもの

| 関数名 | いつ使う |
|--------|----------|
| `rebuildUnusedImageSheet` | 月次の前に今すぐシートを作り直すとき（`cronRebuild…` と同じ本体） |
| `syncTextTopicAnswersToTsukkomi` | 同期だけ試すとき |
| `appendImagePublicUrl` | `pnpm upload:images` で得た `publicUrl` を「画像」に1行足すとき（エディタから呼ぶ／一時スクリプト） |

## トリガーに載せないもの（内部）

`OdaiMessage` / `OdaisyasinMessage` / `OdaiImage` / `OdaiMessageCron`、`fetchUnusedImageUrlsFromApi`、`kaitou` / `sendPushToLine` など。push／`doPost`／rebuild から呼ばれるだけ。

## 画像の流れ（現状）

1. 画像を `local-images/inbox/` に置き、tsukkomi-v2 で `pnpm upload:images`（Storage へ。成功後は `done/<hash>.ext` に移動）
2. 公開 URL を「画像」B列に載せる（手動なら `appendImagePublicUrl`、定期なら月次 rebuild）
3. 日次の「写真」／`linePushImage` はシートからランダム pick のみ（API は叩かない）
4. 回答が付いたお題は sync で topics になり、次の月次 rebuild でシートから落ちる

詳細 API は tsukkomi-v2 の `docs/image-upload.md` / `docs/line-sync.md`。
