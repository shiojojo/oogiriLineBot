/**
 * @deprecated Prefer uploading via tsukkomi-v2 POST /api/upload-image and
 * writing the returned publicUrl into the 「画像」sheet (see appendImagePublicUrl).
 * Drive is no longer the intended source of truth for LINE image odai.
 */
function getFileListInFolder() {
  var url = DRIVE_FOLDER_URL,
    paths = url.split('/'),
    folderId = paths.pop(),
    folder = DriveApp.getFolderById(folderId),
    files = folder.getFiles(),
    list = [],
    rowIndex = 2, //2列目から
    colIndex = 1,
    ss,
    sheet,
    range,
    sheetName = '画像',
    currentRange,
    file;
  // 　console.log(files)
  while (files.hasNext()) {
    file = files.next();
    var imageUrl = file.getUrl();
    imageUrl = imageUrl.replace('file/d/', 'download?id=');
    imageUrl = imageUrl.replace('/view?usp=drivesdk', '');
    imageUrl = imageUrl.replace(
      'drive.google.com',
      'drive.usercontent.google.com'
    );

    // A列, B列, C列のデータをまとめる
    list.push([
      file.getName(), // A列: ファイル名
      imageUrl, // B列: 画像URL
      `=IMAGE(B${rowIndex + list.length})`, // C列: 数式
    ]);
    // list.push([file.getName(), imageUrl]);
  }

  ss = SpreadsheetApp.getActive();
  sheet = ss.getSheetByName(sheetName);
  // A列、B列、C列にデータを一括設定
  range = sheet.getRange(rowIndex, colIndex, list.length, 3); // 3列分の範囲を指定
  range.setValues(list);
  // range = sheet.getRange(rowIndex, colIndex, list.length, list[0].length);
  // range.setValues(list);
}

/**
 * Append a Supabase (or other) public image URL to the 「画像」catalog sheet.
 * Call after POST /api/upload-image returns publicUrl.
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
