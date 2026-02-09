const fs = require('fs');
const idx = parseInt(process.argv[2]||'3213',10);
const txt = fs.readFileSync('public/gastos_reales.csv','utf8');
const lines = txt.split(/\r?\n/);
const line = lines[idx-1] || '';
console.log('LINE:', line.slice(0,300));
const cols = (line.match(/("[^\"]*"|[^,]+)/g) || []).map(c=>c.replace(/^"|"$/g,''));
console.log('COLS COUNT:', cols.length);
for(let i=0;i<cols.length;i++){
  if(i>=0 && i<10) console.log(i, cols[i]);
  else if(i>40 && i<70) console.log(i, cols[i]);
}
