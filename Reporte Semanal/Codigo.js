
/**
 * REPORTES SEMANALES v7.1 — CACHE-FIRST
 * Fix v7.1: aux leads filtra por mail (col B) en lugar de nombre normalizado
 */

// ─── Clear Cache (ejecutar manualmente) ─────────────────────────────────────
function clearCache() {
  var cache = CacheService.getScriptCache();
  var props = PropertiesService.getScriptProperties();
  // Limpia config
  cache.remove('CFG8');
  // Limpia datos directos
  cache.remove('DATA10');
  // Limpia chunks de datos
  var nStr = cache.get("DATA10_N");
  if (nStr) {
    var n = parseInt(nStr);
    var keys = ['DATA10_N'];
    for (var i = 0; i < n; i++) keys.push("DATA10_" + i);
    cache.removeAll(keys);
  }
  // Invalida cache de reportes versionando la clave de cache.
  // Esto evita servir R12 viejos luego de un clearCache.
  props.setProperty('R12_VER', String(Date.now()));

  Logger.log("Cache limpiado correctamente");
  return "Cache limpiado";
}

function getReportCacheVersion() {
  var props = PropertiesService.getScriptProperties();
  return 'crm-act-v9_' + (props.getProperty('R12_VER') || '0');
}

function debugCacheStatus(ac, startTs, endTs) {
  var cfg = getConfig();
  var acMail = cfg.acMap[ac] || '';
  var ver = getReportCacheVersion();
  var cache = CacheService.getScriptCache();

  var rKey = '';
  var rHit = false;
  if (acMail && startTs && endTs) {
    rKey = 'R12_' + ver + '_' + acMail.replace(/[@.]/g, '_') + '_' + startTs + '_' + endTs;
    rHit = !!cache.get(rKey);
  }

  return {
    reportCacheVersion: ver,
    hasCFG8: !!cache.get('CFG8'),
    hasDATA10: !!cache.get('DATA10'),
    data10Chunks: cache.get('DATA10_N') || '0',
    ac: ac || '',
    acMail: acMail,
    reportKey: rKey,
    reportHit: rHit
  };
}

function refreshCacheAndWarmup(ac, startTs, endTs) {
  var clearMsg = clearCache();
  var warm = warmup();
  var status = debugCacheStatus(ac, startTs, endTs);
  return {
    ok: true,
    clear: clearMsg,
    warmup: warm,
    status: status
  };
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function norm(s) {
  if (!s) return "";
  return String(s).trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[áà]/g, "a").replace(/[éè]/g, "e")
    .replace(/[íì]/g, "i").replace(/[óò]/g, "o")
    .replace(/[úù]/g, "u").replace(/ñ/g, "n");
}

function toDateStr(val, tz) {
  if (!val) return "";
  var d = val instanceof Date ? val
    : typeof val === "number" ? new Date((val - 25569) * 86400000)
      : new Date(val);
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, tz, "yyyyMMdd");
}

function toFmt(val, tz) {
  if (!val) return "";
  var d = val instanceof Date ? val
    : typeof val === "number" ? new Date((val - 25569) * 86400000)
      : new Date(val);
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, tz, "dd/MM/yyyy");
}

function toDayIdx(val) {
  var d = val instanceof Date ? val
    : typeof val === "number" ? new Date((val - 25569) * 86400000)
      : new Date(val);
  if (isNaN(d.getTime())) return -1;
  var w = d.getDay();
  // Orden semanal: Sabado(0), Domingo(1), Lunes(2) ... Viernes(6)
  return (w + 1) % 7;
}

function rawSheet(ss, name) {
  var s = ss.getSheetByName(name);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).getValues();
}

// ─── doGet ───────────────────────────────────────────────────────────────────

