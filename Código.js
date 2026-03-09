// ============ CONFIGURACIÓN ============
const SHEET_NAME = 'Base Mendel';

// Columnas (índice desde 0)
const COL = {
  FECHA: 1,        // B - Fecha transacción (para auditoría)
  COMERCIO: 4,     // E - Comercio
  IMPORTE: 5,      // F - Importe Total
  ESTADO: 15,      // P - Estado
  USUARIO: 52,     // BA - Usuario normalizado
  CATEGORIA: 53,   // BB - Categoría normalizada
  PERIODO: 54      // BC - Período normalizado (para agrupar montos)
};
// Nueva hoja para flota
const SHEET_FLOTA = 'Base_Historica';

// Columnas de flota (índice desde 0)
const COL_FLOTA = {
  ANIO: 0,         // A - Año
  MES: 1,          // B - Mes
  PATENTE: 4,      // E - Patente vehículo
  PROPIO: 5,       // F - Propio/DCAC
  KMS: 6,          // G - KMs viajes
  KMS_TOTALES: 7,  // H - KMs totales vehículo
  TIPO: 10,        // K - Tipo (Auto/Chata/SUV)
  AMORTIZACION: 18, // S - Amortización
  USUARIO: 12      // M - Usuario normalizado
};

// Nueva hoja para sueldos
const SHEET_SUELDOS = 'BDsueldos';

// Columnas de sueldos (índice desde 0)
const COL_SUELDOS = {
  ANIO: 1,         // B - Año
  MES: 2,          // C - Mes
  ASOCIADO: 4,     // E - Asociado Comercial
  SUELDO: 13,      // N - Sueldo
  IMPORTE: 21      // V - Importe
};

// Nueva hoja para precios de amortización por KM
const SHEET_XKMS = '$xKms';

// Columnas de $xKms (índice desde 0)
const COL_XKMS = {
  ANIO: 0,         // A - Año
  MES: 1,          // B - Mes
  PRECIO: 2,       // C - Precio por km de amortización
  TIPO: 3          // D - Tipo de vehículo (Chata, Suv, Auto)
};

// Nueva hoja para Roster (usuarios y regiones)
const SHEET_ROSTER = 'Roster';

// Columnas de Roster (índice desde 0)
const COL_ROSTER = {
  REGION: 2,       // C - Región
  USUARIO: 3       // D - Usuario
};

// Nueva hoja para información de categorías
const SHEET_INFO_CATEGORIAS = 'Info Categorias';

// Columnas de Info Categorias (índice desde 0)
const COL_INFO_CATEGORIAS = {
  CATEGORIA_USUARIO: 0,    // A - Categoría Usuario
  DESCRIPCION_USUARIO: 1,  // B - Descripción Usuario
  OFICINA: 2,              // C - Oficina
  DESCRIPCION_OFICINA: 3   // D - Descripción Oficina
};

// ============ FUNCIÓN PRINCIPAL ============
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('DeCampoACampo Analytics')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============ OBTENER PERÍODO POR DEFECTO ============
function getDefaultPeriodo() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11
  
  // Retroceder a mes anterior
  let prevMonth = month - 1;
  let prevYear = year;
  
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = year - 1;
  }
  
  return '' + prevYear + String(prevMonth + 1).padStart(2, '0');
}

// ============ OBTENER DATOS ============
function getData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return { error: 'No se encontró la hoja ' + SHEET_NAME };
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1);
    const transactions = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const estado = String(row[COL.ESTADO] || '').trim().toUpperCase();
      if (estado !== 'CONFIRMADA' && estado !== 'CONFIRMADO') continue;
      let usuario = String(row[COL.USUARIO] || '').trim();
      const periodo = String(row[COL.PERIODO] || '').trim();
      const importe = parseImporte(row[COL.IMPORTE]);
      if (!usuario || !periodo || importe <= 0) continue;
      transactions.push({
        fecha: formatFecha(row[COL.FECHA]),
        comercio: String(row[COL.COMERCIO] || '').trim(),
        importe: importe,
        usuario: usuario,
        categoria: String(row[COL.CATEGORIA] || 'Otros').trim(),
        periodo: periodo
      });
    }
    return { success: true, data: transactions, count: transactions.length };
  } catch (e) {
    return { error: e.toString() };
  }
}
// ============ OBTENER DATOS DE FLOTA ============
function getFlotaData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_FLOTA);
    if (!sheet) return { error: 'No se encontró la hoja ' + SHEET_FLOTA };
    
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1);
    const flota = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const anio = String(row[COL_FLOTA.ANIO] || '').trim();
      const mes = String(row[COL_FLOTA.MES] || '').trim().padStart(2, '0');
      const usuario = String(row[COL_FLOTA.USUARIO] || '').trim();
      const patente = String(row[COL_FLOTA.PATENTE] || '').trim();
      const kms = parseFloat(row[COL_FLOTA.KMS]) || 0;
      const propio = String(row[COL_FLOTA.PROPIO] || '').trim();
      const tipo = String(row[COL_FLOTA.TIPO] || '').trim();
      const kmsTotalesVehiculo = parseFloat(row[COL_FLOTA.KMS_TOTALES]) || 0;
      const amortizacion = parseFloat(row[COL_FLOTA.AMORTIZACION]) || 0;
      
      if (!anio || !mes || !usuario) continue;
      
      flota.push({
        periodo: anio + mes,
        anio: anio,
        mes: mes,
        usuario: usuario,
        patente: patente || '-',
        propio: propio || '-',
        kms: kms,
        kmsTotalesVehiculo: kmsTotalesVehiculo,
        tipo: tipo || '-',
        amortizacion: amortizacion
      });
    }
    return { success: true, data: flota };
  } catch (e) {
    return { error: e.toString() };
  }
}

