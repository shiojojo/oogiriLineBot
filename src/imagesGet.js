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