function doGet(e) {
  if (e && e.parameter && e.parameter.api === "true") {
    try {
      var op = e.parameter.op;
      var out = op === "config" ? getConfig()
        : op === "report" ? getReport(e.parameter.ac, +e.parameter.startTs, +e.parameter.endTs)
          : op === "warmup" ? warmup()
            : op === "clearCache" ? clearCache()
              : op === "refreshCache" ? refreshCacheAndWarmup(e.parameter.ac, +e.parameter.startTs, +e.parameter.endTs)
                : { error: "op desconocida" };
      return ContentService.createTextOutput(JSON.stringify(out))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return HtmlService.createTemplateFromFile("Index").evaluate()
    .setTitle("Reporte Semanal")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─── getConfig ───────────────────────────────────────────────────────────────

function getConfig() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get("CFG8");
  if (hit) return JSON.parse(hit);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aux = rawSheet(ss, "aux");
  var acMap = {}, repsList = [], acsList = [], semanas = [], seenSem = {};

  aux.forEach(function (row, idx) {
    // col O (idx 14) = nombre, col U (idx 20) = mail
    var nombre = String(row[14] || "").trim();
    var mail = String(row[20] || "").trim().toLowerCase();
    
    if (nombre && mail) {
       acMap[nombre] = mail;
       if (idx >= 29) {
           if(repsList.indexOf(nombre) === -1) repsList.push(nombre);
       } else {
           if(acsList.indexOf(nombre) === -1) acsList.push(nombre);
       }
    }

    // semanas: col I(8)=n, col K(10)=start, col L(11)=end, col M(12)=year
    var n = row[8], s = row[10], e = row[11], y = row[12];
    if (n && s && e && !seenSem[n]) {
      seenSem[n] = true;
      semanas.push({
        n: n,
        s: s instanceof Date ? s.getTime() : new Date(s).getTime(),
        e: e instanceof Date ? e.getTime() : new Date(e).getTime(),
        y: y
      });
    }
  });

  var cfg = { acs: acsList.sort(), reps: repsList.sort(), acMap: acMap, semanas: semanas };
  try { cache.put("CFG8", JSON.stringify(cfg), 3600); } catch (e) { }
  return cfg;
}

// ─── loadData ────────────────────────────────────────────────────────────────

function loadData() {
  var cache = CacheService.getScriptCache();
  var fromCache = getDataFromCache(cache);
  if (fromCache) return fromCache;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();

  // ── BASE ──
  var base = [];
  rawSheet(ss, "BASE").forEach(function (row) {
    var ac = norm(row[5]);
    var repVend = norm(row[20]); 
    var repComp = norm(row[21]);
    if (!ac && !repVend && !repComp) return;
    var f = toDateStr(row[1], tz); if (!f) return;
    var est = String(row[3] || "").trim().toUpperCase();
    var ok = false, conc = false, pub = false, ofr = false, noConc = false;
    var cotizo = Number(row[6]) === 1 ? 1 : 0; // columna G
    if (est === "CONCRETADA") { ok = true; conc = true; }
    else if (est === "PUBLICADO") { ok = true; pub = true; }
    else if (est === "OFRECIMIENTOS") { ok = true; ofr = true; }
    else if (est === "NO CONCRETADA" || est === "NO CONCRETADAS") { ok = true; noConc = true; }
    if (!ok) return;
    base.push([
      ac,                           // 0 ac
      f,                            // 1 f
      toDayIdx(row[1]),             // 2 di
      row[2] || "",                 // 3 soc
      Number(row[4]) || 0,          // 4 cab
      conc ? 1 : 0,                 // 5 conc
      pub ? 1 : 0,                  // 6 pub
      ofr ? 1 : 0,                  // 7 ofr
      noConc ? 1 : 0,               // 8 noConc
      cotizo,                       // 9 cotizo
      String(row[0] || ""),         // 10 id (col A)
      String(row[16] || ""),        // 11 CUIT (col Q)
      String(row[8] || ""),         // 12 UN (col I)
      toFmt(row[1], tz),            // 13 fmtFecha
      repVend,                      // 14 rep vend
      repComp                       // 15 rep comp
    ]);
  });

  // ── OPS ──
  var ops = [];
  rawSheet(ss, "OPS").forEach(function (row) {
    var aV = norm(row[6]), aC = norm(row[8]);
    var rV = norm(row[34]), rC = norm(row[35]);
    if (!aV && !aC && !rV && !rC) return;
    var f = toDateStr(row[2], tz); if (!f) return;
    var cargF = row[18] ? toDateStr(row[18], tz) : "";
    var cargAcRaw = String(row[22] || "").trim();
    ops.push([
      aV, aC, f, toDayIdx(row[2]),
      Number(row[9]) || 0,  // 4 Q total (col J)
      row[5] || "",         // 5 socV (col F)
      row[7] || "",         // 6 socC (col H)
      toFmt(row[2], tz),    // 7 fmtFecha (col C)
      String(row[0] || ""), // 8 ID (col A)
      String(row[1] || ""), // 9 UN (col B)
      String(row[10] || ""),// 10 Cat (col K)
      norm(cargAcRaw),      // 11
      cargF,                // 12
      cargF ? toDayIdx(row[18]) : -1, // 13
      String(row[21] || ""),// 14 cuitV (col V)
      String(row[22] || ""),// 15 cuitC (col W)
      cargAcRaw.toLowerCase(), // 16
      Number(row[16]) || 0,  // 17 Q particular para el detalle (col Q)
      rV,                    // 18 repV
      rC                     // 19 repC
    ]);
  });

  // ── COMENTARIOS CRM ──
  // col A (idx 0) = idLead
  // col B (idx 1) = Usuario - Sociedad
  // col C (idx 2) = mail AC
  // col D (idx 3) = fecha para filtrar
  // col E (idx 4) = comentario/texto
  var coms = [];
  rawSheet(ss, "Comentarios_CRM").forEach(function (row) {
    var mail = String(row[2] || "").trim().toLowerCase(); if (!mail) return;
    var f = toDateStr(row[3], tz); if (!f) return;
    coms.push([mail, f, toDayIdx(row[3]), row[1] || "", 1, "Comentario", row[4] || "", String(row[0] || "")]);
    // 0=mail 1=f 2=di 3=soc 4=esCom 5=tipo 6=comentario 7=idLead
  });

  // ── AGENDA CRM ──
  // col A (idx 0) = idLead
  // col B (idx 1) = Usuario - Sociedad
  // col C (idx 2) = mail AC
  // col D (idx 3) = Comentario
  // col F (idx 5) = fecha agenda
  var agendas = [];
  rawSheet(ss, "Agenda_CRM").forEach(function (row) {
    var mail = String(row[2] || "").trim().toLowerCase(); if (!mail) return;
    var f = toDateStr(row[5], tz); if (!f) return;
    agendas.push([mail, f, toDayIdx(row[5]), row[1] || "", row[3] || "", "Agenda", String(row[0] || "")]);
    // 0=mail 1=f 2=di 3=soc 4=comentario 5=tipo 6=idLead
  });

  // ── LEADS CRM (Soc. Cargadas) ──
  // col B (idx 1) = fechaAsignacion, col C (idx 2) = mail AC, col D (idx 3) = fuente, col L (idx 11) = estado
  var leads = [];
  rawSheet(ss, "Leads_CRM").forEach(function (row) {
    var mail = String(row[2] || "").trim().toLowerCase(); if (!mail) return;
    if (String(row[3] || "").trim() !== "UA") return;
    if (String(row[11] || "").trim() === "NO HABILITADO") return;
    var f = toDateStr(row[1], tz); if (!f) return;
    leads.push([mail, f]);
    // 0=mail 1=f
  });

  // ── AUX LEADS ──
  // col B (idx 1)  = mail comercial   → filtro principal
  // col C (idx 2)  = fechaAsignacion
  // col E (idx 4)  = estado           → filtrar NUEVO
  // col W (idx 22) = diasEstadoActual → orden desc
  // col AD (idx 29) = razonSocial
  // col AF (idx 31) = kt
  // col AK (idx 36) = kv
  // col AM (idx 38) = sinGestion
  // col AN (idx 39) = ultActividad
  // col AO (idx 40) = ultGestion
  var auxLeads = [];
  rawSheet(ss, "aux leads").forEach(function (row) {
    var mail = String(row[1] || "").trim().toLowerCase(); if (!mail) return;
    var est = String(row[4] || "").trim().toUpperCase();
    var f = toDateStr(row[2], tz);
    auxLeads.push([
      mail,                              // 0  mail comercial (col B)
      f,                                 // 1  fechaAsignacion (col C)
      f ? toDayIdx(row[2]) : -1,        // 2  dayIdx
      est === "NUEVO" ? 1 : 0,          // 3  esNuevo (col E)
      String(row[31] || ""),               // 4  kt           (col AF)
      String(row[36] || ""),               // 5  kv           (col AK)
      String(row[29] || ""),               // 6  razonSocial  (col AD)
      String(row[38] || ""),               // 7  sinGestion   (col AM)
      Number(row[22]) || 0,                // 8  diasEstadoActual (col W) → orden
      Number(row[32]) || 0,                // 9  ng  (para actSemanal)
      String(row[40] || ""),               // 10 ultGestion   (col AO)
      String(row[39] || ""),               // 11 ultActividad (col AN)
      String(row[26] || ""),               // 12 cuit         (col AA)
      String(row[37] || ""),               // 13 fuente       (col AL)
      String(row[41] || ""),               // 14 comentario   (col AP)
      est,                               // 15 estado raw   (col E)
      String(row[0] || "")                // 16 idLead       (col A)
    ]);
  });

  // ── SAC ──
  // Columnas: Q=usuario-soc(16), T=fechaSol(19), Y=estado(24), U=jdSol(20), W=jdApro(22), AC=acNorm(28), X=UN(23)
  var sacs = [];
  rawSheet(ss, "SAC").forEach(function (row) {
    var ac = norm(row[28]); if (!ac) return;
    var f = toDateStr(row[19], tz); if (!f) return;
    var di = toDayIdx(row[19]);
    sacs.push([
      ac,                     // 0  acNorm (col AC idx 28)
      f,                      // 1  fecha (col T idx 19)
      di,                     // 2  dayIdx
      String(row[16] || ""),    // 3  usuario-sociedad (col Q idx 16)
      String(row[24] || ""),    // 4  estado (col Y idx 24)
      String(row[20] || ""),    // 5  jd solicitadas (col U idx 20)
      String(row[22] || ""),    // 6  jd aprobadas (col W idx 22)
      String(row[23] || "")     // 7  UN (col X idx 23)
    ]);
  });

  // ── REMATES ──
  var remates = [];
  rawSheet(ss, "REMATES").forEach(function (row) {
    var ac = norm(row[2]); if (!ac) return;
    var f = toDateStr(row[1], tz); if (!f) return;
    remates.push([ac, f, String(row[3] || Math.random())]);
    // 0=ac 1=f 2=id
  });

  // ── BCFULL (para mapeo CUIT → Kt, Kv) ──
  var bcfull = [];
  rawSheet(ss, "BCFULL").forEach(function (row) {
    var cuit = String(row[1] || "").trim(); if (!cuit) return;
    var kt = String(row[3] || "").trim();
    var kv = String(row[4] || "").trim();
    bcfull.push([cuit, kt, kv]);
    // 0=cuit 1=kt 2=kv
  });

  var data = {
    base: base, ops: ops, coms: coms, agendas: agendas,
    leads: leads, auxLeads: auxLeads, sacs: sacs, remates: remates, bcfull: bcfull
  };

  saveDataToCache(cache, data);
  return data;
}

function saveDataToCache(cache, data) {
  try {
    var str = JSON.stringify(data);
    var chunks = Math.ceil(str.length / 90000);
    if (chunks === 1) {
      cache.put("DATA10", str, 3600);
      return;
    }
    var entries = { "DATA10_N": String(chunks) };
    for (var i = 0; i < chunks; i++) {
      entries["DATA10_" + i] = str.slice(i * 90000, (i + 1) * 90000);
    }
    cache.putAll(entries, 3600);
  } catch (e) { }
}

function getDataFromCache(cache) {
  var direct = cache.get("DATA10");
  if (direct) { try { return JSON.parse(direct); } catch (e) { } }
  var nStr = cache.get("DATA10_N");
  if (!nStr) return null;
  var n = parseInt(nStr);
  var keys = [];
  for (var i = 0; i < n; i++) keys.push("DATA10_" + i);
  var parts = cache.getAll(keys);
  var str = "";
  for (var i = 0; i < n; i++) {
    var p = parts["DATA10_" + i];
    if (!p) return null;
    str += p;
  }
  try { return JSON.parse(str); } catch (e) { return null; }
}

// ─── warmup ──────────────────────────────────────────────────────────────────

function warmup() {
  getConfig();
  loadData();
  return { ok: true };
}

// ─── Funciones para Automatizar la Caché (Triggers) ─────────────────────────

function scheduledWarmup() {
  Logger.log("Iniciando actualización automática de caché...");
  clearCache(); // Invalida la caché vieja (actualiza la versión R12_VER)
  warmup();     // Recarga CFG7 y DATA9 pesados (leyendo la hoja)
  Logger.log("Caché actualizada correctamente en segundo plano.");
}

function setupAutoWarmup() {
  // 1. Borramos disparadores anteriores para no duplicar
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'scheduledWarmup') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 2. Creamos un nuevo disparador que corra automática y continuamente cada 1 hora
  ScriptApp.newTrigger('scheduledWarmup')
    .timeBased()
    .everyHours(1) // Cada 1 hora Google lo ejecutará solo
    .create();

  Logger.log("Disparador instalado. La caché se actualizará sola cada 1 hora.");
}

// ─── getReport ───────────────────────────────────────────────────────────────

function getReport(ac, startTs, endTs, opts) {
  opts = opts || {};
  var skipPrevLookup = !!opts.skipPrevLookup;
  var cfg = getConfig();
  var acMail = cfg.acMap[ac];
  if (!acMail) return { error: "AC no encontrado: " + ac };

  var acN = norm(ac);
  var reportCacheVersion = getReportCacheVersion();

  var cache = CacheService.getScriptCache();
  var rMode = skipPrevLookup ? "_raw" : "";
  var rKey = "R12_" + reportCacheVersion + "_" + acMail.replace(/[@.]/g, "_") + "_" + startTs + "_" + endTs + rMode;
  var ssgSanitized2 = acMail.replace(/[^a-zA-Z0-9_]/g, '_');
  var ssgStoreKey2 = 'SSGN_' + ssgSanitized2 + '_' + startTs;
  var ssgPrevKey2 = 'SSGN_' + ssgSanitized2 + '_' + (startTs - 604800000);
  var hit = cache.get(rKey);
  if (hit) {
    try {
      var rHit = JSON.parse(hit);
      var storedPrevHit = PropertiesService.getScriptProperties().getProperty(ssgPrevKey2);
      if (storedPrevHit !== null) rHit.pSocSinGestNum = parseInt(storedPrevHit, 10) || 0;
      return rHit;
    } catch (e) { }
  }

  var D = loadData();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var d0 = new Date(startTs); d0.setHours(0, 0, 0, 0);
  var d1 = new Date(endTs); d1.setHours(23, 59, 59, 999);
  var ini = Utilities.formatDate(d0, tz, "yyyyMMdd");
  var fin = Utilities.formatDate(d1, tz, "yyyyMMdd");
  var ini_ = Utilities.formatDate(new Date(startTs - 604800000), tz, "yyyyMMdd");
  var fin_ = Utilities.formatDate(new Date(endTs - 604800000), tz, "yyyyMMdd");
  var m0 = new Date(d1.getTime());
  m0.setDate(1);
  m0.setHours(0, 0, 0, 0);
  var iniM = Utilities.formatDate(m0, tz, "yyyyMMdd");
  var prevMonthStart = new Date(m0.getFullYear(), m0.getMonth() - 1, 1);
  var prevMonthEnd = new Date(m0.getFullYear(), m0.getMonth(), 0);
  var prevCutDay = Math.min(d1.getDate(), prevMonthEnd.getDate());
  var prevMonthCut = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), prevCutDay);
  var iniMPrev = Utilities.formatDate(prevMonthStart, tz, "yyyyMMdd");
  var finMPrev = Utilities.formatDate(prevMonthCut, tz, "yyyyMMdd");

  // Últimas 4 semanas (incluyendo la seleccionada) para evolución de operadas
  var ult4Sem = (cfg.semanas || []).filter(function (s) {
    if (!s || !s.s || !s.e) return false;
    return new Date(s.e).getTime() <= d1.getTime();
  }).sort(function (a, b) {
    return a.s - b.s;
  });
  if (ult4Sem.length > 4) ult4Sem = ult4Sem.slice(ult4Sem.length - 4);

  var semMes = ult4Sem.map(function (s) {
    var ws = new Date(s.s);
    var we = new Date(s.e);
    ws.setHours(0, 0, 0, 0);
    we.setHours(23, 59, 59, 999);
    return {
      label: "S" + s.n,
      ini: Utilities.formatDate(ws, tz, "yyyyMMdd"),
      fin: Utilities.formatDate(we, tz, "yyyyMMdd")
    };
  });

  var semPrevMes = (cfg.semanas || []).filter(function (s) {
    if (!s || !s.s || !s.e) return false;
    var we = new Date(s.e);
    return we.getFullYear() === prevMonthStart.getFullYear() &&
      we.getMonth() === prevMonthStart.getMonth();
  }).sort(function (a, b) {
    return a.e - b.e;
  });
  var ultSemPrevMes = semPrevMes.length ? semPrevMes[semPrevMes.length - 1] : null;
  var semPrevIni = "", semPrevFin = "";
  if (ultSemPrevMes) {
    var pws = new Date(ultSemPrevMes.s);
    var pwe = new Date(ultSemPrevMes.e);
    pws.setHours(0, 0, 0, 0);
    pwe.setHours(23, 59, 59, 999);
    semPrevIni = Utilities.formatDate(pws, tz, "yyyyMMdd");
    semPrevFin = Utilities.formatDate(pwe, tz, "yyyyMMdd");
  }

  function inS(f) { return f >= ini && f <= fin; }
  function inA(f) { return f >= ini_ && f <= fin_; }
  function inM(f) { return f >= iniM && f <= fin; }
  function inMPrev(f) { return f >= iniMPrev && f <= finMPrev; }

  var r = {
    cab: 0, trop: 0, pCab: 0, pTrop: 0, cccNum: 0, cccDen: 0, cabPublicadas: 0,
    cabCompra: 0, pCabCompra: 0, tropCompra: 0, socCompra: 0,
    dT: [0, 0, 0, 0, 0, 0, 0],
    dCompras: [0, 0, 0, 0, 0, 0, 0],
    cabC: 0, cabCWeekTrop: 0, cabCSocCount: 0, pCabC: 0,
    cabV: 0, cabConc: 0, trConc: 0, pConc: 0,
    cabOperMtd: 0, pCabOperMtd: 0, cabVOperMtd: 0, cabCOperMtd: 0,
    carg: 0, cargProp: 0, cargAjen: 0, dCargas: [0, 0, 0, 0, 0, 0, 0],
    com: 0, age: 0, tSG: 0, pTSG: 0, dGestion: [0, 0, 0, 0, 0, 0, 0],
    nuevas: 0, pNuevas: 0, nuevasFuentes: {}, socSinGestNum: 0, pSocSinGestNum: 0, socSinGestAsigSem: 0,
    sacs: [], sacsTable: [], pSac: 0, sacAprob: 0, sacRech: 0, sacPend: 0, rem: 0, pRem: 0, dSacs: [0, 0, 0, 0, 0, 0, 0],
    top5: [], ssgTop5: [], actSemanal: [],
    detOf: [], detC: [], detCarg: [], // Listas para el detalle lateral
    operSemMesLabels: [], operSemMesVals: [], operSemMesDets: [], prevSemOperBase: 0,
    socOf: 0, socOps: 0, ccc: "0%", cotizadas: "0%", tSGAsigSem: 0, socSinGestAvgDays: 0, hideCRM: false
  };

  var hasCrmData = false;
  for (var i = 0; i < D.auxLeads.length; i++) { if (D.auxLeads[i][0] === acMail) { hasCrmData = true; break; } }
  if (!hasCrmData) { for (var i = 0; i < D.coms.length; i++) { if (D.coms[i][0] === acMail) { hasCrmData = true; break; } } }
  if (!hasCrmData) { for (var i = 0; i < D.agendas.length; i++) { if (D.agendas[i][0] === acMail) { hasCrmData = true; break; } } }
  if (!hasCrmData) { for (var i = 0; i < D.leads.length; i++) { if (D.leads[i][0] === acMail) { hasCrmData = true; break; } } }
  r.hideCRM = !hasCrmData;

  r.operSemMesLabels = semMes.map(function (s) { return s.label; });
  r.operSemMesVals = semMes.map(function () { return 0; });
  r.operSemMesDets = semMes.map(function () { return []; }); // detalle por semana

  // ── BASE ──
  // Cabezas Ofrecidas: CONCRETADA + PUBLICADO + OFRECIMIENTOS + NO CONCRETADA(S)
  // (incluye también "No la comercializo")
  // CCC: CONCRETADA / (CONCRETADA + NO CONCRETADA)
  // ── Mapeo CUIT → Kt, Kv ──
  var cuitKtKvMap = {};

  // 1. Prioridad: aux leads
  var auxLeadsData = D.aux || [];
  for (var i = 0, L = auxLeadsData.length; i < L; i++) {
    var row = auxLeadsData[i];
    var cuit = String(row[12] || "").trim(); // CUIT (index 12 en auxLeads array)
    if (cuit && !cuitKtKvMap[cuit]) {
      cuitKtKvMap[cuit] = { kt: row[4], kv: row[5] || "-" }; // Kt(4), Kv(5)
    }
  }

  // 2. Complemento: BCFULL
  var bcfullData = D.bcfull || [];
  for (var i = 0, L = bcfullData.length; i < L; i++) {
    var row = bcfullData[i];
    var cuit = String(row[0] || "").trim(); // CUIT
    if (cuit && !cuitKtKvMap[cuit]) {
      cuitKtKvMap[cuit] = { kt: row[1], kv: row[2] || "-" };
    }
  }

  var socOf = {}, base = D.base;
  var cabConcBase = 0;
  var cabNoConcBase = 0;
  var cabCotizadasCcc = 0;
  for (var i = 0, L = base.length; i < L; i++) {
    var row = base[i];
    if (row[0] !== acN && row[14] !== acN && row[15] !== acN) continue;
    var f = row[1];
    if (inS(f)) {
      r.cab += row[4]; r.trop++;      // Cabezas Ofrecidas total
      if (row[5]) cabConcBase += row[4];
      if (row[8]) cabNoConcBase += row[4];
      if (row[6] || row[7]) r.cabPublicadas += row[4];  // Publicadas + Ofrecimientos
      if ((row[5] || row[8]) && row[9]) cabCotizadasCcc += row[4];
      if (row[3]) socOf[row[3]] = 1;
      if (row[2] >= 0) r.dT[row[2]]++;

      // Buscar Kt/Kv por CUIT en aux leads
      var cuitOf = String(row[11] || "").trim();
      var dataOf = cuitKtKvMap[cuitOf] || { kt: "-", kv: "-" };

      // Generamos fStr siempre a partir del YYYYMMDD para asegurarnos que se vea bien
      var fString = String(f || "");
      var fStr = (fString.length === 8)
        ? fString.substring(6, 8) + "/" + fString.substring(4, 6) + "/" + fString.substring(0, 4)
        : fString;

      // Detalle para el panel lateral
      r.detOf.push({
        id: row[10] || "",
        fecha: row[13] ? String(row[13]) : fStr,
        soc: row[3] || "-",
        q: row[4] || 0,
        un: row[12] || "-", // Columna I (index 12 en base.push)
        kt: dataOf.kt,
        kv: dataOf.kv,
        est: row[5] ? "C" : (row[8] ? "NC" : (row[6] ? "P" : (row[7] ? "O" : "-")))
      });
    }
    if (inA(f)) {
      r.pCab += row[4]; r.pTrop++;
    }
  }
  r.socOf = Object.keys(socOf).length;

  // ── OPS ──
  // cabConc: suma q una sola vez por ID de operación (evita doble conteo si el AC es V y C)
  // cabV / cabC: desglose informativo, pueden sumar más que cabConc
  // Tropas: contar una vez por operación ID (si el AC es V o C)
  // Sociedades: de venta (socV) o compra (socC) según el rol
  var socOps = {}, socCompraWeek = {}, allOps = [], ops = D.ops;
  var seenS = {}, seenA = {}, seenM = {}, seenMPrev = {};
  var seenSemMes = semMes.map(function () { return {}; });
  var seenPrevSem = {};
  var seenCWeek = {};
  for (var i = 0, L = ops.length; i < L; i++) {
    var row = ops[i];
    var isV = (row[0] === acN) || (row[18] === acN);
    var isC = (row[1] === acN) || (row[19] === acN);
    var isCargForAc = row[11] === acN || row[16] === acMail;

    // Cargas: cuentan por columna W (AC de carga), aunque el AC no este en G/I.
    // Clasificacion: propia si el AC es vendedor de esa op, ajena en el resto de casos.
    if (isCargForAc && row[12] && inS(row[12])) {
      r.carg++;
      if (isV) r.cargProp++; else r.cargAjen++;
      if (row[13] >= 0) r.dCargas[row[13]]++;

      var fCargString = String(row[12] || "");
      var fecCargStr = (fCargString.length === 8)
        ? fCargString.substring(6, 8) + "/" + fCargString.substring(4, 6) + "/" + fCargString.substring(0, 4)
        : fCargString;

      var cuitLookupCarg = String(row[14] || "").trim(); // cuitV
      var dataCarg = cuitKtKvMap[cuitLookupCarg] || { kt: "-", kv: "-" };

      r.detCarg.push({
        id: String(row[8] || ""),
        fecha: fecCargStr,
        soc: String(row[5] || "-") + (isV ? " (Propia)" : " (Ajena)"),
        q: Number(row[4]) || 0,
        un: String(row[9] || "-"),
        kt: dataCarg.kt,
        kv: dataCarg.kv
      });
    }

    if (!isV && !isC) continue;
    var f = row[2];
    var id = row[8];
    var opKey = id ? String(id) : ('idx_' + i);
    if (inS(f)) {
      // Operación única (sin doble conteo)
      if (!seenS[opKey]) {
        seenS[opKey] = 1;
        r.cabConc += row[4]; // suma q una sola vez por op
        r.trConc++;           // cuenta tropa una sola vez por op
      }
      // Comprador: contar tropas y sociedades de compra
      if (isC && !seenCWeek[opKey]) {
        seenCWeek[opKey] = 1;
        r.cabCWeekTrop++;   // tropas únicas donde es comprador
        if (row[3] >= 0) r.dCompras[row[3]]++;
      }
      // Cabezas y sociedades por rol
      if (isV) {
        r.cabV += row[4];
        if (row[5]) socOps[row[5]] = 1;
      }
      if (isC) {
        r.cabC += row[4];
        if (row[6]) socCompraWeek[row[6]] = 1;

        // Buscar Kt/Kv por CUIT Comprador (Col V)
        var cuitC = String(row[15] || "").trim(); // row[15] es el cuitC
        var dataC = cuitKtKvMap[cuitC] || { kt: row[10] || "-", kv: "-" }; // fallback a Cat (Col K)

        r.detC.push({
          id: row[8],
          un: row[9], // UN (Col B)
          soc: row[6], // Sociedad (Col H)
          fecha: row[7],
          q: row[4], // Volvemos a usar la Q principal de la tabla (Col J)
          kt: dataC.kt,
          kv: dataC.kv
        });
      }
      var cuitLookup = String(row[14] || "").trim(); // cuitV
      var ktKv = cuitKtKvMap[cuitLookup] || { kt: '-', kv: '-' };
      var tieneCargar = isCargForAc ? 'Sí' : '';
      var acLado = isV && isC ? 'vend/comp' : (isV ? 'vend' : 'comp');
      allOps.push({ q: row[4], kt: ktKv.kt, kv: ktKv.kv, d: [row[8], row[9], row[5], row[0], row[6], row[1], row[7], row[4], tieneCargar, acLado] });
    }
    if (inA(f) && !seenA[opKey]) { seenA[opKey] = 1; r.pConc += row[4]; }
    if (inA(f) && isC) { r.pCabC += row[4]; }
    if (inM(f) && !seenM[opKey]) {
      seenM[opKey] = 1;
      r.cabOperMtd += row[4];
    }
    if (inM(f)) {
      if (isV) r.cabVOperMtd += row[4];
      if (isC) r.cabCOperMtd += row[4];
    }
    if (inMPrev(f) && !seenMPrev[opKey]) {
      seenMPrev[opKey] = 1;
      r.pCabOperMtd += row[4];
    }
    for (var w = 0; w < semMes.length; w++) {
      if (f < semMes[w].ini || f > semMes[w].fin) continue;
      if (!seenSemMes[w][opKey]) {
        seenSemMes[w][opKey] = 1;
        r.operSemMesVals[w] += row[4];
        // Guardar detalle de esta op para la semana w
        var cuitLkp = String(row[14] || '').trim();
        var ktkvW = cuitKtKvMap[cuitLkp] || { kt: '-', kv: '-' };
        r.operSemMesDets[w].push({
          id: row[8],
          un: row[9],
          soc: String(row[5] || row[6] || '-'),
          fecha: row[7],
          q: row[4],
          kt: ktkvW.kt,
          kv: ktkvW.kv
        });
      }
      break;
    }
    if (semPrevIni && f >= semPrevIni && f <= semPrevFin && !seenPrevSem[opKey]) {
      seenPrevSem[opKey] = 1;
      r.prevSemOperBase += row[4];
    }
  }
  r.socOps = Object.keys(socOps).length;
  r.cabCSocCount = Object.keys(socCompraWeek).length;
  allOps.sort(function (a, b) { return b.q - a.q; });
  r.top5 = allOps.slice(0, 5);

  // Cabezas Compradas: usar OPS en lugar de BASE
  // r.cabC cuenta cabezas donde el AC es comprador en OPS
  r.ccc = (cabConcBase + cabNoConcBase) > 0
    ? Math.round(cabConcBase / (cabConcBase + cabNoConcBase) * 100) + "%"
    : "0%";
  r.cotizadas = (cabConcBase + cabNoConcBase) > 0
    ? Math.round(cabCotizadasCcc / (cabConcBase + cabNoConcBase) * 100) + "%"
    : "0%";

  // ── CRM ──
  var socGest = {}, pSocGest = {}, gestDia = [{}, {}, {}, {}, {}, {}, {}];
  var comSocGest = {}, ageSocGest = {}; // para contar sociedades únicas con comentarios/agendas
  var crmGestiones = {}; // map leadKey → {tipo, f, cm, soc, idLead}

  function getLeadKey(idLead, soc, fallback) {
    var id = String(idLead || '').trim();
    if (id) return 'id:' + id;
    var s = String(soc || '').trim();
    if (s) return 'soc:' + s;
    return fallback;
  }

  var coms = D.coms;
  for (var i = 0, L = coms.length; i < L; i++) {
    var row = coms[i];
    if (row[0] !== acMail) continue;
    var f = row[1];
    var gKey = getLeadKey(row[7], row[3], 'com:' + i);
    if (inS(f)) {
      if (row[4] && gKey) comSocGest[gKey] = 1;
      if (gKey) {
        socGest[gKey] = 1;
        if (row[2] >= 0) gestDia[row[2]][gKey] = 1;
        if (!crmGestiones[gKey] || f > crmGestiones[gKey].f) {
          crmGestiones[gKey] = { f: f, tipo: "Comentario", cm: (row[6] || ""), soc: (row[3] || ""), idLead: String(row[7] || "") };
        }
      }
    }
    if (inA(f) && gKey) pSocGest[gKey] = 1;
  }
  var agendas = D.agendas;
  for (var i = 0, L = agendas.length; i < L; i++) {
    var row = agendas[i];
    if (row[0] !== acMail) continue;
    var f = row[1];
    var gKey = getLeadKey(row[6], row[3], 'age:' + i);
    if (inS(f)) {
      if (gKey) ageSocGest[gKey] = 1;
      if (gKey) {
        socGest[gKey] = 1;
        if (row[2] >= 0) gestDia[row[2]][gKey] = 1;
        if (!crmGestiones[gKey] || f > crmGestiones[gKey].f) {
          crmGestiones[gKey] = { f: f, tipo: "Agenda", cm: (row[4] || ""), soc: (row[3] || ""), idLead: String(row[6] || "") };
        }
      }
    }
    if (inA(f) && gKey) pSocGest[gKey] = 1;
  }
  r.com = Object.keys(comSocGest).length;
  r.age = Object.keys(ageSocGest).length;
  r.tSG = Object.keys(socGest).length;
  r.pTSG = Object.keys(pSocGest).length;
  for (var d = 0; d < 7; d++) r.dGestion[d] = Object.keys(gestDia[d]).length;

  // ── AUX LEADS ──
  // Filtra por mail (col B), estado NUEVO (col E), ordena desc por diasEstadoActual (col W)
  var ssgAll = [], auxLeads = D.auxLeads;
  var asigSemSoc = {}, asigPrevSoc = {}, asigSemFuenteCount = {};
  var seenAsigSemFuenteSoc = {}, socSinGestAsigSemSet = {}, socSinGestSet = {}, prevSocSinGestSet = {};
  var ssgByLead = {}; // map leadKey -> fila única para top sin gestión
  var asigSemData = {}; // map socKey → datos de la asignación para las sin gestión
  var auxByLead = {}; // map leadKey → datos del auxLead más reciente

  function saveSsgRow(socKey, rowData) {
    if (!socKey || !rowData) return;
    var prev = ssgByLead[socKey];
    if (!prev) {
      ssgByLead[socKey] = rowData;
      return;
    }
    var prevSem = Number(prev.asigSem) || 0;
    var rowSem = Number(rowData.asigSem) || 0;
    if (rowSem !== prevSem) {
      if (rowSem > prevSem) ssgByLead[socKey] = rowData;
      return;
    }
    var prevW = Number(prev.w) || 0;
    var rowW = Number(rowData.w) || 0;
    if (rowW !== prevW) {
      if (rowW < prevW) ssgByLead[socKey] = rowData;
      return;
    }
    var prevFa = prev.fa || '';
    var rowFa = rowData.fa || '';
    if (rowFa > prevFa) ssgByLead[socKey] = rowData;
  }

  for (var i = 0, L = auxLeads.length; i < L; i++) {
    var row = auxLeads[i];
    if (row[0] !== acMail) continue;        // filtro por mail

    var socKey = getLeadKey(row[16], row[6], 'aux:' + i);
    if (row[1] && inS(row[1])) {
      asigSemSoc[socKey] = 1;
      // Guardar datos de la asignación para potencial "sin gestión"
      if (!asigSemData[socKey] || row[1] > (asigSemData[socKey].fa || '')) {
        asigSemData[socKey] = { kt: row[4], kv: row[5], soc: row[6], fa: row[1], sg: row[10], ug: row[11], w: row[8], fuente: row[13], asigSem: 1 };
      }
      var fuente = String(row[13] || '').trim().toUpperCase() || 'OTROS';
      var sfKey = fuente + '|' + socKey;
      if (!seenAsigSemFuenteSoc[sfKey]) {
        seenAsigSemFuenteSoc[sfKey] = 1;
        asigSemFuenteCount[fuente] = (asigSemFuenteCount[fuente] || 0) + 1;
      }
    }
    if (row[1] && inA(row[1])) asigPrevSoc[socKey] = 1;

    if (row[3]) {                            // esNuevo
      socSinGestSet[socKey] = 1;
      saveSsgRow(socKey, { kt: row[4], kv: row[5], soc: row[6], fa: row[1], sg: row[10], ug: row[11], w: row[8], fuente: row[13], asigSem: (row[1] && inS(row[1])) ? 1 : 0 });
      if (row[1] && inS(row[1])) socSinGestAsigSemSet[socKey] = 1;
    }
    // Variación de Soc. Sin Gestión: comparar stock actual vs stock al cierre de la semana anterior
    // (NUEVO hasta fin_ + asignadas del periodo sin gestión CRM)
    if (row[3] && row[1] && row[1] <= fin_) {
      prevSocSinGestSet[socKey] = 1;
    }
    // Top Soc Gestionadas: socs asignadas en la semana, sin estado NUEVO, deduped por ID Lead (fallback sociedad), ordenadas por fa desc
    if (!row[3] && socKey && row[1] && inS(row[1])) {
      if (!auxByLead[socKey] || row[1] > (auxByLead[socKey].fa || '')) {
        auxByLead[socKey] = { kt: row[4], kv: row[5], fa: row[1], fuente: row[13], estado: row[15], cm: row[14], tipo: "Asignación", soc: row[6], idLead: row[16] };
      }
    }
  }
  // Incorporar asignadas SIN gestión CRM (cualquiera sea su estado)
  for (var asigKey in asigSemSoc) {
    if (!socGest[asigKey]) {
      socSinGestAsigSemSet[asigKey] = 1;
      socSinGestSet[asigKey] = 1;
      saveSsgRow(asigKey, asigSemData[asigKey]);
    }
  }
  for (var pAsigKey in asigPrevSoc) {
    if (!pSocGest[pAsigKey]) prevSocSinGestSet[pAsigKey] = 1;
  }

  ssgAll = Object.keys(ssgByLead).map(function (k) { return ssgByLead[k]; });
  var ssgDaysSum = 0, ssgDaysCount = 0;
  for (var ssgI = 0; ssgI < ssgAll.length; ssgI++) {
    var ssgDays = Number(ssgAll[ssgI].w);
    if (!isNaN(ssgDays)) {
      ssgDaysSum += ssgDays;
      ssgDaysCount++;
    }
  }
  ssgAll.sort(function (a, b) {
    var aSem = Number(a.asigSem) || 0;
    var bSem = Number(b.asigSem) || 0;
    if (aSem !== bSem) return bSem - aSem; // asignadas en la semana primero

    var aw = Number(a.w) || 0;
    var bw = Number(b.w) || 0;
    if (aw !== bw) return aw - bw; // asc por diasEstadoActual (más nuevas primero)
    if (!a.fa && !b.fa) return 0;
    if (!a.fa) return 1;
    if (!b.fa) return -1;
    return a.fa < b.fa ? 1 : a.fa > b.fa ? -1 : 0; // empate: fecha asignación más reciente primero
  });
  r.ssgTop5 = ssgAll.slice(0, 5);
  r.socSinGestNum = Object.keys(socSinGestSet).length;
  r.pSocSinGestNum = Object.keys(prevSocSinGestSet).length;
  // Persist actual count keyed by timestamp
  var ssgProps = PropertiesService.getScriptProperties();
  ssgProps.setProperty(ssgStoreKey2, String(r.socSinGestNum));

  // Variación correcta: usar el socSinGestNum real de la semana anterior
  if (!skipPrevLookup) {
    try {
      var prevRpt = getReport(ac, startTs - 604800000, endTs - 604800000, { skipPrevLookup: true });
      if (prevRpt && !prevRpt.error && prevRpt.socSinGestNum !== undefined && prevRpt.socSinGestNum !== null) {
        r.pSocSinGestNum = Number(prevRpt.socSinGestNum) || 0;
      } else {
        var ssgStoredPrev = ssgProps.getProperty(ssgPrevKey2);
        if (ssgStoredPrev !== null) r.pSocSinGestNum = parseInt(ssgStoredPrev, 10) || 0;
      }
    } catch (e) {
      var ssgStoredPrevFallback = ssgProps.getProperty(ssgPrevKey2);
      if (ssgStoredPrevFallback !== null) r.pSocSinGestNum = parseInt(ssgStoredPrevFallback, 10) || 0;
    }
  } else {
    var ssgStoredPrevRaw = ssgProps.getProperty(ssgPrevKey2);
    if (ssgStoredPrevRaw !== null) r.pSocSinGestNum = parseInt(ssgStoredPrevRaw, 10) || 0;
  }
  r.socSinGestAvgDays = ssgDaysCount ? Math.round((ssgDaysSum / ssgDaysCount) * 10) / 10 : 0;
  r.nuevas = Object.keys(asigSemSoc).length;
  r.pNuevas = Object.keys(asigPrevSoc).length;
  r.nuevasFuentes = asigSemFuenteCount;
  r.socSinGestAsigSem = Object.keys(socSinGestAsigSemSet).length;

  var tsgAsig = 0;
  for (var sgKey in socGest) {
    if (asigSemSoc[sgKey]) tsgAsig++;
  }
  r.tSGAsigSem = tsgAsig;

  // Top Soc. Gestionadas: SOLO de crmGestiones (tienes gestión en CRM), enriquecidas con datos de auxLeads, top 5
  var actArr = [];
  for (var crmKey in crmGestiones) {
    var crm = crmGestiones[crmKey];
    var al = auxByLead[crmKey];
    var sortFa = al ? al.fa : crm.f; // usar fa de asignación para ordenamiento, sino fecha CRM
    actArr.push({
      kt: al ? al.kt : '-',
      kv: al ? al.kv : '-',
      soc: crm.soc || (al ? al.soc : '-') || '-',
      fa: crm.f,  // mostrar siempre fecha de comentario/agenda
      fuente: al ? al.fuente : '-',
      estado: al ? al.estado : '-',
      cm: crm.cm,
      tipo: crm.tipo,
      _sortFa: sortFa  // para ordenamiento interno
    });
  }
  actArr.sort(function (a, b) {
    var aSort = a._sortFa;
    var bSort = b._sortFa;
    if (!aSort && !bSort) return 0;
    if (!aSort) return 1;
    if (!bSort) return -1;
    return aSort < bSort ? 1 : aSort > bSort ? -1 : 0;
  });
  r.actSemanal = actArr.slice(0, 5);

  // ── SAC ──
  var sacsTable = [];
  var sacs = D.sacs;
  for (var i = 0, L = sacs.length; i < L; i++) {
    var row = sacs[i];
    if (row[0] !== acN) continue;
    if (inS(row[1])) {
      var estSac = String(row[4] || "").trim().toUpperCase();
      var estShow = "";
      if (estSac === "APROBADO") {
        estShow = "APROBADO";
        r.sacAprob++;
      } else if (estSac === "RECHAZADO") {
        estShow = "RECHAZADO";
        r.sacRech++;
      } else if (estSac === "PENDIENTE") {
        estShow = "PENDIENTE";
        r.sacPend++;
      }
      r.sacs.push({ s: row[3], f: row[1], e: estShow });
      sacsTable.push({
        soc: row[3],
        fecha: row[1],
        estado: estShow,
        jdSol: row[5],
        jdApro: row[6],
        un: row[7]
      });
      var dayIdx = row[2];
      if (dayIdx >= 0) r.dSacs[dayIdx]++;
    }
    if (inA(row[1])) r.pSac++;
  }
  r.sacsTable = sacsTable;

  // ── REMATES ──
  var remIds = {}, pRemIds = {}, remates = D.remates;
  for (var i = 0, L = remates.length; i < L; i++) {
    var row = remates[i];
    if (row[0] !== acN) continue;
    if (inS(row[1])) remIds[row[2]] = 1;
    if (inA(row[1])) pRemIds[row[2]] = 1;
  }
  r.rem = Object.keys(remIds).length;
  r.pRem = Object.keys(pRemIds).length;

  // DEBUG: Log de los datos extraídos
  Logger.log("=== DEBUG AUX LEADS ===");
  Logger.log("acMail: " + acMail);
  Logger.log("ssgTop5 count: " + (r.ssgTop5 ? r.ssgTop5.length : 0));
  if (r.ssgTop5 && r.ssgTop5.length > 0) {
    Logger.log("ssgTop5[0]: " + JSON.stringify(r.ssgTop5[0]));
  }
  Logger.log("actSemanal count: " + (r.actSemanal ? r.actSemanal.length : 0));
  if (r.actSemanal && r.actSemanal.length > 0) {
    Logger.log("actSemanal[0]: " + JSON.stringify(r.actSemanal[0]));
  }

  try {
    var str = JSON.stringify(r);
    if (str.length < 90000) cache.put(rKey, str, 3600);
  } catch (e) { }

  return r;
}

