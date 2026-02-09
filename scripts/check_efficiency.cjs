const fs = require('fs');
function normalizeStr(s){ if(!s && s!== '') return ''; try { return String(s).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase(); } catch(e){ return String(s).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase(); }}
function parseNumber(str){ if (str===undefined||str===null) return 0; let clean=String(str).replace(/\"/g,'').trim(); if(!clean) return 0; if(clean.includes(',')&&clean.includes('.')){ if(clean.lastIndexOf(',')>clean.lastIndexOf('.')){ clean=clean.replace(/\./g,'').replace(',','.'); } else { clean=clean.replace(/,/g,''); } } else if(clean.includes(',')&&!clean.includes('.')){ const parts=clean.split(','); if(parts.length===2&&parts[1].length===3){ clean=clean.replace(/,/g,''); } else if(parts.length===2){ clean=clean.replace(',','.'); } else { clean=clean.replace(/,/g,''); } } else if(clean.includes('.')&&!clean.includes(',')){ const parts=clean.split('.'); if(parts.length>1&&parts[parts.length-1].length===3){ clean=clean.replace(/\./g,''); } } const num=parseFloat(clean.replace(/[^0-9\.\-]/g,'')); return isNaN(num)?0:num; }

const gastosTxt = fs.readFileSync('public/gastos_reales.csv','utf8');
const kmsTxt = fs.readFileSync('public/base_historica.csv','utf8');
const gastoLines = gastosTxt.split(/\r?\n/).slice(1).filter(l=>l.trim());
const kmsLines = kmsTxt.split(/\r?\n/).slice(1).filter(l=>l.trim());

function parseCSVLine(line){ return line.match(/("[^"]*"|[^,]+)/g)||[] }

// Compute combustible gasto for Sebastian Poullion in periodo 202601 (Ene 2026)
const targetName = 'Sebastian Poullion';
const targetKey = normalizeStr(targetName);
let gasto = 0;
for(const l of gastoLines){ const cols = parseCSVLine(l); const estado=(cols[15]||'').trim().toUpperCase(); const categoria=(cols[53]||'').trim(); const usuario=(cols[3]||'').trim(); const periodo=(cols[54]||'').replace(/-/g,'').trim(); if(estado!=='CONFIRMADA') continue; if(periodo!=='202601') continue; if(categoria!=='Combustible') continue; const key=normalizeStr(usuario); if(key===targetKey){ const importeStr=cols[5]||''; const num= parseFloat(importeStr.replace(/"/g,'').replace(/\./g,'').replace(/,/g,'.')); // approximate import parser from app
 gasto += (isNaN(num)?0:num); } }

// Find kms in base_historica for same user and periodo
let kms = 0;
for(const l of kmsLines){ const cols = parseCSVLine(l); const anio = cols[0]; const mes = cols[1]; const periodo = anio && mes ? `${anio}${mes.padStart(2,'0')}`:''; if(periodo!=='202601') continue; const usuarioNorm = (cols[12]||cols[3]||cols[2]||'').trim(); const key = normalizeStr(usuarioNorm); if(key===targetKey){ kms += parseNumber(cols[6]); } }

console.log('Gasto combustible for',targetName, 'periodo 202601 ->', gasto);
console.log('KMs empresa for',targetName, 'periodo 202601 ->', kms);
console.log('Costo por km ->', kms>0? (gasto/kms): null);
