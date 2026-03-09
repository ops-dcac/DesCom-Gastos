/** 
 * REPORTES SEMANALES - VERSIÓN ULTRA RÁPIDA 4.0
 * Sincronizado exactamente con fórmulas de Excel (Single Fetch & Exact Dates)
 */

function doGet() {
  return HtmlService.createTemplateFromFile("Index").evaluate()
    .setTitle("Reporte Semanal")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function getConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = { errors: [] };
  try {
    var c = ss.getSheetByName("Config 2.0");
    var d = c.getRange("A2:A" + c.getLastRow()).getValues();
    result.acs = d.map(function (r) { return r[0]; }).filter(String);
  } catch (e) { result.errors.push("Config 2.0: " + e); result.acs = []; }

  try {
    var s = ss.getSheetByName("aux");
    var d = s.getDataRange().getValues();
    result.semanas = [];
    for (var i = 1; i < d.length; i++) {
      var row = d[i];
      if (row[9] && row[10] && row[11]) {
        result.semanas.push({
          n: row[9],
          s: row[10] instanceof Date ? row[10].getTime() : new Date(row[10]).getTime(),
          e: row[11] instanceof Date ? row[11].getTime() : new Date(row[11]).getTime(),
          y: row[12]
        });
      }
    }
  } catch (e) { result.errors.push("aux: " + e); result.semanas = []; }
  return result;
}

