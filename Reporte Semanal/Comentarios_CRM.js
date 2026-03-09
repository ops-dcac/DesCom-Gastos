function copiarComentarios() {
  // IDs de los archivos (cambia por los tuyos)
  var origenId = "1tYDuVZFmaZOxUDqUfEjgap4PWSlvYSYwnZnZNFW_CgM";   // donde está "Comentarios"
  var destinoId = "1_NwrZnNmoY5l9o-efNtSa40JwY2RoJ1K2XStj4OXxXk"; // donde está "Comentarios_CRM"

  var hojaOrigen = SpreadsheetApp.openById(origenId).getSheetByName("Comentarios");
  var hojaDestino = SpreadsheetApp.openById(destinoId).getSheetByName("Comentarios_CRM");

  // Obtengo todos los datos de origen
  var datos = hojaOrigen.getDataRange().getValues();

  // Defino fecha mínima: 22/09/2025
  var fechaMin = new Date(2025, 8, 22); // septiembre = 8 (mes base 0)

  // Armo array filtrado con títulos + filas válidas (columnas B-G => destino A-F)
  var resultado = [];
  resultado.push([datos[0][1], datos[0][2], datos[0][3], datos[0][4], datos[0][5], datos[0][6]]); // encabezados

  for (var i = 1; i < datos.length; i++) {
    var fecha = datos[i][4]; // columna E (índice 4 porque A=0 en array)
    if (fecha instanceof Date && fecha >= fechaMin) {
      resultado.push([datos[i][1], datos[i][2], datos[i][3], datos[i][4], datos[i][5], datos[i][6]]);
    }
  }

  // Limpio columnas A-F del destino antes de pegar (sin tocar otras columnas)
  var ultimaFilaDestino = hojaDestino.getLastRow();
  if (ultimaFilaDestino > 0) {
    hojaDestino.getRange(1, 1, ultimaFilaDestino, 6).clearContent();
  }

  // Pego datos en columnas A-F, desde fila 1
  if (resultado.length > 0) {
    hojaDestino.getRange(1, 1, resultado.length, 6).setValues(resultado);
  }
}
