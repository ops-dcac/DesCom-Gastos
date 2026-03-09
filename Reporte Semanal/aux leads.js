function copiarEstadosAuxLeads() {
  // IDs de los archivos
  const ID_ORIGEN = '19wCjd-6EuKKKBmoOoowCSCRi-6svS0o6gwtxFRMuSQo';
  const ID_DESTINO = '1_NwrZnNmoY5l9o-efNtSa40JwY2RoJ1K2XStj4OXxXk';

  // Nombres de hojas
  const HOJA_ORIGEN = 'Estados';
  const HOJA_DESTINO = 'aux leads';

  // Abrir archivos
  const ssOrigen = SpreadsheetApp.openById(ID_ORIGEN);
  const ssDestino = SpreadsheetApp.openById(ID_DESTINO);

  const shOrigen = ssOrigen.getSheetByName(HOJA_ORIGEN);
  const shDestino = ssDestino.getSheetByName(HOJA_DESTINO);

  // Última fila con datos en origen
  const lastRow = shOrigen.getLastRow();

  if (lastRow === 0) return; // por si no hay datos

  // Rango A:AL (38 columnas)
  const datos = shOrigen.getRange(1, 1, lastRow, 38).getValues();

  // Limpiar SOLO A:AL del destino (no toca columnas con fórmulas)
  shDestino.getRange(1, 1, shDestino.getMaxRows(), 38).clearContent();

  // Pegar datos
  shDestino.getRange(1, 1, datos.length, datos[0].length).setValues(datos);
}
