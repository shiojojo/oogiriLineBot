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
