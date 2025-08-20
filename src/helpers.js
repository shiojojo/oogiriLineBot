// Helper functions extracted from main.js
// These are defined in the global scope so Google Apps Script can call them from other files.

function getRandomFromSheet(sheetName, colIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return '';
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return '';
  const row = Math.ceil(Math.random() * (lastRow - 1)) + 1; // between 2..lastRow
  return sheet.getRange(row, colIndex).getValue();
}

function setGroupOdaiValue(sourceGroupId, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupSheet = ss.getSheetByName(sourceGroupId);
  if (groupSheet) {
    groupSheet.getRange(2, 6).setValue(value);
  }
}

function createTextMessage(text) {
  return { type: 'text', text: text };
}

function createImageMessage(url) {
  return {
    type: 'image',
    originalContentUrl: url,
    previewImageUrl: url,
  };
}

// Send a push message to a single user/group using the LINE Push API.
// - to: string (userId or groupId)
// - messages: array of message objects (same shape as reply messages)
function sendPushToLine(to, messages) {
  if (!Array.isArray(messages) || messages.length === 0) return;
  if (typeof LINE_TOKEN === 'undefined' || !LINE_TOKEN) {
    Logger.log('sendPushToLine aborted: LINE_TOKEN is not set');
    return;
  }

  const payload = {
    to: to,
    messages: messages,
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + LINE_TOKEN,
    },
    payload: JSON.stringify(payload),
  };

  try {
    UrlFetchApp.fetch(
      typeof LINE_ENDPOINT !== 'undefined' && LINE_ENDPOINT
        ? LINE_ENDPOINT
        : 'https://api.line.me/v2/bot/message/push',
      options
    );
  } catch (err) {
    Logger.log(
      'sendPushToLine error: ' + (err && err.message ? err.message : err)
    );
  }
}

// Send a reply message using replyToken (LINE Reply API)
// - replyToken: string
// - messages: array of message objects
function sendReplyToLine(replyToken, messages) {
  if (!Array.isArray(messages) || messages.length === 0) return;
  if (typeof CHANNEL_ACCESS_TOKEN === 'undefined' || !CHANNEL_ACCESS_TOKEN) {
    Logger.log('sendReplyToLine aborted: CHANNEL_ACCESS_TOKEN is not set');
    return;
  }

  const endpoint = 'https://api.line.me/v2/bot/message/reply';
  const payload = JSON.stringify({
    replyToken: replyToken,
    messages: messages,
  });

  try {
    UrlFetchApp.fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN,
      },
      method: 'post',
      payload: payload,
    });
  } catch (err) {
    Logger.log(
      'sendReplyToLine error: ' + (err && err.message ? err.message : err)
    );
  }
}
