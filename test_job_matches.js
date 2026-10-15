const fs = require('fs');
const path = require('path');

const jobCsv = fs.readFileSync(path.join(__dirname, 'data', 'sheet_job_history.csv'), 'utf8');
const lines = jobCsv.split('\n');

const jobList = [];
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

  if (row.length > 20) {
    const invDate = row[2];
    const customer = (row[6] || '').toUpperCase();
    const vin = (row[12] || '').trim();
    const jasa = parseFloat((row[24] || '0').replace(/\./g, '').replace(/,/g, '.')) || 0;
    const part = parseFloat((row[25] || '0').replace(/\./g, '').replace(/,/g, '.')) || 0;
    const oil = parseFloat((row[26] || '0').replace(/\./g, '').replace(/,/g, '.')) || 0;
    const material = parseFloat((row[27] || '0').replace(/\./g, '').replace(/,/g, '.')) || 0;
    const sublet = parseFloat((row[28] || '0').replace(/\./g, '').replace(/,/g, '.')) || 0;
    const disc = parseFloat((row[29] || '0').replace(/\./g, '').replace(/,/g, '.')) || 0;
    const revenue = jasa + part + oil + material + sublet - disc;

    if (invDate && vin && customer) {
      jobList.push({ invDate, customer, vin, revenue });
    }
  }
}

console.log(`Loaded ${jobList.length} valid job history records.`);

