const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'data', 'sheet_job_history.csv');
const lines = fs.readFileSync(csvPath, 'utf8').split('\n');

const techMap = {};

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
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

  const tech = (row[22] || '').toUpperCase().trim();
  if (tech) {
    techMap[tech] = (techMap[tech] || 0) + 1;
  }
}

console.log('Unique Technician Codes & Job Counts:');
console.log(Object.entries(techMap).sort((a, b) => b[1] - a[1]));
