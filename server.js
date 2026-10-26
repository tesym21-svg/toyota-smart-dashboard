const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

const DOC_ID = '1HOQ3_UYada8g4uGN6VhnAS6jI0LMA3GPcnUoPVxOPr8';
const GID_BOOKING = '0';
const GID_JOB_HISTORY = '1425998962';
const GID_STO = '669300407';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSV(text) {
  const lines = text.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    row.push(current.trim());
    result.push(row);
  }
  return result;
}

function cleanNum(val) {
  if (!val) return 0;
  let cleaned = val.toString().replace(/\./g, '').replace(/,/g, '.');
  let num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeDate(str) {
  if (!str) return null;
  str = str.trim();
  // YYYY-MM-DD
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  // DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return null;
}

function normalizeSA(saName) {
  if (!saName) return 'OTHER';
  const u = saName.toUpperCase().trim();
  if (u.includes('AYU')) return 'AYU';
  if (u.includes('AJS') || u.includes('AJUS')) return 'AJS';
  if (u.includes('WBN') || u.includes('WIBANI')) return 'WBN';
  if (u.includes('FIK') || u.includes('RAFIK')) return 'FIK';
  if (u.includes('THS2') || u.includes('TMS 2') || u.includes('TMS2')) return 'THS2';
  if (u.includes('THS') || u.includes('TMS 1') || u.includes('TMS1')) return 'THS';
  if (u.includes('PDS')) return 'PDS';
  return u;
}

function extractTCareCategory(noteStr) {
  if (!noteStr) return 'NON_TCARE';
  const u = noteStr.toUpperCase();
  if (u.includes('TCARE') || u.includes('TC LP') || u.includes('/TC')) {
    const match = u.match(/(\d+0?K)/);
    if (match) return match[1];
    return 'TCARE_OTHER';
  }
  return 'NON_TCARE';
}

function extractSbeKmCategory(row) {
  const job = (row[16] || '').toUpperCase();
  const jobSbe = (row[17] || '').toUpperCase();
  const repairType = (row[18] || '').toUpperCase();
  const notes = (row[39] || '').toUpperCase();

  const combined = `${job} ${jobSbe} ${repairType} ${notes}`;
  
  let kmNum = null;
  const dottedMatch = combined.match(/(\d{1,3}\.\d{3})\s*KM/i);
  if (dottedMatch) {
    kmNum = parseInt(dottedMatch[1].replace(/\./g, ''), 10);
  } else {
    const kMatch = combined.match(/(\d+)\s*K\b/i);
    if (kMatch) {
      kmNum = parseInt(kMatch[1], 10) * 1000;
    } else {
      const numMatch = combined.match(/(\d{4,6})\s*KM/i);
      if (numMatch) {
        kmNum = parseInt(numMatch[1], 10);
      }
    }
  }

  if (!kmNum) {
    const fjMatch = notes.match(/FJ\s*(\d+)K/i);
    if (fjMatch) {
      kmNum = parseInt(fjMatch[1], 10) * 1000;
    }
  }

  if (kmNum !== null) {
    const kmK = Math.round(kmNum / 1000);
    if (kmK === 10) return '10K';
    if (kmK === 20) return '20K';
    if (kmK === 30) return '30K';
    if (kmK === 40) return '40K';
    if (kmK === 50) return '50K';
    if (kmK === 60) return '60K';
    if (kmK === 70) return '70K';
    if (kmK === 80) return '80K';
    if (kmK === 90) return '90K';
    if (kmK === 100) return '100K';
    if ([15, 25, 35, 45, 55, 65, 75, 85, 95].includes(kmK)) return '15/25K';
    if (kmK > 100) return '>100K';
    return `${kmK}K`;
  }

  return 'OTHER_KM';
}

async function getSheetData(gid, fallbackFilename) {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${DOC_ID}/export?format=csv&gid=${gid}`;
    const csvData = await fetchUrl(csvUrl);
    if (csvData && csvData.length > 500 && !csvData.includes('<!DOCTYPE html>')) {
      try {
        fs.writeFileSync(path.join(DATA_DIR, fallbackFilename), csvData);
      } catch (writeErr) {
        // Read-only filesystem on Vercel serverless
      }
      return csvData;
    }
  } catch (e) {
    console.warn(`Fetch live GID ${gid} failed, using local cache:`, e.message);
  }

  const localPath = path.join(DATA_DIR, fallbackFilename);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, 'utf8');
  }
  return '';
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function parseStoPerson(rawName, rawCert, rawCert2) {
  if (!rawName) return null;
  let status = 'Tetap';
  let cleanName = rawName.replace(/`/g, '').trim();
  if (!cleanName || cleanName === '-') return null;

  if (/\(\s*K\s*\)/i.test(cleanName)) {
    status = 'Kontrak';
    cleanName = cleanName.replace(/\(\s*K\s*\)/gi, '').trim();
  } else if (/\(\s*T\s*\)/i.test(cleanName)) {
    status = 'Tetap';
    cleanName = cleanName.replace(/\(\s*T\s*\)/gi, '').trim();
  }

  const certs = [];
  if (rawCert && rawCert.trim()) certs.push(rawCert.trim());
  if (rawCert2 && rawCert2.trim()) certs.push(rawCert2.trim());

  return {
    name: cleanName,
    status,
    cert: certs.join(' / ') || '-'
  };
}

