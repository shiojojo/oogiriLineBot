//var CHANNEL_ACCESS_TOKEN = '';  // LINE Bot のアクセストークン
//var BOSYU_BUNSYOU = '';　　　　　// 　お題シート
//var BOSYU_SYASHIN = '';　　　　　//　写真シート
//　HTTPリクエスト　POST
var linePost = 'https://api.line.me/v2/bot/message/reply';

function OdaiMessage() {
  // お題のラスト行を取得
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('お題');
  var lastRow = sheet.getLastRow();
  //2行目～最終行の間で、ランダムな行番号を算出する
  var row = Math.ceil(Math.random() * (lastRow - 1)) + 1;
  //ランダムに算出した行番号のタイトルとURLを取得
  var OdaiMessage = sheet.getRange(row, 2).getValue();

  return OdaiMessage;
}

function OdaisyasinMessage() {
  // お題のラスト行を取得
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('画像');
  var lastRow = sheet.getLastRow();
  //2行目～最終行の間で、ランダムな行番号を算出する
  var row = Math.ceil(Math.random() * (lastRow - 1)) + 1;
  //ランダムに算出した行番号のタイトルとURLを取得
  var OdaiSyasinMessage = sheet.getRange(row, 2).getValue();

  return OdaiSyasinMessage;
}

function ColumLastRowPlusOne(sheet, colum) {
  // 列指定の最終行に一足した値を取得する。
  // 指定の列を配列として取得
  var columnVal = sheet.getRange(colum).getValues();
  //　空白を除いて、配列の数を取得して、１を加える
  var lastRowPlusOne = columnVal.filter(String).length + 1;

  return lastRowPlusOne;
}

function kaitou(sourceGroupId, sourceUserId, userMessage) {
  // 回答を保存する処理
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('回答');
  var lastRow = ColumLastRowPlusOne(sheet, 'C:C');
  var today = new Date();

  if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sourceGroupId)) {
    //グループで作成したシートが存在するならそのシートに記載する。
    var groupSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sourceGroupId);
    var groupLastRow = ColumLastRowPlusOne(groupSheet, 'C:C');
    var GenzainoOdai = groupSheet.getRange(2, 6).getValue();

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
  var json = JSON.parse(e.postData.contents);
  console.log(json);

  // 送信されてきた情報を取得
  var userMessage = json.events[0].message.text;
  var sourceGroupId = json.events[0].source.groupId;
  var sourceUserId = json.events[0].source.userId;

  //var sourceGroupId = 'C86096a86ba1ccf8d7e91fbee7d39c607';
  //console.log(e);

  // 返信するためのトークンを取得
  var replyToken = json.events[0].replyToken;
  if (typeof replyToken === 'undefined') {
    return;
  }

  // 返信するメッセージを配列で用意
  var replyMessages;
  if (userMessage === 'お題') {
    //　お題とメッセージ来た時の処理

    var odai = OdaiMessage();
    if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sourceGroupId)) {
      var groupSheet =
        SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sourceGroupId);
      groupSheet.getRange(2, 6).setValue(odai);
    }
    replyMessages = [{ type: 'text', text: odai }];
    postToLine(replyToken, replyMessages);
  } else if (userMessage === '写真') {
    //　写真とメッセージ来た時の処理
    var odaiMessage = '写真でひとこと';
    var odaiImage = OdaisyasinMessage();
    if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sourceGroupId)) {
      var groupSheet =
        SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sourceGroupId);
      groupSheet.getRange(2, 6).setValue(odaiImage);
    }

    replyMessages = [
      { type: 'text', text: odaiMessage },
      { type: 'text', text: odaiImage },
      {
        type: 'image',
        originalContentUrl: odaiImage,
        previewImageUrl: odaiImage,
      },
    ];
    //sheet.getRange("A1").setValue(OdaisyasinMessage());
    postToLine(replyToken, replyMessages);
  } else if (userMessage === '募集') {
    // 募集とメッセージ来た時の処理
    replyMessages = [
      { type: 'text', text: BOSYU_BUNSYOU },
      { type: 'text', text: BOSYU_SYASHIN },
    ];
    //sheet.getRange("A1").setValue(OdaiSyasinMessage());
    postToLine(replyToken, replyMessages);
  } else {
    kaitou(sourceGroupId, sourceUserId, userMessage);
  }
}

function postToLine(replyToken, messages) {
  // メッセージをLINEに送信
  UrlFetchApp.fetch(linePost, {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    method: 'post',
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: messages,
    }),
  });
  // return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}