// ── MAIL FUNCTIONS ──
function getConfigData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName("Config 2.0");
  if (!configSheet) return { config: [] };

  var data = configSheet.getDataRange().getValues();
  var config = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] || !row[0].toString().trim()) break;
    config.push([
      row[0] || "", // A: Nombre
      row[1] || "", // B: ID Carpeta Drive
      row[2] || "", // C: Email
      row[3] || "", // D: Nombre mail
      "", // E: (unused)
      row[5] || ""  // F: CC
    ]);
  }

  return { config: config };
}

function sendMailsToCommercials(ac, indices, bodyText) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = getConfigData();
  var config = data.config;

  // Obtener reporte actual
  var curWk = getWeekKey();
  var rpt = getReport(ac, curWk[0], curWk[1]);

  // Convertir reporte a PDF (usando html2pdf en el cliente)
  // Por ahora: crear el HTML y enviarlo por Gmail

  for (var i = 0; i < indices.length; i++) {
    var idx = indices[i];
    var row = config[idx];
    var nombre = row[0];
    var folderId = row[1];
    var email = row[2];
    var cc = row[5];

    if (!email || !email.toString().trim()) continue;

    // Reemplazar placeholders en el body
    var finalBody = bodyText
      .replace(/\[NOMBRE\]/g, nombre)
      .replace(/\[LINK_CARPETA\]/g, folderId ? 'https://drive.google.com/drive/folders/' + folderId : '[link carpeta]');

    // Crear PDF y guardar en carpeta
    var blob = createReportPDF(rpt, ac);
    var fileName = 'Reporte_' + ac.replace(/\s+/g, '_') + '_' + Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyyMMdd') + '.pdf';

    // Si hay folderId, guardar PDF en esa carpeta
    if (folderId) {
      try {
        var folder = DriveApp.getFolderById(folderId);
        folder.createFile(blob.setName(fileName));
      } catch (e) {
        Logger.log("Error saving to folder: " + e);
      }
    }

    // Enviar email
    var emailOptions = {};
    if (cc && cc.toString().trim()) {
      emailOptions.cc = cc;
    }
    emailOptions.attachments = [blob];

    GmailApp.sendEmail(email, 'Reporte Semanal - ' + ac, finalBody, emailOptions);
  }
}