function parseStoSheet(csvText) {
  if (!csvText) return null;
  const rows = parseCSV(csvText);
  if (!rows || rows.length < 15) return null;

  const sto = {
    docDate: 'Gianyar, 02 - 01 - 2026',
    management: [
      { role: 'BRANCH MANAGER', name: 'Gullit Ngantung', status: 'Disetujui', cert: '-' },
      { role: 'ADM. HEAD', name: 'Reynal Sitompul', status: 'Diketahui', cert: '-' },
      { role: 'WORKSHOP HEAD', name: 'I Nengah Andika', status: 'Dibuat', cert: 'TSMT L2', empStatus: 'Tetap' }
    ],
    serviceAdvisors: [],
    controller: null,
    technicalLeader: null,
    foremen: [
      { id: 'f1', title: 'FOREMAN 1', lead: null, technicians: [] },
      { id: 'f2', title: 'FOREMAN 2', lead: null, technicians: [] },
      { id: 'f3', title: 'FOREMAN 3', lead: null, technicians: [] }
    ],
    ths: [],
    servicePoint: [],
    pds: [],
    partman: [],
    toolsKeeper: [],
    mra: [],
    billing: [],
    compositionTech: [],
    certificationsGlossary: []
  };

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] && row[c].toLowerCase().includes('gianyar')) {
        sto.docDate = row[c].trim();
        break;
      }
    }
  }

  // 1. Service Advisors (Rows 14 to 17)
  for (let r = 14; r <= 17; r++) {
    const row = rows[r];
    if (row && row[7] && !row[7].toLowerCase().includes('advisor') && !row[7].toLowerCase().includes('controller')) {
      const sa = parseStoPerson(row[7], row[9]);
      if (sa) sto.serviceAdvisors.push(sa);
    }
  }

  // 2. Controller (Row 22)
  const rCtrl = rows[22];
  if (rCtrl && rCtrl[7]) {
    const rNext = rows[23];
    sto.controller = parseStoPerson(rCtrl[7], rCtrl[9], rNext ? rNext[9] : '');
  }

  // 3. Technical Leader (Row 42)
  const rTL = rows[42];
  if (rTL && rTL[7]) {
    const rNext = rows[43];
    sto.technicalLeader = parseStoPerson(rTL[7], rTL[9], rNext ? rNext[9] : '');
  }

  // 4. Foreman 1 (Lead Row 26, Techs Rows 24, 25, 26, 27)
  const rF1Lead = rows[26];
  if (rF1Lead && rF1Lead[7]) {
    const rNext = rows[27];
    sto.foremen[0].lead = parseStoPerson(rF1Lead[7], rF1Lead[9], rNext ? rNext[9] : '');
  }
  for (let r = 24; r <= 27; r++) {
    const row = rows[r];
    if (row && row[12]) {
      const tech = parseStoPerson(row[12], row[14]);
      if (tech) sto.foremen[0].technicians.push(tech);
    }
  }

  // 5. Foreman 2 (Lead Row 32, Techs Rows 30, 31, 32, 33)
  const rF2Lead = rows[32];
  if (rF2Lead && rF2Lead[7]) {
    const rNext = rows[33];
    sto.foremen[1].lead = parseStoPerson(rF2Lead[7], rF2Lead[9], rNext ? rNext[9] : '');
  }
  for (let r = 30; r <= 33; r++) {
    const row = rows[r];
    if (row && row[12]) {
      const tech = parseStoPerson(row[12], row[14]);
      if (tech) sto.foremen[1].technicians.push(tech);
    }
  }

  // 6. Foreman 3 (Lead Row 38, Techs Rows 36, 37, 38, 39)
  const rF3Lead = rows[38];
  if (rF3Lead && rF3Lead[7]) {
    const rNext = rows[39];
    sto.foremen[2].lead = parseStoPerson(rF3Lead[7], rF3Lead[9], rNext ? rNext[9] : '');
  }
  for (let r = 36; r <= 39; r++) {
    const row = rows[r];
    if (row && row[12]) {
      const tech = parseStoPerson(row[12], row[14]);
      if (tech) sto.foremen[2].technicians.push(tech);
    }
  }

  // 7. THS (Rows 45, 46)
  for (let r = 45; r <= 46; r++) {
    const row = rows[r];
    if (row && row[12]) {
      const ths = parseStoPerson(row[12], row[14]);
      if (ths) sto.ths.push(ths);
    }
  }

  // 8. Service Point (Row 49)
  const rSP = rows[49];
  if (rSP && rSP[12]) {
    sto.servicePoint.push({ name: rSP[12], cert: rSP[14] || 'DT', status: 'Rotasi / Bulan' });
  }

  // 9. PDS Mekanik (Row 52)
  const rPDS = rows[52];
  if (rPDS && rPDS[12]) {
    const pds = parseStoPerson(rPDS[12], rPDS[14]);
    if (pds) sto.pds.push(pds);
  }

  // 10. Partman (Rows 56, 57)
  for (let r = 56; r <= 57; r++) {
    const row = rows[r];
    if (row && row[12]) {
      const pm = parseStoPerson(row[12], row[14]);
      if (pm) sto.partman.push(pm);
    }
  }

  // 11. Tools Keeper (Row 60)
  const rTK = rows[60];
  if (rTK && rTK[12]) {
    const tk = parseStoPerson(rTK[12], rTK[14]);
    if (tk) sto.toolsKeeper.push(tk);
  }

  // 12. MRA (Rows 63, 64)
  for (let r = 63; r <= 64; r++) {
    const row = rows[r];
    if (row && row[12]) {
      const mra = parseStoPerson(row[12], row[14]);
      if (mra) sto.mra.push(mra);
    }
  }

  // 13. Billing & Adm (Rows 68, 69)
  for (let r = 68; r <= 69; r++) {
    const row = rows[r];
    if (row && row[12]) {
      const adm = parseStoPerson(row[12], row[14]);
      if (adm) sto.billing.push(adm);
    }
  }

  // 14. Komposisi Teknisi (Rows 25-31 at col 16, 17, 18)
  for (let r = 25; r <= 31; r++) {
    const row = rows[r];
    if (row && row[16] && row[17]) {
      sto.compositionTech.push({
        category: row[16],
        count: parseInt(row[17], 10) || 0,
        pct: row[18] || '0%'
      });
    }
  }

  // 15. Glossary (Rows 13-23 at col 14)
  for (let r = 13; r <= 23; r++) {
    const row = rows[r];
    if (row && row[14] && row[14].includes('=')) {
      const [abbr, ...rest] = row[14].split('=');
      const cleanAbbr = abbr.trim();
      if (cleanAbbr.toUpperCase() === 'EL') continue; // Exclude EL
      sto.certificationsGlossary.push({
        abbr: cleanAbbr,
        desc: rest.join('=').trim()
      });
    }
  }

  // Summary counts
  let staffList = [
    { role: 'Workshop Head', ...parseStoPerson('I Nengah Andika ( T )', 'TSMT L2') },
    ...sto.serviceAdvisors.map(x => ({ role: 'Service Advisor', ...x })),
    ...(sto.controller ? [{ role: 'Controller', ...sto.controller }] : []),
    ...(sto.technicalLeader ? [{ role: 'Technical Leader', ...sto.technicalLeader }] : [])
  ];

  sto.foremen.forEach(f => {
    if (f.lead) staffList.push({ role: f.title, ...f.lead });
    f.technicians.forEach(t => staffList.push({ role: `Teknisi ${f.title}`, ...t }));
  });

  sto.ths.forEach(x => staffList.push({ role: 'THS', ...x }));
  sto.pds.forEach(x => staffList.push({ role: 'PDS Mekanik', ...x }));
  sto.partman.forEach(x => staffList.push({ role: 'Partman', ...x }));
  sto.toolsKeeper.forEach(x => staffList.push({ role: 'Tools Keeper', ...x }));
  sto.mra.forEach(x => staffList.push({ role: 'MRA', ...x }));
  sto.billing.forEach(x => staffList.push({ role: 'Billing & Adm', ...x }));

  const totalTetap = staffList.filter(m => m.status === 'Tetap').length;
  const totalKontrak = staffList.filter(m => m.status === 'Kontrak').length;

  sto.summary = {
    totalMembers: staffList.length,
    totalTetap,
    totalKontrak,
    totalTeknisi: 15,
    totalSa: sto.serviceAdvisors.length
  };

  return sto;
}

