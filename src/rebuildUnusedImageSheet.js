/**
 * Monthly rebuild of spreadsheet「画像」with unanswered Storage URLs only.
 * GAS reads Storage and topics directly from Supabase, then writes the result.
 *
 * Schedule: time-driven trigger on cronRebuildUnusedImageSheet (e.g. monthly).
 * Daily 「写真」 / image cron keep using getRandomFromSheet('画像', 2) — no API.
 *
 * Config:
 *   SUPABASE_SECRET_KEY — stored in Script Properties
 */

/**
 * @returns {{ ok: boolean, urls: string[], meta?: object, error?: string }}
 */
function fetchUnusedImageUrlsFromSupabase() {
  try {
    const result = listUnusedImageUrlsDirect_();
    return {
      ok: true,
      urls: result.urls.map(String),
      meta: {
        storageCount: result.storageCount,
        storageUniqueKeyCount: result.storageUniqueKeyCount,
        usedUrlCount: result.usedUrlCount,
        usedKeyCount: result.usedKeyCount,
        usedTopicCount: result.usedTopicCount,
        unusedCount: result.unusedCount,
        folders: result.folders,
      },
    };
  } catch (error) {
    return { ok: false, urls: [], error: String(error.message || error) };
  }
}

/**
 * Replace「画像」sheet rows 2+ with unused URLs in one batch write.
 * On fetch failure, leaves the sheet unchanged.
 */
function rebuildUnusedImageSheet() {
  const result = fetchUnusedImageUrlsFromSupabase();
  if (!result.ok) {
    Logger.log('rebuildUnusedImageSheet aborted: ' + result.error);
    throw new Error('rebuildUnusedImageSheet: ' + result.error);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('画像');
  if (!sheet) {
    throw new Error('rebuildUnusedImageSheet: sheet 「画像」 not found');
  }

  const urls = result.urls;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, Math.max(3, sheet.getLastColumn())).clearContent();
  }

  if (!urls.length) {
    Logger.log(
      'rebuildUnusedImageSheet: 0 unused URLs (storage=' +
        (result.meta && result.meta.storageCount) +
        ' usedTopics=' +
        (result.meta && result.meta.usedTopicCount) +
        ')',
    );
    return 0;
  }

  const rows = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const name = url.split('/').pop() || 'image';
    const rowIndex = i + 2;
    rows.push([name, url, '=IMAGE(B' + rowIndex + ')']);
  }

  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  Logger.log(
    'rebuildUnusedImageSheet: wrote ' +
      rows.length +
      ' rows (storageObjects=' +
      (result.meta && result.meta.storageCount) +
      ' uniqueKeys=' +
      (result.meta && result.meta.storageUniqueKeyCount) +
      ' usedTopics=' +
      (result.meta && result.meta.usedTopicCount) +
      ' usedKeys=' +
      (result.meta && result.meta.usedKeyCount) +
      ' folders=' +
      JSON.stringify((result.meta && result.meta.folders) || []) +
      ')',
  );
  return rows.length;
}

/** Time-driven trigger entrypoint (e.g. monthly). */
function cronRebuildUnusedImageSheet() {
  rebuildUnusedImageSheet();
}

this.rebuildUnusedImageSheet = rebuildUnusedImageSheet;
this.cronRebuildUnusedImageSheet = cronRebuildUnusedImageSheet;
this.fetchUnusedImageUrlsFromSupabase = fetchUnusedImageUrlsFromSupabase;
