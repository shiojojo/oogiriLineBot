/**
 * Direct Supabase REST / Storage access for trusted GAS jobs.
 * Required Script Property: SUPABASE_SECRET_KEY (never log or expose it).
 */
function getSupabaseDirectConfig_() {
  const url =
    getScriptConfig_('SUPABASE_URL') ||
    (typeof SUPABASE_URL !== 'undefined' ? String(SUPABASE_URL) : '');
  const key = getScriptConfig_('SUPABASE_SECRET_KEY');
  if (!url || !key) {
    throw new Error('Supabase direct access requires SUPABASE_URL and SUPABASE_SECRET_KEY');
  }
  return { url: url.replace(/\/$/, ''), key };
}

function supabaseDirectRequest_(path, method, payload, prefer) {
  const config = getSupabaseDirectConfig_();
  const headers = {
    apikey: config.key,
    'Content-Type': 'application/json',
  };
  // Legacy service_role keys are JWTs. New sb_secret_ keys authenticate via apikey.
  if (!config.key.startsWith('sb_secret_')) {
    headers.Authorization = 'Bearer ' + config.key;
  }
  if (prefer) headers.Prefer = prefer;

  const options = {
    method: method.toLowerCase(),
    headers,
    muteHttpExceptions: true,
  };
  if (payload !== undefined) options.payload = JSON.stringify(payload);

  const response = UrlFetchApp.fetch(config.url + path, options);
  const status = response.getResponseCode();
  const text = response.getContentText();
  if (status < 200 || status >= 300) {
    // Supabase error bodies may echo submitted values; keep logs free of payload data.
    throw new Error('Supabase request failed with HTTP ' + status);
  }
  if (!text) return null;
  return JSON.parse(text);
}

function supabaseQueryValue_(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, function (char) {
    return '%' + char.charCodeAt(0).toString(16).toUpperCase();
  });
}

function supabasePublicStorageUrl_(storagePath) {
  const config = getSupabaseDirectConfig_();
  const bucket = getScriptConfig_('STORAGE_BUCKET', 'images');
  const encodedPath = storagePath
    .split('/')
    .map(function (segment) { return encodeURIComponent(segment); })
    .join('/');
  return config.url + '/storage/v1/object/public/' + encodeURIComponent(bucket) + '/' + encodedPath;
}

function storageObjectStem_(urlOrPath) {
  try {
    const raw = /^https?:\/\//i.test(urlOrPath)
      ? new URL(urlOrPath).pathname
      : String(urlOrPath);
    const base = raw.split('/').pop() || '';
    const stem = base.replace(/\.[a-z0-9]{2,5}$/i, '');
    return stem || null;
  } catch (_error) {
    return null;
  }
}

