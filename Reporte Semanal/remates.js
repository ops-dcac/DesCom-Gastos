function copiarColumnasSeleccionadas() {
  var idOrigen = "1boXdwBBFsSs2Kv6Jl53wW9XQUdwbUFqcBkkwHB2XAo8"; // ID del archivo origen
  var nombreHojaOrigen = "Datos_Remate"; // Nombre de la hoja a copiar
  var idDestino = "1_NwrZnNmoY5l9o-efNtSa40JwY2RoJ1K2XStj4OXxXk"; // ID del archivo destino
  var nombreHojaDestino = "REMATES"; // Nombre de la hoja en destino

  var ssOrigen = SpreadsheetApp.openById(idOrigen);
  var hojaOrigen = ssOrigen.getSheetByName(nombreHojaOrigen);
  var ssDestino = SpreadsheetApp.openById(idDestino);
  var hojaDestino = ssDestino.getSheetByName(nombreHojaDestino);

  if (!hojaDestino) {
    hojaDestino = ssDestino.insertSheet(nombreHojaDestino);
  } else {
    // Borra solo el contenido de las columnas A a D de la hoja destino
    var numFilas = hojaDestino.getMaxRows();
    hojaDestino.getRange(1, 1, numFilas, 4).clearContent();
  }

  // Obtiene la cantidad de filas con datos
  var ultimaFila = hojaOrigen.getLastRow();

  // Obtiene las columnas A (1), E (5), T (20), Z (26)
  var colE = hojaOrigen.getRange(1, 5, ultimaFila, 1).getValues();
  var colT = hojaOrigen.getRange(1, 20, ultimaFila, 1).getValues();
  var colZ = hojaOrigen.getRange(1, 26, ultimaFila, 1).getValues();
  var colU = hojaOrigen.getRange(1, 21, ultimaFila, 1).getValues();

  // Combina las columnas en un solo arreglo fila por fila
  var datosCombinados = [];
  for (var i = 0; i < ultimaFila; i++) {
    datosCombinados.push([colE[i][0], colT[i][0], colZ[i][0], colU[i][0]]);
  }

  // Pega el resultado en las columnas A:D del destino
  hojaDestino.getRange(1, 1, datosCombinados.length, 4).setValues(datosCombinados);
}
