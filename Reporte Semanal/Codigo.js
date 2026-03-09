/**
 * REPORTES SEMANALES v7.1 — CACHE-FIRST
 * Fix v7.1: aux leads filtra por mail (col B) en lugar de nombre normalizado
 */

// ─── Clear Cache (ejecutar manualmente) ─────────────────────────────────────
function clearCache() {
  var cache = CacheService.getScriptCache();
  var props = PropertiesService.getScriptProperties();
  // Limpia config
  cache.remove('CFG7');
  // Limpia datos directos
  cache.remove('DATA8');
  // Limpia chunks de datos
  var nStr = cache.get("DATA8_N");
  if (nStr) {
    var n = parseInt(nStr);
    var keys = ['DATA8_N'];
    for (var i = 0; i < n; i++) keys.push("DATA8_" + i);
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
  return props.getProperty('R12_VER') || '0';
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
    hasCFG7: !!cache.get('CFG7'),
    hasDATA8: !!cache.get('DATA8'),
    data8Chunks: cache.get('DATA8_N') || '0',
    ac: ac || '',
    acMail: acMail,
    reportKey: rKey,
    reportHit: rHit
  };
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function norm(s) {
  if (!s) return "";
  return String(s).trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[áà]/g,"a").replace(/[éè]/g,"e")
    .replace(/[íì]/g,"i").replace(/[óò]/g,"o")
    .replace(/[úù]/g,"u").replace(/ñ/g,"n");
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
      var op  = e.parameter.op;
      var out = op === "config" ? getConfig()
              : op === "report" ? getReport(e.parameter.ac, +e.parameter.startTs, +e.parameter.endTs)
              : op === "warmup" ? warmup()
              : { error: "op desconocida" };
      return ContentService.createTextOutput(JSON.stringify(out))
        .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
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
  var hit   = cache.get("CFG7");
  if (hit) return JSON.parse(hit);

  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aux = rawSheet(ss, "aux");
  var acMap = {}, semanas = [], seenSem = {};

  aux.forEach(function(row) {
    // col O (idx 14) = nombre, col U (idx 20) = mail
    var nombre = String(row[14] || "").trim();
    var mail   = String(row[20] || "").trim().toLowerCase();
    if (nombre && mail) acMap[nombre] = mail;

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

  var cfg = { acs: Object.keys(acMap).sort(), acMap: acMap, semanas: semanas };
  try { cache.put("CFG7", JSON.stringify(cfg), 3600); } catch(e) {}
  return cfg;
}

// ─── loadData ────────────────────────────────────────────────────────────────

function loadData() {
  var cache     = CacheService.getScriptCache();
  var fromCache = getDataFromCache(cache);
  if (fromCache) return fromCache;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();

  // ── BASE ──
  var base = [];
  rawSheet(ss, "BASE").forEach(function(row) {
    var ac  = norm(row[5]); if (!ac) return;
    var f   = toDateStr(row[1], tz); if (!f) return;
    var est = String(row[3] || "").trim().toUpperCase();
    var gF  = Number(row[6]);
    var mot = String(row[15] || "").trim();
    var ok  = false, ccc = false;
    if (est === "CONCRETADA" || est === "PUBLICADO") { ok = true; ccc = true; }
    else if (est === "NO CONCRETADAS" && mot !== "No la comercializo" && gF === 1) { ok = true; }
    if (!ok) return;
    base.push([ac, f, toDayIdx(row[1]), row[2]||"", Number(row[4])||0, ccc ? 1 : 0]);
    // 0=ac 1=f 2=di 3=soc 4=cab 5=ccc
  });

  // ── OPS ──
  var ops = [];
  rawSheet(ss, "OPS").forEach(function(row) {
    var aV = norm(row[6]), aC = norm(row[8]);
    if (!aV && !aC) return;
    var f     = toDateStr(row[2], tz); if (!f) return;
    var cargF = row[18] ? toDateStr(row[18], tz) : "";
    var cargAcRaw = String(row[22] || "").trim();
    ops.push([
      aV, aC, f, toDayIdx(row[2]),
      Number(row[9])||0,
      row[5]||"", row[7]||"",
      toFmt(row[2], tz),
      String(row[0]||""), String(row[1]||""), String(row[22]||""),
      norm(cargAcRaw), cargF, cargF ? toDayIdx(row[18]) : -1,
      String(row[20]||""), String(row[21]||""),
      cargAcRaw.toLowerCase()
    ]);
    // 0=aV 1=aC 2=f 3=di 4=q 5=socV 6=socC 7=fmt 8=id 9=un 10=cat 11=cargAcNorm 12=cargF 13=cargDi 14=cuitV 15=cuitC 16=cargAcLower
  });

  // ── COMENTARIOS CRM ──
  var coms = [];
  rawSheet(ss, "Comentarios_CRM").forEach(function(row) {
    var mail = String(row[5]||"").trim().toLowerCase(); if (!mail) return;
    var f    = toDateStr(row[3], tz); if (!f) return;
    coms.push([mail, f, toDayIdx(row[3]), row[0]||"", !String(row[7]||"").trim() ? 1 : 0]);
    // 0=mail 1=f 2=di 3=soc 4=esCom
  });

  // ── AGENDA CRM ──
  var agendas = [];
  rawSheet(ss, "Agenda_CRM").forEach(function(row) {
    var mail = String(row[3]||"").trim().toLowerCase(); if (!mail) return;
    var f    = toDateStr(row[4], tz); if (!f) return;
    agendas.push([mail, f, toDayIdx(row[4]), row[1]||""]);
    // 0=mail 1=f 2=di 3=soc
  });

  // ── LEADS CRM (Soc. Cargadas) ──
  // col B (idx 1) = fechaAsignacion, col C (idx 2) = mail AC, col D (idx 3) = fuente, col L (idx 11) = estado
  var leads = [];
  rawSheet(ss, "Leads_CRM").forEach(function(row) {
    var mail = String(row[2]||"" ).trim().toLowerCase(); if (!mail) return;
    if (String(row[3]||"" ).trim() !== "UA") return;
    if (String(row[11]||"" ).trim() === "NO HABILITADO") return;
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
  rawSheet(ss, "aux leads").forEach(function(row) {
    var mail = String(row[1]||"").trim().toLowerCase(); if (!mail) return;
    var est  = String(row[4]||"").trim().toUpperCase();
    var f    = toDateStr(row[2], tz);
    auxLeads.push([
      mail,                              // 0  mail comercial (col B)
      f,                                 // 1  fechaAsignacion (col C)
      f ? toDayIdx(row[2]) : -1,        // 2  dayIdx
      est === "NUEVO" ? 1 : 0,          // 3  esNuevo (col E)
      String(row[31]||""),               // 4  kt           (col AF)
      String(row[36]||""),               // 5  kv           (col AK)
      String(row[29]||""),               // 6  razonSocial  (col AD)
      String(row[38]||""),               // 7  sinGestion   (col AM)
      Number(row[22])||0,                // 8  diasEstadoActual (col W) → orden
      Number(row[32])||0,                // 9  ng  (para actSemanal)
      String(row[40]||""),               // 10 ultGestion   (col AO)
      String(row[39]||""),               // 11 ultActividad (col AN)
      String(row[26]||""),               // 12 cuit         (col AA)
      String(row[37]||""),               // 13 fuente       (col AL)
      String(row[41]||"")                // 14 comentario   (col AP)
    ]);
  });

  // ── SAC ──
  // Columnas: A=usuario-soc(0), D=fechaSol(3), Y=estado(24), U=jdSol(20), W=jdApro(22), AC=acNorm(28)
  var sacs = [];
  rawSheet(ss, "SAC").forEach(function(row) {
    var ac = norm(row[28]); if (!ac) return;
    var f  = toDateStr(row[3], tz); if (!f) return;
    var di = toDayIdx(row[3]);
    sacs.push([
      ac,                     // 0  acNorm (col AC idx 28)
      f,                      // 1  fecha (col D idx 3)
      di,                     // 2  dayIdx
      String(row[0]||""),     // 3  usuario-sociedad (col A idx 0)
      String(row[24]||""),    // 4  estado (col Y idx 24)
      String(row[20]||""),    // 5  jd solicitadas (col U idx 20)
      String(row[22]||""),    // 6  jd aprobadas (col W idx 22)
      String(row[1]||"")      // 7  UN (col B idx 1)
    ]);
  });

  // ── REMATES ──
  var remates = [];
  rawSheet(ss, "REMATES").forEach(function(row) {
    var ac = norm(row[2]); if (!ac) return;
    var f  = toDateStr(row[1], tz); if (!f) return;
    remates.push([ac, f, String(row[3]||Math.random())]);
    // 0=ac 1=f 2=id
  });

  // ── BCFULL (para mapeo CUIT → Kt, Kv) ──
  var bcfull = [];
  rawSheet(ss, "BCFULL").forEach(function(row) {
    var cuit = String(row[1]||"").trim(); if (!cuit) return;
    var kt = String(row[3]||"").trim();
    var kv = String(row[4]||"").trim();
    bcfull.push([cuit, kt, kv]);
    // 0=cuit 1=kt 2=kv
  });

  var data = { base:base, ops:ops, coms:coms, agendas:agendas,
               leads:leads, auxLeads:auxLeads, sacs:sacs, remates:remates, bcfull:bcfull };

  saveDataToCache(cache, data);
  return data;
}

function saveDataToCache(cache, data) {
  try {
    var str    = JSON.stringify(data);
    var chunks = Math.ceil(str.length / 90000);
    if (chunks === 1) {
      cache.put("DATA8", str, 3600);
      return;
    }
    var entries = { "DATA8_N": String(chunks) };
    for (var i = 0; i < chunks; i++) {
      entries["DATA8_" + i] = str.slice(i * 90000, (i + 1) * 90000);
    }
    cache.putAll(entries, 3600);
  } catch(e) {}
}

function getDataFromCache(cache) {
  var direct = cache.get("DATA8");
  if (direct) { try { return JSON.parse(direct); } catch(e) {} }
  var nStr = cache.get("DATA8_N");
  if (!nStr) return null;
  var n    = parseInt(nStr);
  var keys = [];
  for (var i = 0; i < n; i++) keys.push("DATA8_" + i);
  var parts = cache.getAll(keys);
  var str   = "";
  for (var i = 0; i < n; i++) {
    var p = parts["DATA8_" + i];
    if (!p) return null;
    str += p;
  }
  try { return JSON.parse(str); } catch(e) { return null; }
}

// ─── warmup ──────────────────────────────────────────────────────────────────

function warmup() {
  getConfig();
  loadData();
  return { ok: true };
}

// ─── getReport ───────────────────────────────────────────────────────────────

function getReport(ac, startTs, endTs) {
  var cfg    = getConfig();
  var acMail = cfg.acMap[ac];
  if (!acMail) return { error: "AC no encontrado: " + ac };

  var acN = norm(ac);
  var reportCacheVersion = getReportCacheVersion();

  var cache = CacheService.getScriptCache();
  var rKey  = "R12_" + reportCacheVersion + "_" + acMail.replace(/[@.]/g,"_") + "_" + startTs + "_" + endTs;
  var hit   = cache.get(rKey);
  if (hit) { try { return JSON.parse(hit); } catch(e) {} }

  var D = loadData();

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var tz   = ss.getSpreadsheetTimeZone();
  var d0   = new Date(startTs); d0.setHours(0,0,0,0);
  var d1   = new Date(endTs);   d1.setHours(23,59,59,999);
  var ini  = Utilities.formatDate(d0, tz, "yyyyMMdd");
  var fin  = Utilities.formatDate(d1, tz, "yyyyMMdd");
  var ini_ = Utilities.formatDate(new Date(startTs - 604800000), tz, "yyyyMMdd");
  var fin_ = Utilities.formatDate(new Date(endTs   - 604800000), tz, "yyyyMMdd");

  function inS(f) { return f >= ini  && f <= fin;  }
  function inA(f) { return f >= ini_ && f <= fin_; }

  var r = {
    cab:0, trop:0, pCab:0, pTrop:0, cccNum:0, cccDen:0,
    dT:[0,0,0,0,0,0,0],
    cabV:0, cabC:0, cabConc:0, trConc:0, pConc:0,
    carg:0, cargProp:0, cargAjen:0, dCargas:[0,0,0,0,0,0,0],
    com:0, age:0, tSG:0, pTSG:0, dGestion:[0,0,0,0,0,0,0],
    nuevas:0, pNuevas:0, socSinGestNum:0, pSocSinGestNum:0,
    sacs:[], sacsTable:[], pSac:0, rem:0, pRem:0, dSacs:[0,0,0,0,0,0,0],
    top5:[], ssgTop5:[], actSemanal:[],
    socOf:0, socOps:0, ccc:"0%"
  };

  // ── BASE ──
  var socOf = {}, base = D.base;
  for (var i = 0, L = base.length; i < L; i++) {
    var row = base[i];
    if (row[0] !== acN) continue;
    var f = row[1];
    if (inS(f)) {
      r.cab += row[4]; r.trop++;
      if (row[5]) r.cccNum++;
      r.cccDen++;
      if (row[3]) socOf[row[3]] = 1;
      if (row[2] >= 0) r.dT[row[2]]++;
    }
    if (inA(f)) { r.pCab += row[4]; r.pTrop++; }
  }
  r.socOf = Object.keys(socOf).length;
  r.ccc   = r.cccDen > 0 ? Math.round(r.cccNum / r.cccDen * 100) + "%" : "0%";

  // ── Mapeo CUIT → Kt, Kv desde BCFULL ──
  var cuitKtKvMap = {};
  var bcfullData = D.bcfull;
  for (var i = 0, L = bcfullData.length; i < L; i++) {
    var row = bcfullData[i];
    var cuit = row[0]; // CUIT
    if (cuit && !cuitKtKvMap[cuit]) {
      cuitKtKvMap[cuit] = { kt: row[1], kv: row[2] };
    }
  }

  // ── OPS ──
  // cabConc: suma q una sola vez por ID de operación (evita doble conteo si el AC es V y C)
  // cabV / cabC: desglose informativo, pueden sumar más que cabConc
  var socOps = {}, allOps = [], ops = D.ops;
  var seenS = {}, seenA = {};
  for (var i = 0, L = ops.length; i < L; i++) {
    var row = ops[i];
    var isV = row[0] === acN, isC = row[1] === acN;
    if (!isV && !isC) continue;
    var f  = row[2];
    var id = row[8];
    if (inS(f)) {
      if (!seenS[id]) {
        seenS[id] = 1;
        r.cabConc += row[4]; // suma q una sola vez por op
        r.trConc++;           // cuenta tropa una sola vez por op
      }
      if (isV) { r.cabV += row[4]; if (row[5]) socOps[row[5]] = 1; }
      if (isC) { r.cabC += row[4]; if (row[6]) socOps[row[6]] = 1; }
      var cuitLookup = String(row[14]||"").trim();
      var ktKv = cuitKtKvMap[cuitLookup] || { kt: '-', kv: '-' };
      var isCargForAc = row[11] === acN || row[16] === acMail;
      var tieneCargar = isCargForAc ? 'Sí' : '';
      var acLado = isV && isC ? 'vend/comp' : (isV ? 'vend' : 'comp');
      allOps.push({ q:row[4], kt:ktKv.kt, kv:ktKv.kv, d:[row[8],row[9],row[5],row[0],row[6],row[1],row[7],row[4],tieneCargar,acLado] });
    }
    if (inA(f) && !seenA[id]) { seenA[id] = 1; r.pConc += row[4]; }
    if ((row[11] === acN || row[16] === acMail) && row[12] && inS(row[12])) {
      r.carg++;
      if (isV) r.cargProp++; else r.cargAjen++;
      if (row[13] >= 0) r.dCargas[row[13]]++;
    }
  }
  r.socOps = Object.keys(socOps).length;
  allOps.sort(function(a,b) { return b.q - a.q; });
  r.top5 = allOps.slice(0, 5);

  // ── CRM ──
  var socGest = {}, pSocGest = {}, gestDia = [{},{},{},{},{},{},{}];
  var coms = D.coms;
  for (var i = 0, L = coms.length; i < L; i++) {
    var row = coms[i];
    if (row[0] !== acMail) continue;
    var f = row[1];
    if (inS(f)) {
      if (row[4]) r.com++;
      if (row[3]) { socGest[row[3]] = 1; if (row[2] >= 0) gestDia[row[2]][row[3]] = 1; }
    }
    if (inA(f) && row[3]) pSocGest[row[3]] = 1;
  }
  var agendas = D.agendas;
  for (var i = 0, L = agendas.length; i < L; i++) {
    var row = agendas[i];
    if (row[0] !== acMail) continue;
    var f = row[1];
    if (inS(f)) {
      r.age++;
      if (row[3]) { socGest[row[3]] = 1; if (row[2] >= 0) gestDia[row[2]][row[3]] = 1; }
    }
    if (inA(f) && row[3]) pSocGest[row[3]] = 1;
  }
  r.tSG  = Object.keys(socGest).length;
  r.pTSG = Object.keys(pSocGest).length;
  for (var d = 0; d < 7; d++) r.dGestion[d] = Object.keys(gestDia[d]).length;

  // ── LEADS ──
  // filtra por mail (col C de Leads_CRM)
  var leads = D.leads;
  for (var i = 0, L = leads.length; i < L; i++) {
    var row = leads[i];
    if (row[0] !== acMail) continue;
    if (inS(row[1])) r.nuevas++;
    if (inA(row[1])) r.pNuevas++;
  }

  // ── AUX LEADS ──
  // Filtra por mail (col B), estado NUEVO (col E), ordena desc por diasEstadoActual (col W)
  var ssgAll = [], auxLeads = D.auxLeads;
  for (var i = 0, L = auxLeads.length; i < L; i++) {
    var row = auxLeads[i];
    if (row[0] !== acMail) continue;        // filtro por mail
    if (row[3]) {                            // esNuevo
      r.socSinGestNum++;
      ssgAll.push({ kt:row[4], kv:row[5], soc:row[6], fa:row[1], sg:row[10], ug:row[11], w:row[8], fuente:row[13] });
    }
    if (row[3] && row[1] && inA(row[1])) {
      r.pSocSinGestNum++;
    }
    if (row[1] && inS(row[1]) && row[9] <= 6 && row[7] !== "sin gestion") {
      r.actSemanal.push({ kt:row[4], kv:row[5], soc:row[6], fa:row[1], sg:row[10], ug:row[11], cm:row[14], w:row[8], fs:row[1] });
    }
  }
  ssgAll.sort(function(a,b) { return b.w - a.w; }); // desc por diasEstadoActual
  r.ssgTop5 = ssgAll.slice(0, 5);
  r.actSemanal.sort(function(a,b) { return b.fs > a.fs ? 1 : b.fs < a.fs ? -1 : a.w - b.w; });

  // ── SAC ──
  var sacsTable = [];
  var sacs = D.sacs;
  for (var i = 0, L = sacs.length; i < L; i++) {
    var row = sacs[i];
    if (row[0] !== acN) continue;
    if (inS(row[1])) {
      r.sacs.push({ s: row[3], f: row[1], e: row[4] });
      sacsTable.push({
        soc: row[3],
        fecha: row[1],
        estado: row[4],
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
    if (inS(row[1])) remIds[row[2]]  = 1;
    if (inA(row[1])) pRemIds[row[2]] = 1;
  }
  r.rem  = Object.keys(remIds).length;
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
  } catch(e) {}

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
      row[0]||"", // A: Nombre
      row[1]||"", // B: ID Carpeta Drive
      row[2]||"", // C: Email
      row[3]||"", // D: Nombre mail
      "", // E: (unused)
      row[5]||""  // F: CC
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
      } catch(e) {
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
      } catch(driveErr) {
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

  } catch(e) {
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
  } catch(e) {
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
