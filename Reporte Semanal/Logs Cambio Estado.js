function copiarLogsCambioEstado() {
  const ID_ORIGEN  = '1tYDuVZFmaZOxUDqUfEjgap4PWSlvYSYwnZnZNFW_CgM';
  const ID_DESTINO = '1_NwrZnNmoY5l9o-efNtSa40JwY2RoJ1K2XStj4OXxXk';

  const ssOrigen  = SpreadsheetApp.openById(ID_ORIGEN);
  const ssDestino = SpreadsheetApp.openById(ID_DESTINO);

  const hojaOrigen  = ssOrigen.getSheetByName('Logs Cambio Estado');
  const hojaDestino = ssDestino.getSheetByName('Logs Cambio Estado');

  if (!hojaOrigen || !hojaDestino) {
    throw new Error('No se encontró la hoja "Logs Cambio Estado" en uno de los archivos');
  }

  const lastRow = hojaOrigen.getLastRow();
  if (lastRow < 1) return;

  // Leer solo A:E
  const datos = hojaOrigen.getRange(1, 1, lastRow, 5).getValues();

  // Limpiar solo A:E en destino
  hojaDestino.getRange(1, 1, hojaDestino.getMaxRows(), 5).clearContent();

  // Pegar datos
  hojaDestino.getRange(1, 1, datos.length, datos[0].length).setValues(datos);
}
