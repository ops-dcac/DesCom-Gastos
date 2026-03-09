function copiarLeads() {
  // IDs de las hojas (cambiar por los reales)
  var origenId = "1tYDuVZFmaZOxUDqUfEjgap4PWSlvYSYwnZnZNFW_CgM";   // ID del archivo que contiene "Leads"
  var destinoId = "1_NwrZnNmoY5l9o-efNtSa40JwY2RoJ1K2XStj4OXxXk";   // ID del archivo que contiene "Leads_CRM"

  var hojaOrigen = SpreadsheetApp.openById(origenId).getSheetByName("Leads");
  var hojaDestino = SpreadsheetApp.openById(destinoId).getSheetByName("Leads_CRM");

  // Columnas que queremos copiar (índices base 1)
  var columnas = [1, 2, 3, 4, 5, 6, 7, 12, 13, 30, 37, 38]; 
  // A=1, B=2, ..., L=12, M=13, AD=30, AK=37, AL=38

  // Leer todos los datos de origen
  var ultimaFilaOrigen = hojaOrigen.getLastRow();
  if (ultimaFilaOrigen < 2) return; // sin datos

  var datos = hojaOrigen.getRange(1, 1, ultimaFilaOrigen, hojaOrigen.getLastColumn()).getValues();

  // Fecha mínima (01/08/2025)
  var fechaMin = new Date(2025, 1, 1); // Agosto = mes 7 (base 0)

  // Filtrar filas (encabezado + fechas válidas en columna B)
  var filtrados = datos.filter(function (fila, i) {
    if (i === 0) return true; // encabezado
    var fecha = fila[1]; // Columna B
    return fecha instanceof Date && fecha >= fechaMin;
  });

  // Extraer solo las columnas requeridas
  var resultado = filtrados.map(function (fila) {
    return columnas.map(function (col) {
      return fila[col - 1];
    });
  });

  if (resultado.length === 0) return;

  // Limpiar SOLO el rango donde se pegarán los datos (A:L)
  var numFilas = resultado.length;
  hojaDestino.getRange(1, 1, numFilas, 12).clearContent();

  // Pegar datos nuevos en destino (A:L)
  hojaDestino.getRange(1, 1, numFilas, resultado[0].length).setValues(resultado);
}