function listUsedImageKeysDirect_() {
  const keys = {};
  const urls = {};
  const topicIds = {};
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const rows = supabaseDirectRequest_(
      '/rest/v1/topics?select=id,image&image=not.is.null&order=id.asc&limit=' +
        pageSize + '&offset=' + offset,
      'get',
    ) || [];
    rows.forEach(function (row) {
      if (row.id != null) topicIds[String(row.id)] = true;
      if (typeof row.image !== 'string') return;
      const imageUrl = row.image.trim();
      if (!/^https?:\/\//i.test(imageUrl)) return;
      urls[imageUrl] = true;
      const key = storageObjectStem_(imageUrl);
      if (key) keys[key] = true;
    });
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return {
    keys,
    urls,
    usedTopicCount: Object.keys(topicIds).length,
  };
}

function listStorageFilesDirect_(folder, bucket) {
  const paths = [];
  const pageSize = 100;
  let offset = 0;
  const prefix = String(folder || '').replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');

  for (;;) {
    const rows = supabaseDirectRequest_(
      '/storage/v1/object/list/' + encodeURIComponent(bucket),
      'post',
      {
        prefix,
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      },
    ) || [];
    rows.forEach(function (item) {
      // Storage list may include virtual folders; only file entries have an id.
      if (!item.name || item.id == null) return;
      paths.push(prefix ? prefix + '/' + item.name : item.name);
    });
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return paths;
}

function listUnusedImageUrlsDirect_() {
  const bucket = getScriptConfig_('STORAGE_BUCKET', 'images');
  const primaryFolder = getScriptConfig_('STORAGE_FOLDER', 'line-sync')
    .replace(/\/+/g, '/')
    .replace(/^\//, '')
    .replace(/\/$/, '');
  const extraFolders = getScriptConfig_('STORAGE_EXTRA_FOLDERS', '')
    .split(',')
    .map(function (folder) { return folder.trim().replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, ''); })
    .filter(Boolean);
  const folders = Array.from(new Set([primaryFolder].concat(extraFolders)));
  const used = listUsedImageKeysDirect_();
  let paths = [];
  folders.forEach(function (folder) {
    paths = paths.concat(listStorageFilesDirect_(folder, bucket));
  });

  const bestPathByKey = {};
  paths.forEach(function (path) {
    const key = storageObjectStem_(path);
    if (!key) return;
    const previous = bestPathByKey[key];
    if (!previous) {
      bestPathByKey[key] = path;
      return;
    }
    const previousPrimary = previous.indexOf(primaryFolder + '/') === 0;
    const pathPrimary = path.indexOf(primaryFolder + '/') === 0;
    if ((pathPrimary && !previousPrimary) ||
        (pathPrimary === previousPrimary && path.length < previous.length)) {
      bestPathByKey[key] = path;
    }
  });

  const urls = [];
  Object.keys(bestPathByKey).forEach(function (key) {
    if (!used.keys[key]) urls.push(supabasePublicStorageUrl_(bestPathByKey[key]));
  });

  return {
    urls,
    storageCount: paths.length,
    storageUniqueKeyCount: Object.keys(bestPathByKey).length,
    answeredUrlCount: Object.keys(used.urls).length,
    usedUrlCount: Object.keys(used.urls).length,
    usedKeyCount: Object.keys(used.keys).length,
    usedTopicCount: used.usedTopicCount,
    unusedCount: urls.length,
    folders,
  };
}

function normalizeLineAnswerTextDirect_(text) {
  return String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
}

function ownStorageImagePathDirect_(imageUrl) {
  const config = getSupabaseDirectConfig_();
  const bucket = getScriptConfig_('STORAGE_BUCKET', 'images');
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch (_error) {
    throw new Error('Image topic URL must be a valid URL');
  }
  const expected = new URL(config.url);
  const prefix = '/storage/v1/object/public/' + bucket + '/';
  if (parsed.host !== expected.host || parsed.protocol !== 'https:' || !parsed.pathname.startsWith(prefix)) {
    throw new Error('Image topic URL must be this project\'s public Storage URL');
  }
  return decodeURIComponent(parsed.pathname.slice(prefix.length));
}

function validateLineSyncPayloadDirect_(payload) {
  if (!payload || !payload.topic || !Array.isArray(payload.answers) ||
      payload.answers.length < 1 || payload.answers.length > 200) {
    throw new Error('Invalid LINE sync payload');
  }
  const topic = payload.topic;
  if (topic.kind === 'image') {
    if (!topic.image || !/^https?:\/\//i.test(topic.image)) throw new Error('Image topic requires image URL');
    ownStorageImagePathDirect_(topic.image);
    if (topic.title && String(topic.title).length > 300) throw new Error('Topic title is too long');
  } else {
    if (!String(topic.title || '').trim() || String(topic.title).length > 300) throw new Error('Invalid topic title');
  }
  payload.answers.forEach(function (answer) {
    if (!answer || !String(answer.text || '').trim() || String(answer.text).length > 1000 ||
        !String(answer.lineUserId || '').trim() || String(answer.lineUserId).length > 200 ||
        (answer.answerId && String(answer.answerId).length > 120) ||
        (answer.displayName && String(answer.displayName).length > 120)) {
      throw new Error('Invalid LINE answer payload');
    }
    [answer.submittedAt, topic.createdAt].forEach(function (value) {
      if (value != null && isNaN(new Date(value).getTime())) throw new Error('Invalid timestamp');
    });
  });
}

function findDirect_(table, query) {
  const rows = supabaseDirectRequest_('/rest/v1/' + table + '?' + query, 'get') || [];
  return rows.length ? rows[0] : null;
}

function insertDirect_(table, row) {
  const rows = supabaseDirectRequest_('/rest/v1/' + table, 'post', row, 'return=representation') || [];
  if (!rows.length) throw new Error('Supabase insert returned no row for ' + table);
  return rows[0];
}

function ingestLineAnswersDirect(payload) {
  validateLineSyncPayloadDirect_(payload);
  const topic = payload.topic;
  const createdAt = topic.createdAt ? new Date(topic.createdAt).toISOString() : new Date().toISOString();
  let topicId;
  let createdTopic = false;
  let uploadedImagePath = null;

  if (topic.kind === 'image') {
    uploadedImagePath = ownStorageImagePathDirect_(topic.image);
    const imageFilter = 'eq.' + supabaseQueryValue_(topic.image);
    const existing = findDirect_('topics', 'select=id,image&image=' + imageFilter + '&order=created_at.desc&limit=1');
    if (existing) {
      topicId = Number(existing.id);
    } else {
      const inserted = insertDirect_('topics', {
        title: String(topic.title || '写真').trim() || '写真',
        image: topic.image,
        created_at: createdAt,
      });
      topicId = Number(inserted.id);
      createdTopic = true;
    }
  } else {
    const title = String(topic.title).trim();
    const existing = findDirect_('topics',
      'select=id,title&title=eq.' + supabaseQueryValue_(title) + '&image=is.null&order=created_at.desc&limit=1');
    if (existing) {
      topicId = Number(existing.id);
    } else {
      const inserted = insertDirect_('topics', { title, created_at: createdAt });
      topicId = Number(inserted.id);
      createdTopic = true;
    }
  }
  if (!Number.isFinite(topicId)) throw new Error('Failed to resolve Supabase topic id');

  const preferredNames = {};
  const lineIds = {};
  payload.answers.forEach(function (answer) {
    const lineId = String(answer.lineUserId).trim();
    lineIds[lineId] = true;
    if (answer.displayName && String(answer.displayName).trim()) {
      preferredNames[lineId] = String(answer.displayName).trim();
    }
  });

  const profileIds = {};
  let createdProfiles = 0;
  let updatedProfiles = 0;
  Object.keys(lineIds).forEach(function (lineId) {
    const existing = findDirect_('profiles',
      'select=id,name&line_id=eq.' + supabaseQueryValue_(lineId) + '&order=created_at.asc&limit=1');
    const displayName = preferredNames[lineId] || '名無し';
    if (existing && existing.id) {
      profileIds[lineId] = String(existing.id);
      if (displayName !== existing.name) {
        supabaseDirectRequest_(
          '/rest/v1/profiles?id=eq.' + supabaseQueryValue_(existing.id),
          'patch',
          { name: displayName },
          'return=minimal',
        );
        updatedProfiles += 1;
      }
    } else {
      const inserted = insertDirect_('profiles', { name: displayName, line_id: lineId });
      profileIds[lineId] = String(inserted.id);
      createdProfiles += 1;
    }
  });

  const existingKeys = {};
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const rows = supabaseDirectRequest_(
      '/rest/v1/answers?select=profile_id,text&topic_id=eq.' + topicId +
        '&limit=' + pageSize + '&offset=' + offset,
      'get',
    ) || [];
    rows.forEach(function (row) {
      existingKeys[String(row.profile_id || '') + '::' + normalizeLineAnswerTextDirect_(row.text)] = true;
    });
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const rowsToInsert = [];
  let skipped = 0;
  payload.answers.forEach(function (answer) {
    const profileId = profileIds[String(answer.lineUserId).trim()];
    const text = normalizeLineAnswerTextDirect_(answer.text);
    if (!profileId || !text) {
      skipped += 1;
      return;
    }
    const key = profileId + '::' + text;
    if (existingKeys[key]) {
      skipped += 1;
      return;
    }
    existingKeys[key] = true;
    rowsToInsert.push({
      topic_id: topicId,
      profile_id: profileId,
      text,
      created_at: answer.submittedAt ? new Date(answer.submittedAt).toISOString() : createdAt,
    });
  });

  if (rowsToInsert.length) {
    supabaseDirectRequest_('/rest/v1/answers', 'post', rowsToInsert, 'return=minimal');
  }

  return {
    topicId,
    inserted: rowsToInsert.length,
    skipped,
    createdTopic,
    totalReceived: payload.answers.length,
    createdProfiles,
    updatedProfiles,
    uploadedImagePath,
  };
}

/** Read-only connectivity check. Logs counts only, never image URLs or keys. */
function testSupabaseDirectConnection() {
  const result = listUnusedImageUrlsDirect_();
  Logger.log(
    'testSupabaseDirectConnection: PASS ' +
      JSON.stringify({
        storageCount: result.storageCount,
        usedTopicCount: result.usedTopicCount,
        unusedCount: result.unusedCount,
        folders: result.folders,
      }),
  );
  return true;
}

this.listUnusedImageUrlsDirect_ = listUnusedImageUrlsDirect_;
this.ingestLineAnswersDirect = ingestLineAnswersDirect;
this.testSupabaseDirectConnection = testSupabaseDirectConnection;
