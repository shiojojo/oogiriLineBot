//var CHANNEL_ACCESS_TOKEN = '';  // LINE Bot のアクセストークン
//var BOSYU_BUNSYOU = '';　　　　　// 　お題シート
//var BOSYU_SYASHIN = '';　　　　　//　写真シート
// HTTP: reply/send helpers are in src/helpers.js

function OdaiMessage() {
  return getRandomFromSheet('お題', 2);
}

function OdaisyasinMessage() {
  return getRandomFromSheet('画像', 2);
}
// Helper functions moved to src/helpers.js

function ColumLastRowPlusOne(sheet) {
  // シート全体の最終行 + 1 を返す（ヘッダ 1 行想定）。
  // getLastRow は空行が途中にあっても一番下の使用行を返すため
  // 途中の空行を再利用しないポリシーであれば衝突リスクを減らせる。
  return sheet.getLastRow() + 1;
}

function kaitou(sourceGroupId, sourceUserId, userMessage, replyToken) {
  // ロックによる待ち時間が LINE Webhook タイムアウトを誘発するケースがあるため
  // appendRow の原子的追加性を利用してロックレス運用へ変更。
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const answerSheet = ss.getSheetByName('回答');
  const now = new Date();
  const failSheet =
    ss.getSheetByName('FAILED_BUFFER') || ss.insertSheet('FAILED_BUFFER');

  // 確実性向上: 一意な回答IDを生成 (時刻 + ランダム 4桁)
  const answerId =
    'A_' +
    now.getTime().toString(36) +
    '_' +
    Math.floor(Math.random() * 0xffff).toString(16);

  /**
   * 安定 append: 競合/一時エラー時に短時間リトライ。成功判定は直近数行に ID が存在するか。
   */
  function reliableAppend(sheet, rowValues, idIndexFrom1) {
    const MAX_RETRY = 5;
    const SLEEP_MS = 80; // 0.08s x 5 ≒ 0.4s 以内
    let attempt = 0;
    while (attempt < MAX_RETRY) {
      try {
        sheet.appendRow(rowValues);
        SpreadsheetApp.flush();
        // 直近 20 行を走査し ID の存在確認
        const lastRow = sheet.getLastRow();
        const start = Math.max(1, lastRow - 19); // 20 行以内
        const rng = sheet
          .getRange(start, idIndexFrom1, lastRow - start + 1, 1)
          .getValues();
        const found = rng.some(r => r[0] === rowValues[idIndexFrom1 - 1]);
        if (found) return true;
      } catch (err) {
        // 続行して再試行
      }
      attempt++;
      Utilities.sleep(SLEEP_MS);
    }
    return false;
  }

  // グループシート（存在すれば）への追記
  const groupSheet = ss.getSheetByName(sourceGroupId);
  let groupOk = true;
  if (groupSheet) {
    try {
      const odai = groupSheet.getRange(2, GROUP_META_ODAI_COL).getValue();
      const isImage =
        typeof odai === 'string' &&
        odai.indexOf('https://drive.usercontent.google.com/download') === 0;

      // 1回の appendRow で基本列を書き込む（D列の VLOOKUP は行番号確定後に設定）
      const firstCell = isImage ? '=IMAGE("' + odai + '")' : odai;
      groupSheet.appendRow([
        firstCell,
        userMessage,
        sourceUserId,
        '',
        now,
        answerId,
      ]);
      const newRow = groupSheet.getLastRow();
      // 行高さ調整 & VLOOKUP 設定
      groupSheet.setRowHeight(newRow, isImage ? 120 : 21);
      groupSheet
        .getRange(newRow, 4)
        .setFormula('=VLOOKUP(C' + newRow + ',$H$4:$I$8,2,false)');
    } catch (e) {
      groupOk = false;
    }
  }

  // 回答シート: CSV 例より "お題, 回答, 回答者ID, 回答者(名前), (予備), 現在のお題(or Group)" 形式を想定。
  // '現在のお題' は回答時点のお題を再度残す/GroupId を残すなど運用差異があるため末尾に groupId を入れる。
  // 表示名は別途バッチ or VLOOKUP で補完できるよう空文字をプレースホルダ。
  var currentOdai = '';
  if (!groupSheet) {
    // グループシートが無い場合は空欄 (個別/1:1 チャットなど)
  } else {
    currentOdai = groupSheet.getRange(2, GROUP_META_ODAI_COL).getValue();
  }
  // 回答シート列: A お題 / B 回答 / C 回答者ID / D 回答者名 / E 時刻 / F グループID / G 回答ID
  const answerRowValues = [
    currentOdai,
    userMessage,
    sourceUserId,
    '',
    now,
    sourceGroupId,
    answerId,
  ];

  const ok = reliableAppend(answerSheet, answerRowValues, 7);
  if (!ok) {
    // 失敗時は FAIL バッファに raw 保存 (後でリカバリ可能)
    failSheet.appendRow([
      new Date(),
      'append_failed',
      JSON.stringify({
        sourceGroupId,
        sourceUserId,
        userMessage,
        answerId,
      }),
    ]);
  }

  // どちらか失敗時にユーザーへ通知（回答が消えたと誤解されないよう）
  if ((!ok || !groupOk) && replyToken) {
    try {
      sendReplyToLine(replyToken, [
        createTextMessage(
          '書き込みに失敗しました。少し待って再送してください。ID: ' + answerId
        ),
      ]);
    } catch (e) {
      // 通知失敗は黙殺（これ以上リトライしない）
    }
  }
}

function doPost(e) {
  // LINE から複数イベントが同一リクエストで届く場合 (短時間連投) に対応
  const json = JSON.parse(e.postData.contents);
  const events = json.events || [];
  for (var i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!ev || ev.type !== 'message') continue;
    if (!ev.message || ev.message.type !== 'text') continue; // テキスト以外は無視

    const userMessage = ev.message.text;
    const replyToken = ev.replyToken; // 各イベントごとに異なる
    const source = ev.source || {};
    const sourceGroupId = source.groupId || source.roomId || source.userId; // グループ/ルーム/1:1 fallback
    const sourceUserId = source.userId || '';

    // コマンド判定
    if (userMessage === 'お題') {
      const odai = OdaiMessage();
      setGroupOdaiValue(sourceGroupId, odai);
      sendReplyToLine(replyToken, [createTextMessage(odai)]);
      continue;
    }
    if (userMessage === '写真') {
      const odaiMessage = '写真でひとこと';
      const odaiImage = OdaisyasinMessage();
      setGroupOdaiValue(sourceGroupId, odaiImage);
      sendReplyToLine(replyToken, [
        createTextMessage(odaiMessage),
        createTextMessage(odaiImage),
        createImageMessage(odaiImage),
      ]);
      continue;
    }
    if (userMessage === '募集') {
      sendReplyToLine(replyToken, [
        createTextMessage(BOSYU_BUNSYOU),
        createTextMessage(BOSYU_SYASHIN),
      ]);
      continue;
    }

    // 通常回答
    kaitou(sourceGroupId, sourceUserId, userMessage, replyToken);
  }
}

// reply/send implemented in helpers.js
