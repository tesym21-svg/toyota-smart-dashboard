const fs = require('fs');
const path = require('path');

const allCusts = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_customers.json'), 'utf8'));

const CONTRACTS = [
  // GSO
  { id: 1, name: "BAGIAN UMUM SETDA KLUNGKUNG", type: "GSO", unit: 14, keys: ["SETDA KLUNGKUNG", "SETDA KAB.KLUNGKUNG", "SETDA KAB KLUNGKUNG", "BAGIAN UMUM SETDA KAB.KLUNGKUNG", "BAGIAN UMUM SETDA KLUNGKUNG"] },
  { id: 2, name: "SEKRETARIAT DPRD KAB. GIANYAR", type: "GSO", unit: 11, keys: ["DPRD KAB. GIANYAR", "DPRD GIANYAR", "SEKRETARIAT DPRD GIANYAR", "DPRD KAB GIANYAR"] },
  { id: 3, name: "SEKRETARIAT DPRD KAB.KLUNGKUNG", type: "GSO", unit: 12, keys: ["DPRD KAB.KLUNGKUNG", "DPRD KLUNGKUNG", "SEKRETARIAT DPRD KLUNGKUNG", "DPRD KAB KLUNGKUNG"] },
  { id: 4, name: "DINAS KESEHATAN KABUPATEN GIANYAR", type: "GSO", unit: 12, keys: ["KESEHATAN KABUPATEN GIANYAR", "DINAS KESEHATAN GIANYAR", "DINKES GIANYAR", "KESEHATAN GIANYAR"] },
  { id: 5, name: "KANTOR SEKRETARIAT DAERAH KAB GIANYAR", type: "GSO", unit: 43, keys: ["SEKRETARIAT DAERAH KAB GIANYAR", "SETDA KAB GIANYAR", "SETDA GIANYAR", "SEKRETARIAT DAERAH GIANYAR", "KANTOR SEKRETARIAT DAERAH KAB GIANYAR"] },
  { id: 6, name: "BPBD KAB GIANYAR", type: "GSO", unit: 4, keys: ["BPBD KAB GIANYAR", "BPBD GIANYAR", "PENANGGULANGAN BENCANA DAERAH KAB GIANYAR"] },
  { id: 7, name: "DINAS PU & PR KAB. GIANYAR", type: "GSO", unit: 20, keys: ["DINAS PU & PR KAB. GIANYAR", "DINAS PU & PR GIANYAR", "DINAS PU PR GIANYAR", "PU & PR KAB. GIANYAR", "PU & PR GIANYAR", "PUPR GIANYAR"] },
  { id: 8, name: "SAT POL PP & DAMKAR KAB KLUNGKUNG", type: "GSO", unit: 5, keys: ["SAT POL PP", "SATPOL PP", "DAMKAR KAB KLUNGKUNG", "SATUAN POLISI PAMONG PRAJA KAB KLUNGKUNG"] },
  { id: 9, name: "BPKAD KAB GIANYAR", type: "GSO", unit: 9, keys: ["BPKAD KAB GIANYAR", "BPKAD GIANYAR", "PENGELOLAAN KEUANGAN DAN ASET DAERAH GIANYAR"] },
  { id: 10, name: "DINAS KOMUNIKASI DAN INFORMATIKA KAB.GYR", type: "GSO", unit: 7, keys: ["KOMUNIKASI DAN INFORMATIKA KAB.GYR", "KOMUNIKASI DAN INFORMATIKA KAB GIANYAR", "DISKOMINFO GIANYAR", "KOMINFO GIANYAR"] },
  { id: 11, name: "DISPERINDAG KAB.GIANYAR", type: "GSO", unit: 7, keys: ["DISPERINDAG KAB.GIANYAR", "DISPERINDAG KABUPATEN GIANYAR", "DISPERINDAG GIANYAR", "PERINDAG GIANYAR"] },
  { id: 12, name: "DINAS KOMUNIKASI INFORMATIKA DAN PERSANDIAN KABUPATEN BANGLI", type: "GSO", unit: 3, keys: ["KOMUNIKASI INFORMATIKA DAN PERSANDIAN KABUPATEN BANGLI", "DISKOMINFO BANGLI", "KOMINFO BANGLI"] },
  { id: 13, name: "BADAN PERENCANAAN PEMBANGUNAN DAERAH KABUPATEN GIANYAR", type: "GSO", unit: 5, keys: ["PERENCANAAN PEMBANGUNAN DAERAH KABUPATEN GIANYAR", "BAPEDA GIANYAR", "BAPPERIDA GIANYAR", "BAPPEDA GIANYAR"] },
  { id: 14, name: "KANTOR PERTANAHAN GIANYAR", type: "GSO", unit: 5, keys: ["PERTANAHAN GIANYAR", "BPN GIANYAR", "PERTANAHAN KABUPATEN GIANYAR", "PERTANAHAN KAB. GIANYAR"] },
  { id: 15, name: "DINAS KESEHATAN KABUPATEN BANGLI", type: "GSO", unit: 2, keys: ["DINAS KESEHATAN KABUPATEN BANGLI", "DINAS KESEHATAN BANGLI", "DINKES BANGLI", "KESEHATAN BANGLI"] },
  { id: 16, name: "BKPAD KABUPATEN BANGLI", type: "GSO", unit: 4, keys: ["BKPAD KABUPATEN BANGLI", "BKPAD BANGLI", "BPKAD BANGLI"] },
  { id: 17, name: "UPT PUSKESMAS TEMBUKU II", type: "GSO", unit: 3, keys: ["PUSKESMAS TEMBUKU", "TEMBUKU II", "TEMBUKU 2"] },
  { id: 18, name: "INSPEKTORAT KABUPATEN GIANYAR", type: "GSO", unit: 11, keys: ["INSPEKTORAT KABUPATEN GIANYAR", "INSPEKTORAT GIANYAR", "INSPEKTORAT KAB. GIANYAR"] },
  { id: 19, name: "DINAS LINGKUNGAN HIDUP GIANYAR", type: "GSO", unit: 13, keys: ["LINGKUNGAN HIDUP GIANYAR", "DLH GIANYAR", "LINGKUNGAN HIDUP KABUPATEN GIANYAR"] },
  { id: 20, name: "DINAS PU BANGLI", type: "GSO", unit: 7, keys: ["DINAS PU BANGLI", "PU BANGLI", "DINAS PEKERJAAN UMUM BANGLI", "PUPR BANGLI"] },
  { id: 21, name: "RUMAH SAKIT UMUM PAYANGAN", type: "GSO", unit: 4, keys: ["PAYANGAN", "RSU PAYANGAN", "RSUD PAYANGAN"] },
  { id: 22, name: "POLRES BANGLI", type: "GSO", unit: 6, keys: ["POLRES BANGLI", "KEPOLISIAN RESORT BANGLI", "KEPOLISIAN NEGARA RI BANGLI"] },
  { id: 23, name: "KEMENTERIAN AGAMA KABUPATEN GIANYAR", type: "GSO", unit: 1, keys: ["KEMENTERIAN AGAMA KABUPATEN GIANYAR", "KEMENAG GIANYAR", "KEMENTERIAN AGAMA GIANYAR"] },
  { id: 24, name: "DINAS PARIWISATA KABUPATEN KLUNGKUNG", type: "GSO", unit: 2, keys: ["DINAS PARIWISATA KABUPATEN KLUNGKUNG", "DISPAR KLUNGKUNG", "PARIWISATA KLUNGKUNG"] },
  { id: 25, name: "KEPOLISIAN RESORT KLUNGKUNG", type: "GSO", unit: 12, keys: ["POLRES KLUNGKUNG", "KEPOLISIAN RESORT KLUNGKUNG", "KEPOLISIAN NEGARA RI KLUNGKUNG"] },
  { id: 26, name: "BADAN RISET DAN INOVASI DAERAH KABUPATEN GIANYAR", type: "GSO", unit: 2, keys: ["RISET DAN INOVASI DAERAH KABUPATEN GIANYAR", "BRIDA GIANYAR", "RISET DAN INOVASI GIANYAR"] },
  { id: 27, name: "RUMAH SAKIT UMUM DAERAH BANGLI", type: "GSO", unit: 11, keys: ["RSUD BANGLI", "RSU BANGLI", "RUMAH SAKIT UMUM DAERAH BANGLI", "RUMAH SAKIT BANGLI"] },
  { id: 28, name: "DINAS PARIWISATA DAN KEBUDAYAAN KABUPATEN BANGLI", type: "GSO", unit: 3, keys: ["PARIWISATA DAN KEBUDAYAAN KABUPATEN BANGLI", "DISPARBUD BANGLI", "PARIWISATA BANGLI"] },

  // FLEET
  { id: 29, name: "AWAHITA INDONESIA PUTRA PT (CAPELLA HOTEL)", type: "FLEET", unit: 8, keys: ["AWAHITA", "CAPELLA"] },
  { id: 30, name: "WAPA DIUMA RESORT & SPA / SIDEMEN", type: "FLEET", unit: 4, keys: ["WAPA DIUMA", "WAPA DI UMA SIDEMEN"] },
  { id: 31, name: "PT WAPA DI UME (WAPA DI UME RESORT & SPA)", type: "FLEET", unit: 3, keys: ["WAPA DI UME", "WAPA DIUME"] },
  { id: 32, name: "CV DHARMA PUTRA SIADJA", type: "FLEET", unit: 2, keys: ["CV DHARMA PUTRA SIADJA", "CV. DHARMA PUTRA SIADJA"] },
  { id: 33, name: "PT CIPTA SATYA GRAHA (HOTEL ROYAL KAMUELA UBUD)", type: "FLEET", unit: 5, keys: ["CIPTA SATYA GRAHA", "ROYAL KAMUELA", "KAMUELA UBUD"] },
  { id: 34, name: "PT DHARMA PUTRA SIADJA", type: "FLEET", unit: 6, keys: ["PT DHARMA PUTRA SIADJA", "PT. DHARMA PUTRA SIADJA", "GOYA HOTEL", "GOYA RESORT"] },
  { id: 35, name: "PT BISMA INTERNUSA JAYA ABADI", type: "FLEET", unit: 9, keys: ["BISMA INTERNUSA"] },
  { id: 36, name: "PT.MANDRA ALILA", type: "FLEET", unit: 3, keys: ["MANDRA ALILA", "ALILA UBUD"] },
  { id: 37, name: "PITAMAHA HOTEL", type: "FLEET", unit: 4, keys: ["PITAMAHA", "PITA MAHA"] },
  { id: 38, name: "PT. LEMBAH MAHARAJA (VICEROY BALI)", type: "FLEET", unit: 10, keys: ["LEMBAH MAHARAJA", "VICEROY"] },
  { id: 39, name: "PT. PURI KAMANDALU", type: "FLEET", unit: 5, keys: ["PURI KAMANDALU", "KAMANDALU UBUD", "HOTEL KAMANDALU"] },
  { id: 40, name: "PT.SRI SEKAR UBUD", type: "FLEET", unit: 5, keys: ["SRI SEKAR"] },
  { id: 41, name: "PT. SRI JAYA UBUD", type: "FLEET", unit: 2, keys: ["SRI JAYA UBUD"] },
  { id: 42, name: "PT. SRI WANAYUDA UBUD", type: "FLEET", unit: 2, keys: ["SRI WANAYUDA"] },
  { id: 43, name: "PT SRI WANA WANARA", type: "FLEET", unit: 1, keys: ["SRI WANA WANARA"] },
  { id: 44, name: "PT SRI BARUNA KERAMAS", type: "FLEET", unit: 2, keys: ["SRI BARUNA"] },
  { id: 45, name: "AHAYU ARUNIMA PT", type: "FLEET", unit: 6, keys: ["AHAYU ARUNIMA"] },
  { id: 46, name: "BPJS KESEHATAN KAB KLUNGKUNG", type: "FLEET", unit: 6, keys: ["BPJS KESEHATAN KAB KLUNGKUNG", "BPJS KESEHATAN KLUNGKUNG", "BPJS KLUNGKUNG"] },
  { id: 47, name: "UBUD WANA RESORT", type: "FLEET", unit: 2, keys: ["UBUD WANA RESORT", "UBUD WANA"] },
  { id: 48, name: "AMANKILA", type: "FLEET", unit: 14, keys: ["AMANKILA"] },
  { id: 49, name: "AMANDARI", type: "FLEET", unit: 11, keys: ["AMANDARI"] },
  { id: 50, name: "CV CS TRANS", type: "FLEET", unit: 18, keys: ["CS TRANS", "CS TRANSPORT"] },
  { id: 51, name: "ALAYA RESORT UBUD", type: "FLEET", unit: 5, keys: ["ALAYA RESORT", "ALAYA UBUD"] },
  { id: 52, name: "CV WIRASANA", type: "FLEET", unit: 10, keys: ["CV WIRASANA", "CV. WIRASANA"] },
  { id: 53, name: "WIRASANA TANGKAS CV", type: "FLEET", unit: 8, keys: ["WIRASANA TANGKAS"] },
  { id: 54, name: "PT PURI ZUQNI", type: "FLEET", unit: 6, keys: ["PURI ZUQNI"] },
  { id: 55, name: "WISATA JANS RESORT UBUD PT", type: "FLEET", unit: 9, keys: ["WISATA JANS", "JANS RESORT"] },
  { id: 56, name: "KAYON ADILUHUNG PT", type: "FLEET", unit: 5, keys: ["KAYON ADILUHUNG", "THE KAYON"] }
];

console.log('--- TESTING MATCHES FOR 56 CONTRACTS ---');

CONTRACTS.forEach(c => {
  const matches = allCusts.filter(custStr => {
    return c.keys.some(k => custStr.includes(k));
  });
  console.log(`\n[#${c.id}] ${c.name} (${c.type}, ${c.unit} Units) -> Matched ${matches.length} distinct customer names:`);
  matches.forEach(m => console.log(`   - "${m}"`));
});