const handleRequest = async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      const [bookingCsv, jobCsv, stoCsv] = await Promise.all([
        getSheetData(GID_BOOKING, 'sheet_booking.csv'),
        getSheetData(GID_JOB_HISTORY, 'sheet_job_history.csv'),
        getSheetData(GID_STO, 'sheet_sto.csv')
      ]);

      const bookingRows = parseCSV(bookingCsv);
      const jobRows = parseCSV(jobCsv);

      const bookingVinMonthSet = new Set();
      const jobList = [];

      // Parse Job History with strict date & VIN filtering
      if (jobRows.length > 1) {
        for (let i = 1; i < jobRows.length; i++) {
          const row = jobRows[i];
          if (!row || row.length < 15) continue;

          const invDate = normalizeDate(row[2]);
          const vin = (row[12] || '').trim();
          if (!invDate || !vin) continue; // Ignore invalid dates or missing VINs

          const repairType = (row[18] || '').toUpperCase().trim();
          const saRaw = row[21] || '';
          const sa = normalizeSA(saRaw);

          const jasa = cleanNum(row[24]);
          const part = cleanNum(row[25]);
          const oil = cleanNum(row[26]);
          const material = cleanNum(row[27]);
          const sublet = cleanNum(row[28]);
          const disc = cleanNum(row[29]);

          const revenue = jasa + part + oil + material + sublet - disc;
          const notes = row[39] || '';
          const tCareCategory = extractTCareCategory(notes);
          const isTCare = tCareCategory !== 'NON_TCARE';
          const sbeKmCategory = extractSbeKmCategory(row);
          const isSbe = repairType.includes('SBE') || (row[17] && row[17].length > 0) || (row[16] && row[16].toUpperCase().includes('SBE'));

          const customer = (row[6] || '').trim();
          const customerType = (row[15] || '').trim();
          const tech = (row[22] || 'OTHER').toUpperCase().trim();

          const monthStr = invDate.substring(0, 7);
          bookingVinMonthSet.add(`${vin.toUpperCase()}_${monthStr}`);

          jobList.push({
            invDate,
            vin,
            customer,
            customerType,
            tech,
            repairType,
            sa,
            jasa,
            part,
            oil,
            material,
            sublet,
            disc,
            revenue,
            notes,
            isTCare,
            tCareCategory,
            isSbe,
            sbeKmCategory
          });
        }
      }

      // Parse Booking Records with strict date & VIN filtering
      const bookingList = [];
      if (bookingRows.length > 1) {
        for (let i = 1; i < bookingRows.length; i++) {
          const row = bookingRows[i];
          if (!row || row.length < 20) continue;

          const arrivalDate = normalizeDate(row[18]);
          const vin = (row[67] || '').trim();
          if (!arrivalDate || !vin || vin.length < 8) continue; // Ignore non-booking or shifted rows

          const pic = (row[8] || '').trim();
          const bookingDate = normalizeDate(row[16]) || '';
          const repairType = row[4] || '';

          const monthStr = arrivalDate.substring(0, 7);
          const isCai = bookingVinMonthSet.has(`${vin.toUpperCase()}_${monthStr}`);

          bookingList.push({
            vin,
            pic,
            arrivalDate,
            bookingDate,
            repairType,
            isCai
          });
        }
      }

      let targets = {};
      const targetsPath = path.join(DATA_DIR, 'targets.json');
      if (fs.existsSync(targetsPath)) {
        targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
      }

      let wip = {};
      const wipPath = path.join(DATA_DIR, 'wip.json');
      if (fs.existsSync(wipPath)) {
        wip = JSON.parse(fs.readFileSync(wipPath, 'utf8'));
      }

      const sto = parseStoSheet(stoCsv);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          bookings: bookingList,
          jobHistory: jobList,
          targets: targets,
          wip: wip,
          sto: sto
        }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (pathname === '/api/sto' && req.method === 'GET') {
    try {
      const stoCsv = await getSheetData(GID_STO, 'sheet_sto.csv');
      const sto = parseStoSheet(stoCsv);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, sto }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (pathname === '/api/wip') {
    const wipPath = path.join(DATA_DIR, 'wip.json');
    if (req.method === 'GET') {
      if (fs.existsSync(wipPath)) {
        const wip = JSON.parse(fs.readFileSync(wipPath, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, wip }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'WIP data not found' }));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const newWip = JSON.parse(body);
          fs.writeFileSync(wipPath, JSON.stringify(newWip, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'WIP data saved successfully', wip: newWip }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/targets') {
    const targetsPath = path.join(DATA_DIR, 'targets.json');
    if (req.method === 'GET') {
      if (fs.existsSync(targetsPath)) {
        const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, targets }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Targets not found' }));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const newTargets = JSON.parse(body);
          fs.writeFileSync(targetsPath, JSON.stringify(newTargets, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Targets saved successfully' }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }
  }

  // Serve static files
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf8');
    }
  });
};

module.exports = handleRequest;

if (require.main === module) {
  const server = http.createServer(handleRequest);
  const backupServer = http.createServer(handleRequest);

  function listenWithFallback(port) {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} sedang digunakan, beralih ke port ${port + 1}...`);
        listenWithFallback(port + 1);
      } else {
        console.error('Server error:', err);
      }
    });

    server.listen(port, () => {
      console.log(`Dashboard Server active at http://localhost:${port}`);
    });
  }

  listenWithFallback(PORT);

  // Also listen on port 3001 as dedicated backup so that http://127.0.0.1:3001 always works
  if (PORT !== 3001) {
    backupServer.once('error', () => {});
    backupServer.listen(3001, () => {
      console.log(`Dashboard Server (Port Cadangan) active at http://localhost:3001`);
    });
  }
}
