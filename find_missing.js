const fs = require('fs');
const path = require('path');
const allCusts = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_customers.json'), 'utf8'));

const targets = ['BAPPEDA', 'PERENCANAAN', 'AGAMA', 'KEMENAG', 'RISET', 'BRIDA', 'INOVASI', 'KESEHATAN', 'BANGLI', 'PAYANGAN', 'TEMBUKU', 'KLUNGKUNG'];

targets.forEach(t => {
  const found = allCusts.filter(c => c.includes(t));
  console.log(`\nMatches for "${t}" (${found.length}):`);
  found.slice(0, 15).forEach(f => console.log('  ', f));
});
