const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'data', 'sheet_job_history.csv');
const text = fs.readFileSync(csvPath, 'utf8');
const lines = text.split('\n');

const custSet = new Set();
const custCountMap = {};

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  // Simple CSV split handling quotes
  const row = [];
  let current = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  row.push(current.trim());

  const cust = (row[6] || '').toUpperCase().trim();
  if (cust) {
    custSet.add(cust);
    custCountMap[cust] = (custCountMap[cust] || 0) + 1;
  }
}

console.log(`Total unique customer strings: ${custSet.size}`);

const sortedCusts = Array.from(custSet).sort();
fs.writeFileSync(path.join(__dirname, 'all_customers.json'), JSON.stringify(sortedCusts, null, 2));

console.log('\nTop 40 most frequent customer strings:');
const topCusts = Object.entries(custCountMap).sort((a, b) => b[1] - a[1]).slice(0, 40);
topCusts.forEach(([c, cnt]) => console.log(`${c} -> ${cnt} jobs`));
