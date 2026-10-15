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

const handleRequest = async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      const [bookingCsv, jobCsv] = await Promise.all([
        getSheetData(GID_BOOKING, 'sheet_booking.csv'),
        getSheetData(GID_JOB_HISTORY, 'sheet_job_history.csv')
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          bookings: bookingList,
          jobHistory: jobList,
          targets: targets
        }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
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
