/**
 * Monthly rebuild of spreadsheet「画像」with unanswered Storage URLs only.
 * Diff (Storage − answered topics) runs on tsukkomi; GAS only writes the result.
 *
 * Schedule: time-driven trigger on cronRebuildUnusedImageSheet (e.g. monthly).
 * Daily 「写真」 / image cron keep using getRandomFromSheet('画像', 2) — no API.
 *
 * Config:
 *   TSUKKOMI_API_ENDPOINT — https://host/api/line-ingest (path derived)
 *   TSUKKOMI_UNUSED_IMAGE_URLS_ENDPOINT — optional full override
 *   TSUKKOMI_API_KEY
 */

function resolveTsukkomiApiKey() {
  return getScriptConfig_('TSUKKOMI_API_KEY');
}

function resolveUnusedImageUrlsEndpoint() {
  const explicit = getScriptConfig_('TSUKKOMI_UNUSED_IMAGE_URLS_ENDPOINT');
  if (explicit) return explicit;

  const ingest = getScriptConfig_('TSUKKOMI_API_ENDPOINT');
  if (!ingest) return null;
  return String(ingest).replace(
    /\/api\/line-ingest\/?$/i,
    '/api/unused-image-urls',
  );
}

/**
 * @returns {{ ok: boolean, urls: string[], meta?: object, error?: string }}
 */
function fetchUnusedImageUrlsFromApi() {
  const endpoint = resolveUnusedImageUrlsEndpoint();
  const apiKey = resolveTsukkomiApiKey();
  if (!endpoint || !apiKey) {
    return {
      ok: false,
      urls: [],
      error: 'missing TSUKKOMI_API_ENDPOINT or TSUKKOMI_API_KEY',
    };
  }

  try {
    const response = UrlFetchApp.fetch(endpoint, {
      method: 'get',
      headers: { 'X-API-KEY': apiKey },
      muteHttpExceptions: true,
    });
    const status = response.getResponseCode();
    const body = response.getContentText();
    if (status < 200 || status >= 300) {
      return { ok: false, urls: [], error: 'HTTP ' + status + ': ' + body };
    }
    const json = JSON.parse(body);
    if (!json || !json.ok || !Array.isArray(json.urls)) {
      return {
        ok: false,
        urls: [],
        error: (json && json.error) || 'invalid response',
      };
    }
    return {
      ok: true,
      urls: json.urls.map(String),
      meta: {
        storageCount: json.storageCount,
        storageUniqueKeyCount: json.storageUniqueKeyCount,
        usedUrlCount: json.usedUrlCount != null ? json.usedUrlCount : json.answeredUrlCount,
        usedKeyCount: json.usedKeyCount,
        usedTopicCount: json.usedTopicCount != null ? json.usedTopicCount : json.answeredTopicCount,
        unusedCount: json.unusedCount,
        folders: json.folders,
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
  const result = fetchUnusedImageUrlsFromApi();
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
this.fetchUnusedImageUrlsFromApi = fetchUnusedImageUrlsFromApi;
