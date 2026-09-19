// Helper functions extracted from main.js
// These are defined in the global scope so Google Apps Script can call them from other files.

/**
 * Script Properties 優先。未設定時のみ同名グローバル（secret.js の残り）を見る。
 * @param {string} key
 * @param {string} [defaultValue]
 * @returns {string}
 */
function getScriptConfig_(key, defaultValue) {
  const fromProps = PropertiesService.getScriptProperties().getProperty(key);
  if (fromProps != null && String(fromProps).trim() !== '') {
    return String(fromProps).trim();
  }

  let fromGlobal = '';
  switch (key) {
    case 'CHANNEL_ACCESS_TOKEN':
      fromGlobal =
        typeof CHANNEL_ACCESS_TOKEN !== 'undefined' ? CHANNEL_ACCESS_TOKEN : '';
      break;
    case 'LINE_USERID':
      fromGlobal = typeof LINE_USERID !== 'undefined' ? LINE_USERID : '';
      break;
    case 'LINE_ENDPOINT':
      fromGlobal = typeof LINE_ENDPOINT !== 'undefined' ? LINE_ENDPOINT : '';
      break;
    case 'TSUKKOMI_API_KEY':
      fromGlobal =
        typeof TSUKKOMI_API_KEY !== 'undefined' ? TSUKKOMI_API_KEY : '';
      break;
    case 'TSUKKOMI_API_ENDPOINT':
      fromGlobal =
        typeof TSUKKOMI_API_ENDPOINT !== 'undefined' ? TSUKKOMI_API_ENDPOINT : '';
      break;
    case 'TSUKKOMI_GROUP_SHEET':
      fromGlobal =
        typeof TSUKKOMI_GROUP_SHEET !== 'undefined' ? TSUKKOMI_GROUP_SHEET : '';
      break;
    case 'TSUKKOMI_UNUSED_IMAGE_URLS_ENDPOINT':
      fromGlobal =
        typeof TSUKKOMI_UNUSED_IMAGE_URLS_ENDPOINT !== 'undefined'
          ? TSUKKOMI_UNUSED_IMAGE_URLS_ENDPOINT
          : '';
      break;
    case 'BOSYU_BUNSYOU':
      fromGlobal = typeof BOSYU_BUNSYOU !== 'undefined' ? BOSYU_BUNSYOU : '';
      break;
    case 'BOSYU_SYASHIN':
      fromGlobal = typeof BOSYU_SYASHIN !== 'undefined' ? BOSYU_SYASHIN : '';
      break;
    default:
      fromGlobal = '';
  }

  if (fromGlobal != null && String(fromGlobal).trim() !== '') {
    return String(fromGlobal).trim();
  }
  return defaultValue != null ? String(defaultValue) : '';
}

function getRandomFromSheet(sheetName, colIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return '';
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return '';
  const row = Math.ceil(Math.random() * (lastRow - 1)) + 1; // between 2..lastRow
  return sheet.getRange(row, colIndex).getValue();
}

// Column shift: 現在のお題 を H 列(8列目) に配置 (以前は F 列(6))
var GROUP_META_ODAI_COL = 8;
function setGroupOdaiValue(sourceGroupId, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groupSheet = ss.getSheetByName(sourceGroupId);
  if (groupSheet) {
    groupSheet.getRange(2, GROUP_META_ODAI_COL).setValue(value);
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

// Execute a critical section with a document-level lock to avoid concurrent
// writes clobbering the same spreadsheet rows. waitLock up to 5s; if it fails
// it will throw and upstream can decide how to handle (LINE will usually retry).
function withDocumentLock(fn) {
  const lock = LockService.getDocumentLock();
  // Wait up to 5 seconds for other executions (cron / replies) to finish.
  lock.waitLock(5000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// Export to global scope for other files.
this.withDocumentLock = withDocumentLock;
this.getScriptConfig_ = getScriptConfig_;

// Send a push message to a single user/group using the LINE Push API.
// - to: string (userId or groupId)
// - messages: array of message objects (same shape as reply messages)
function sendPushToLine(to, messages) {
  if (!Array.isArray(messages) || messages.length === 0) return;
  const token = getScriptConfig_('CHANNEL_ACCESS_TOKEN');
  if (!token) {
    Logger.log('sendPushToLine aborted: CHANNEL_ACCESS_TOKEN is not set');
    return;
  }

  const payload = {
    to: to,
    messages: messages,
  };

  const endpoint = getScriptConfig_(
    'LINE_ENDPOINT',
    'https://api.line.me/v2/bot/message/push',
  );

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
    },
    payload: JSON.stringify(payload),
  };

  try {
    UrlFetchApp.fetch(endpoint, options);
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
  const token = getScriptConfig_('CHANNEL_ACCESS_TOKEN');
  if (!token) {
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
        Authorization: 'Bearer ' + token,
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
