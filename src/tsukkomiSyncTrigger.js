/**
 * cronSyncTextTopicsToTsukkomi
 * Google Apps Script time-driven trigger entrypoint for syncing the latest topic answers
 * (text or image) to the tsukkomi v2 ingestion API.
 */

function getTsukkomiSyncConfig() {
  const props = PropertiesService.getScriptProperties();
  const endpoint =
    (typeof TSUKKOMI_API_ENDPOINT !== 'undefined' && TSUKKOMI_API_ENDPOINT) ||
    props.getProperty('TSUKKOMI_API_ENDPOINT');
  const apiKey =
    (typeof TSUKKOMI_API_KEY !== 'undefined' && TSUKKOMI_API_KEY) ||
    props.getProperty('TSUKKOMI_API_KEY');
  const groupSheetName =
    (typeof TSUKKOMI_GROUP_SHEET !== 'undefined' && TSUKKOMI_GROUP_SHEET) ||
    props.getProperty('TSUKKOMI_GROUP_SHEET') ||
    (typeof LINE_USERID !== 'undefined' && LINE_USERID) ||
    props.getProperty('LINE_USERID');
  return { endpoint, apiKey, groupSheetName, props };
}

function toIsoString(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    const dateFromNumber = new Date(value);
    if (!Number.isNaN(dateFromNumber.getTime())) {
      return dateFromNumber.toISOString();
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  return new Date().toISOString();
}

function extractImageUrlFromFormula(formula) {
  if (typeof formula !== 'string') return null;
  const match = formula.trim().match(/^=IMAGE\(("|')([^"']+)("|')/i);
  if (match && match[2]) {
    return match[2];
  }
  return null;
}

function resolveImageUrl(cellValue, formulaValue) {
  const fromFormula = extractImageUrlFromFormula(formulaValue);
  if (fromFormula) return fromFormula;
  if (typeof cellValue === 'string') {
    const trimmed = cellValue.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

function buildLatestTopicPayload(config, lastSyncedAnswerId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = config.groupSheetName;
  if (!sheetName) {
    Logger.log('buildLatestTopicPayload aborted: group sheet name missing');
    return null;
  }

  const groupSheet = ss.getSheetByName(sheetName);
  if (!groupSheet) {
    Logger.log('buildLatestTopicPayload: sheet not found ' + sheetName);
    return null;
  }

  const metaCol =
    typeof GROUP_META_ODAI_COL === 'number' ? GROUP_META_ODAI_COL : 8;
  const metaRange = groupSheet.getRange(2, metaCol);
  const currentOdaiFormula = metaRange.getFormula();
  const currentOdaiDisplay = String(metaRange.getDisplayValue() || '').trim();
  const currentImageUrl = resolveImageUrl(
    currentOdaiDisplay,
    currentOdaiFormula
  );
  const latestTopicKey = currentImageUrl || currentOdaiDisplay;

  if (!latestTopicKey) {
    Logger.log(
      'buildLatestTopicPayload: current odai empty on sheet ' + sheetName
    );
    return null;
  }

  const isImageTopic = /^https?:\/\//i.test(latestTopicKey);

  const lastRow = groupSheet.getLastRow();
  if (lastRow <= 2) return null;

  const rowCount = lastRow - 2;
  if (rowCount <= 0) return null;

  const range = groupSheet.getRange(3, 1, rowCount, 6);
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  const formulas = range.getFormulas();
  if (!values.length) return null;

  let idx = values.length - 1;
  while (idx >= 0) {
    const rowFormulaTopic = resolveImageUrl(
      displayValues[idx][0],
      formulas[idx][0]
    );
    const rowTopic =
      rowFormulaTopic || String(displayValues[idx][0] || '').trim();
    if (rowTopic === latestTopicKey) {
      break;
    }
    idx--;
  }
  if (idx < 0) return null;

  const answersDesc = [];
  while (idx >= 0) {
    const rowValues = values[idx];
    const rowDisplay = displayValues[idx];
    const rowFormulaTopic = resolveImageUrl(rowDisplay[0], formulas[idx][0]);
    const rowTopic = rowFormulaTopic || String(rowDisplay[0] || '').trim();

    if (rowTopic !== latestTopicKey) {
      break;
    }

    const answerIdRaw = rowValues[5];
    const textRaw = String(rowDisplay[1] || '').trim();
    const lineUserIdRaw = String(rowDisplay[2] || rowValues[2] || '').trim();
    if (!answerIdRaw || !textRaw || !lineUserIdRaw) {
      idx--;
      continue;
    }

    const displayNameRaw = String(rowDisplay[3] || '').trim();

    const answer = {
      answerId: String(answerIdRaw).trim(),
      text: textRaw,
      lineUserId: lineUserIdRaw,
      displayName:
        displayNameRaw && displayNameRaw !== '#N/A'
          ? displayNameRaw
          : undefined,
      groupId: sheetName,
      submittedAt: toIsoString(rowValues[4]),
    };

    answersDesc.push(answer);
    idx--;
  }

  if (!answersDesc.length) return null;
  answersDesc.reverse();

  if (lastSyncedAnswerId) {
    const lastIndex = answersDesc.findIndex(
      answer => answer.answerId === lastSyncedAnswerId
    );
    if (lastIndex >= 0) {
      answersDesc.splice(0, lastIndex + 1);
    }
  }

  if (!answersDesc.length) return null;

  const newestAnswerId = answersDesc[answersDesc.length - 1].answerId || null;
  const topicCreatedAt = answersDesc[0].submittedAt || new Date().toISOString();
  const sourceLabel = 'groupSheet:' + sheetName;
  const topicTitle = isImageTopic ? '写真でひとこと' : latestTopicKey;

  return {
    payload: {
      topic: isImageTopic
        ? {
            kind: 'image',
            title: topicTitle,
            createdAt: topicCreatedAt,
            sourceLabel,
            sourceImage: latestTopicKey,
            altText: '写真でひとこと',
          }
        : {
            kind: 'text',
            title: latestTopicKey,
            createdAt: topicCreatedAt,
            sourceLabel,
          },
      answers: answersDesc,
    },
    newestAnswerId,
  };
}

function syncTextTopicAnswersToTsukkomi() {
  const config = getTsukkomiSyncConfig();
  const { endpoint, apiKey, groupSheetName, props } = config;

  if (!endpoint || !apiKey) {
    Logger.log(
      'syncTextTopicAnswersToTsukkomi aborted: missing endpoint or API key'
    );
    return;
  }

  if (!groupSheetName) {
    Logger.log(
      'syncTextTopicAnswersToTsukkomi aborted: missing group sheet name'
    );
    return;
  }

  const lastSynced = props.getProperty('TSUKKOMI_LAST_SYNC_ANSWER_ID');
  const result = buildLatestTopicPayload(config, lastSynced);
  if (!result) {
    Logger.log('syncTextTopicAnswersToTsukkomi: no new topic answers to sync');
    return;
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-API-KEY': apiKey,
    },
    payload: JSON.stringify(result.payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(endpoint, options);
    const status = response.getResponseCode();
    const body = response.getContentText();
    Logger.log('tsukkomi ingest status ' + status + ' body ' + body);
    if (status >= 200 && status < 300) {
      if (result.newestAnswerId) {
        props.setProperty(
          'TSUKKOMI_LAST_SYNC_ANSWER_ID',
          result.newestAnswerId
        );
      }
    }
  } catch (error) {
    Logger.log('syncTextTopicAnswersToTsukkomi error: %s', error);
  }
}

function cronSyncTextTopicsToTsukkomi() {
  syncTextTopicAnswersToTsukkomi();
}

// Expose named functions to the global scope for GAS triggers.
this.cronSyncTextTopicsToTsukkomi = cronSyncTextTopicsToTsukkomi;
this.syncTextTopicAnswersToTsukkomi = syncTextTopicAnswersToTsukkomi;