// ============ OBTENER DATOS DE SUELDOS ============
function getSueldosData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_SUELDOS);
    if (!sheet) return { error: 'No se encontró la hoja ' + SHEET_SUELDOS };
    
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1); // Saltar encabezado
    const sueldos = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const anio = String(row[COL_SUELDOS.ANIO] || '').trim();
      const mes = String(row[COL_SUELDOS.MES] || '').trim().padStart(2, '0');
      const asociado = String(row[COL_SUELDOS.ASOCIADO] || '').trim();
      const sueldo = parseFloat(row[COL_SUELDOS.SUELDO]) || 0;
      const importe = parseFloat(row[COL_SUELDOS.IMPORTE]) || 0;
      
      if (!anio || !mes || !asociado) continue;
      
      sueldos.push({
        periodo: anio + mes,
        anio: anio,
        mes: mes,
        asociado: asociado,
        sueldo: sueldo,
        importe: importe
      });
    }
    
    return { success: true, data: sueldos };
  } catch (e) {
    return { error: e.toString() };
  }
}

// ============ OBTENER DATOS DE PRECIOS DE AMORTIZACIÓN POR KM ============
function getXKmsData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_XKMS);
    if (!sheet) return { error: 'No se encontró la hoja ' + SHEET_XKMS };
    
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1); // Saltar encabezado
    const xkms = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const anio = String(row[COL_XKMS.ANIO] || '').trim();
      const mes = String(row[COL_XKMS.MES] || '').trim().padStart(2, '0');
      const precio = parseFloat(row[COL_XKMS.PRECIO]) || 0;
      const tipo = String(row[COL_XKMS.TIPO] || '').trim();
      
      if (!anio || !mes || !tipo) continue;
      
      xkms.push({
        periodo: anio + mes,
        anio: anio,
        mes: mes,
        precio: precio,
        tipo: tipo
      });
    }
    
    return { success: true, data: xkms };
  } catch (e) {
    return { error: e.toString() };
  }
}

// ============ OBTENER DATOS DE ROSTER (USUARIOS Y REGIONES) ============
function getRosterData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_ROSTER);
    if (!sheet) return { error: 'No se encontró la hoja ' + SHEET_ROSTER };
    
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1); // Saltar encabezado
    const roster = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const region = String(row[COL_ROSTER.REGION] || '').trim();
      const usuario = String(row[COL_ROSTER.USUARIO] || '').trim();
      
      if (!region || !usuario) continue;
      
      roster.push({
        region: region,
        usuario: usuario
      });
    }
    
    return { success: true, data: roster };
  } catch (e) {
    return { error: e.toString() };
  }
}

// ============ OBTENER INFORMACIÓN DE CATEGORÍAS ============
function getInfoCategorias() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_INFO_CATEGORIAS);
    if (!sheet) return { error: 'No se encontró la hoja ' + SHEET_INFO_CATEGORIAS };
    
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1); // Saltar encabezado
    const infoUsuarios = [];
    const infoOficinas = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Procesar usuarios (columnas A-B)
      const categoriaUsuario = String(row[COL_INFO_CATEGORIAS.CATEGORIA_USUARIO] || '').trim();
      const descripcionUsuario = String(row[COL_INFO_CATEGORIAS.DESCRIPCION_USUARIO] || '').trim();
      
      if (categoriaUsuario) {
        infoUsuarios.push({
          categoria: categoriaUsuario,
          descripcion: descripcionUsuario
        });
      }
      
      // Procesar oficinas (columnas C-D)
      const oficina = String(row[COL_INFO_CATEGORIAS.OFICINA] || '').trim();
      const descripcionOficina = String(row[COL_INFO_CATEGORIAS.DESCRIPCION_OFICINA] || '').trim();
      
      if (oficina) {
        infoOficinas.push({
          nombre: oficina,
          descripcion: descripcionOficina
        });
      }
    }
    
    return { success: true, data: { usuarios: infoUsuarios, oficinas: infoOficinas } };
  } catch (e) {
    return { error: e.toString() };
  }
}

// UTILIDADES (parseImporte, formatFecha) — idénticas a las que venías usando
function parseImporte(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  var str = String(value).replace(/"/g, '').replace(/\$/g, '').trim();
  if (str.indexOf(',') !== -1 && str.indexOf('.') !== -1) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) str = str.replace(/\./g, '').replace(',', '.');
    else str = str.replace(/,/g, '');
  } else if (str.indexOf(',') !== -1) {
    var parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) str = str.replace(',', '.');
    else str = str.replace(/,/g, '');
  } else if (str.indexOf('.') !== -1) {
    var parts2 = str.split('.');
    if (parts2.length > 1 && parts2[parts2.length - 1].length === 3) str = str.replace(/\./g, '');
  }
  var num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function formatFecha(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    var d = value.getDate().toString().padStart(2, '0');
    var m = (value.getMonth() + 1).toString().padStart(2, '0');
    var y = value.getFullYear();
    return d + '/' + m + '/' + y;
  }
  return String(value);
}

function testGetData() {
  const result = getData();
  Logger.log('Transacciones: ' + result.count);
  if (result.data && result.data.length > 0) {
    Logger.log('Primera transacción: ' + JSON.stringify(result.data[0]));
  }
  if (result.error) Logger.log('Error: ' + result.error);
}