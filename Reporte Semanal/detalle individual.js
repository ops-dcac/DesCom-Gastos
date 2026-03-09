function generarReporteDetalle() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaDestino = ss.getSheetByName('Detalle Individual');
  const asociadoFiltro = hojaDestino.getRange('B6').getValue();

  // Limpiar contenido desde la fila 15 en adelante (sin borrar formato)
  const ultimaFila = hojaDestino.getMaxRows();
  const ultimaCol = hojaDestino.getMaxColumns();
  const rangoLimpiar = hojaDestino.getRange(15, 1, ultimaFila - 14, ultimaCol);
  rangoLimpiar.clearContent();

  const hojasConfig = [
    {
      nombreHoja: 'OPS_di',
      titulo: 'OFRECIMIENTOS - OPERACIONES - CARGAS',
      columnas: ['A', 'B', 'C', 'D', 'E', 'F', 'AE', 'AF', 'I', 'J', 'K', 'AH', 'N', 'O', 'Q', 'R', 'S', 'T', 'U', 'X', 'AI','V', 'W', 'AJ', 'AK', 'AM'],
      colFiltro: 'AG'
    },
    {
      nombreHoja: 'SOC_TRAB_di',
      titulo: 'SOCIEDADES TRABAJADAS',
      columnas: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I','T', 'J', 'K', 'R', 'L', 'M', 'N'],
      colFiltro: 'Q'
    },
    {
      nombreHoja: 'SOC_CREADAS_di',
      titulo: 'SOCIEDADES CREADAS',
      columnas: ['A', 'B', 'C', 'D', 'E', 'F', 'O', 'H', 'G', 'J', 'P', 'I'],
      colFiltro: 'K'
    },
    {
      nombreHoja: 'SAC_di',
      titulo: 'SAC',
      columnas: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I', 'H', 'J', 'K', 'L'],
      colFiltro: 'O'
    },
    {
      nombreHoja: 'REMATES_di',
      titulo: 'REMATES',
      columnas: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I', 'J', 'K'],
      colFiltro: 'H'
    }
  ];

  let filaActual = 15;
  const colInicio = 2; // Columna B

  hojasConfig.forEach(config => {
    const hoja = ss.getSheetByName(config.nombreHoja);
    if (!hoja) return;

    const data = hoja.getDataRange().getValues();
    const formats = hoja.getDataRange().getNumberFormats();
    if (data.length < 2) return;

    const encabezados = data[0];
    const colIndices = config.columnas.map(col => colLetraAIndice(col));
    const colFiltroIndex = colLetraAIndice(config.colFiltro);

    let filasFiltradas = data.slice(1).map((fila, i) => {
      return {
        valores: fila,
        formatos: formats[i + 1]
      };
    }).filter(obj => obj.valores[colFiltroIndex] == asociadoFiltro);

    if (filasFiltradas.length > 0) {
      const numCols = colIndices.length;

      hojaDestino.getRange(filaActual, colInicio, 1, 1).setValue(config.titulo);
      filaActual++;

      const encabezadosFiltrados = colIndices.map(i => encabezados[i]);
      hojaDestino.getRange(filaActual, colInicio, 1, numCols).setValues([encabezadosFiltrados]);
      filaActual++;

      const filasValores = filasFiltradas.map(obj => colIndices.map(i => obj.valores[i]));
      const filasFormatos = filasFiltradas.map(obj => colIndices.map(i => obj.formatos[i]));

      hojaDestino.getRange(filaActual, colInicio, filasValores.length, numCols).setValues(filasValores);

      const filasFormatosLimpios = filasFormatos.map(fila => 
        fila.map(formato => (typeof formato === 'string' && formato.trim() !== '') ? formato : '@')
      );

      if (
        filasFormatosLimpios.length === filasValores.length &&
        filasFormatosLimpios.every(fila => fila.length === numCols)
      ) {
        hojaDestino.getRange(filaActual, colInicio, filasFormatosLimpios.length, numCols).setNumberFormats(filasFormatosLimpios);
      } else {
        Logger.log("Las dimensiones de formatos no coinciden con los valores");
      }

      filaActual += filasFiltradas.length;
    }
  });

  // 🟩 Mostrar mensaje al finalizar
  const fechaDesde = hojaDestino.getRange('G1').getDisplayValue();
  const fechaHasta = hojaDestino.getRange('H2').getDisplayValue();

}

function colLetraAIndice(letra) {
  let col = 0;
  for (let i = 0; i < letra.length; i++) {
    col *= 26;
    col += letra.charCodeAt(i) - 64;
  }
  return col - 1;
}

