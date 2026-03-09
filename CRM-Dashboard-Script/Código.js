// ============================================================
// DCAC CRM Dashboard - Code.gs v6 — CACHE POR USUARIO + WARM-UP
//
// FLUJO:
//   1. runImport.gs termina → llama warmUpAllUsersCache()
//   2. warmUpAllUsersCache() procesa y cachea el dashboard de cada usuario
//   3. Cuando el usuario entra → getDashboardData() devuelve desde cache (~1s)
//   4. refreshUserFromMetabase() invalida el cache de ese usuario
//
// LÍMITE DE CACHE GAS: 100KB por key.
//   Con 50-150 filas × 40 cols el payload es ~15-45KB → entra perfecto.
//   Para payloads > 90KB se guarda automáticamente en chunks.
// ============================================================

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('deCampoACampo - CRM Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================================================
// LOGIN
// ============================================================
function login(email, password) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('usuarios');
    var data = sheet.getDataRange().getValues().slice(1);
    var searchEmail = email.toLowerCase().trim();

    for (var i = 0; i < data.length; i++) {
      var dbEmail = String(data[i][0] || '').toLowerCase().trim();
      var dbPass  = String(data[i][1] || '').trim();
      if (dbEmail === searchEmail && dbPass === password) {
        var userIdStr = String(data[i][3] || '').replace(/[^0-9]/g, '');
        if (!userIdStr) return { success: false, error: 'ID inválido en base de datos.' };
        return { success: true, userId: userIdStr, name: String(data[i][2] || dbEmail.split('@')[0]).trim(), email: dbEmail };
      }
      var adminEmail = String(data[i][5] || '').toLowerCase().trim();
      var adminPass  = String(data[i][6] || '').trim();
      if (adminEmail !== '' && adminEmail === searchEmail && adminPass === password) {
        return { success: true, userId: '0', name: String(data[i][2] || 'Administrador').trim(), email: adminEmail, isAdmin: true };
      }
    }
    return { success: false, error: 'Credenciales incorrectas.' };
  } catch (e) {
    return { success: false, error: 'Error en login: ' + e.toString() };
  }
}

// ============================================================
// GET DASHBOARD DATA — cache primero, sino procesa y guarda
// ============================================================
function getDashboardData(userId) {
  var t0 = new Date().getTime();

  // Intentar desde cache
  var fromCache = getCachedDashboard(userId);
  if (fromCache) {
    fromCache.fromCache = true;
    Logger.log('getDashboardData CACHE HIT userId:' + userId + ' en ' + (new Date().getTime() - t0) + 'ms');
    return fromCache;
  }

  // Cache miss: procesar
  Logger.log('getDashboardData CACHE MISS userId:' + userId);
  var result = _buildDashboardData(userId);
  if (result.success) saveCachedDashboard(userId, result);
  Logger.log('getDashboardData PROCESADO userId:' + userId + ' en ' + (new Date().getTime() - t0) + 'ms');
  return result;
}

// ============================================================
// WARM-UP — llamar al final de runImport.gs
// Precalcula y cachea el dashboard de TODOS los usuarios
// así cuando entren ya está listo (~1s en vez de ~15s)
// ============================================================
function warmUpAllUsersCache() {
  var t0 = new Date().getTime();
  Logger.log('warmUpAllUsersCache: iniciando...');

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('usuarios');
  if (!sheet) { Logger.log('warmUpAllUsersCache: hoja usuarios no encontrada'); return; }

  // Recolectar IDs únicos de todos los usuarios
  var data = sheet.getDataRange().getValues().slice(1);
  var ids = [], seen = {};
  for (var i = 0; i < data.length; i++) {
    var uid = String(data[i][3] || '').replace(/[^0-9]/g, '');
    if (uid && !seen[uid]) { seen[uid] = true; ids.push(uid); }
  }

  Logger.log('warmUpAllUsersCache: ' + ids.length + ' usuarios');

  // Procesar cada usuario
  var ok = 0, err = 0;
  for (var j = 0; j < ids.length; j++) {
    try {
      var result = _buildDashboardData(ids[j]);
      if (result.success) { saveCachedDashboard(ids[j], result); ok++; }
      else { err++; Logger.log('warmUp sin datos userId ' + ids[j] + ': ' + result.error); }
    } catch(e) {
      err++;
      Logger.log('warmUp error userId ' + ids[j] + ': ' + e.toString());
    }
  }

  Logger.log('warmUpAllUsersCache: ok=' + ok + ' err=' + err + ' en ' + (new Date().getTime() - t0) + 'ms');
}

