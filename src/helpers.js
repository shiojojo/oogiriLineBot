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
  if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sourceGroupId)) {
    const groupSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sourceGroupId);
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
