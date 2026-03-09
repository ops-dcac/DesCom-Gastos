function copiarHoja2() {
  var idOrigen = "1bxZGicvfQaAebCtBuzP53064whf-Ir2_RmJBQkRBrxU"; // ID del archivo origen
  var nombreHojaOrigen = "SACs"; // Nombre de la hoja a copiar
  var idDestino = "1_NwrZnNmoY5l9o-efNtSa40JwY2RoJ1K2XStj4OXxXk"; // ID del archivo destino
  var nombreHojaDestino = "SAC"; // Nombre de la hoja en destino

  var ssOrigen = SpreadsheetApp.openById(idOrigen);
  var hojaOrigen = ssOrigen.getSheetByName(nombreHojaOrigen);
  var ssDestino = SpreadsheetApp.openById(idDestino);
  var hojaDestino = ssDestino.getSheetByName(nombreHojaDestino);
  
  if (!hojaDestino) {
    hojaDestino = ssDestino.insertSheet(nombreHojaDestino);
  } else {
    // Borra solo el contenido de las columnas A a T (columnas 1 a 20)
    var numFilas = hojaDestino.getMaxRows();
    hojaDestino.getRange(1, 1, numFilas, 24).clearContent();
  }

  var rangoDatos = hojaOrigen.getDataRange();
  var valores = rangoDatos.getValues();
  
  hojaDestino.getRange(1, 1, valores.length, valores[0].length).setValues(valores);
}

