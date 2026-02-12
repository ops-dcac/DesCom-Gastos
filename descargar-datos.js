import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURACIÓN
// ==========================================
const SHEET_ID = '1nxrPYMCCHJ_kdsbWFE28bRoqiu0WS0PUAYTKsA-qTKw';
const SHEET_NAME = 'Base Mendel';
const URL_GASTOS = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

// KMs: Mantenemos el mismo ID pero buscamos la hoja 'KMS MENSUALES' (suponiendo que existe en el mismo doc)
// Si no existe, fallará, pero es la mejor apuesta sin más info.
const URL_KMS = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('KMS MENSUALES')}`;

const filesToDownload = [
    {
        name: 'gastos_reales.csv',
        url: URL_GASTOS
    },
    {
        name: 'kms_mensuales.csv',
        url: URL_KMS
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
    console.log('--- Iniciando actualización de datos (Base Mendel) ---');
    for (const f of filesToDownload) {
        await downloadFile(f);
    }
    console.log('--- Proceso finalizado ---');
})();
