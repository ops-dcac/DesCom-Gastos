const fs = require('fs');
function normalizeStr(s){ if(!s && s!== '') return ''; try { return String(s).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase(); } catch(e){ return String(s).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase(); }}
function parseImporte(str){ if(!str) return 0; let clean = String(str).replace(/"/g,'').replace(/\$/g,'').trim(); if (clean.includes(',') && clean.includes('.')){ if (clean.lastIndexOf(',') > clean.lastIndexOf('.')){ clean = clean.replace(/\./g,'').replace(',','.'); } else { clean = clean.replace(/,/g,''); } } else if (clean.includes(',') && !clean.includes('.')){ const parts = clean.split(','); if (parts.length === 2 && parts[1].length === 2) { clean = clean.replace(',', '.'); } else { clean = clean.replace(/,/g, ''); } } else if (clean.includes('.') && !clean.includes(',')) { const parts = clean.split('.'); if (parts.length > 1 && parts[parts.length - 1].length === 3) { clean = clean.replace(/\./g, ''); } } const num = parseFloat(clean); return isNaN(num) ? 0 : num; }
function parseNumber(str){ if (str===undefined||str===null) return 0; let clean=String(str).replace(/\"/g,'').trim(); if(!clean) return 0; if(clean.includes(',')&&clean.includes('.')){ if(clean.lastIndexOf(',')>clean.lastIndexOf('.')){ clean=clean.replace(/\./g,'').replace(',','.'); } else { clean=clean.replace(/,/g,''); } } else if(clean.includes(',')&&!clean.includes('.')){ const parts=clean.split(','); if(parts.length===2&&parts[1].length===3){ clean=clean.replace(/,/g,''); } else if(parts.length===2){ clean=clean.replace(',','.'); } else { clean=clean.replace(/,/g,''); } } else if(clean.includes('.')&&!clean.includes(',')){ const parts=clean.split('.'); if(parts.length>1&&parts[parts.length-1].length===3){ clean=clean.replace(/\./g,''); } } const num=parseFloat(clean.replace(/[^0-9\.\-]/g,'')); return isNaN(num)?0:num; }
function parseCSVLine(line){ return line.match(/("[^"]*"|[^,]+)/g)||[] }

const gastosTxt = fs.readFileSync('public/gastos_reales.csv','utf8');
const kmsTxt = fs.readFileSync('public/base_historica.csv','utf8');
const gastoLines = gastosTxt.split(/\r?\n/).slice(1).filter(l=>l.trim());
const kmsLines = kmsTxt.split(/\r?\n/).slice(1).filter(l=>l.trim());

const targetName = 'Sebastian Poullion';
const targetKey = normalizeStr(targetName);
const periodo = '202601';

let gasto = 0;
for(const l of gastoLines){ const cols = parseCSVLine(l); const estado=(cols[15]||'').trim().toUpperCase(); const categoria=(cols[53]||'').trim(); const usuario=(cols[3]||'').trim(); const per=(cols[54]||'').replace(/-/g,'').trim(); if(estado!=='CONFIRMADA') continue; if(per!==periodo) continue; if(categoria!=='Combustible') continue; const key=normalizeStr(usuario); if(key===targetKey){ gasto += parseImporte(cols[5]||''); } }

let kms = 0;
for(const l of kmsLines){ const cols = parseCSVLine(l); const anio = cols[0]; const mes = cols[1]; const per = anio && mes ? `${anio}${mes.padStart(2,'0')}`:''; if(per!==periodo) continue; const usuarioNorm = (cols[12]||cols[3]||cols[2]||'').trim(); const key = normalizeStr(usuarioNorm); if(key===targetKey){ kms += parseNumber(cols[6]||''); } }

console.log('Gasto combustible for',targetName,'periodo',periodo,'->',gasto);
console.log('KMs empresa for',targetName,'periodo',periodo,'->',kms);
console.log('Costo por km ->', kms>0? (gasto/kms).toFixed(3): null);
