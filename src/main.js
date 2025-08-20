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

function ColumLastRowPlusOne(sheet, colum) {
  // 列指定の最終行に一足した値を取得する。
  // 指定の列を配列として取得
  const columnVal = sheet.getRange(colum).getValues();
  //　空白を除いて、配列の数を取得して、１を加える
  const lastRowPlusOne = columnVal.filter(String).length + 1;

  return lastRowPlusOne;
}

function kaitou(sourceGroupId, sourceUserId, userMessage) {
  // 回答を保存する処理
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('回答');
  const lastRow = ColumLastRowPlusOne(sheet, 'C:C');
  const today = new Date();

  //グループで作成したシートが存在するならそのシートに記載する。
  const groupSheet = ss.getSheetByName(sourceGroupId);
  if (groupSheet) {
    const groupLastRow = ColumLastRowPlusOne(groupSheet, 'C:C');
    const GenzainoOdai = groupSheet.getRange(2, 6).getValue();

    //グループシートに情報を入力
    if (
      GenzainoOdai.includes('https://drive.usercontent.google.com/download')
    ) {
      groupSheet
        .getRange(groupLastRow, 1)
        .setFormula('=IMAGE("' + GenzainoOdai + '")');
      groupSheet.setRowHeight(groupLastRow, 120);
    } else {
      groupSheet.getRange(groupLastRow, 1).setValue(GenzainoOdai);
      groupSheet.setRowHeight(groupLastRow, 21);
    }
    groupSheet.getRange(groupLastRow, 2).setValue(userMessage);
    groupSheet.getRange(groupLastRow, 3).setValue(sourceUserId); // 非表示
    groupSheet
      .getRange(groupLastRow, 4)
      .setFormula('=VLOOKUP(C' + groupLastRow + ',$F$4:$G$8,2,false)');
    groupSheet.getRange(groupLastRow, 5).setValue(today);
  }
  //回答シートに記載
  sheet.getRange(lastRow, 1).setValue(sourceGroupId);
  sheet.getRange(lastRow, 3).setValue(sourceUserId);
  sheet.getRange(lastRow, 2).setValue(userMessage);
  sheet.getRange(lastRow, 4).setValue(today);
}

function doPost(e) {
  //送信するメッセージを作成

  // Jsonにパース
  const json = JSON.parse(e.postData.contents);

  // 送信されてきた情報を取得
  const userMessage = json.events[0].message.text;
  const sourceGroupId = json.events[0].source.groupId;
  const sourceUserId = json.events[0].source.userId;

  //var sourceGroupId = 'C86096a86ba1ccf8d7e91fbee7d39c607';
  //console.log(e);

  // 返信するためのトークンを取得
  const replyToken = json.events[0].replyToken;
  if (typeof replyToken === 'undefined') {
    return;
  }

  // 返信するメッセージを配列で用意
  let replyMessages;
  if (userMessage === 'お題') {
    //　お題とメッセージ来た時の処理

    const odai = OdaiMessage();
    setGroupOdaiValue(sourceGroupId, odai);
    replyMessages = [createTextMessage(odai)];
    sendReplyToLine(replyToken, replyMessages);
  } else if (userMessage === '写真') {
    //　写真とメッセージ来た時の処理
    const odaiMessage = '写真でひとこと';
    const odaiImage = OdaisyasinMessage();
    setGroupOdaiValue(sourceGroupId, odaiImage);
    replyMessages = [
      createTextMessage(odaiMessage),
      createTextMessage(odaiImage),
      createImageMessage(odaiImage),
    ];
    sendReplyToLine(replyToken, replyMessages);
  } else if (userMessage === '募集') {
    // 募集とメッセージ来た時の処理
    replyMessages = [
      createTextMessage(BOSYU_BUNSYOU),
      createTextMessage(BOSYU_SYASHIN),
    ];
    sendReplyToLine(replyToken, replyMessages);
  } else {
    kaitou(sourceGroupId, sourceUserId, userMessage);
  }
}

// reply/send implemented in helpers.js
