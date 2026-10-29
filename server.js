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
const GID_JOB_HISTORY_2025 = '229849563';

// Spreadsheet WIP (Work In Progress)
const DOC_ID_WIP = '1PoXWBRJafxE3fYr479k-ZczgBTd4uOS_cFRs6Xi5PJs';
const GID_WIP_MAIN = '2131957268';  // progress status < 40
const GID_WIP_PLAN = '44824614';    // Planning Cetak SI OKTOBER
const GID_WIP_TCARE = '1052469338'; // TCARE
const GID_WIP_REPORT = '1595584966';// REPORT

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

async function getSheetByName(sheetName, fallbackFilename) {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${DOC_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
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
    console.warn(`Fetch live Sheet ${sheetName} failed, using local cache:`, e.message);
  }

  const localPath = path.join(DATA_DIR, fallbackFilename);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, 'utf8');
  }
  return '';
}

function normalizeKecamatanAndKab(kecRaw, kabRaw) {
  let kec = (kecRaw || '').toUpperCase().trim();
  let kab = (kabRaw || '').toUpperCase().trim();

  if (kec === '#N/A' || kec === '-' || kec === '0') kec = '';
  if (kab === '#N/A' || kab === '-' || kab === '0') kab = '';

  // Clean KABUPATEN / KAB. prefix for comparison
  let cleanKab = kab.replace(/^KABUPATEN\s+/i, 'KAB. ').trim();
  if (cleanKab === 'GIANYAR') cleanKab = 'KAB. GIANYAR';
  if (cleanKab === 'BANGLI') cleanKab = 'KAB. BANGLI';
  if (cleanKab === 'KLUNGKUNG') cleanKab = 'KAB. KLUNGKUNG';
  if (cleanKab === 'DENPASAR' || cleanKab === 'KOTA DENPASAR') cleanKab = 'KOTA DENPASAR';
  if (cleanKab === 'BADUNG') cleanKab = 'KAB. BADUNG';
  if (cleanKab === 'KARANGASEM' || cleanKab === 'KARANGSEM') cleanKab = 'KAB. KARANGASEM';
  if (cleanKab === 'TABANAN') cleanKab = 'KAB. TABANAN';
  if (cleanKab === 'BULELENG') cleanKab = 'KAB. BULELENG';
  if (cleanKab === 'JEMBRANA') cleanKab = 'KAB. JEMBRANA';

  // 1. Normalize 7 Kecamatan in KAB. GIANYAR
  if (kec.includes('BLAHBATUH') || kec.includes('BELAH BATUH') || kec === 'BLAHBATU') {
    return { kecamatan: 'KEC. BLAHBATUH', kabupaten: 'KAB. GIANYAR' };
  }
  if (kec.includes('TAMPAKSIRING') || kec.includes('TAMPAK SIRING') || kec === 'TPS') {
    return { kecamatan: 'KEC. TAMPAKSIRING', kabupaten: 'KAB. GIANYAR' };
  }
  if (kec.includes('TEGALLALANG') || kec.includes('TEGALALANG') || kec === 'TEGALLANG') {
    return { kecamatan: 'KEC. TEGALLALANG', kabupaten: 'KAB. GIANYAR' };
  }
  if (kec.includes('UBUD')) {
    return { kecamatan: 'KEC. UBUD', kabupaten: 'KAB. GIANYAR' };
  }
  if (kec.includes('SUKAWATI')) {
    return { kecamatan: 'KEC. SUKAWATI', kabupaten: 'KAB. GIANYAR' };
  }
  if (kec.includes('PAYANGAN')) {
    return { kecamatan: 'KEC. PAYANGAN', kabupaten: 'KAB. GIANYAR' };
  }
  if (kec === 'KEC. GIANYAR' || kec === 'GIANYAR' || kec === 'GYR' || (cleanKab === 'KAB. GIANYAR' && ['ABIANBASE', 'BAKBAKAN', 'PETAK', 'SIANGAN'].includes(kec))) {
    return { kecamatan: 'KEC. GIANYAR', kabupaten: 'KAB. GIANYAR' };
  }

  // 2. Normalize 4 Kecamatan in KAB. BANGLI
  if (kec.includes('KINTAMANI')) {
    return { kecamatan: 'KEC. KINTAMANI', kabupaten: 'KAB. BANGLI' };
  }
  if (kec.includes('SUSUT')) {
    return { kecamatan: 'KEC. SUSUT', kabupaten: 'KAB. BANGLI' };
  }
  if (kec.includes('TEMBUKU')) {
    return { kecamatan: 'KEC. TEMBUKU', kabupaten: 'KAB. BANGLI' };
  }
  if (kec === 'KEC. BANGLI' || kec === 'BANGLI' || (cleanKab === 'KAB. BANGLI' && ['KAWAN', 'KUBU'].includes(kec))) {
    return { kecamatan: 'KEC. BANGLI', kabupaten: 'KAB. BANGLI' };
  }

  // 3. Normalize 4 Kecamatan in KAB. KLUNGKUNG
  if (kec.includes('NUSA PENIDA') || kec.includes('NUSAPENIDA')) {
    return { kecamatan: 'KEC. NUSA PENIDA', kabupaten: 'KAB. KLUNGKUNG' };
  }
  if (kec.includes('BANJARANGKAN') || kec.includes('BANJARANGAKAN')) {
    return { kecamatan: 'KEC. BANJARANGKAN', kabupaten: 'KAB. KLUNGKUNG' };
  }
  if (kec === 'KEC. DAWAN' || kec === 'DAWAN' || (cleanKab === 'KAB. KLUNGKUNG' && kec === 'KUSAMBA')) {
    return { kecamatan: 'KEC. DAWAN', kabupaten: 'KAB. KLUNGKUNG' };
  }
  if (kec === 'KEC. KLUNGKUNG' || kec === 'KLUNGKUNG' || kec === 'KLUNGKUN' || kec === 'KLK' || kec === 'SEMARAPURA' ||
      (cleanKab === 'KAB. KLUNGKUNG' && ['SEMARAPURA', 'SEMARAPURA KAU', 'GELGEL', 'KAMASAN', 'AKAH', 'TEGAK'].includes(kec))) {
    return { kecamatan: 'KEC. KLUNGKUNG', kabupaten: 'KAB. KLUNGKUNG' };
  }

  // 4. Normalize 4 Kecamatan in KOTA DENPASAR
  if (kec.includes('DENPASAR SELATAN') || ['SANUR', 'SIDAKARYA', 'SESETA', 'SESETAN'].includes(kec)) {
    return { kecamatan: 'KEC. DENPASAR SELATAN', kabupaten: 'KOTA DENPASAR' };
  }
  if (kec.includes('DENPASAR TIMUR')) {
    return { kecamatan: 'KEC. DENPASAR TIMUR', kabupaten: 'KOTA DENPASAR' };
  }
  if (kec.includes('DENPASAR UTARA')) {
    return { kecamatan: 'KEC. DENPASAR UTARA', kabupaten: 'KOTA DENPASAR' };
  }
  if (kec.includes('DENPASAR BARAT') || kec === 'PADANG SAMBIAN' || kec === 'DENPASAR' || kec === 'DENPSAR') {
    return { kecamatan: 'KEC. DENPASAR BARAT', kabupaten: 'KOTA DENPASAR' };
  }

  // 5. Normalize 8 Kecamatan in KAB. KARANGASEM
  if (kec.includes('MANGGIS')) return { kecamatan: 'KEC. MANGGIS', kabupaten: 'KAB. KARANGASEM' };
  if (kec.includes('SIDEMEN')) return { kecamatan: 'KEC. SIDEMEN', kabupaten: 'KAB. KARANGASEM' };
  if (kec.includes('SELAT')) return { kecamatan: 'KEC. SELAT', kabupaten: 'KAB. KARANGASEM' };
  if (kec.includes('RENDANG')) return { kecamatan: 'KEC. RENDANG', kabupaten: 'KAB. KARANGASEM' };
  if (kec.includes('ABANG')) return { kecamatan: 'KEC. ABANG', kabupaten: 'KAB. KARANGASEM' };
  if (kec.includes('BEBANDEM')) return { kecamatan: 'KEC. BEBANDEM', kabupaten: 'KAB. KARANGASEM' };
  if (kec.includes('KUBU') && !kec.includes('KUBUTAMBAHAN')) return { kecamatan: 'KEC. KUBU', kabupaten: 'KAB. KARANGASEM' };
  if (kec.includes('KARANGASEM') || kec.includes('KARANG ASEM') || kec === 'KARANGSEM' || kec === 'PADANGKERTA' || kec === 'KRA') {
    return { kecamatan: 'KEC. KARANGASEM', kabupaten: 'KAB. KARANGASEM' };
  }

  // 6. Normalize 6 Kecamatan in KAB. BADUNG
  if (kec.includes('KUTA SELATAN')) return { kecamatan: 'KEC. KUTA SELATAN', kabupaten: 'KAB. BADUNG' };
  if (kec.includes('KUTA UTARA')) return { kecamatan: 'KEC. KUTA UTARA', kabupaten: 'KAB. BADUNG' };
  if (kec === 'KEC. KUTA' || kec === 'KUTA') return { kecamatan: 'KEC. KUTA', kabupaten: 'KAB. BADUNG' };
  if (kec.includes('ABIANSEMAL')) return { kecamatan: 'KEC. ABIANSEMAL', kabupaten: 'KAB. BADUNG' };
  if (kec.includes('MENGWI') || kec === 'GULINGAN' || kec === 'BADUNG') return { kecamatan: 'KEC. MENGWI', kabupaten: 'KAB. BADUNG' };
  if (kec.includes('PETANG')) return { kecamatan: 'KEC. PETANG', kabupaten: 'KAB. BADUNG' };

  // 7. Normalize 10 Kecamatan in KAB. TABANAN
  if (kec.includes('SELEMADEG TIMUR')) return { kecamatan: 'KEC. SELEMADEG TIMUR', kabupaten: 'KAB. TABANAN' };
  if (kec.includes('SELEMADEG BARAT')) return { kecamatan: 'KEC. SELEMADEG BARAT', kabupaten: 'KAB. TABANAN' };
  if (kec.includes('SELEMADEG')) return { kecamatan: 'KEC. SELEMADEG', kabupaten: 'KAB. TABANAN' };
  if (kec.includes('KEDIRI')) return { kecamatan: 'KEC. KEDIRI', kabupaten: 'KAB. TABANAN' };
  if (kec.includes('MARGA')) return { kecamatan: 'KEC. MARGA', kabupaten: 'KAB. TABANAN' };
  if (kec.includes('BATURITI')) return { kecamatan: 'KEC. BATURITI', kabupaten: 'KAB. TABANAN' };
  if (kec.includes('KERAMBITAN')) return { kecamatan: 'KEC. KERAMBITAN', kabupaten: 'KAB. TABANAN' };
  if (kec.includes('PENEBEL')) return { kecamatan: 'KEC. PENEBEL', kabupaten: 'KAB. TABANAN' };
  if (kec.includes('PUPUAN')) return { kecamatan: 'KEC. PUPUAN', kabupaten: 'KAB. TABANAN' };
  if (kec.includes('TABANAN')) return { kecamatan: 'KEC. TABANAN', kabupaten: 'KAB. TABANAN' };

  // 8. Normalize 9 Kecamatan in KAB. BULELENG
  if (kec.includes('KUBUTAMBAHAN')) return { kecamatan: 'KEC. KUBUTAMBAHAN', kabupaten: 'KAB. BULELENG' };
  if (kec.includes('SAWAN')) return { kecamatan: 'KEC. SAWAN', kabupaten: 'KAB. BULELENG' };
  if (kec.includes('TEJAKULA')) return { kecamatan: 'KEC. TEJAKULA', kabupaten: 'KAB. BULELENG' };
  if (kec.includes('SERIRIT')) return { kecamatan: 'KEC. SERIRIT', kabupaten: 'KAB. BULELENG' };
  if (kec.includes('SUKASADA')) return { kecamatan: 'KEC. SUKASADA', kabupaten: 'KAB. BULELENG' };
  if (kec.includes('BUSUNGBIU') || kec.includes('BUSUNG BIU')) return { kecamatan: 'KEC. BUSUNGBIU', kabupaten: 'KAB. BULELENG' };
  if (kec.includes('GEROKGAK')) return { kecamatan: 'KEC. GEROKGAK', kabupaten: 'KAB. BULELENG' };
  if ((kec === 'KEC. BANJAR' || kec === 'BANJAR') && (cleanKab === 'KAB. BULELENG' || cleanKab === '')) {
    return { kecamatan: 'KEC. BANJAR', kabupaten: 'KAB. BULELENG' };
  }
  if (kec.includes('BULELENG')) return { kecamatan: 'KEC. BULELENG', kabupaten: 'KAB. BULELENG' };

  // 9. Normalize 5 Kecamatan in KAB. JEMBRANA
  if (kec.includes('NEGARA')) return { kecamatan: 'KEC. NEGARA', kabupaten: 'KAB. JEMBRANA' };
  if (kec.includes('MELAYA')) return { kecamatan: 'KEC. MELAYA', kabupaten: 'KAB. JEMBRANA' };
  if (kec.includes('MENDOYO')) return { kecamatan: 'KEC. MENDOYO', kabupaten: 'KAB. JEMBRANA' };
  if (kec.includes('PEKUTATAN')) return { kecamatan: 'KEC. PEKUTATAN', kabupaten: 'KAB. JEMBRANA' };
  if (kec.includes('JEMBRANA')) return { kecamatan: 'KEC. JEMBRANA', kabupaten: 'KAB. JEMBRANA' };

  // Other Kecamatan formatting
  if (kec && !kec.startsWith('KEC.')) {
    kec = `KEC. ${kec}`;
  }
  return {
    kecamatan: kec || 'BELUM TERDATA',
    kabupaten: cleanKab || 'LAINNYA'
  };
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

function parseJobRows(jobRows) {
  const list = [];
  const seenOrders = new Set();
  if (jobRows && jobRows.length > 1) {
    for (let i = 1; i < jobRows.length; i++) {
      const row = jobRows[i];
      if (!row || row.length < 15) continue;

      const invDate = normalizeDate(row[2]);
      const vin = (row[12] || '').trim();
      if (!invDate || !vin) continue; // Ignore invalid dates or missing VINs

      const orderNo = (row[14] || '').trim();
      if (orderNo) seenOrders.add(orderNo);

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
      const { kecamatan, kabupaten } = normalizeKecamatanAndKab(row[10], row[11]);

      list.push({
        invDate,
        vin,
        orderNo,
        customer,
        customerType,
        kecamatan,
        kabupaten,
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

  // Supplement rows 12014-12018 (5 PDI rows on 2026-10-27 from JOB History 2026) if not yet copied to JOB HISTORY ANALISA
  const oct2026PdiSupplement = [
    { orderNo: '210126012144', vin: 'PDI-210126012144', invDate: '2026-10-27', jasa: 231000 },
    { orderNo: '210126012142', vin: 'PDI-210126012142', invDate: '2026-10-27', jasa: 297000 },
    { orderNo: '210126012141', vin: 'PDI-210126012141', invDate: '2026-10-27', jasa: 163000 },
    { orderNo: '210126012140', vin: 'PDI-210126012140', invDate: '2026-10-27', jasa: 231000 },
    { orderNo: '210126012138', vin: 'PDI-210126012138', invDate: '2026-10-27', jasa: 231000 }
  ];
  const hasOct2026 = list.some(j => j.invDate && j.invDate.startsWith('2026-10'));
  if (hasOct2026) {
    oct2026PdiSupplement.forEach(item => {
      if (!seenOrders.has(item.orderNo)) {
        list.push({
          invDate: item.invDate,
          vin: item.vin,
          orderNo: item.orderNo,
          customer: 'INTERNAL PDI',
          customerType: 'INT',
          kecamatan: 'BELUM TERDATA',
          kabupaten: 'LAINNYA',
          tech: 'BAS',
          repairType: 'PDI',
          sa: 'PDS',
          jasa: item.jasa,
          part: 0,
          oil: 0,
          material: 0,
          sublet: 0,
          disc: 0,
          revenue: item.jasa,
          notes: '',
          isTCare: false,
          tCareCategory: 'NON_TCARE',
          isSbe: false,
          sbeKmCategory: 'OTHER_KM'
        });
      }
    });
  }

  return list;
}

function parseUioRows(uioRows) {
  const list = [];
  const seenVins = new Set();
  if (uioRows && uioRows.length > 1) {
    for (let i = 1; i < uioRows.length; i++) {
      const row = uioRows[i];
      if (!row || row.length < 15) continue;

      const vin = (row[9] || '').toUpperCase().trim(); // Col J: NO RANGKA
      if (!vin || vin.length < 6 || seenVins.has(vin)) continue;
      seenVins.add(vin);

      const model = (row[7] || '').trim();
      const customer = (row[10] || '').trim();
      const nopol = (row[11] || '').trim();
      const kabRaw = row[13] || ''; // Col N: Kab
      const kecRaw = row[14] || ''; // Col O: Kec
      const tahun = (row[19] || '').trim();
      const { kecamatan, kabupaten } = normalizeKecamatanAndKab(kecRaw, kabRaw);

      list.push({
        vin,
        model,
        customer,
        nopol,
        kecamatan,
        kabupaten,
        tahun
      });
    }
  }
  return list;
}

function categorizeWipReason(reason) {
  const r = (reason || '').toUpperCase();
  if (r.includes('ORDER') || r.includes('PART') || r.includes('BAN') || r.includes('PENGADAAN')) {
    return 'Kendala Part / Pengadaan';
  }
  if (r.includes('DIKERJAKAN') || r.includes('BENGKEL') || r.includes('STALL')) {
    return 'Sedang Dikerjakan di Stall';
  }
  if (r.includes('ACC') || r.includes('SPK') || r.includes('KONFIRMASI') || r.includes('ESTIMASI')) {
    return 'Menunggu Persetujuan / SPK';
  }
  if (r.includes('VALIDATION') || r.includes('TOWASS') || r.includes('TF') || r.includes('PBYRN') || r.includes('THS') || r.includes('CETAK SI')) {
    return 'Pembayaran & Validasi';
  }
  return 'Menunggu Persetujuan / SPK';
}

function parseWipData(mainCsv, planCsv, tcareCsv, reportCsv) {
  const mainRows = parseCSV(mainCsv);
  const planRows = parseCSV(planCsv || '');
  const tcareRows = parseCSV(tcareCsv || '');

  const planSoSet = new Set();
  for (let i = 1; i < planRows.length; i++) {
    const so = (planRows[i][5] || '').trim();
    const pol = (planRows[i][1] || '').trim();
    if (so) planSoSet.add(so);
    if (pol) planSoSet.add(pol);
  }

  const tcareSoSet = new Set();
  for (let i = 1; i < tcareRows.length; i++) {
    const so = (tcareRows[i][5] || '').trim();
    const pol = (tcareRows[i][1] || '').trim();
    if (so) tcareSoSet.add(so);
    if (pol) tcareSoSet.add(pol);
  }

  let updatedAtText = '28 Oktober 2026';
  let updatedAt = '2026-10-28';
  if (reportCsv) {
    const m = reportCsv.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})/);
    if (m) {
      const day = m[1];
      const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const monthIdx = parseInt(m[2], 10);
      const year = m[3];
      updatedAtText = `${day} ${monthNames[monthIdx] || 'Oktober'} ${year}`;
      updatedAt = `${year}-${String(monthIdx).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const items = [];
  let totalOmzet = 0;
  const uniqueCars = new Set();
  const cpusCars = new Set();

  let planCount = 0;
  let planOmzet = 0;
  let tcareCount = 0;
  let tcareOmzet = 0;

  const byType = {
    SBE: { count: 0, omzet: 0 },
    GRP: { count: 0, omzet: 0 },
    PRT: { count: 0, omzet: 0 },
    OIL: { count: 0, omzet: 0 },
    TWC: { count: 0, omzet: 0 },
    SBI: { count: 0, omzet: 0 },
    PDI: { count: 0, omzet: 0 }
  };
  const bySa = {};
  const byReasonCategory = {
    'Kendala Part / Pengadaan': { count: 0, omzet: 0 },
    'Sedang Dikerjakan di Stall': { count: 0, omzet: 0 },
    'Menunggu Persetujuan / SPK': { count: 0, omzet: 0 },
    'Pembayaran & Validasi': { count: 0, omzet: 0 }
  };

  for (let i = 1; i < mainRows.length; i++) {
    const r = mainRows[i];
    if (!r || r.length < 10) continue;

    const no = parseInt(r[0], 10) || i;
    const policeNo = (r[1] || '').trim();
    if (!policeNo) continue;

    const customer = (r[2] || '').trim();
    const model = (r[3] || '').trim();
    const vin = (r[67] || r[4] || '').trim();
    const serviceOrder = (r[5] || '').trim();
    const status = (r[6] || '').trim();
    const repairType = (r[7] || '').toUpperCase().trim();
    const sa = (r[11] || '').toUpperCase().trim();
    const technician = (r[12] || '-').trim() || '-';
    const arrivalDate = (r[19] || '').trim();
    const deliveryDate = (r[43] || r[47] || '').trim();
    const notes = (r[57] || '').trim();
    const reason = (r[88] || '').trim() || 'Dalam Pengerjaan';
    const reasonCategory = categorizeWipReason(reason);
    const omzet = cleanNum(r[89]);

    const isPlanningCetakSi = planSoSet.has(serviceOrder) || planSoSet.has(policeNo);
    const isTCare = tcareSoSet.has(serviceOrder) || tcareSoSet.has(policeNo);

    const isCpus = repairType !== 'TWC' && repairType !== 'PRT';
    if (isCpus) {
      cpusCars.add(policeNo);
    }
    uniqueCars.add(policeNo);

    totalOmzet += omzet;
    if (isPlanningCetakSi) {
      planCount++;
      planOmzet += omzet;
    }
    if (isTCare) {
      tcareCount++;
      tcareOmzet += omzet;
    }

    if (!byType[repairType]) {
      byType[repairType] = { count: 0, omzet: 0 };
    }
    byType[repairType].count++;
    byType[repairType].omzet += omzet;

    if (!bySa[sa]) {
      bySa[sa] = { soCount: 0, carCount: 0, cars: new Set(), omzet: 0 };
    }
    bySa[sa].soCount++;
    bySa[sa].cars.add(policeNo);
    bySa[sa].omzet += omzet;

    if (!byReasonCategory[reasonCategory]) {
      byReasonCategory[reasonCategory] = { count: 0, omzet: 0 };
    }
    byReasonCategory[reasonCategory].count++;
    byReasonCategory[reasonCategory].omzet += omzet;

    items.push({
      no,
      policeNo,
      customer,
      model,
      vin,
      serviceOrder,
      status,
      repairType,
      sa,
      technician,
      arrivalDate,
      deliveryDate,
      reason,
      reasonCategory,
      omzet,
      notes,
      isCpusUnique: isCpus,
      isPlanningCetakSi,
      isTCare
    });
  }

  const formattedBySa = {};
  Object.keys(bySa).forEach(k => {
    formattedBySa[k] = {
      soCount: bySa[k].soCount,
      carCount: bySa[k].cars.size,
      omzet: bySa[k].omzet
    };
  });

  return {
    updatedAt,
    updatedAtText,
    summary: {
      totalWipRows: items.length,
      totalCpusUnique: cpusCars.size,
      totalOmzetEstimasi: totalOmzet,
      planningCetakSi: {
        count: planCount,
        omzet: planOmzet
      },
      tCare: {
        count: tcareCount,
        omzet: tcareOmzet
      },
      byType,
      bySa: formattedBySa,
      byReasonCategory
    },
    items
  };
}

async function fetchWipFromSheet() {
  try {
    const [mainCsv, planCsv, tcareCsv, reportCsv] = await Promise.all([
      fetchUrl(`https://docs.google.com/spreadsheets/d/${DOC_ID_WIP}/export?format=csv&gid=${GID_WIP_MAIN}`),
      fetchUrl(`https://docs.google.com/spreadsheets/d/${DOC_ID_WIP}/export?format=csv&gid=${GID_WIP_PLAN}`),
      fetchUrl(`https://docs.google.com/spreadsheets/d/${DOC_ID_WIP}/export?format=csv&gid=${GID_WIP_TCARE}`),
      fetchUrl(`https://docs.google.com/spreadsheets/d/${DOC_ID_WIP}/export?format=csv&gid=${GID_WIP_REPORT}`)
    ]);

    if (mainCsv && mainCsv.length > 200 && !mainCsv.includes('<!DOCTYPE html>')) {
      const parsedWip = parseWipData(mainCsv, planCsv, tcareCsv, reportCsv);
      // Cache locally
      try {
        fs.writeFileSync(path.join(DATA_DIR, 'wip.json'), JSON.stringify(parsedWip, null, 2));
      } catch (_) {}
      return parsedWip;
    }
  } catch (err) {
    console.warn('Fetch live WIP failed, using local cache:', err.message);
  }
  const wipPath = path.join(DATA_DIR, 'wip.json');
  if (fs.existsSync(wipPath)) {
    try {
      return JSON.parse(fs.readFileSync(wipPath, 'utf8'));
    } catch (_) {}
  }
  return null;
}

const handleRequest = async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      const [bookingCsv, jobCsv, stoCsv, job2025Csv, uioCsv] = await Promise.all([
        getSheetData(GID_BOOKING, 'sheet_booking.csv'),
        getSheetData(GID_JOB_HISTORY, 'sheet_job_history.csv'),
        getSheetData(GID_STO, 'sheet_sto.csv'),
        getSheetData(GID_JOB_HISTORY_2025, 'sheet_job_history_2025.csv'),
        getSheetByName('UIO', 'sheet_uio.csv')
      ]);

      const bookingRows = parseCSV(bookingCsv);
      const jobRows = parseCSV(jobCsv);
      const job2025Rows = parseCSV(job2025Csv);
      const uioRows = parseCSV(uioCsv);

      const bookingVinMonthSet = new Set();
      const jobList = parseJobRows(jobRows);
      const job2025List = parseJobRows(job2025Rows);
      const uioList = parseUioRows(uioRows);

      jobList.forEach(j => {
        const monthStr = j.invDate.substring(0, 7);
        bookingVinMonthSet.add(`${j.vin.toUpperCase()}_${monthStr}`);
      });

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

      const wip = (await fetchWipFromSheet()) || {};

      const sto = parseStoSheet(stoCsv);

      let kpiTeknisi = {};
      const kpiPath = path.join(DATA_DIR, 'kpi_teknisi.json');
      if (fs.existsSync(kpiPath)) {
        try { kpiTeknisi = JSON.parse(fs.readFileSync(kpiPath, 'utf8')); } catch (_) {}
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          bookings: bookingList,
          jobHistory: jobList,
          jobHistory2025: job2025List,
          uio: uioList,
          targets: targets,
          wip: wip,
          sto: sto,
          kpiTeknisi: kpiTeknisi
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
      try {
        const liveWip = await fetchWipFromSheet();
        if (liveWip) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, wip: liveWip }));
          return;
        }
      } catch (err) {
        console.warn('Live WIP fetch failed:', err.message);
      }
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

  if (pathname === '/api/kpi-teknisi/sync-sheet') {
    const kpiPath = path.join(DATA_DIR, 'kpi_teknisi.json');
    (async () => {
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${DOC_ID}/export?format=csv&gid=1193883980`;
        const csvText = await fetchUrl(csvUrl);
        const rows = parseCSV(csvText);
        let periode = '1 - 28 OKTOBER 2026';
        const groups = [];
        let currentGrp = null;
        let grpIdx = 0;

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const colB = (r[1] || '').trim();
          const colC = (r[2] || '').trim();
          if (colB.includes('OKTOBER') || colB.includes('2026') || colB.includes('2025')) {
            if (!colB.toUpperCase().includes('KPI')) periode = colB;
          }
          const grpCandidate = colC.toUpperCase().startsWith('GROUP') || colC.toUpperCase() === 'THS' || colC.toUpperCase() === 'PDS'
            ? colC
            : (colB.toUpperCase().startsWith('GROUP') || colB.toUpperCase() === 'THS' || colB.toUpperCase() === 'PDS' ? colB : '');
          if (grpCandidate) {
            grpIdx++;
            const isPds = grpCandidate.toUpperCase() === 'PDS';
            const grpId = isPds ? 'grp-pds' : (grpCandidate.toUpperCase() === 'THS' ? 'grp-ths' : `grp-${grpIdx}`);
            currentGrp = { id: grpId, name: grpCandidate, isPds, technicians: [] };
            groups.push(currentGrp);
          }
          const noNum = parseInt(colB, 10);
          if (!isNaN(noNum) && noNum > 0 && colC && !colC.toUpperCase().startsWith('GROUP')) {
            if (!currentGrp) {
              grpIdx++;
              currentGrp = { id: `grp-${grpIdx}`, name: `GROUP ${grpIdx}`, technicians: [] };
              groups.push(currentGrp);
            }
            const rawTargetJam = (r[3] || '').trim();
            const isNcs = rawTargetJam.toUpperCase() === 'NCS';
            currentGrp.technicians.push({
              id: `tek-${currentGrp.id}-${noNum}`,
              no: noNum,
              name: colC,
              targetJam: isNcs ? 0 : cleanNum(rawTargetJam),
              targetJamText: isNcs ? 'NCS' : '',
              aktualJam: cleanNum(r[4]),
              targetOmset: cleanNum(r[7]),
              aktualOmset: cleanNum(r[8]),
              hok: cleanNum(r[11]),
              lt: cleanNum(r[12]),
              ti: cleanNum(r[13]),
              cr7: cleanNum(r[14]),
              sakit: cleanNum(r[15]),
              cuti: cleanNum(r[16]),
              keterangan: (r[17] || (isNcs ? 'NCS' : '')).trim()
            });
          }
        }

        if (groups.length > 0) {
          const syncedKpi = {
            title: 'KPI TEKNISI',
            periode,
            summarySide: {
              targetBengkel: 558681846,
              pembagi: 14,
              targetPerTeknisi: 39905846,
              targetJamBengkel: 1806
            },
            groups,
            notes: [
              'TE : TINGKAT KECEPATAN TEKNISI DALAM BEKERJA',
              'OP : TINGKAT PRODUKTIFITAS BENGKEL DALAM MEMANFAATKAN TEKNISI',
              'LU : EFICIENCY PENGGUNAAN TEKNISI YANG ADA',
              '# : POTENSI T.I / GRUP UNTUK LAPORAN TEKNIK'
            ]
          };
          fs.writeFileSync(kpiPath, JSON.stringify(syncedKpi, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: syncedKpi }));
        } else {
          throw new Error('Tidak dapat membaca baris teknisi dari Google Sheet KPI Teknisi');
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (pathname === '/api/kpi-teknisi' || pathname === '/api/kpi/teknisi') {
    const kpiPath = path.join(DATA_DIR, 'kpi_teknisi.json');
    if (req.method === 'GET') {
      if (fs.existsSync(kpiPath)) {
        try {
          const kpi = JSON.parse(fs.readFileSync(kpiPath, 'utf8'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: kpi }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'KPI data not found' }));
      }
      return;
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const newKpi = JSON.parse(body);
          fs.writeFileSync(kpiPath, JSON.stringify(newKpi, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Data KPI Teknisi berhasil disimpan', data: newKpi }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/kpi-teknisi/download' || pathname === '/api/kpi-teknisi-download' || pathname === '/api/kpi/teknisi/download') {
    const kpiExcelPath = path.join(DATA_DIR, 'KPI_TEKNISI.xlsx');
    if (fs.existsSync(kpiExcelPath)) {
      const stat = fs.statSync(kpiExcelPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="KPI_TEKNISI_AGUNG_TOYOTA_GIANYAR.xlsx"'
      });
      const readStream = fs.createReadStream(kpiExcelPath);
      readStream.pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Excel file not found' }));
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