const CONTRACTS = [
  // GSO (1-28)
  { no: 1, name: "BAGIAN UMUM SETDA KLUNGKUNG", type: "GSO", unit: 14, matchKeys: ["SETDA KLUNGKUNG", "SETDA KAB.KLUNGKUNG", "SETDA KAB KLUNGKUNG", "BAG. UMUM SETDA"] },
  { no: 2, name: "SEKRETARIAT DPRD KAB. GIANYAR", type: "GSO", unit: 11, matchKeys: ["DPRD KAB GIANYAR", "DPRD KAB. GIANYAR", "DPRD GIANYAR"] },
  { no: 3, name: "SEKRETARIAT DPRD KAB.KLUNGKUNG", type: "GSO", unit: 12, matchKeys: ["DPRD KAB.KLUNGKUNG", "DPRD KAB KLUNGKUNG", "DPRD KLUNGKUNG"] },
  { no: 4, name: "DINAS KESEHATAN KABUPATEN GIANYAR", type: "GSO", unit: 12, matchKeys: ["DINAS KESEHATAN KABUPATEN GIANYAR", "DINKES GIANYAR"] },
  { no: 5, name: "KANTOR SEKRETARIAT DAERAH KAB GIANYAR", type: "GSO", unit: 43, matchKeys: ["SEKRETARIAT DAERAH KAB GIANYAR", "SETDA KAB GIANYAR", "SETDA GIANYAR"] },
  { no: 6, name: "BPBD KAB GIANYAR", type: "GSO", unit: 4, matchKeys: ["BPBD KAB GIANYAR", "BPBD GIANYAR"] },
  { no: 7, name: "DINAS PU & PR KAB. GIANYAR", type: "GSO", unit: 20, matchKeys: ["DINAS PU & PR", "PU & PR", "PUPR GIANYAR", "PU PR GIANYAR"] },
  { no: 8, name: "SAT POL PP & DAMKAR KAB KLUNGKUNG", type: "GSO", unit: 5, matchKeys: ["SAT POL PP", "SATPOL PP", "DAMKAR KAB KLUNGKUNG"] },
  { no: 9, name: "BPKAD KAB GIANYAR", type: "GSO", unit: 9, matchKeys: ["BPKAD KAB GIANYAR", "BPKAD GIANYAR"] },
  { no: 10, name: "DINAS KOMUNIKASI DAN INFORMATIKA KAB.GYR", type: "GSO", unit: 7, matchKeys: ["KOMUNIKASI DAN INFORMATIKA KAB.GYR", "DISKOMINFO GIANYAR", "KOMINFO GIANYAR"] },
  { no: 11, name: "DISPERINDAG KAB.GIANYAR", type: "GSO", unit: 7, matchKeys: ["DISPERINDAG KAB.GIANYAR", "DISPERINDAG KABUPATEN GIANYAR", "DISPERINDAG GIANYAR"] },
  { no: 12, name: "DINAS KOMUNIKASI INFORMATIKA DAN PERSANDIAN KABUPATEN BANGLI", type: "GSO", unit: 3, matchKeys: ["KOMINFO BANGLI", "KOMUNIKASI INFORMATIKA", "PERSANDIAN KABUPATEN BANGLI"] },
  { no: 13, name: "BADAN PERENCANAAN PEMBANGUNAN DAERAH KABUPATEN GIANYAR", type: "GSO", unit: 5, matchKeys: ["BAPEDA GIANYAR", "BAPPERIDA GIANYAR", "BAPPEDA GIANYAR", "PERENCANAAN PEMBANGUNAN DAERAH KABUPATEN GIANYAR"] },
  { no: 14, name: "KANTOR PERTANAHAN GIANYAR", type: "GSO", unit: 5, matchKeys: ["PERTANAHAN GIANYAR", "BPN GIANYAR", "PERTANAHAN KAB. GIANYAR", "PERTANAHAN KABUPATEN GIANYAR"] },
  { no: 15, name: "DINAS KESEHATAN KABUPATEN BANGLI", type: "GSO", unit: 2, matchKeys: ["DINAS KESEHATAN BANGLI", "DINKES BANGLI", "KESEHATAN BANGLI", "KESEHATAN KABUPATEN BANGLI"] },
  { no: 16, name: "BKPAD KABUPATEN BANGLI", type: "GSO", unit: 4, matchKeys: ["BKPAD KABUPATEN BANGLI", "BKPAD BANGLI"] },
  { no: 17, name: "UPT PUSKESMAS TEMBUKU II", type: "GSO", unit: 3, matchKeys: ["PUSKESMAS TEMBUKU", "TEMBUKU II", "TEMBUKU 2"] },
  { no: 18, name: "INSPEKTORAT KABUPATEN GIANYAR", type: "GSO", unit: 11, matchKeys: ["INSPEKTORAT KABUPATEN GIANYAR", "INSPEKTORAT GIANYAR"] },
  { no: 19, name: "DINAS LINGKUNGAN HIDUP GIANYAR", type: "GSO", unit: 13, matchKeys: ["LINGKUNGAN HIDUP GIANYAR", "DLH GIANYAR"] },
  { no: 20, name: "DINAS PU BANGLI", type: "GSO", unit: 7, matchKeys: ["DINAS PU BANGLI", "PU BANGLI", "PU KAB BANGLI", "PU KAB. BANGLI"] },
  { no: 21, name: "RUMAH SAKIT UMUM PAYANGAN", type: "GSO", unit: 4, matchKeys: ["PAYANGAN", "RSU PAYANGAN", "RSUD PAYANGAN"] },
  { no: 22, name: "POLRES BANGLI", type: "GSO", unit: 6, matchKeys: ["POLRES BANGLI", "KEPOLISIAN RESORT BANGLI"] },
  { no: 23, name: "KEMENTERIAN AGAMA KABUPATEN GIANYAR", type: "GSO", unit: 1, matchKeys: ["KEMENTERIAN AGAMA GIANYAR", "KEMENTRIAN AGAMA GIANYAR", "KEMENAG GIANYAR"] },
  { no: 24, name: "DINAS PARIWISATA KABUPATEN KLUNGKUNG", type: "GSO", unit: 2, matchKeys: ["PARIWISATA KABUPATEN KLUNGKUNG", "DISPAR KLUNGKUNG"] },
  { no: 25, name: "KEPOLISIAN RESORT KLUNGKUNG", type: "GSO", unit: 12, matchKeys: ["POLRES KLUNGKUNG", "KEPOLISIAN RESORT KLUNGKUNG"] },
  { no: 26, name: "BADAN RISET DAN INOVASI DAERAH KABUPATEN GIANYAR", type: "GSO", unit: 2, matchKeys: ["RISET DAN INOVASI DAERAH KABUPATEN GIANYAR", "BRIDA GIANYAR"] },
  { no: 27, name: "RUMAH SAKIT UMUM DAERAH BANGLI", type: "GSO", unit: 11, matchKeys: ["RSUD BANGLI", "RSU BANGLI", "RUMAH SAKIT UMUM BANGLI"] },
  { no: 28, name: "DINAS PARIWISATA DAN KEBUDAYAAN KABUPATEN BANGLI", type: "GSO", unit: 3, matchKeys: ["PARIWISATA DAN KEBUDAYAAN KABUPATEN BANGLI", "DISPARBUD BANGLI"] },

  // FLEET (29-56)
  { no: 29, name: "AWAHITA INDONESIA PUTRA PT (CAPELLA HOTEL)", type: "FLEET", unit: 8, matchKeys: ["AWAHITA", "CAPELLA", "CAPPELLA"] },
  { no: 30, name: "WAPA DIUMA RESORT & SPA / SIDEMEN", type: "FLEET", unit: 4, matchKeys: ["WAPA DIUMA", "SIDEMEN"] },
  { no: 31, name: "PT WAPA DI UME (WAPA DI UME RESORT & SPA)", type: "FLEET", unit: 3, matchKeys: ["WAPA DI UME", "WAPA DIUME"] },
  { no: 32, name: "CV DHARMA PUTRA SIADJA", type: "FLEET", unit: 2, matchKeys: ["CV DHARMA PUTRA SIADJA", "CV. DHARMA PUTRA SIADJA"] },
  { no: 33, name: "PT CIPTA SATYA GRAHA (HOTEL ROYAL KAMUELA UBUD)", type: "FLEET", unit: 5, matchKeys: ["CIPTA SATYA GRAHA", "ROYAL KAMUELA", "KAMUELA UBUD"] },
  { no: 34, name: "PT DHARMA PUTRA SIADJA", type: "FLEET", unit: 6, matchKeys: ["PT DHARMA PUTRA SIADJA", "PT. DHARMA PUTRA SIADJA", "GOYA HOTEL"] },
  { no: 35, name: "PT BISMA INTERNUSA JAYA ABADI", type: "FLEET", unit: 9, matchKeys: ["BISMA INTERNUSA"] },
  { no: 36, name: "PT.MANDRA ALILA", type: "FLEET", unit: 3, matchKeys: ["MANDRA ALILA", "ALILA UBUD"] },
  { no: 37, name: "PITAMAHA HOTEL", type: "FLEET", unit: 4, matchKeys: ["PITAMAHA", "PITA MAHA"] },
  { no: 38, name: "PT. LEMBAH MAHARAJA (VICEROY BALI)", type: "FLEET", unit: 10, matchKeys: ["LEMBAH MAHARAJA", "VICEROY"] },
  { no: 39, name: "PT. PURI KAMANDALU", type: "FLEET", unit: 5, matchKeys: ["PURI KAMANDALU", "KAMANDALU"] },
  { no: 40, name: "PT.SRI SEKAR UBUD", type: "FLEET", unit: 5, matchKeys: ["SRI SEKAR"] },
  { no: 41, name: "PT. SRI JAYA UBUD", type: "FLEET", unit: 2, matchKeys: ["SRI JAYA UBUD"] },
  { no: 42, name: "PT. SRI WANAYUDA UBUD", type: "FLEET", unit: 2, matchKeys: ["SRI WANAYUDA"] },
  { no: 43, name: "PT SRI WANA WANARA", type: "FLEET", unit: 1, matchKeys: ["SRI WANA WANARA"] },
  { no: 44, name: "PT SRI BARUNA KERAMAS", type: "FLEET", unit: 2, matchKeys: ["SRI BARUNA"] },
  { no: 45, name: "AHAYU ARUNIMA PT", type: "FLEET", unit: 6, matchKeys: ["AHAYU ARUNIMA"] },
  { no: 46, name: "BPJS KESEHATAN KAB KLUNGKUNG", type: "FLEET", unit: 6, matchKeys: ["BPJS KESEHATAN KLUNGKUNG", "BPJS KESEHATAN CAB KLUNGKUNG", "BPJS KLUNGKUNG"] },
  { no: 47, name: "UBUD WANA RESORT", type: "FLEET", unit: 2, matchKeys: ["UBUD WANA RESORT", "UBUD WANA"] },
  { no: 48, name: "AMANKILA", type: "FLEET", unit: 14, matchKeys: ["AMANKILA"] },
  { no: 49, name: "AMANDARI", type: "FLEET", unit: 11, matchKeys: ["AMANDARI"] },
  { no: 50, name: "CV CS TRANS", type: "FLEET", unit: 18, matchKeys: ["CS TRANS", "CS TRANSPORT"] },
  { no: 51, name: "ALAYA RESORT UBUD", type: "FLEET", unit: 5, matchKeys: ["ALAYA RESORT", "ALAYA UBUD"] },
  { no: 52, name: "CV WIRASANA", type: "FLEET", unit: 10, matchKeys: ["CV WIRASANA", "CV. WIRASANA"] },
  { no: 53, name: "WIRASANA TANGKAS CV", type: "FLEET", unit: 8, matchKeys: ["WIRASANA TANGKAS"] },
  { no: 54, name: "PT PURI ZUQNI", type: "FLEET", unit: 6, matchKeys: ["PURI ZUQNI"] },
  { no: 55, name: "WISATA JANS RESORT UBUD PT", type: "FLEET", unit: 9, matchKeys: ["WISATA JANS", "JANS RESORT"] },
  { no: 56, name: "KAYON ADILUHUNG PT", type: "FLEET", unit: 5, matchKeys: ["KAYON ADILUHUNG", "THE KAYON"] }
];

let totalCPUSAll = 0;
let totalRevAll = 0;

CONTRACTS.forEach(c => {
  const matched = jobList.filter(j => {
    return c.matchKeys.some(k => j.customer.includes(k));
  });

  const uniqueVins = new Set(matched.map(j => `${j.vin}_${j.invDate}`));
  const cpus = uniqueVins.size;
  const rev = matched.reduce((a, b) => a + b.revenue, 0);

  totalCPUSAll += cpus;
  totalRevAll += rev;

  console.log(`[#${c.no}] ${c.name} (${c.type}) -> Jobs: ${matched.length}, CPUS: ${cpus}, Rev: Rp ${Math.round(rev).toLocaleString('id-ID')}`);
});

console.log(`\n========================================`);
console.log(`TOTAL CPUS MATCED (56 CONTRACTS): ${totalCPUSAll}`);
console.log(`TOTAL REVENUE MATCHED: Rp ${Math.round(totalRevAll).toLocaleString('id-ID')}`);
console.log(`========================================`);
