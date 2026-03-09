function generarYEnviarReporteSemanalIndividual() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaReporte = ss.getSheetByName('Reporte Semanal Individual');
  const hojaConfig = ss.getSheetByName('Config 2.0');

  if (!hojaReporte || !hojaConfig) {
    Browser.msgBox("⚠️ Falta la hoja Reporte Semanal Individual o Config 2.0");
    return;
  }

  // Leer Config 2.0
  const datos = hojaConfig.getDataRange().getValues();
  const headers = datos.shift();

  const colAsociado = headers.indexOf('Asociado Comercial');
  const colCarpeta  = headers.indexOf('Carpeta ID');
  const colEmail    = headers.indexOf('Email');
  const colNombre   = headers.indexOf('nombreParaMail');
  const colEnviar   = headers.indexOf('Enviar');
  const colCC       = headers.indexOf('CC');
  const colLink     = headers.indexOf('Link Modelo Ops');

  datos
    .filter(f => f[colEnviar]?.toString().toUpperCase() === 'SI')
    .forEach(f => {

      try {
        const asociado = f[colAsociado];
        const carpetaId = f[colCarpeta];
        const email = f[colEmail];
        const nombreParaMail = f[colNombre] || asociado;
        const cc = f[colCC] || '';
        const linkModelo = f[colLink];

        // Setear asociado
        hojaReporte.getRange('P2').setValue(asociado);
        
        // Forzar actualización de fórmulas para que el condicional lea bien
        SpreadsheetApp.flush();

        // --- LÓGICA DE RANGO DINÁMICO ---
        // Chequeamos si la fila 70 tiene datos (Sociedad)
        const datoSAC = hojaReporte.getRange('L70').getValue();
        let filaCorte = 67; // Por defecto corta en la 67

        if (datoSAC !== "" && datoSAC !== null) {
          filaCorte = 75; // Si hay datos, estira hasta la 75 (dando margen a la 74)
        }
        // --------------------------------

        // Nombre del PDF
        const fechaStr = Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          "yyyy-MM-dd"
        );
        const nombreArchivo = `${fechaStr} - ${asociado}.pdf`;

        // Exportar PDF
        const url = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?`;
        const opciones = {
          exportFormat: 'pdf',
          format: 'pdf',
          size: 'A4',
          portrait: true,
          fitw: true,
          top_margin: 0.25,
          bottom_margin: 0.25,
          left_margin: 0.25,
          right_margin: 0.25,
          sheetnames: false,
          printtitle: false,
          pagenumbers: false,
          gridlines: false,
          fzr: false,
          gid: hojaReporte.getSheetId(),
          range: 'L6:AK' + filaCorte // <--- RANGO DINÁMICO APLICADO
        };

        const query = Object.keys(opciones)
          .map(k => `${k}=${encodeURIComponent(opciones[k])}`)
          .join('&');

        const token = ScriptApp.getOAuthToken();
        const respuesta = UrlFetchApp.fetch(url + query, {
          headers: { Authorization: 'Bearer ' + token }
        });

        const pdfBlob = respuesta.getBlob().setName(nombreArchivo);

        // Guardar en carpeta
        const carpeta = DriveApp.getFolderById(carpetaId);
        carpeta.createFile(pdfBlob);
        const urlCarpeta = carpeta.getUrl();

        // Enviar mail
        const fechaMail = Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          "dd/MM/yyyy"
        );

        const asunto = `Reporte Semanal de Actividad - ${fechaMail}`;
        const cuerpoHTML =  `Hola ${nombreParaMail}, ¿cómo estás?<br><br>
Te comparto el reporte semanal de actividad correspondiente a esta semana que estamos terminando.<br>
Como siempre, cualquier duda que tengas o si hay algo que no se entienda, no dudes en escribirme y lo vemos juntos.<br><br>
Adjunto el PDF, y te recuerdo que todos los reportes quedan guardados en la carpeta compartida:<a href="${urlCarpeta}">Abrir carpeta</a> <br><br>
¡¡A seguir creciendo!!<br><br>
¡Gracias!<br>Saludos! Buen finde!`;

        GmailApp.sendEmail(
          email,
          asunto,
          "Requiere HTML",
          {
            htmlBody: cuerpoHTML,
            attachments: [pdfBlob],
            cc: cc
          }
        );

        Logger.log(`✅ Reporte enviado a ${asociado}`);
        Utilities.sleep(2000);

      } catch (e) {
        Logger.log(`❌ Error con ${f[colAsociado]}: ${e}`);
      }
    });

  Browser.msgBox('✅ Reportes semanales individuales enviados correctamente.');
}