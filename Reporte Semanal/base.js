function copiarBase() {
  var idOrigen = "1FVX-J8CDqQvUEIC21BseOnWPEJ-TUaI1DIgVizwBQ3g"; 
  var nombreHojaOrigen = "BASE"; 
  var idDestino = "1_NwrZnNmoY5l9o-efNtSa40JwY2RoJ1K2XStj4OXxXk"; 
  var nombreHojaDestino = "BASE"; 

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

  // Convertir fechas de columna B a texto
  for (var i = 1; i < valores.length; i++) {
    var celda = valores[i][1];
    if (celda instanceof Date) {
      var y = celda.getFullYear();
      var m = ('0' + (celda.getMonth() + 1)).slice(-2);
      var d = ('0' + celda.getDate()).slice(-2);
      valores[i][1] = y + '-' + m + '-' + d;
    }
  }

  if (valores.length > 0) {
    hojaDestino.getRange(1, 1, valores.length, valores[0].length).setValues(valores);
  }
}