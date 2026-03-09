const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'Codigo.js');
let content = fs.readFileSync(file, 'utf8');

const oldLine = "var tieneCargar = row[12] ? 'Sí' : '';";
const newLine = "var tieneCargar = row[11] === acN ? 'Sí' : '';";

if (content.includes(oldLine)) {
  content = content.replace(oldLine, newLine);
  fs.writeFileSync(file, content, 'utf8');
  console.log('✓ Cambio aplicado correctamente');
} else {
  console.log('✗ No se encontró la línea exacta');
  console.log('Buscando variantes...');
  
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('tieneCargar') && line.includes('row[12]')) {
      console.log(`Línea ${i + 1}: ${line}`);
    }
  });
}
