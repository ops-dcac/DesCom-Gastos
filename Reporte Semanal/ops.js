function copiarOPS() {
  var idOrigen = "1FVX-J8CDqQvUEIC21BseOnWPEJ-TUaI1DIgVizwBQ3g"; 
  var nombreHojaOrigen = "OPS"; 
  var idDestino = "1_NwrZnNmoY5l9o-efNtSa40JwY2RoJ1K2XStj4OXxXk"; 
  var nombreHojaDestino = "OPS"; 

  var ssOrigen = SpreadsheetApp.openById(idOrigen);
  var hojaOrigen = ssOrigen.getSheetByName(nombreHojaOrigen);
  var ssDestino = SpreadsheetApp.openById(idDestino);
  var hojaDestino = ssDestino.getSheetByName(nombreHojaDestino);
  
  if (!hojaDestino) {
    hojaDestino = ssDestino.insertSheet(nombreHojaDestino);
  } else {
    hojaDestino.clearContents(); 
  }

  var rangoDatos = hojaOrigen.getDataRange();
  var valores = rangoDatos.getValues(); 

  // Convertir cualquier columna con fechas a texto
  for (var i = 1; i < valores.length; i++) {
    for (var j = 0; j < valores[i].length; j++) {
      if (valores[i][j] instanceof Date) {
        var y = valores[i][j].getFullYear();
        var m = ('0' + (valores[i][j].getMonth() + 1)).slice(-2);
        var d = ('0' + (valores[i][j].getDate())).slice(-2);
        valores[i][j] = y + '-' + m + '-' + d;
      }
    }
  }

  if (valores.length > 0) {
    hojaDestino.getRange(1, 1, valores.length, valores[0].length).setValues(valores);
  }
}