// ============================================================
// CACHE HELPERS — maneja chunks para payloads > 90KB
// ============================================================
var CACHE_TTL    = 82800; // 23hs — se invalida antes del próximo import diario
var CACHE_CHUNK  = 90 * 1024; // 90KB por chunk (límite GAS es 100KB)

function saveCachedDashboard(userId, result) {
  try {
    var cache = CacheService.getScriptCache();
    var json  = JSON.stringify(result);

    if (json.length <= CACHE_CHUNK) {
      // Entra en una sola key
      cache.put('dash_' + userId, json, CACHE_TTL);
      cache.put('dash_n_' + userId, '1', CACHE_TTL);
    } else {
      // Partir en chunks
      var n      = Math.ceil(json.length / CACHE_CHUNK);
      var batch  = {};
      for (var i = 0; i < n; i++) {
        batch['dash_' + userId + '_' + i] = json.substring(i * CACHE_CHUNK, (i + 1) * CACHE_CHUNK);
      }
      batch['dash_n_' + userId] = String(n);
      cache.putAll(batch, CACHE_TTL);
    }
  } catch(e) {
    Logger.log('saveCachedDashboard error userId ' + userId + ': ' + e.toString());
  }
}

function getCachedDashboard(userId) {
  try {
    var cache = CacheService.getScriptCache();
    var n     = cache.get('dash_n_' + userId);
    if (!n) return null;

    if (n === '1') {
      var json = cache.get('dash_' + userId);
      return json ? JSON.parse(json) : null;
    }

    // Reconstruir desde chunks
    var parts = [];
    for (var i = 0; i < parseInt(n); i++) {
      var part = cache.get('dash_' + userId + '_' + i);
      if (!part) return null; // chunk expiró — forzar re-proceso
      parts.push(part);
    }
    return JSON.parse(parts.join(''));
  } catch(e) {
    Logger.log('getCachedDashboard error userId ' + userId + ': ' + e.toString());
    return null;
  }
}

function invalidateUserCache(userId) {
  try {
    var cache = CacheService.getScriptCache();
    var n     = cache.get('dash_n_' + userId);
    var keys  = ['dash_n_' + userId, 'dash_' + userId];
    if (n && parseInt(n) > 1) {
      for (var i = 0; i < parseInt(n); i++) keys.push('dash_' + userId + '_' + i);
    }
    cache.removeAll(keys);
  } catch(e) {}
}

// ============================================================
// CORE — procesa el dashboard completo de un usuario
// ============================================================
function _buildDashboardData(userId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var importSheet = ss.getSheetByName('import');
    if (!importSheet) return { success: false, error: 'Hoja "import" no encontrada.' };

    var lastRow = importSheet.getLastRow();
    if (lastRow < 2) return { success: false, error: 'La hoja "import" está vacía.' };

    var IMPORT_COLS   = 31;
    var importData    = importSheet.getRange(1, 1, lastRow, IMPORT_COLS).getValues();
    var importHeaders = importData[0].map(function(h){ return String(h).trim().toLowerCase(); });
    var allImportRows = importData.slice(1);

    // Índice ID
    var idIdx = importHeaders.indexOf('id_asociado_comercial');
    if (idIdx === -1) idIdx = importHeaders.indexOf('asociado_comercial_id');
    if (idIdx === -1) idIdx = 4;

    // Filtrar por usuario
    var filteredRows;
    if (userId === '0' || userId === 0) {
      filteredRows = allImportRows;
    } else {
      var cleanId = String(userId).replace(/[^0-9]/g, '');
      filteredRows = allImportRows.filter(function(row) {
        var val = String(row[idIdx] || '').replace(/[^0-9]/g, '');
        return val !== '' && val === cleanId;
      });
    }

    if (filteredRows.length === 0) {
      return { success: false, error: 'Sin datos para este usuario (ID: ' + userId + ').' };
    }

    // Auxiliares cacheadas
    var baseClaveMap = getBaseClaveData(ss);
    var creditMaps   = getCreditPerformanceData(ss);
    var sacMap       = getSACData(ss);
    var dcpMap       = getDCPData(ss);

    var nowTs = new Date().getTime();
    var hLen  = importHeaders.length;
    var rows  = new Array(filteredRows.length);

    for (var r = 0; r < filteredRows.length; r++) {
      var baseObj = mapImportRow(filteredRows[r], importHeaders, hLen);
      rows[r] = buildRowObject(baseObj, baseClaveMap, creditMaps, sacMap, dcpMap, nowTs);
    }

    rows.sort(function(a, b) {
      return (parseFloat(b['Q total OP']) || 0) - (parseFloat(a['Q total OP']) || 0);
    });

    var headers    = buildHeaders();
    var importTime = '';
    try { importTime = String(getImportTimestamp(ss) || ''); } catch(e2) {}

    return {
      success   : true,
      h         : headers,
      d         : rowsToArrays(rows, headers),
      total     : rows.length,
      importTime: importTime
    };

  } catch (e) {
    Logger.log('Error _buildDashboardData userId ' + userId + ': ' + e.toString());
    return { success: false, error: 'Error: ' + e.toString() };
  }
}