function sendEmailWithPDF(comercial, email, cc, folderId, pdfBase64, fileName, bodyText) {
  try {
    if (!email || !String(email).trim()) {
      throw new Error('Email vacío para ' + comercial);
    }

    var byteChars = Utilities.base64Decode(pdfBase64);
    var blob = Utilities.newBlob(byteChars, MimeType.PDF).setName(fileName);

    if (folderId && String(folderId).trim()) {
      try {
        DriveApp.getFolderById(folderId).createFile(
          Utilities.newBlob(byteChars, MimeType.PDF).setName(fileName)
        );
      } catch (driveErr) {
        Logger.log('Drive error (no crítico): ' + driveErr);
        // No frenar el envío si falla Drive
      }
    }

    var opts = { attachments: [blob], name: 'Reportes Semanales' };
    if (cc && String(cc).trim()) opts.cc = String(cc).trim();

    GmailApp.sendEmail(
      String(email).trim(),
      'Reporte Semanal - ' + comercial,
      bodyText,
      opts
    );

    Logger.log('OK: mail enviado a ' + email + ' para ' + comercial);
    return { ok: true };

  } catch (e) {
    Logger.log('ERROR sendEmailWithPDF [' + comercial + ']: ' + e.toString());
    throw e; // re-throw para que llegue al withFailureHandler del cliente
  }
}

