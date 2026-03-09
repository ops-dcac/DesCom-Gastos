function obtenerColorHexDesdeHojaYCelda() {
  const nombreHoja = 'Detalle Individual'; // Cambiá esto por el nombre de tu hoja
  const celdaReferencia = 'M3';            // Cambiá esto por la celda que quieras consultar

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombreHoja);
  if (!hoja) {
    Logger.log('⚠️ No se encontró la hoja: ' + nombreHoja);
    return;
  }

  const color = hoja.getRange(celdaReferencia).getBackground();
  Logger.log(`🎨 Color hex de ${nombreHoja} ${celdaReferencia}: ${color}`);
}
