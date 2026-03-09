// ----------------------
// MENÚS MANUALES
// ----------------------

function onInstall() {
  onOpen();
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Metabase')
    .addItem('3126 - CIs Comp', 'import3126bis')
    .addItem('3124 - Conc General', 'import3124bis')
    // Se ha eliminado la opción 4524 de aquí
    .addItem('3397 - dCP', 'import3397bis')
    .addToUi();
}

// ----------------------
// FUNCIONES MANUALES
// ----------------------

function import3126bis() {
  importQuestion('3126', 'CIs Comp', true); // true = mostrar alert
}

function import3124bis() {
  importQuestion('3124', 'Conc General', true); // true = mostrar alert
}

// Se ha eliminado import4524bis

function import3397bis() {
  importQuestion('3397', 'dCP', true); // true = mostrar alert
}


// ----------------------
// FUNCIONES AUTOMÁTICAS (para triggers)
// ----------------------

function import3126Automatico() {
  importQuestion('3126', 'CIs Comp', false); // false = no mostrar alert
}

function import3124Automatico() {
  importQuestion('3124', 'Conc General', false); // false = no mostrar alert
}

// Se ha eliminado import4524Automatico

function import3397Automatico() {
  importQuestion('3397', 'dCP', false); // false = no mostrar alert
}

// ----------------------
// LÓGICA CENTRAL DE IMPORT
// ----------------------

function importQuestion(metabaseQuestionNum, sheetName, showUiAlert) {
  SpreadsheetApp.flush();

  if (metabaseQuestionNum !== 'cancel' && !isNaN(metabaseQuestionNum)) {
    var status = getQuestionAsCSV(metabaseQuestionNum, sheetName);

    if (showUiAlert) {
      var ui = SpreadsheetApp.getUi();
      if (status.success) {
        ui.alert('Question ' + metabaseQuestionNum + ' successfully imported to ' + sheetName + '.');
      } else {
        ui.alert('Question ' + metabaseQuestionNum + ' failed to import. ' + status.error);
      }
    } else {
      Logger.log('Import status for question ' + metabaseQuestionNum + ': ' + JSON.stringify(status));
    }
  } else {
    if (showUiAlert) {
      SpreadsheetApp.getUi().alert('You did not enter a valid number.');
    } else {
      Logger.log('Invalid number provided for import.');
    }
  }

  SpreadsheetApp.flush();
}

// ----------------------
// FUNCIONES EXISTENTES PARA CONEXIÓN CON METABASE
// ----------------------

function getToken(baseUrl, username, password) {
  var sessionUrl = baseUrl + "api/session";
  var options = {
    "method": "post",
    "headers": { "Content-Type": "application/json" },
    "payload": JSON.stringify({ username: username, password: password })
  };

  try {
    var response = UrlFetchApp.fetch(sessionUrl, options);
    var token = JSON.parse(response).id;
    return token;
  } catch (e) {
    throw new Error("Error during token retrieval: " + e.message);
  }
}

function getQuestionAndFillSheet(baseUrl, token, metabaseQuestionNum, sheetName) {
  var questionUrl = baseUrl + "api/card/" + metabaseQuestionNum + "/query/csv";
  var options = {
    "method": "post",
    "headers": {
      "X-Metabase-Session": token
    },
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(questionUrl, options);
    var statusCode = response.getResponseCode();

    if (statusCode === 200 || statusCode === 202) {
      var values = Utilities.parseCsv(response.getContentText());
      fillSheet(values, sheetName);
      return { 'success': true };
    } else if (statusCode === 401) {
      var scriptProp = PropertiesService.getScriptProperties();
      var username = scriptProp.getProperty('USERNAME');
      var password = scriptProp.getProperty('PASSWORD');
      var newToken = getToken(baseUrl, username, password);
      scriptProp.setProperty('TOKEN', newToken);
      return getQuestionAndFillSheet(baseUrl, newToken, metabaseQuestionNum, sheetName);
    } else {
      return {
        'success': false,
        'error': "Error: Could not retrieve question. Metabase says: '" + response.getContentText() + "'"
      };
    }
  } catch (e) {
    return { 'success': false, 'error': e.message };
  }
}

function fillSheet(values, sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  var maxRows = values.length;
  var maxCols = values[0] ? values[0].length : 0;

  if (maxRows > 0 && maxCols > 0) {
    sheet.clearContents(); // Limpia el contenido antes de pegar
    
    var batchSize = 1000;
    for (var i = 0; i < maxRows; i += batchSize) {
      var endRow = Math.min(i + batchSize, maxRows);
      var range = sheet.getRange(i + 1, 1, endRow - i, maxCols);
      range.setValues(values.slice(i, endRow));
    }
  }
}

function getQuestionAsCSV(metabaseQuestionNum, sheetName) {
  var scriptProp = PropertiesService.getScriptProperties();
  var baseUrl = scriptProp.getProperty('BASE_URL');
  var username = scriptProp.getProperty('USERNAME');
  var password = scriptProp.getProperty('PASSWORD');
  var token = scriptProp.getProperty('TOKEN');

  if (!token) {
    token = getToken(baseUrl, username, password);
    scriptProp.setProperty('TOKEN', token);
  }

  return getQuestionAndFillSheet(baseUrl, token, metabaseQuestionNum, sheetName);
}