function createReportPDF(rpt, ac) {
  // Crear documento desde HTML del reporte
  // Esta es una versión simplificada - se genera mediante HTML2PDF en el cliente
  // Para una versión más robusta, se podría usar Apps Script Document API

  try {
    var htmlContent = '<html><body><h2>Reporte Semanal: ' + ac + '</h2>';
    htmlContent += '<p>Generado: ' + Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm') + '</p>';
    htmlContent += '</body></html>';

    var blob = Utilities.newBlob(htmlContent, MimeType.HTML);
    return blob.getAs('application/pdf');
  } catch (e) {
    Logger.log("Error creating PDF: " + e);
    return Utilities.newBlob('Error generando PDF', MimeType.PLAIN_TEXT);
  }
}

function getWeekKey() {
  var today = new Date();
  var tz = 'America/Argentina/Buenos_Aires';
  var dayOfWeek = parseInt(Utilities.formatDate(today, tz, 'u')); // 1=Sun, 7=Sat
  var daysBackToMonday = dayOfWeek === 1 ? 6 : dayOfWeek - 2;
  var monday = new Date(today.getTime() - daysBackToMonday * 86400000);

  var weekNum = parseInt(Utilities.formatDate(monday, tz, 'w'));
  var year = parseInt(Utilities.formatDate(monday, tz, 'yyyy'));

  return [weekNum.toString(), year.toString()];
}