// ── Mapeo rápido fila → objeto
function mapImportRow(row, headers, hLen) {
  var obj = {};
  for (var c = 0; c < hLen; c++) {
    var val = row[c];
    obj[headers[c]] = (val instanceof Date) ? val.toISOString() : val;
  }
  return obj;
}

// ── Objetos → array-of-arrays (payload ~60% menor)
function rowsToArrays(rows, headers) {
  var hLen = headers.length;
  var out  = new Array(rows.length);
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var arr = new Array(hLen);
    for (var c = 0; c < hLen; c++) {
      var v = row[headers[c]];
      arr[c] = (v === undefined || v === null) ? '' : v;
    }
    out[r] = arr;
  }
  return out;
}

// ============================================================
// REFRESH MANUAL — Metabase, invalida cache del usuario
// ============================================================
function refreshUserFromMetabase(userId) {
  try {
    var numId = parseInt(userId, 10);
    if (!userId || isNaN(numId)) return { success: false, error: 'ID inválido.' };

    // Invalidar cache de este usuario antes de refrescar
    invalidateUserCache(String(userId));

    var scriptProp = PropertiesService.getScriptProperties();
    var baseUrl    = scriptProp.getProperty('BASE_URL');
    var mbUser     = scriptProp.getProperty('USERNAME');
    var mbPass     = scriptProp.getProperty('PASSWORD');
    var questionId = scriptProp.getProperty('QUESTION_ID') || '4551';

    if (!baseUrl || !mbUser || !mbPass) return { success: false, error: 'Configuración incompleta.' };
    if (baseUrl.charAt(baseUrl.length - 1) !== '/') baseUrl += '/';

    var cache = CacheService.getScriptCache();
    var token = cache.get('mb_token');
    if (!token) {
      var tokenResp = UrlFetchApp.fetch(baseUrl + 'api/session', {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify({ username: mbUser, password: mbPass }),
        muteHttpExceptions: true
      });
      if (tokenResp.getResponseCode() !== 200) return { success: false, error: 'Error auth Metabase.' };
      token = JSON.parse(tokenResp.getContentText()).id;
      cache.put('mb_token', token, 480);
    }

    var cardCacheKey = 'mb_card_' + questionId;
    var cardJson     = cache.get(cardCacheKey);
    var card;
    if (cardJson) {
      card = JSON.parse(cardJson);
    } else {
      var cardResp = UrlFetchApp.fetch(baseUrl + 'api/card/' + questionId, {
        method: 'get',
        headers: { 'X-Metabase-Session': token },
        muteHttpExceptions: true
      });
      card = JSON.parse(cardResp.getContentText());
      try { cache.put(cardCacheKey, JSON.stringify(card), 21600); } catch(e) {}
    }

    var datasetPayload = {
      database: card.database_id,
      type: 'native',
      native: {
        query: card.dataset_query.native.query,
        'template-tags': card.dataset_query.native['template-tags']
      },
      parameters: [{ type: 'number', target: ['variable', ['template-tag', 'filtro_usuario']], value: [String(numId)] }]
    };

    var response = UrlFetchApp.fetch(baseUrl + 'api/dataset', {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': token },
      payload: JSON.stringify(datasetPayload),
      muteHttpExceptions: true
    });

    var result = JSON.parse(response.getContentText());
    if (!result.data || !result.data.rows) return { success: false, error: 'Sin datos de Metabase.' };

    var ss           = SpreadsheetApp.getActiveSpreadsheet();
    var cols         = result.data.cols.map(function(c){ return c.name; });
    var baseClaveMap = getBaseClaveData(ss);
    var creditMaps   = getCreditPerformanceData(ss);
    var sacMap       = getSACData(ss);
    var dcpMap       = getDCPData(ss);
    var nowTs        = new Date().getTime();

    var rows = result.data.rows.map(function(row) {
      var obj = {};
      for (var i = 0; i < cols.length; i++) { obj[cols[i]] = row[i]; }
      return buildRowObject(obj, baseClaveMap, creditMaps, sacMap, dcpMap, nowTs);
    });

    rows.sort(function(a, b) {
      return (parseFloat(b['Q total OP']) || 0) - (parseFloat(a['Q total OP']) || 0);
    });

    var headers = buildHeaders();
    return { success: true, h: headers, d: rowsToArrays(rows, headers), total: rows.length, fresh: true };

  } catch (e) {
    Logger.log('Error refreshUserFromMetabase: ' + e.toString());
    return { success: false, error: 'Error: ' + e.toString() };
  }
}

