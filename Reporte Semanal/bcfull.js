function copiarHoja3() {

  var idOrigen = "1FVX-J8CDqQvUEIC21BseOnWPEJ-TUaI1DIgVizwBQ3g"; // ID del archivo origen
  var nombreHojaOrigen = "BCFULL"; // Nombre de la hoja a copiar
  var idDestino = "1_NwrZnNmoY5l9o-efNtSa40JwY2RoJ1K2XStj4OXxXk"; // ID del archivo destino
  var nombreHojaDestino = "BCFULL"; // Nombre de la hoja en destino

  var ssOrigen = SpreadsheetApp.openById(idOrigen);
  var hojaOrigen = ssOrigen.getSheetByName(nombreHojaOrigen);
  var ssDestino = SpreadsheetApp.openById(idDestino);
  var hojaDestino = ssDestino.getSheetByName(nombreHojaDestino);

  if (!hojaDestino) {
    hojaDestino = ssDestino.insertSheet(nombreHojaDestino);
  } else {
    // Borra solo el contenido de las columnas A a D (columnas 1 a 4)
    var numFilas = hojaDestino.getMaxRows();
    hojaDestino.getRange(1, 1, numFilas, 4).clearContent();
  }

  var rangoDatos = hojaOrigen.getDataRange();
  var valores = rangoDatos.getDisplayValues();

  hojaDestino.getRange(1, 1, valores.length, valores[0].length).setValues(valores);

}