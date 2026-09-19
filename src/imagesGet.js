/**
 * Append a Supabase (or other) public image URL to the 「画像」catalog sheet.
 * Call after local `pnpm upload:images` prints publicUrl.
 *
 * @param {string} publicUrl - HTTPS public URL of the image
 * @param {string} [label] - Optional display name for column A
 * @returns {number} row index written
 */
function appendImagePublicUrl(publicUrl, label) {
  if (typeof publicUrl !== 'string' || !/^https?:\/\//i.test(publicUrl.trim())) {
    throw new Error('appendImagePublicUrl: publicUrl must be an http(s) URL');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('画像');
  if (!sheet) {
    throw new Error('appendImagePublicUrl: sheet 「画像」 not found');
  }
  const url = publicUrl.trim();
  const name =
    (typeof label === 'string' && label.trim()) ||
    url.split('/').pop() ||
    'image';
  const nextRow = Math.max(2, sheet.getLastRow() + 1);
  sheet.getRange(nextRow, 1, 1, 3).setValues([
    [name, url, '=IMAGE(B' + nextRow + ')'],
  ]);
  return nextRow;
}
