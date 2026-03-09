function onInstall() {
  onOpen();
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Metabase')
    .addItem('Actualizar Transacción 4569', 'import4569bis')
    .addToUi();
}

// ----------------------
// FUNCIÓN PRINCIPAL (MANUAL)
// ----------------------

function import4569bis() {
  importQuestion('4569', 'Import', true);
}

function import4569Automatico() {
  importQuestion('4569', 'Import', false);
}

// ----------------------
// LÓGICA CENTRAL DE IMPORTACIÓN
// ----------------------

function importQuestion(metabaseQuestionNum, sheetName, showUiAlert) {
  SpreadsheetApp.flush();

  if (metabaseQuestionNum !== 'cancel' && !isNaN(metabaseQuestionNum)) {
    var status = getQuestionAsCSV(metabaseQuestionNum, sheetName);

    if (status.success) {
      // ── Guardar timestamp del import en hoja import_meta
      saveImportTimestamp();

      // ── Invalidar caches auxiliares (base clave, credit perf, SAC, DCP)
      //    para que el warm-up los regenere con datos frescos
      try { invalidateAuxCache(); } catch(e) { Logger.log('invalidateAuxCache error: ' + e); }

      // ── Precalentar el cache de cada usuario
      //    Así cuando entren ya tienen respuesta en ~1s en vez de ~15s
      try { warmUpAllUsersCache(); } catch(e) { Logger.log('warmUpAllUsersCache error: ' + e); }
    }

    if (showUiAlert) {
      var ui = SpreadsheetApp.getUi();
      if (status.success) {
        ui.alert('Éxito: Pregunta ' + metabaseQuestionNum + ' importada correctamente en la hoja "' + sheetName + '".');
      } else {
        ui.alert('Error en la importación: ' + status.error);
      }
    } else {
      Logger.log('Importación automática finalizada. Status: ' + JSON.stringify(status));
    }
  }
  SpreadsheetApp.flush();
}

// ----------------------
// TIMESTAMP DEL IMPORT
// ----------------------

function saveImportTimestamp() {
  try {
    var ss        = SpreadsheetApp.getActiveSpreadsheet();
    var metaSheet = ss.getSheetByName('import_meta') || ss.insertSheet('import_meta');
    metaSheet.getRange('A1').setValue('ultima_importacion');
    metaSheet.getRange('B1').setValue(new Date());
    Logger.log('Timestamp guardado en import_meta!B1');
  } catch(e) {
    Logger.log('saveImportTimestamp error: ' + e);
  }
}

// ----------------------
// CONEXIÓN CON API DE METABASE
// ----------------------

function getQuestionAsCSV(metabaseQuestionNum, sheetName) {
  var scriptProp = PropertiesService.getScriptProperties();
  var baseUrl    = scriptProp.getProperty('BASE_URL');
  var username   = scriptProp.getProperty('USERNAME');
  var password   = scriptProp.getProperty('PASSWORD');
  var token      = scriptProp.getProperty('TOKEN');

  if (!token) {
    token = getToken(baseUrl, username, password);
    scriptProp.setProperty('TOKEN', token);
  }

  return getQuestionAndFillSheet(baseUrl, token, metabaseQuestionNum, sheetName);
}

function getToken(baseUrl, username, password) {
  var sessionUrl = baseUrl + "api/session";
  var options = {
    "method": "post",
    "headers": { "Content-Type": "application/json" },
    "payload": JSON.stringify({ username: username, password: password })
  };

  try {
    var response = UrlFetchApp.fetch(sessionUrl, options);
    return JSON.parse(response).id;
  } catch (e) {
    throw new Error("No se pudo obtener el Token de Metabase. Revisa credenciales.");
  }
}

function getQuestionAndFillSheet(baseUrl, token, metabaseQuestionNum, sheetName) {
  var questionUrl = baseUrl + "api/card/" + metabaseQuestionNum + "/query/csv";
  var options = {
    "method": "post",
    "headers": {
      "Content-Type": "application/json",
      "X-Metabase-Session": token
    },
    "muteHttpExceptions": true
  };

  try {
    var response   = UrlFetchApp.fetch(questionUrl, options);
    var statusCode = response.getResponseCode();

    if (statusCode === 200 || statusCode === 202) {
      var csvData = response.getContentText();
      var values  = Utilities.parseCsv(csvData);
      fillSheet(values, sheetName);
      return { success: true };
    }
    else if (statusCode === 401) {
      // Token expirado → renovar y reintentar una vez
      var scriptProp = PropertiesService.getScriptProperties();
      var newToken   = getToken(baseUrl, scriptProp.getProperty('USERNAME'), scriptProp.getProperty('PASSWORD'));
      scriptProp.setProperty('TOKEN', newToken);
      return getQuestionAndFillSheet(baseUrl, newToken, metabaseQuestionNum, sheetName);
    }
    else {
      return { success: false, error: "Metabase devolvió error " + statusCode + ": " + response.getContentText() };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ----------------------
// GESTIÓN DE LA HOJA DE CÁLCULO
// ----------------------

function fillSheet(values, sheetName) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  sheet.clearContents();

  var maxRows = values.length;
  var maxCols = values[0] ? values[0].length : 0;

  if (maxRows > 0 && maxCols > 0) {
    var batchSize = 1000;
    for (var i = 0; i < maxRows; i += batchSize) {
      var endRow = Math.min(i + batchSize, maxRows);
      sheet.getRange(i + 1, 1, endRow - i, maxCols).setValues(values.slice(i, endRow));
    }
  }
}