// ============================================================
// HELPERS INTERNOS
// ============================================================
function getImportTimestamp(ss) {
  try {
    var metaSheet = ss.getSheetByName('import_meta');
    if (!metaSheet) return null;
    return metaSheet.getRange('B1').getValue();
  } catch(e) { return null; }
}

function buildHeaders() {
  return [
    'razon_social','Kt','Kv','% u','CCC','CCC ult 5','cuit','nosis','fact','SAC',
    'credito jd','Fecha Creacion','Ultimo ingreso','q_usuarios','Prov_direc_fisc',
    'asociado_comercial','representante',
    'DCP','CI FAE','CI INV','Q total OP','FUOp','FUAct',
    'OFR (F)','VEN (F)','CCC (F)','CCC ult5 (F)','FUV (F)','Q Cis comp (F)','COMP (F)',
    'OFR (I)','VEN (I)','CCC (I)','CCC ult5 (I)','FUV (I)','Q Cis comp (I)','COMP (I)',
    'FUC','DCP EF','DCP Prop'
  ];
}

function buildRowObject(obj, baseClaveMap, creditMaps, sacMap, dcpMap, nowTs) {
  var cuitVal   = String(obj['cuit'] || '').replace(/[^0-9]/g, '');
  var extra     = baseClaveMap[cuitVal]       || { Kt: '', Kv: '', pct_u: '', prov: '' };
  var creditGen = creditMaps.general[cuitVal] || { nosis: '', fact: '' };
  var creditJD  = creditMaps.jd[cuitVal]      || '';
  var dcpInfo   = dcpMap[cuitVal]             || { dcp: '', dcp_ef: '', dcp_prop: '' };

  var fVal    = parseLocaleNum(creditGen.fact);
  var factStr = (fVal !== 0) ? (fVal / 1000000).toFixed(1) + 'M' : '';

  var cjd        = parseFloat(String(creditJD).replace(',', '.'));
  var creditJDStr= (!isNaN(cjd) && creditJD !== '') ? Math.round(cjd).toString() : '';

  var qTotal = (parseFloat(obj['q_ventas_fae']  || 0)
              + parseFloat(obj['q_ventas_inv']   || 0)
              + parseFloat(obj['q_compras_fae']  || 0)
              + parseFloat(obj['q_compras_inv']  || 0));

  return {
    'razon_social'      : obj['razon_social']    || '',
    'Kt'                : extra.Kt               || '',
    'Kv'                : extra.Kv               || '',
    '% u'               : extra.pct_u            || '',
    'CCC'               : fmtPct(obj['conc_gral']),
    'CCC ult 5'         : fmtPct(obj['porc_conc_5_tot']),
    'cuit'              : obj['cuit']            || '',
    'nosis'             : creditGen.nosis        || '',
    'fact'              : factStr,
    'SAC'               : sacMap[cuitVal]        || '',
    'credito jd'        : creditJDStr,
    'Fecha Creacion'    : formatDateShort(obj['fecha_creacion']),
    'Ultimo ingreso'    : getRelativeTime(obj['ult_ingreso'], nowTs),
    'q_usuarios'        : obj['q_usuarios']      || '',
    'Prov_direc_fisc'   : extra.prov             || '',
    'asociado_comercial': obj['asociado_comercial'] || '',
    'representante'     : obj['representante']   || '',
    'DCP'               : dcpInfo.dcp,
    'CI FAE'            : (parseInt(obj['sugerido_ci_faena'])     === 1) ? '✅' : '',
    'CI INV'            : (parseInt(obj['sugerido_ci_invernada']) === 1) ? '✅' : '',
    'Q total OP'        : qTotal,
    'FUOp'              : getRelativeTime(obj['ult_op'],  nowTs),
    'FUAct'             : getRelativeTime(obj['ult_act'], nowTs),
    'OFR (F)'           : obj['q_ofrec_fae']     || '',
    'VEN (F)'           : obj['q_ventas_fae']    || '',
    'CCC (F)'           : fmtPct(obj['conc_gral_fae']),
    'CCC ult5 (F)'      : fmtPct(obj['porc_conc_5_fae']),
    'FUV (F)'           : getRelativeTime(obj['fuv_fae'], nowTs),
    'Q Cis comp (F)'    : obj['cis_com_fae']     || '',
    'COMP (F)'          : obj['q_compras_fae']   || '',
    'OFR (I)'           : obj['q_ofrec_inv']     || '',
    'VEN (I)'           : obj['q_ventas_inv']    || '',
    'CCC (I)'           : fmtPct(obj['conc_gral_inv']),
    'CCC ult5 (I)'      : fmtPct(obj['porc_conc_5_inv']),
    'FUV (I)'           : getRelativeTime(obj['fuv_inv'], nowTs),
    'Q Cis comp (I)'    : obj['cis_com_inv']     || '',
    'COMP (I)'          : obj['q_compras_inv']   || '',
    'FUC'               : getRelativeTime(obj['fuc'], nowTs),
    'DCP EF'            : dcpInfo.dcp_ef,
    'DCP Prop'          : dcpInfo.dcp_prop
  };
}

