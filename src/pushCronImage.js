function OdaiImage() {
  // お題のラスト行を取得
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('画像');
  const lastRow = sheet.getLastRow();
  //2行目～最終行の間で、ランダムな行番号を算出する
  // const row = Math.floor(Math.random() * (lastRow - 1)) + 2;
  const row = Math.ceil(Math.random() * (lastRow - 1)) + 1;
  //ランダムに算出した行番号のタイトルとURLを取得
  const OdaiImageMessage = sheet.getRange(row, 2).getValue();

  return OdaiImageMessage;
}

function linePushImage(e) {
  const odaiImage = OdaiImage();
  if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LINE_USERID)) {
    const groupSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LINE_USERID);
    groupSheet.getRange(2, 6).setValue(odaiImage);
  }
  lineReply('写真でひとこと');
  lineImageReply(odaiImage);
}

// LINEへの応答
function lineImageReply(replyImage) {
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
        text: replyImage,
      },
      {
        type: 'image',
        originalContentUrl: replyImage,
        previewImageUrl: replyImage,
      },
    ],
  };
  const options = {
    headers: headers,
    payload: JSON.stringify(messages),
  };

  UrlFetchApp.fetch(LINE_ENDPOINT, options);
}