function getReport(ac, startTs, endTs) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ssTZ = ss.getSpreadsheetTimeZone();

  var dIn = new Date(startTs); dIn.setHours(0, 0, 0, 0);
  var dFi = new Date(endTs); dFi.setHours(23, 59, 59, 999);
  var dInAnt = new Date(startTs - 604800000); dInAnt.setHours(0, 0, 0, 0);
  var dFiAnt = new Date(endTs - 604800000); dFiAnt.setHours(23, 59, 59, 999);

  var dInicio = Utilities.formatDate(dIn, ssTZ, "yyyyMMdd");
  var dFin = Utilities.formatDate(dFi, ssTZ, "yyyyMMdd");
  var dInicioAnt = Utilities.formatDate(dInAnt, ssTZ, "yyyyMMdd");
  var dFinAnt = Utilities.formatDate(dFiAnt, ssTZ, "yyyyMMdd");

  var r = {
    cab: 0, trop: 0, dT: [0, 0, 0, 0, 0, 0, 0], pCab: 0, pTrop: 0, cccNum: 0,
    cabV: 0, cabC: 0, trConc: 0, pConc: 0, socOps: 0, top5: [],
    tSG: 0, pTSG: 0, com: 0, age: 0, nuevas: 0, pNuevas: 0,
    socSinGestNum: 0, ssgTop5: [], actSemanal: [],
    sacs: [], pSac: 0, rem: 0, pRem: 0,
    carg: 0, cargProp: 0, cargAjen: 0
  };

  // 1. BASE (Ofrecidas)
  try {
    var dBase = getSheetData(ss, "BASE", 16);
    var socS = {};
    for (var i = 0; i < dBase.length; i++) {
      var row = dBase[i];
      if (String(row[5] || "").trim() !== ac) continue;
      var f = row[1]; if (!(f instanceof Date)) continue;
      var fStr = Utilities.formatDate(f, ssTZ, "yyyyMMdd");

      var est = String(row[3] || "").trim().toUpperCase();
      var gF = Number(row[6]);
      var mot = String(row[15] || "").trim();
      var cab = Number(row[4]) || 0;

      var ok = false;
      var esCCC = false;
      if (est === "CONCRETADA") { ok = true; esCCC = true; }
      else if (est === "PUBLICADO") { ok = true; esCCC = true; }
      else if (est === "NO CONCRETADAS" && mot !== "No la comercializo" && gF === 1) { ok = true; }

      if (!ok) continue;

      if (fStr >= dInicio && fStr <= dFin) {
        r.cab += cab; r.trop++;
        if (esCCC) r.cccNum++;
        if (row[2]) socS[row[2]] = 1;
        var dIdx = f.getDay() === 0 ? 6 : f.getDay() - 1;
        r.dT[dIdx]++;
      }
      if (fStr >= dInicioAnt && fStr <= dFinAnt) { r.pCab += cab; r.pTrop++; }
    }
    r.socOf = Object.keys(socS).length;
    r.ccc = r.trop > 0 ? Math.round((r.cccNum / r.trop) * 100) + "%" : "0%";
  } catch (e) { r.errBase = e.message; }

  // 2. OPS (Concretadas + Cargas)
  try {
    var dOps = getSheetData(ss, "OPS", 23);
    var socOps = {}; var allOps = [];
    for (var i = 0; i < dOps.length; i++) {
      var row = dOps[i];
      var fOp = row[2]; if (!(fOp instanceof Date)) continue;
      var fOpStr = Utilities.formatDate(fOp, ssTZ, "yyyyMMdd");

      var aV = String(row[6] || "").trim();
      var aC = String(row[8] || "").trim();
      var q = Number(row[9]) || 0;

      if (aV === ac || aC === ac) {
        if (fOpStr >= dInicio && fOpStr <= dFin) {
          if (aV === ac) { r.cabV += q; if (row[5]) socOps[row[5]] = 1; }
          if (aC === ac) { r.cabC += q; if (row[7]) socOps[row[7]] = 1; }
          r.trConc++;
          allOps.push({ q: q, d: [row[0] || "", row[1] || "", row[5] || "", row[6] || "", row[7] || "", row[8] || "", Utilities.formatDate(fOp, ssTZ, "dd/MM/yyyy"), q, row[22] || "", row[20] || "", row[10] || ""] });
        }
        if (fOpStr >= dInicioAnt && fOpStr <= dFinAnt) r.pConc += q;
      }

      var fCar = row[18];
      if (fCar instanceof Date && String(row[22] || "").trim() === ac) {
        var fCarStr = Utilities.formatDate(fCar, ssTZ, "yyyyMMdd");
        if (fCarStr >= dInicio && fCarStr <= dFin) {
          r.carg++;
          if (aV === ac) r.cargProp++; else r.cargAjen++;
        }
      }
    }
    allOps.sort(function (a, b) { return b.q - a.q; });
    r.top5 = allOps.slice(0, 5);
    r.socOps = Object.keys(socOps).length;
  } catch (e) { r.errOps = e.message; }

  // 3. CRM (Comentarios + Agendas + Soc. Gestionadas)
  var socGestSet = {};
  var psocGestSet = {};
  try {
    var dCom = getSheetData(ss, "Comentarios_CRM", 8);
    for (var i = 0; i < dCom.length; i++) {
      var row = dCom[i]; if (String(row[5] || "").trim() !== ac) continue;
      var f = row[3]; if (!(f instanceof Date)) continue;
      var fStr = Utilities.formatDate(f, ssTZ, "yyyyMMdd");
      if (fStr >= dInicio && fStr <= dFin) {
        if (String(row[7] || "").trim() === "") r.com++;
        if (row[0]) socGestSet[row[0]] = 1;
      }
      if (fStr >= dInicioAnt && fStr <= dFinAnt) {
        if (row[0]) psocGestSet[row[0]] = 1;
      }
    }
    var dAge = getSheetData(ss, "Agenda_CRM", 5);
    for (var i = 0; i < dAge.length; i++) {
      var row = dAge[i]; if (String(row[3] || "").trim() !== ac) continue;
      var f = row[4]; if (!(f instanceof Date)) continue;
      var fStr = Utilities.formatDate(f, ssTZ, "yyyyMMdd");
      if (fStr >= dInicio && fStr <= dFin) {
        r.age++;
        if (row[1]) socGestSet[row[1]] = 1;
      }
      if (fStr >= dInicioAnt && fStr <= dFinAnt) {
        if (row[1]) psocGestSet[row[1]] = 1;
      }
    }
    r.tSG = Object.keys(socGestSet).length;
    r.pTSG = Object.keys(psocGestSet).length;
  } catch (e) { }

  // 4. LEADS (Nuevas)
  try {
    var dLeads = getSheetData(ss, "Leads_CRM", 12);
    for (var i = 0; i < dLeads.length; i++) {
      var row = dLeads[i]; if (String(row[2] || "").trim() !== ac) continue;
      if (String(row[3]).trim() !== "UA" || String(row[11]).trim() === "NO HABILITADO") continue;
      var f = row[1]; if (!(f instanceof Date)) continue;
      var fStr = Utilities.formatDate(f, ssTZ, "yyyyMMdd");
      if (fStr >= dInicio && fStr <= dFin) r.nuevas++;
      if (fStr >= dInicioAnt && fStr <= dFinAnt) r.pNuevas = (r.pNuevas || 0) + 1;
    }
  } catch (e) { }

  // 5. aux leads (Top 5 Soc. Sin Gestion & Actividad Semanal)
  try {
    var dAux = getSheetData(ss, "aux leads", 45);
    var ssgAll = [];
    for (var i = 0; i < dAux.length; i++) {
      var row = dAux[i];
      if (String(row[1] || "").trim() !== ac) continue; // Col B

      var isNuevo = (String(row[4] || "").trim().toUpperCase() === "NUEVO"); // Col E
      if (isNuevo) r.socSinGestNum++;

      var obj = {
        kt: row[31] || "", kv: row[36] || "", soc: row[29] || "",
        fa: row[2] instanceof Date ? Utilities.formatDate(row[2], ssTZ, "dd/MM/yyyy") : String(row[2] || ""),
        fu: row[37] || "", ug: row[40] || "", ua: row[39] || "", sg: row[38] || "",
        w: Number(row[22]) || 0,
        cDateStr: row[2] instanceof Date ? Utilities.formatDate(row[2], ssTZ, "yyyyMMdd") : ""
      };

      if (isNuevo) ssgAll.push(obj);

      if (obj.cDateStr >= dInicio && obj.cDateStr <= dFin) {
        var ag = Number(row[32]) || 0; // Col AG
        var aoStr = String(row[40] || "").trim().toLowerCase(); // Col AO
        if (ag <= 6 && aoStr !== "sin gestión") r.actSemanal.push(obj);
      }
    }
    ssgAll.sort(function (a, b) { return b.w - a.w; });
    r.ssgTop5 = ssgAll.slice(0, 5);
    r.actSemanal.sort(function (a, b) {
      if (b.cDateStr !== a.cDateStr) return b.cDateStr > a.cDateStr ? 1 : -1;
      return a.w - b.w;
    });
  } catch (e) { }

  // 6. SACs
  try {
    var dSac = getSheetData(ss, "SAC", 20);
    for (var i = 0; i < dSac.length; i++) {
      var row = dSac[i]; if (String(row[18] || "").trim() !== ac) continue;
      var f = row[19]; if (!(f instanceof Date)) continue;
      var fStr = Utilities.formatDate(f, ssTZ, "yyyyMMdd");
      if (fStr >= dInicio && fStr <= dFin) r.sacs.push({ s: row[1] || "", f: f.getTime(), e: row[3] || "" });
      if (fStr >= dInicioAnt && fStr <= dFinAnt) r.pSac++;
    }
  } catch (e) { }

  // 7. REMATES (Unique)
  try {
    var dRem = getSheetData(ss, "REMATES", 4);
    var remIds = {}, pRemIds = {};
    for (var i = 0; i < dRem.length; i++) {
      var row = dRem[i]; if (String(row[2] || "").trim() !== ac) continue;
      var f = row[1]; if (!(f instanceof Date)) continue;
      var fStr = Utilities.formatDate(f, ssTZ, "yyyyMMdd");
      var id = row[3] || i;
      if (fStr >= dInicio && fStr <= dFin) remIds[id] = 1;
      if (fStr >= dInicioAnt && fStr <= dFinAnt) pRemIds[id] = 1;
    }
    r.rem = Object.keys(remIds).length; r.pRem = Object.keys(pRemIds).length;
  } catch (e) { }

  return r;
}

function getSheetData(ss, name, lastCol) {
  var s = ss.getSheetByName(name);
  if (!s) return [];
  var lr = s.getLastRow();
  if (lr < 2) return [];
  return s.getRange(2, 1, lr - 1, lastCol).getValues();
}

function dwk(f) { var d = f.getDay(); return d === 0 ? 6 : d - 1; }
function fd(v) { if (!v) return ""; if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy"); return String(v); }