function fmtPct(val) {
  if (val == null || val === '') return '';
  var n = parseFloat(val);
  return isNaN(n) ? '' : Math.round(n * 100) + '%';
}

// ============================================================
// HOJAS AUXILIARES — cache 2h
// ============================================================
function getBaseClaveData(ss) {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('aux_base_clave');
  if (cached) return JSON.parse(cached);

  var map   = {};
  var sheet = ss.getSheetByName('base clave')
            || ss.getSheetByName('Base clave')
            || ss.getSheetByName('Base Clave')
            || ss.getSheetByName('BASE CLAVE');
  if (!sheet) { cache.put('aux_base_clave', '{}', 7200); return map; }

  var lastRow = sheet.getLastRow();
  var data    = sheet.getRange(1, 1, lastRow, 11).getValues();
  var headers = data[0].map(function(h){ return String(h).toLowerCase().trim(); });

  var cuitIdx = headers.indexOf('cuit'); if (cuitIdx === -1) cuitIdx = 1;
  var ktIdx   = headers.indexOf('kt');   if (ktIdx   === -1) ktIdx   = 2;
  var kvIdx   = headers.indexOf('kv');   if (kvIdx   === -1) kvIdx   = 3;
  var puIdx   = headers.indexOf('% u');  if (puIdx   === -1) puIdx   = 8;
  var provIdx = 10;

  for (var i = 1; i < data.length; i++) {
    var cleanCuit = String(data[i][cuitIdx] || '').replace(/[^0-9]/g, '');
    if (cleanCuit) {
      map[cleanCuit] = { Kt: data[i][ktIdx] || '', Kv: data[i][kvIdx] || '', pct_u: data[i][puIdx] || '', prov: data[i][provIdx] || '' };
    }
  }
  try { cache.put('aux_base_clave', JSON.stringify(map), 7200); } catch(e) {}
  return map;
}

function getCreditPerformanceData(ss) {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('aux_credit_perf');
  if (cached) return JSON.parse(cached);

  var maps  = { general: {}, jd: {} };
  var sheet = null;
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var n = sheets[s].getName().toLowerCase().trim();
    if (n === 'credit performance' || n === 'creditperformance') { sheet = sheets[s]; break; }
  }
  if (!sheet) { cache.put('aux_credit_perf', JSON.stringify(maps), 7200); return maps; }

  var lastRow = sheet.getLastRow();
  var data    = sheet.getRange(1, 1, lastRow, 47).getValues();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var cG  = String(row[2]  || '').replace(/[^0-9]/g, '');
    if (cG) maps.general[cG] = { nosis: row[37] || '', fact: row[33] || '' };
    var cJ  = String(row[45] || '').replace(/[^0-9]/g, '');
    if (cJ) maps.jd[cJ] = row[46] || '';
  }
  try { cache.put('aux_credit_perf', JSON.stringify(maps), 7200); } catch(e) {}
  return maps;
}

