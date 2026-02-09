const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'public', 'base_historica.csv');
const txt = fs.readFileSync(file, 'utf8');
const lines = txt.split(/\r?\n/).slice(1).filter(l => l.trim()).slice(0,8);
function parseCSVLine(line){
  return line.match(/("[^"]*"|[^,]+)/g) || [];
}
function normalize(s){
  if(!s) return '';
  return s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
lines.forEach((l,i)=>{
  const cols = parseCSVLine(l);
  const col12 = (cols[12] || '').replace(/"/g,'').trim();
  console.log(i+1, 'col[12]=', col12 || '<empty>', '->', normalize(col12));
});
