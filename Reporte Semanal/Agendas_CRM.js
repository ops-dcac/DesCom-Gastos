function copiarAgenda() {
  // IDs de las hojas (cambia por los reales)
  var origenId = "1tYDuVZFmaZOxUDqUfEjgap4PWSlvYSYwnZnZNFW_CgM";   // <-- Reemplazar con ID del archivo con "Agenda"
  var destinoId = "1_NwrZnNmoY5l9o-efNtSa40JwY2RoJ1K2XStj4OXxXk"; // <-- Reemplazar con ID del archivo con "Agenda_CRM"

  var hojaOrigen = SpreadsheetApp.openById(origenId).getSheetByName("Agenda");
  var hojaDestino = SpreadsheetApp.openById(destinoId).getSheetByName("Agenda_CRM");

  // Columnas a copiar (números base 1)
  var columnas = [2, 3, 9, 10]; 
  // B=2, C=3, I=9, J=10

  // Obtener todos los datos
  var datos = hojaOrigen.getRange(1, 1, hojaOrigen.getLastRow(), hojaOrigen.getLastColumn()).getValues();

  // Fecha mínima (22/09/2025 → mes 8 porque JS empieza en 0 = enero)
  var fechaMin = new Date(2025, 8, 22);

  // Filtrar: encabezados + filas con fecha >= fechaMin en col J y col I distinto a los mails
  var filtrados = datos.filter(function(fila, i) {
    if (i === 0) return true; // títulos
    var fecha = fila[9]; // columna J (índice 9 base 0)
    var correo = fila[8]; // columna I (índice 8 base 0)
    return (
      fecha instanceof Date &&
      fecha >= fechaMin &&
      correo !== "lbortolin@decampoacampo.com" &&
      correo !== "fgarzaron@decampoacampo.com"
    );
  });

  // Extraer solo columnas deseadas
  var resultado = filtrados.map(function(fila) {
    return columnas.map(function(col) {
      return fila[col - 1]; // ajustar a base 0
    });
  });

  // Limpiar SOLO esas columnas en el destino
  var ultimaFila = hojaDestino.getLastRow();
  columnas.forEach(function(col) {
    if (ultimaFila > 0) {
      hojaDestino.getRange(1, col, ultimaFila).clearContent();
    }
  });

  // Pegar en destino (arranca en fila 1)
  if (resultado.length > 0) {
    hojaDestino.getRange(1, columnas[0], resultado.length, resultado[0].length).setValues(resultado);
  }
}