function getSACData(ss) {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('aux_sac');
  if (cached) return JSON.parse(cached);

  var map   = {};
  var sheet = ss.getSheetByName('SAC');
  if (!sheet) { cache.put('aux_sac', '{}', 7200); return map; }

  var lastRow = sheet.getLastRow();
  var data    = sheet.getRange(1, 1, lastRow, 23).getValues();

  for (var i = 1; i < data.length; i++) {
    var cuit = String(data[i][17] || '').replace(/[^0-9]/g, '');
    if (cuit) {
      var num = parseFloat(data[i][22]);
      map[cuit] = (!isNaN(num) && typeof data[i][22] === 'number' && num >= 0 && num <= 50) ? '✅' : '';
    }
  }
  try { cache.put('aux_sac', JSON.stringify(map), 7200); } catch(e) {}
  return map;
}

function getDCPData(ss) {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('aux_dcp');
  if (cached) return JSON.parse(cached);

  var map   = {};
  var sheet = ss.getSheetByName('DCP');
  if (!sheet) { cache.put('aux_dcp', '{}', 7200); return map; }

  var lastRow = sheet.getLastRow();
  var data    = sheet.getRange(1, 1, lastRow, 5).getValues();

  for (var i = 1; i < data.length; i++) {
    var cuit = String(data[i][2] || '').replace(/[^0-9]/g, '');
    if (cuit) {
      var dcp  = (data[i][3] != null && data[i][3] !== '') ? parseFloat(data[i][3]) : null;
      var prop = (data[i][4] != null && data[i][4] !== '') ? parseFloat(data[i][4]) : null;
      map[cuit] = { dcp: dcp !== null ? dcp : '', dcp_ef: dcp !== null ? dcp : '', dcp_prop: prop !== null ? prop : '' };
    }
  }
  try { cache.put('aux_dcp', JSON.stringify(map), 7200); } catch(e) {}
  return map;
}

// ============================================================
// HELPERS DE FORMATEO
// ============================================================
function parseLocaleNum(val) {
  if (val == null || val === '-' || val === '') return 0;
  var s = String(val).replace(/\s/g, '');
  if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) { s = s.replace(/\./g, '').replace(',', '.'); }
  else if (s.indexOf(',') !== -1) { s = s.replace(',', '.'); }
  return parseFloat(s) || 0;
}

function getRelativeTime(dateStr, nowTs) {
  if (!dateStr || dateStr === '-' || dateStr === '0000-01-01' || dateStr === 'null') return '';
  try {
    var date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    var diffDays = Math.floor(((nowTs || new Date().getTime()) - date.getTime()) / 86400000);
    if (diffDays < 1)  return 'hoy';
    if (diffDays < 30) return diffDays + 'd';
    var m = Math.floor(diffDays / 30);
    if (m < 12) return m + 'm';
    var y = Math.floor(diffDays / 365);
    return (y >= 5) ? '5a+' : y + 'a';
  } catch(e) { return ''; }
}

function formatDateShort(dateStr) {
  if (!dateStr || dateStr === '-' || dateStr === '0000-01-01' || dateStr === 'null') return '';
  try {
    var date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    var d = date.getDate(), m = date.getMonth() + 1, y = date.getFullYear().toString().substr(-2);
    return (d < 10 ? '0' + d : d) + '/' + (m < 10 ? '0' + m : m) + '/' + y;
  } catch(e) { return ''; }
}

// ============================================================
// ADMIN
// ============================================================
function getAllCommercials() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('usuarios');
    var data  = sheet.getDataRange().getValues().slice(1);
    var list  = [], seen = {};
    for (var i = 0; i < data.length; i++) {
      var name = String(data[i][2] || '').trim();
      if (name && !seen[name]) { seen[name] = true; list.push(name); }
    }
    return list.sort();
  } catch(e) { return []; }
}

function getUserIdByName(name) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('usuarios');
    var data  = sheet.getDataRange().getValues().slice(1);
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][2] || '').trim().toLowerCase() === name.toLowerCase()) return String(data[i][3]);
    }
    return null;
  } catch(e) { return null; }
}

// ============================================================
// INVALIDAR CACHÉ
// ============================================================
function invalidateAuxCache() {
  CacheService.getScriptCache().removeAll(['aux_base_clave', 'aux_credit_perf', 'aux_sac', 'aux_dcp']);
  return { success: true, message: 'Caché de hojas auxiliares limpiado.' };
}

function invalidateMetabaseCache() {
  var questionId = PropertiesService.getScriptProperties().getProperty('QUESTION_ID') || '4551';
  CacheService.getScriptCache().removeAll(['mb_token', 'mb_card_' + questionId]);
  return { success: true, message: 'Caché de Metabase limpiado.' };
}