import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURACIÓN
// ==========================================
// ==========================================
// CONFIGURACIÓN
// ==========================================
const API_KEY = 'AIzaSyD2xBSdB5m-XA6XugA_QrouPWFhq2m2Fss'; // Clave de API proporcionada por el usuario
const SHEET_ID = '1nxrPYMCCHJ_kdsbWFE28bRoqiu0WS0PUAYTKsA-qTKw'; // Original Mendel
const SHEET_VEHICULOS_ID = '1QMqzx_FlHtUIvXh5HFofAf6-ZF-2QiOHA-eJG2PQTuY'; // New shared sheet

const SHEET_NAME = 'main';
const SHEET_VEHICULOS_NAME = 'Base_Historica';

const getUrl = (id, sheetName) => `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&key=${API_KEY}`;

const filesToDownload = [
    {
        name: 'gastos_reales.csv',
        url: getUrl(SHEET_ID, SHEET_NAME)
    },
    {
        name: 'kms_mensuales.csv',
        url: getUrl(SHEET_ID, 'KMS MENSUALES')
    },
    {
        name: 'base_historica.csv',
        url: getUrl(SHEET_VEHICULOS_ID, SHEET_VEHICULOS_NAME)
    }
];

const downloadFile = (fileConfig) => {
    return new Promise((resolve, reject) => {
        const targetPath = path.join(__dirname, 'public', fileConfig.name);

        console.log(`⬇️ Descargando ${fileConfig.name}...`);

        const tryDownload = (currentUrl) => {
            https.get(currentUrl, (res) => {
                // Manejar redirecciones
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    console.log(`↪️ Redireccionando...`);
                    tryDownload(res.headers.location);
                    return;
                }

                if (res.statusCode !== 200) {
                    console.error(`❌ Error descargando ${fileConfig.name}: ${res.statusCode}`);
                    resolve(false);
                    return;
                }

                const fileStream = fs.createWriteStream(targetPath);
                res.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`✅ ${fileConfig.name} guardado!`);
                    resolve(true);
                });
            }).on('error', (err) => {
                console.error(`❌ Error red: ${err.message}`);
                resolve(false);
            });
        };

        tryDownload(fileConfig.url);
    });
};

(async () => {
    console.log('--- Iniciando actualización de datos (main) ---');
    for (const f of filesToDownload) {
        await downloadFile(f);
    }
    console.log('--- Proceso finalizado ---');
})();
