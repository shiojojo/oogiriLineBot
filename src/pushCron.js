function OdaiMessageCron() {
  // お題のラスト行を取得
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('お題');
  var lastRow = sheet.getLastRow();
  //2行目～最終行の間で、ランダムな行番号を算出する
  // const row = Math.floor(Math.random() * (lastRow - 1)) + 2;
  const row = Math.ceil(Math.random() * (lastRow - 1)) + 1;
  //ランダムに算出した行番号のタイトルとURLを取得
  var OdaiMessage = sheet.getRange(row, 2).getValue();

  return OdaiMessage;
}

function linePush(e) {
  var odai = OdaiMessageCron();
  if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LINE_USERID)) {
    var groupSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LINE_USERID);
    groupSheet.getRange(2, 6).setValue(odai);
  }
  lineReply('お題');
  lineReply(odai);
}

// LINEへの応答
function lineReply(replyText) {
  const headers = {
    Authorization: 'Bearer ' + LINE_TOKEN,
    'Content-type': 'application/json',
  };
  const messages = {
    headers: headers,
    to: LINE_USERID,
    messages: [
      {
        type: 'text',
        text: replyText,
      },
    ],
  };
  const options = {
    headers: headers,
    payload: JSON.stringify(messages),
  };

  UrlFetchApp.fetch(LINE_ENDPOINT, options);
}
