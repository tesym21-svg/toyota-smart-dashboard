// Global Dashboard State
let appData = {
  bookings: [],
  jobHistory: [],
  targets: {}
};

let currentTab = 'overview';
let currentTargetSubTab = 'gianyar';

// Chart Instances
let chartOverviewDaily = null;
let chartBookingVs = null;
let chartCaiPie = null;
let chartSaDaily = null;
let chartTCarePie = null;
let chartTCareKm = null;

const STANDARD_12_MONTHS = [
  { code: '2026-01', name: 'Januari' },
  { code: '2026-02', name: 'Februari' },
  { code: '2026-03', name: 'Maret' },
  { code: '2026-04', name: 'April' },
  { code: '2026-05', name: 'Mei' },
  { code: '2026-06', name: 'Juni' },
  { code: '2026-07', name: 'Juli' },
  { code: '2026-08', name: 'Agustus' },
  { code: '2026-09', name: 'September' },
  { code: '2026-10', name: 'Oktober' },
  { code: '2026-11', name: 'November' },
  { code: '2026-12', name: 'Desember' }
];

const MONTH_NAMES_IND = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sept', 'Okt', 'Nov', 'Des'];

function changeDashboardFont(fontKey) {
  const allowed = ['plus-jakarta', 'inter', 'outfit', 'poppins'];
  if (!allowed.includes(fontKey)) fontKey = 'plus-jakarta';

  allowed.forEach(f => document.body.classList.remove(`font-${f}`));
  document.body.classList.add(`font-${fontKey}`);
  localStorage.setItem('dashboard_font_choice', fontKey);

  const selectElem = document.getElementById('font-family-select');
  if (selectElem && selectElem.value !== fontKey) {
    selectElem.value = fontKey;
  }
}

function initDashboardFont() {
  const saved = localStorage.getItem('dashboard_font_choice') || 'plus-jakarta';
  changeDashboardFont(saved);
}

document.addEventListener('DOMContentLoaded', () => {
  initDashboardFont();
  loadDashboardData();
});

async function loadDashboardData() {
  const statusText = document.getElementById('data-status-text');
  statusText.innerText = 'Memuat data...';

  try {
    const res = await fetch('/api/data');
    const json = await res.json();

    if (json.success) {
      appData = json.data;
      statusText.innerText = `Data Siap (${appData.bookings.length} Booking, ${appData.jobHistory.length} Jobs)`;
      document.getElementById('filter-info').innerText = `Data diperbarui: ${new Date().toLocaleTimeString('id-ID')} | Total ${appData.jobHistory.length} transaksi`;

      populateMonthSelectors();
      updateDashboardView();
    } else {
      statusText.innerText = 'Gagal memuat data';
      alert('Error loading data: ' + json.error);
    }
  } catch (err) {
    statusText.innerText = 'Offline / Cache Mode';
    console.error('Fetch error:', err);
  }
}

function populateMonthSelectors() {
  const selectMain = document.getElementById('filter-month');
  const selectOverview1 = document.getElementById('overview-vs-month1');
  const selectOverview2 = document.getElementById('overview-vs-month2');
  const selectVs1 = document.getElementById('booking-vs-month1');
  const selectVs2 = document.getElementById('booking-vs-month2');
  const selectSa1 = document.getElementById('sa-vs-month1');
  const selectSa2 = document.getElementById('sa-vs-month2');
  const selectYtmStart = document.getElementById('ytm-start-month');
  const selectYtmEnd = document.getElementById('ytm-end-month');

  const populateSelect = (selectElem, defaultVal) => {
    if (!selectElem) return;
    selectElem.innerHTML = '';
    STANDARD_12_MONTHS.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.code;
      opt.innerText = m.name;
      selectElem.appendChild(opt);
    });
    selectElem.value = defaultVal || '2026-09';
  };

  populateSelect(selectMain, '2026-09');
  populateSelect(selectOverview1, '2026-09');
  populateSelect(selectOverview2, '2026-08');
  populateSelect(selectVs1, '2026-09');
  populateSelect(selectVs2, '2026-08');
  populateSelect(selectSa1, '2026-09');
  populateSelect(selectSa2, '2026-08');
  populateSelect(selectYtmStart, '2026-01');
  populateSelect(selectYtmEnd, '2026-09');
}

function formatMonthNameOnly(ym) {
  const found = STANDARD_12_MONTHS.find(m => m.code === ym);
  if (found) return found.name;
  if (!ym || ym.length < 7) return ym;
  const m = parseInt(ym.split('-')[1], 10);
  return MONTH_NAMES_IND[m - 1] || ym;
}

function getActiveDateRange() {
  const startElem = document.getElementById('filter-start-date');
  const endElem = document.getElementById('filter-end-date');
  const monthElem = document.getElementById('filter-month');

  let selectedMonth = monthElem ? monthElem.value : '2026-09';
  let startDate = startElem ? startElem.value : '';
  let endDate = endElem ? endElem.value : '';

  if (!startDate || !endDate) {
    const ym = selectedMonth || '2026-09';
    startDate = `${ym}-01`;
    endDate = `${ym}-${getDaysInMonthString(ym)}`;
    if (startElem) startElem.value = startDate;
    if (endElem) endElem.value = endDate;
  }

  const monthIdx = selectedMonth ? parseInt(selectedMonth.split('-')[1], 10) - 1 : 8;
  return { startDate, endDate, selectedMonth, monthIdx };
}

function onMonthFilterChange() {
  const mainVal = document.getElementById('filter-month').value;
  const startElem = document.getElementById('filter-start-date');
  const endElem = document.getElementById('filter-end-date');

  if (startElem && endElem && mainVal) {
    startElem.value = `${mainVal}-01`;
    endElem.value = `${mainVal}-${getDaysInMonthString(mainVal)}`;
  }

  const o1 = document.getElementById('overview-vs-month1');
  const b1 = document.getElementById('booking-vs-month1');
  const s1 = document.getElementById('sa-vs-month1');

  if (o1) o1.value = mainVal;
  if (b1) b1.value = mainVal;
  if (s1) s1.value = mainVal;

  updateDashboardView();
}

function onDateRangeChange() {
  updateDashboardView();
}

function toggleSidebar(show) {
  const drawer = document.getElementById('sidebar-drawer');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!drawer || !backdrop) return;

  const isShowing = show !== undefined ? show : drawer.classList.contains('-translate-x-full');

  if (isShowing) {
    drawer.classList.remove('-translate-x-full');
    drawer.classList.add('translate-x-0');
    backdrop.classList.remove('hidden');
    setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
    document.body.style.overflow = 'hidden';
  } else {
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('-translate-x-full');
    backdrop.classList.add('opacity-0');
    setTimeout(() => backdrop.classList.add('hidden'), 300);
    document.body.style.overflow = '';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') toggleSidebar(false);
});

const TAB_LABELS = {
  'overview': 'Overview AT GYR',
  'booking': 'Performance Booking',
  'sa-performance': 'Pencapaian SA',
  'tcare': 'Analisa T-Care',
  'ytm': 'Pencapaian YTM',
  'gso-fleet': 'Performa GSO & FLEET',
  'tech-performance': 'Pencapaian Teknisi & FO',
  'target-editor': 'Menu Setting Target'
};

function switchTab(tabName) {
  currentTab = tabName;

  // Sync top navbar buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active-tab'));
  const topBtn = document.getElementById(`tab-${tabName}`);
  if (topBtn) topBtn.classList.add('active-tab');

  // Sync drawer nav buttons
  document.querySelectorAll('.drawer-nav-btn').forEach(btn => btn.classList.remove('active-drawer-btn'));
  const drawerBtn = document.getElementById(`drawer-tab-${tabName}`);
  if (drawerBtn) drawerBtn.classList.add('active-drawer-btn');

  // Update active tab label button text
  const labelElem = document.getElementById('active-tab-label-text');
  if (labelElem && TAB_LABELS[tabName]) {
    labelElem.innerText = TAB_LABELS[tabName];
  }

  // Switch view content
  document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) targetView.classList.remove('hidden');

  updateDashboardView();
}

function updateDashboardView() {
  const { startDate, endDate, selectedMonth, monthIdx } = getActiveDateRange();

  const monthBookings = appData.bookings.filter(b => b.arrivalDate && b.arrivalDate >= startDate && b.arrivalDate <= endDate);
  const monthJobs = appData.jobHistory.filter(j => j.invDate && j.invDate >= startDate && j.invDate <= endDate);

  // KPIs
  const totalBooking = monthBookings.length;
  const caiCount = monthBookings.filter(b => b.isCai).length;
  const caiRate = totalBooking > 0 ? ((caiCount / totalBooking) * 100).toFixed(1) : 0;

  const uniqueVinDateSet = new Set();
  let totalRev = 0;
  let tCareCount = 0;

  monthJobs.forEach(j => {
    uniqueVinDateSet.add(`${j.vin}_${j.invDate}`);
    totalRev += j.revenue;
    if (j.isTCare) tCareCount++;
  });

  const totalCPUS = uniqueVinDateSet.size;
  const tCareRatio = totalCPUS > 0 ? ((tCareCount / (monthJobs.length || 1)) * 100).toFixed(1) : 0;
  const salesPerUnit = totalCPUS > 0 ? Math.round(totalRev / totalCPUS) : 0;

  // Targets
  const targetGianyar = appData.targets.gianyarConsul || {};
  const targetCpusMonth = targetGianyar.cpus ? targetGianyar.cpus[monthIdx] : 0;
  const targetRevMonth = targetGianyar.revenue ? targetGianyar.revenue[monthIdx] * 1000000 : 0;
  const targetSuMonth = targetGianyar.salesUnit ? targetGianyar.salesUnit[monthIdx] : 0;

  document.getElementById('kpi-total-booking').innerText = totalBooking.toLocaleString('id-ID');
  document.getElementById('kpi-cai-rate').innerText = `CAI (Kedatangan): ${caiCount} (${caiRate}%)`;

  document.getElementById('kpi-total-cpus').innerText = totalCPUS.toLocaleString('id-ID');
  document.getElementById('kpi-target-cpus').innerText = `Target OAP: ${targetCpusMonth.toLocaleString('id-ID')} Unit`;

  document.getElementById('kpi-total-revenue').innerText = formatRupiah(totalRev);
  document.getElementById('kpi-target-revenue').innerText = `Target: ${formatRupiah(targetRevMonth)}`;

  document.getElementById('kpi-sales-unit').innerText = formatRupiah(salesPerUnit);
  document.getElementById('kpi-target-su').innerText = targetSuMonth > 0 ? `Target S/U: ${formatRupiah(targetSuMonth)}` : 'Revenue / CPUS';

  document.getElementById('kpi-tcare-ratio').innerText = `${tCareRatio}%`;
  document.getElementById('kpi-tcare-count').innerText = `${tCareCount} Transaksi T-Care`;

  if (currentTab === 'overview') {
    renderOverviewTab(monthJobs, targetCpusMonth, targetRevMonth, monthIdx);
  } else if (currentTab === 'booking') {
    renderBookingTab();
  } else if (currentTab === 'sa-performance') {
    renderSaPerformance();
  } else if (currentTab === 'tcare') {
    renderTCareTab(monthJobs, monthIdx);
  } else if (currentTab === 'ytm') {
    renderYtmTab(selectedMonth, monthIdx);
  } else if (currentTab === 'gso-fleet') {
    renderGsoFleetTab();
  } else if (currentTab === 'tech-performance') {
    renderTechPerformance();
  } else if (currentTab === 'target-editor') {
    renderTargetEditor();
  }
}

function isSunday(ym, day) {
  if (!ym || ym.length < 7) return false;
  const [year, month] = ym.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getDay() === 0;
}

function countWorkingDays(ym, startDay, endDay) {
  let count = 0;
  for (let d = startDay; d <= endDay; d++) {
    if (!isSunday(ym, d)) count++;
  }
  return count > 0 ? count : 1;
}

// -------------------------------------------------------------
// TAB 1: OVERVIEW GIANYAR CONSUL
// -------------------------------------------------------------
function renderOverviewTab(monthJobs, targetCpus, targetRev, monthIdx) {
  const cpusAct = new Set(monthJobs.map(j => `${j.vin}_${j.invDate}`)).size;
  let revAct = 0;
  let sbeAct = 0;

  let jasaTot = 0, partTot = 0, oilTot = 0, matTot = 0, subletTot = 0, discTot = 0;

  monthJobs.forEach(j => {
    revAct += j.revenue;
    if (j.repairType === 'SBE') sbeAct++;
    jasaTot += j.jasa;
    partTot += j.part;
    oilTot += j.oil;
    matTot += j.material;
    subletTot += j.sublet;
    discTot += j.disc;
  });

  const cpusPct = targetCpus > 0 ? ((cpusAct / targetCpus) * 100).toFixed(1) : 0;
  const revPct = targetRev > 0 ? ((revAct / targetRev) * 100).toFixed(1) : 0;
  const sbeRatioPct = cpusAct > 0 ? ((sbeAct / cpusAct) * 100).toFixed(1) : 0;

  document.getElementById('overview-cpus-pct').innerText = `${cpusPct}%`;
  document.getElementById('overview-cpus-bar').style.width = `${Math.min(cpusPct, 100)}%`;
  document.getElementById('overview-cpus-act').innerText = `Actual: ${cpusAct}`;
  document.getElementById('overview-cpus-tgt').innerText = `Target: ${targetCpus}`;

  document.getElementById('overview-rev-pct').innerText = `${revPct}%`;
  document.getElementById('overview-rev-bar').style.width = `${Math.min(revPct, 100)}%`;
  document.getElementById('overview-rev-act').innerText = `Actual: ${formatRupiah(revAct)}`;
  document.getElementById('overview-rev-tgt').innerText = `Target: ${formatRupiah(targetRev)}`;

  document.getElementById('overview-sbe-pct').innerText = `${sbeRatioPct}%`;
  document.getElementById('overview-sbe-bar').style.width = `${Math.min(sbeRatioPct, 100)}%`;
  document.getElementById('overview-sbe-act').innerText = `Actual SBE: ${sbeAct} Job`;

  // Revenue Components
  const compBox = document.getElementById('overview-revenue-components');
  compBox.innerHTML = `
    <div class="flex justify-between items-center bg-blue-50 p-2.5 rounded-xl border border-blue-100">
      <span class="font-bold text-blue-900"><i class="fa-solid fa-wrench mr-1.5 text-blue-600"></i>Jasa</span>
      <span class="font-black text-blue-900">${formatRupiah(jasaTot)}</span>
    </div>
    <div class="flex justify-between items-center bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
      <span class="font-bold text-emerald-900"><i class="fa-solid fa-gear mr-1.5 text-emerald-600"></i>Part</span>
      <span class="font-black text-emerald-900">${formatRupiah(partTot)}</span>
    </div>
    <div class="flex justify-between items-center bg-amber-50 p-2.5 rounded-xl border border-amber-100">
      <span class="font-bold text-amber-900"><i class="fa-solid fa-oil-can mr-1.5 text-amber-600"></i>Oil</span>
      <span class="font-black text-amber-900">${formatRupiah(oilTot)}</span>
    </div>
    <div class="flex justify-between items-center bg-purple-50 p-2.5 rounded-xl border border-purple-100">
      <span class="font-bold text-purple-900"><i class="fa-solid fa-box mr-1.5 text-purple-600"></i>Material</span>
      <span class="font-black text-purple-900">${formatRupiah(matTot)}</span>
    </div>
    <div class="flex justify-between items-center bg-slate-100 p-2.5 rounded-xl border border-slate-200">
      <span class="font-bold text-slate-800"><i class="fa-solid fa-handshake mr-1.5 text-slate-600"></i>Sublet</span>
      <span class="font-black text-slate-900">${formatRupiah(subletTot)}</span>
    </div>
    <div class="flex justify-between items-center bg-red-50 p-2.5 rounded-xl border border-red-100 text-red-700">
      <span class="font-bold"><i class="fa-solid fa-tag mr-1.5"></i>Discount</span>
      <span class="font-black">-${formatRupiah(discTot)}</span>
    </div>
  `;

  renderOverviewChart();
  renderWeeklyCards('weekly-cards-container', monthJobs, targetCpus, targetRev, monthIdx);
  renderSaMasterPerformanceTable(monthJobs, monthIdx);
}

// -------------------------------------------------------------
// RENDER 5 WEEKLY CARDS (W1 - W5) WITH FULL PARAMETERS (CPUS, REVENUE, SALES/UNIT)
// -------------------------------------------------------------
function renderWeeklyCards(containerId, jobs, monthTargetCpus, monthTargetRev, monthIdx) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const selectedMonth = document.getElementById('filter-month').value;
  const targetGianyar = appData.targets.gianyarConsul || {};
  const totalDaysInMonth = getDaysInMonthString(selectedMonth);
  const totalWorkingDays = targetGianyar.kpiDays ? targetGianyar.kpiDays[monthIdx] : 22;

  const weekRanges = [
    { name: 'W1', start: 1, end: 7 },
    { name: 'W2', start: 8, end: 14 },
    { name: 'W3', start: 15, end: 21 },
    { name: 'W4', start: 22, end: 28 },
    { name: 'W5', start: 29, end: totalDaysInMonth }
  ];

  let html = '';

  weekRanges.forEach(w => {
    const wWorkingDays = countWorkingDays(selectedMonth, w.start, w.end);

    // 1. CPUS Calculation
    const cpusPlanHari = Math.round(monthTargetCpus / (totalWorkingDays || 22));
    const wJobs = jobs.filter(j => {
      const day = parseInt(j.invDate.split('-')[2], 10);
      return day >= w.start && day <= w.end;
    });
    const wCpus = new Set(wJobs.map(j => `${j.vin}_${j.invDate}`)).size;
    const cpusActHari = (wCpus / wWorkingDays).toFixed(1);
    const targetWeekCpus = cpusPlanHari * wWorkingDays;
    const cpusAchPct = targetWeekCpus > 0 ? ((wCpus / targetWeekCpus) * 100).toFixed(1) : 0;
    const cpusDiff = wCpus - targetWeekCpus;
    const cpusGrowthPct = targetWeekCpus > 0 ? ((cpusDiff / targetWeekCpus) * 100).toFixed(1) : 0;
    const cpusBad = parseFloat(cpusAchPct) < 100;

    // 2. Revenue Calculation
    const revPlanHari = monthTargetRev / (totalWorkingDays || 22);
    const wRev = wJobs.reduce((acc, j) => acc + j.revenue, 0);
    const revActHari = wRev / wWorkingDays;
    const targetWeekRev = revPlanHari * wWorkingDays;
    const revAchPct = targetWeekRev > 0 ? ((wRev / targetWeekRev) * 100).toFixed(1) : 0;
    const revDiff = revActHari - revPlanHari;
    const revBad = parseFloat(revAchPct) < 100;

    // 3. Sales / Unit (S/U) Calculation
    const targetSu = monthTargetCpus > 0 ? Math.round(monthTargetRev / monthTargetCpus) : 0;
    const actSu = wCpus > 0 ? Math.round(wRev / wCpus) : 0;
    const suAchPct = targetSu > 0 ? ((actSu / targetSu) * 100).toFixed(1) : 0;
    const suBad = parseFloat(suAchPct) < 100;

    html += `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm transition hover:shadow-md">
        <div class="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100">
          <span class="font-extrabold text-base text-slate-800">${w.name}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">Weekly Pace</span>
        </div>

        <!-- CPUS Section -->
        <div class="text-[11px] space-y-1 font-semibold border-b border-slate-100 pb-2 mb-2">
          <p class="font-black text-xs text-slate-700 uppercase tracking-wider mb-1 flex justify-between">
            <span>1. CPUS</span>
            <span class="${cpusBad ? 'text-red-600' : 'text-emerald-600'}">${cpusAchPct}%</span>
          </p>
          <div class="flex justify-between text-slate-500">
            <span>Plan/Hari:</span> <span class="font-bold text-slate-800">${cpusPlanHari}</span>
          </div>
          <div class="flex justify-between text-slate-500">
            <span>Actual/Hari:</span> <span class="font-bold text-slate-800">${cpusActHari}</span>
          </div>
          <div class="flex justify-between ${cpusBad ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}">
            <span>Growth/Hari:</span> <span>${cpusDiff > 0 ? '+' : ''}${cpusDiff} / ${cpusGrowthPct}%</span>
          </div>
        </div>

        <!-- REVENUE Section -->
        <div class="text-[11px] space-y-1 font-semibold border-b border-slate-100 pb-2 mb-2">
          <p class="font-black text-xs text-slate-700 uppercase tracking-wider mb-1 flex justify-between">
            <span>2. REVENUE</span>
            <span class="${revBad ? 'text-red-600' : 'text-emerald-600'}">${revAchPct}%</span>
          </p>
          <div class="flex justify-between text-slate-500">
            <span>Plan/Hari:</span> <span class="font-bold text-slate-800">${formatRupiahShort(revPlanHari)}</span>
          </div>
          <div class="flex justify-between text-slate-500">
            <span>Actual/Hari:</span> <span class="font-bold text-slate-800">${formatRupiahShort(revActHari)}</span>
          </div>
          <div class="flex justify-between ${revBad ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}">
            <span>Growth/Hari:</span> <span>${formatRupiahShort(revDiff)}</span>
          </div>
        </div>

        <!-- SALES / UNIT S/U Section -->
        <div class="text-[11px] space-y-1 font-semibold">
          <p class="font-black text-xs text-purple-900 uppercase tracking-wider mb-1 flex justify-between">
            <span>3. SALES / UNIT</span>
            <span class="${suBad ? 'text-red-600' : 'text-emerald-600'}">${suAchPct}%</span>
          </p>
          <div class="flex justify-between text-slate-500">
            <span>Target S/U:</span> <span class="font-bold text-purple-900">${formatRupiahShort(targetSu)}</span>
          </div>
          <div class="flex justify-between text-slate-500">
            <span>Actual S/U:</span> <span class="font-bold text-purple-900">${formatRupiahShort(actSu)}</span>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// -------------------------------------------------------------
// SA / FUNCTION MASTER PERFORMANCE TABLE & INSIGHTS
// -------------------------------------------------------------
function renderSaMasterPerformanceTable(monthJobs1, monthIdx) {
  const tbody = document.getElementById('table-sa-master-performance');
  const insightsContainer = document.getElementById('management-insights-container');
  if (!tbody) return;

  const m1 = document.getElementById('overview-vs-month1').value;
  const m2 = document.getElementById('overview-vs-month2').value;

  const monthJobs2 = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m2));

  const targetGianyar = appData.targets.gianyarConsul || {};
  const totalWorkingDays = targetGianyar.kpiDays ? targetGianyar.kpiDays[monthIdx] : 22;
  const hokElapsed = Math.min(countWorkingDays(m1, 1, 31), totalWorkingDays);
  const hokRemaining = Math.max(totalWorkingDays - hokElapsed, 1);

  const saList = ['AYU', 'AJS', 'WBN', 'FIK', 'THS', 'THS2', 'PDS'];
  const saTargetsObj = (appData.targets.saTargets && appData.targets.saTargets.CPUS) || {};

  const rowsData = [];

  const totalCpus1 = new Set(monthJobs1.map(j => `${j.vin}_${j.invDate}`)).size;
  const totalCpus2 = new Set(monthJobs2.map(j => `${j.vin}_${j.invDate}`)).size;
  const targetBulanTotal = targetGianyar.cpus ? targetGianyar.cpus[monthIdx] : 947;

  rowsData.push({
    name: 'GIANYAR CONSUL Total',
    isTotal: true,
    targetBulan: targetBulanTotal,
    actual: totalCpus1,
    actualM2: totalCpus2
  });

  saList.forEach(saName => {
    const jobs1 = monthJobs1.filter(j => j.sa === saName);
    const jobs2 = monthJobs2.filter(j => j.sa === saName);
    const cpus1 = new Set(jobs1.map(j => `${j.vin}_${j.invDate}`)).size;
    const cpus2 = new Set(jobs2.map(j => `${j.vin}_${j.invDate}`)).size;

    const tgtArr = saTargetsObj[saName] || saTargetsObj[saName.replace('THS', 'TMS ')] || [];
    const targetBulan = (tgtArr && tgtArr[monthIdx] !== undefined) ? tgtArr[monthIdx] : 150;

    rowsData.push({
      name: saName,
      isTotal: false,
      targetBulan: targetBulan,
      actual: cpus1,
      actualM2: cpus2
    });
  });

  tbody.innerHTML = '';

  let bestPerf = null;
  let maxGap = null;
  let highestRecovery = null;

  rowsData.forEach(r => {
    const achBulanPct = r.targetBulan > 0 ? ((r.actual / r.targetBulan) * 100).toFixed(1) : 0;
    const targetHari = (r.targetBulan / totalWorkingDays).toFixed(1);
    const actualHari = (r.actual / (hokElapsed || 1)).toFixed(1);
    const achHariPct = targetHari > 0 ? ((actualHari / targetHari) * 100).toFixed(1) : 0;

    const gap = r.targetBulan - r.actual;
    const diffMtd = r.actual - r.actualM2;
    const growthMtdPct = r.actualM2 > 0 ? ((diffMtd / r.actualM2) * 100).toFixed(1) : 0;
    const growthAvgDay = (diffMtd / (hokElapsed || 1)).toFixed(1);

    const nextPlanHari = Math.max(Math.ceil(gap / hokRemaining), 0);

    const mainSAs = ['AYU', 'AJS', 'WBN', 'FIK'];
    if (!r.isTotal && mainSAs.includes(r.name)) {
      const achVal = parseFloat(achBulanPct);
      if (!bestPerf || achVal > bestPerf.achVal) bestPerf = { name: r.name, achVal, gap };
      if (!maxGap || gap > maxGap.gap) maxGap = { name: r.name, gap };
      if (!highestRecovery || nextPlanHari > highestRecovery.nextPlanHari) highestRecovery = { name: r.name, nextPlanHari };
    }

    const tr = document.createElement('tr');
    tr.className = r.isTotal ? 'bg-blue-50/80 font-black text-blue-900 border-b-2 border-blue-200' : 'hover:bg-slate-50';

    tr.innerHTML = `
      <td class="p-3 border border-slate-200 ${r.isTotal ? 'font-black text-blue-900' : 'font-bold'}">${r.name}</td>
      <td class="p-2.5 border border-slate-200 text-center">${hokElapsed}</td>
      <td class="p-2.5 border border-slate-200 text-right">${r.targetBulan}</td>
      <td class="p-2.5 border border-slate-200 text-right font-black">${r.actual}</td>
      <td class="p-2.5 border border-slate-200 text-right ${parseFloat(achBulanPct) >= 100 ? 'text-emerald-600' : 'text-red-600'}">${achBulanPct}%</td>
      <td class="p-2.5 border border-slate-200 text-right">${targetHari}</td>
      <td class="p-2.5 border border-slate-200 text-right">${actualHari}</td>
      <td class="p-2.5 border border-slate-200 text-right ${parseFloat(achHariPct) >= 100 ? 'text-emerald-600' : 'text-red-600'}">${achHariPct}%</td>
      <td class="p-2.5 border border-slate-200 text-right text-red-600 font-black">${gap > 0 ? gap : 0}</td>
      <td class="p-2.5 border border-slate-200 text-right ${diffMtd >= 0 ? 'text-emerald-600' : 'text-red-600'}">${diffMtd > 0 ? '+' : ''}${diffMtd} / ${growthMtdPct}%</td>
      <td class="p-2.5 border border-slate-200 text-right ${growthAvgDay >= 0 ? 'text-emerald-600' : 'text-red-600'}">${growthAvgDay > 0 ? '+' : ''}${growthAvgDay}</td>
      <td class="p-2.5 border border-slate-200 text-right font-black text-blue-900">${nextPlanHari}</td>
    `;
    tbody.appendChild(tr);
  });

  if (insightsContainer && bestPerf && maxGap && highestRecovery) {
    insightsContainer.innerHTML = `
      <div class="bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl flex items-start space-x-3">
        <div class="p-2.5 bg-emerald-500 text-white rounded-xl font-bold text-lg"><i class="fa-solid fa-trophy"></i></div>
        <div>
          <p class="text-[10px] font-black uppercase text-emerald-800 tracking-wider">BEST PERFORMING</p>
          <h4 class="font-extrabold text-slate-800 text-sm">${bestPerf.name} – CPUS achievement ${bestPerf.achVal}%</h4>
          <p class="text-xs text-emerald-700 font-medium">Pencapaian tertinggi terhadap target bulan ini</p>
        </div>
      </div>

      <div class="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl flex items-start space-x-3">
        <div class="p-2.5 bg-amber-500 text-white rounded-xl font-bold text-lg"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div>
          <p class="text-[10px] font-black uppercase text-amber-800 tracking-wider">BIGGEST GAP</p>
          <h4 class="font-extrabold text-slate-800 text-sm">${maxGap.name} – CPUS kurang ${maxGap.gap} unit</h4>
          <p class="text-xs text-amber-700 font-medium">Kekurangan unit / nominal terbesar terhadap target</p>
        </div>
      </div>

      <div class="bg-rose-50/80 border border-rose-200 p-4 rounded-2xl flex items-start space-x-3">
        <div class="p-2.5 bg-rose-500 text-white rounded-xl font-bold text-lg"><i class="fa-solid fa-fire"></i></div>
        <div>
          <p class="text-[10px] font-black uppercase text-rose-800 tracking-wider">HIGHEST RECOVERY NEED</p>
          <h4 class="font-extrabold text-slate-800 text-sm">${highestRecovery.name} – butuh ${highestRecovery.nextPlanHari} unit/hari</h4>
          <p class="text-xs text-rose-700 font-medium">Pace harian paling intensif untuk mencapai target</p>
        </div>
      </div>
    `;
  }
}

function renderOverviewChart() {
  const m1 = document.getElementById('overview-vs-month1').value;
  const m2 = document.getElementById('overview-vs-month2').value;
  const metric = document.getElementById('overview-chart-metric').value;

  const jobs1 = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m1));
  const jobs2 = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m2));

  const days1 = getDaysInMonthString(m1);
  const days2 = getDaysInMonthString(m2);
  const maxDays = Math.max(days1, days2, 31);

  const daily1 = new Array(maxDays).fill(0);
  const daily2 = new Array(maxDays).fill(0);

  const vinSet1 = Array.from({ length: maxDays }, () => new Set());
  const vinSet2 = Array.from({ length: maxDays }, () => new Set());

  jobs1.forEach(j => {
    const day = parseInt(j.invDate.split('-')[2], 10);
    if (day >= 1 && day <= maxDays) {
      if (metric === 'revenue') daily1[day - 1] += j.revenue;
      else if (metric === 'cpus') vinSet1[day - 1].add(j.vin);
      else if (metric === 'sbe' && j.repairType === 'SBE') daily1[day - 1]++;
      else if (metric === 'grp' && j.repairType === 'GRP') daily1[day - 1]++;
    }
  });

  jobs2.forEach(j => {
    const day = parseInt(j.invDate.split('-')[2], 10);
    if (day >= 1 && day <= maxDays) {
      if (metric === 'revenue') daily2[day - 1] += j.revenue;
      else if (metric === 'cpus') vinSet2[day - 1].add(j.vin);
      else if (metric === 'sbe' && j.repairType === 'SBE') daily2[day - 1]++;
      else if (metric === 'grp' && j.repairType === 'GRP') daily2[day - 1]++;
    }
  });

  if (metric === 'cpus') {
    vinSet1.forEach((set, idx) => daily1[idx] = set.size);
    vinSet2.forEach((set, idx) => daily2[idx] = set.size);
  }

  const labels = Array.from({ length: maxDays }, (_, i) => `${i + 1}`);
  const ctx = document.getElementById('chart-overview-daily').getContext('2d');
  if (chartOverviewDaily) chartOverviewDaily.destroy();

  chartOverviewDaily = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `${formatMonthNameOnly(m1)} (Utama)`,
          data: daily1,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.12)',
          fill: true,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 4
        },
        {
          label: `${formatMonthNameOnly(m2)} (Pembanding)`,
          data: daily2,
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.05)',
          borderDash: [5, 5],
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${metric === 'revenue' ? formatRupiah(ctx.raw) : ctx.raw}`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: (ctx) => isSunday(m1, ctx.index + 1) ? '#dc2626' : '#475569',
            font: (ctx) => isSunday(m1, ctx.index + 1) ? { weight: 'bold', size: 12 } : { weight: 'normal', size: 11 }
          }
        },
        y: {
          beginAtZero: true,
          ticks: { callback: (val) => metric === 'revenue' ? formatRupiahShort(val) : val }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// TAB 2: BOOKING ACHIEVEMENT & VERSUS MONTH COMPARISON
// -------------------------------------------------------------
function renderBookingTab() {
  renderBookingVsChart();
  renderBookingPicWeekly();

  const selectedMonth = document.getElementById('filter-month').value;
  const monthBookings = appData.bookings.filter(b => b.arrivalDate && b.arrivalDate.startsWith(selectedMonth));

  const picMap = {};
  monthBookings.forEach(b => {
    const picName = (b.pic || 'TIDAK TERIDENTIFIKASI').toUpperCase().trim();
    if (!picMap[picName]) {
      picMap[picName] = { total: 0, cai: 0 };
    }
    picMap[picName].total++;
    if (b.isCai) picMap[picName].cai++;
  });

  const tbody = document.getElementById('table-booking-pic');
  tbody.innerHTML = '';

  Object.keys(picMap).sort().forEach(pic => {
    const data = picMap[pic];
    const rate = data.total > 0 ? ((data.cai / data.total) * 100).toFixed(1) : 0;
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50';
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-bold text-slate-800">${pic}</td>
      <td class="py-2.5 px-3 text-right font-bold text-slate-700">${data.total}</td>
      <td class="py-2.5 px-3 text-right font-bold text-emerald-600">${data.cai}</td>
      <td class="py-2.5 px-3 text-right font-bold text-blue-600">${rate}%</td>
    `;
    tbody.appendChild(tr);
  });

  const totalCai = monthBookings.filter(b => b.isCai).length;
  const totalNonCai = monthBookings.length - totalCai;

  const ctxPie = document.getElementById('chart-cai-pie').getContext('2d');
  if (chartCaiPie) chartCaiPie.destroy();

  chartCaiPie = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: ['CAI (Kedatangan)', 'Pending / Non-CAI'],
      datasets: [{
        data: [totalCai, totalNonCai],
        backgroundColor: ['#10b981', '#f59e0b'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderBookingPicWeekly() {
  const container = document.getElementById('booking-pic-weekly-container');
  if (!container) return;

  const selectedMonth = document.getElementById('filter-month').value;
  const monthBookings = appData.bookings.filter(b => b.arrivalDate && b.arrivalDate.startsWith(selectedMonth));
  const monthJobs = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth));
  const totalDaysInMonth = getDaysInMonthString(selectedMonth);

  const targetPics = ['PONI', 'RINI'];
  const weekRanges = [
    { name: 'W1', label: '01-07', start: 1, end: 7 },
    { name: 'W2', label: '08-14', start: 8, end: 14 },
    { name: 'W3', label: '15-21', start: 15, end: 21 },
    { name: 'W4', label: '22-28', start: 22, end: 28 },
    { name: 'W5', label: `29-${totalDaysInMonth}`, start: 29, end: totalDaysInMonth }
  ];

  let cardsHtml = '';

  targetPics.forEach(picName => {
    const picBookings = monthBookings.filter(b => (b.pic || '').toUpperCase().includes(picName));
    const picVinSet = new Set(picBookings.map(b => b.vin.toUpperCase()));

    // MTD Summary
    const totalB = picBookings.length;
    const caiB = picBookings.filter(b => b.isCai);
    const caiCount = caiB.length;
    const caiRate = totalB > 0 ? ((caiCount / totalB) * 100).toFixed(1) : 0;

    const picJobs = monthJobs.filter(j => picVinSet.has(j.vin.toUpperCase()));
    const totalCpus = new Set(picJobs.map(j => `${j.vin}_${j.invDate}`)).size;
    const totalRev = picJobs.reduce((acc, j) => acc + j.revenue, 0);

    let rowsHtml = '';
    weekRanges.forEach(w => {
      const wBookings = picBookings.filter(b => {
        const day = parseInt(b.arrivalDate.split('-')[2], 10);
        return day >= w.start && day <= w.end;
      });
      const wBCount = wBookings.length;
      const wCaiCount = wBookings.filter(b => b.isCai).length;
      const wCaiRate = wBCount > 0 ? ((wCaiCount / wBCount) * 100).toFixed(1) : 0;

      const wJobs = monthJobs.filter(j => {
        const day = parseInt(j.invDate.split('-')[2], 10);
        return day >= w.start && day <= w.end && picVinSet.has(j.vin.toUpperCase());
      });

      const wCpus = new Set(wJobs.map(j => `${j.vin}_${j.invDate}`)).size;
      const wRev = wJobs.reduce((acc, j) => acc + j.revenue, 0);

      rowsHtml += `
        <tr class="hover:bg-slate-50">
          <td class="py-2 px-2.5 font-black text-slate-800">${w.name} <span class="text-[10px] text-slate-400 font-semibold">(${w.label})</span></td>
          <td class="py-2 px-2.5 text-center font-bold text-slate-800">${wBCount}</td>
          <td class="py-2 px-2.5 text-center font-extrabold text-blue-900">${wCpus}</td>
          <td class="py-2 px-2.5 text-center font-bold text-emerald-600">${wCaiCount} <span class="text-[10px] text-slate-500">(${wCaiRate}%)</span></td>
          <td class="py-2 px-2.5 text-right font-black text-slate-900">${wRev > 0 ? formatRupiahShort(wRev) : '&mdash;'}</td>
        </tr>
      `;
    });

    cardsHtml += `
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <!-- Card Header -->
          <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-base shadow-md">
                ${picName.charAt(0)}
              </div>
              <div>
                <h3 class="text-lg font-black text-slate-900">PIC ${picName}</h3>
                <p class="text-xs text-slate-500 font-semibold">Pencapaian Booking Mingguan & MTD</p>
              </div>
            </div>
            <span class="text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">CAI Rate: ${caiRate}%</span>
          </div>

          <!-- MTD Metric Cards -->
          <div class="grid grid-cols-4 gap-2 text-center text-xs mb-4">
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <p class="text-[10px] font-bold text-slate-400 uppercase">Booking</p>
              <p class="text-base font-black text-slate-900">${totalB}</p>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <p class="text-[10px] font-bold text-slate-400 uppercase">CPUS</p>
              <p class="text-base font-black text-blue-900">${totalCpus}</p>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <p class="text-[10px] font-bold text-slate-400 uppercase">CAI</p>
              <p class="text-base font-black text-emerald-600">${caiCount}</p>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <p class="text-[10px] font-bold text-slate-400 uppercase">Revenue</p>
              <p class="text-xs font-black text-slate-900 truncate">${formatRupiahShort(totalRev)}</p>
            </div>
          </div>

          <!-- Weekly Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead>
                <tr class="bg-slate-100 text-slate-700 font-extrabold border-b">
                  <th class="py-2 px-2.5">Minggu</th>
                  <th class="py-2 px-2.5 text-center">Booking</th>
                  <th class="py-2 px-2.5 text-center">CPUS</th>
                  <th class="py-2 px-2.5 text-center">CAI (Rate)</th>
                  <th class="py-2 px-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-semibold">
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = cardsHtml;
}

function renderBookingVsChart() {
  const m1 = document.getElementById('booking-vs-month1').value;
  const m2 = document.getElementById('booking-vs-month2').value;

  const b1 = appData.bookings.filter(b => b.arrivalDate && b.arrivalDate.startsWith(m1));
  const b2 = appData.bookings.filter(b => b.arrivalDate && b.arrivalDate.startsWith(m2));

  const days1 = getDaysInMonthString(m1);
  const days2 = getDaysInMonthString(m2);
  const maxDays = Math.max(days1, days2, 31);

  const daily1 = new Array(maxDays).fill(0);
  const daily2 = new Array(maxDays).fill(0);

  b1.forEach(b => {
    const day = parseInt(b.arrivalDate.split('-')[2], 10);
    if (day >= 1 && day <= maxDays) daily1[day - 1]++;
  });

  b2.forEach(b => {
    const day = parseInt(b.arrivalDate.split('-')[2], 10);
    if (day >= 1 && day <= maxDays) daily2[day - 1]++;
  });

  const labels = Array.from({ length: maxDays }, (_, i) => `${i + 1}`);
  const ctx = document.getElementById('chart-booking-vs').getContext('2d');
  if (chartBookingVs) chartBookingVs.destroy();

  chartBookingVs = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `Booking ${formatMonthNameOnly(m1)} (Utama)`,
          data: daily1,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          fill: true,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 4
        },
        {
          label: `Booking ${formatMonthNameOnly(m2)} (Pembanding)`,
          data: daily2,
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.05)',
          borderDash: [5, 5],
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' }
      },
      scales: {
        x: {
          ticks: {
            color: (ctx) => isSunday(m1, ctx.index + 1) ? '#dc2626' : '#475569',
            font: (ctx) => isSunday(m1, ctx.index + 1) ? { weight: 'bold', size: 12 } : { weight: 'normal', size: 11 }
          }
        },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

// -------------------------------------------------------------
// TAB 3: SA PERFORMANCE (FULL WIDTH LINE CHART & WEEKLY CARDS)
// -------------------------------------------------------------
function renderSaPerformance() {
  const m1 = document.getElementById('sa-vs-month1').value;
  const m2 = document.getElementById('sa-vs-month2').value;
  const saFilter = document.getElementById('sa-select').value;
  const componentFilter = document.getElementById('sa-revenue-component').value;

  const monthIdx1 = m1 ? parseInt(m1.split('-')[1], 10) - 1 : 8;
  const monthJobs1 = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m1));
  const monthJobs2 = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m2));

  const filteredJobs1 = saFilter === 'ALL' ? monthJobs1 : monthJobs1.filter(j => j.sa === saFilter);
  const filteredJobs2 = saFilter === 'ALL' ? monthJobs2 : monthJobs2.filter(j => j.sa === saFilter);

  const daysInMonth = Math.max(getDaysInMonthString(m1), getDaysInMonthString(m2), 31);
  const dailyData1 = new Array(daysInMonth).fill(0);
  const dailyData2 = new Array(daysInMonth).fill(0);

  function getVal(j) {
    if (componentFilter === 'jasa') return j.jasa;
    if (componentFilter === 'part') return j.part;
    if (componentFilter === 'oil') return j.oil;
    if (componentFilter === 'material') return j.material;
    if (componentFilter === 'sublet') return j.sublet;
    return j.revenue;
  }

  filteredJobs1.forEach(j => {
    const day = parseInt(j.invDate.split('-')[2], 10);
    if (day >= 1 && day <= daysInMonth) {
      dailyData1[day - 1] += getVal(j);
    }
  });

  filteredJobs2.forEach(j => {
    const day = parseInt(j.invDate.split('-')[2], 10);
    if (day >= 1 && day <= daysInMonth) {
      dailyData2[day - 1] += getVal(j);
    }
  });

  // Render SA Weekly Cards W1 - W5 (FULL PARAMETERS: CPUS, REVENUE, SALES/UNIT)
  const saTargetObj = (appData.targets.saTargets && appData.targets.saTargets.CPUS) || {};
  const saTargetRevObj = (appData.targets.saTargets && appData.targets.saTargets.REVENUE) || {};

  const saTargetCpusVal = (saFilter !== 'ALL' && saTargetObj[saFilter]) ? saTargetObj[saFilter][monthIdx1] : (appData.targets.gianyarConsul ? appData.targets.gianyarConsul.cpus[monthIdx1] : 947);
  const saTargetRevVal = (saFilter !== 'ALL' && saTargetRevObj[saFilter]) ? saTargetRevObj[saFilter][monthIdx1] * 1000000 : (appData.targets.gianyarConsul ? appData.targets.gianyarConsul.revenue[monthIdx1] * 1000000 : 1776000000);

  renderWeeklyCards('sa-weekly-cards-container', filteredJobs1, saTargetCpusVal, saTargetRevVal, monthIdx1);

  // FULL WIDTH DAILY LINE CHART
  const labelsDaily = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
  const ctxDaily = document.getElementById('chart-sa-daily').getContext('2d');
  if (chartSaDaily) chartSaDaily.destroy();

  chartSaDaily = new Chart(ctxDaily, {
    type: 'line',
    data: {
      labels: labelsDaily,
      datasets: [
        {
          label: `${formatMonthNameOnly(m1)} (${saFilter})`,
          data: dailyData1,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 4
        },
        {
          label: `${formatMonthNameOnly(m2)} (${saFilter})`,
          data: dailyData2,
          borderColor: '#d97706',
          borderDash: [5, 5],
          fill: false,
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: (ctx) => isSunday(m1, ctx.index + 1) ? '#dc2626' : '#475569',
            font: (ctx) => isSunday(m1, ctx.index + 1) ? { weight: 'bold', size: 12 } : { weight: 'normal', size: 11 }
          }
        },
        y: { beginAtZero: true, ticks: { callback: (val) => formatRupiahShort(val) } }
      }
    }
  });

  // Populate SA Summary Cards
  const saList = ['AYU', 'AJS', 'WBN', 'FIK', 'THS', 'THS2', 'PDS'];
  const cardsContainer = document.getElementById('sa-cards-container');
  cardsContainer.innerHTML = '';

  saList.forEach(saName => {
    const saJobs = monthJobs1.filter(j => j.sa === saName);
    const saCpusSet = new Set(saJobs.map(j => `${j.vin}_${j.invDate}`));
    const saCpus = saCpusSet.size;

    let saRev = 0, saJasa = 0, saPart = 0, saOil = 0, saMat = 0, saSublet = 0;
    let saSbe = 0, saGrp = 0;

    saJobs.forEach(j => {
      saRev += j.revenue;
      saJasa += j.jasa;
      saPart += j.part;
      saOil += j.oil;
      saMat += j.material;
      saSublet += j.sublet;
      if (j.repairType === 'SBE') saSbe++;
      if (j.repairType === 'GRP') saGrp++;
    });

    const saSalesPerUnit = saCpus > 0 ? Math.round(saRev / saCpus) : 0;
    const isHighlight = saFilter === saName;
    const card = document.createElement('div');
    card.className = `p-4.5 rounded-2xl border ${isHighlight ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500 shadow-md' : 'bg-white border-slate-200'} shadow-sm transition hover:shadow-md`;
    card.innerHTML = `
      <div class="flex justify-between items-center mb-3">
        <h4 class="font-extrabold text-sm text-slate-800 flex items-center">
          <i class="fa-solid fa-user-check text-blue-600 mr-2"></i>SA: ${saName}
        </h4>
        <span class="text-xs font-black px-2.5 py-1 bg-blue-100 text-blue-900 rounded-full">${saCpus} CPUS</span>
      </div>

      <div class="text-xs space-y-1.5 border-t border-slate-100 pt-2.5 text-slate-600 font-medium">
        <div class="flex justify-between font-bold text-slate-800 text-sm">
          <span>Total Revenue:</span>
          <span class="text-emerald-600 font-black">${formatRupiah(saRev)}</span>
        </div>
        <div class="flex justify-between font-bold text-purple-900">
          <span>Sales / Unit (S/U):</span>
          <span class="font-black">${formatRupiah(saSalesPerUnit)}</span>
        </div>
        <div class="flex justify-between">
          <span>Jasa:</span>
          <span>${formatRupiah(saJasa)}</span>
        </div>
        <div class="flex justify-between">
          <span>Part:</span>
          <span>${formatRupiah(saPart)}</span>
        </div>
        <div class="flex justify-between">
          <span>Oil:</span>
          <span>${formatRupiah(saOil)}</span>
        </div>
        <div class="flex justify-between border-t border-slate-100 pt-1.5 text-slate-500 font-bold">
          <span>Job SBE: ${saSbe}</span>
          <span>Job GRP: ${saGrp}</span>
        </div>
      </div>
    `;
    cardsContainer.appendChild(card);
  });
}

// -------------------------------------------------------------
// TAB 4: T-CARE ANALYSIS WITH TARGET OVERLAY ON SBE KM CHART
// -------------------------------------------------------------
function renderTCareTab(monthJobs, monthIdx) {
  const selectedMonth = document.getElementById('filter-month').value;
  const bookingVinSet = new Set(
    appData.bookings
      .filter(b => b.arrivalDate && b.arrivalDate.startsWith(selectedMonth) && b.isCai)
      .map(b => b.vin.toUpperCase())
  );

  let tCareJobs = monthJobs.filter(j => j.isTCare && ['10K','20K','30K','40K','50K','60K'].includes(j.sbeKmCategory || j.tCareCategory.replace('TCARE_','')));
  let nonTCareCount = monthJobs.length - tCareJobs.length;

  // 1. Doughnut Chart T-Care Ratio
  const ctxPie = document.getElementById('chart-tcare-pie').getContext('2d');
  if (chartTCarePie) chartTCarePie.destroy();

  chartTCarePie = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: ['Unit T-Care', 'Unit Non T-Care'],
      datasets: [{
        data: [tCareJobs.length, nonTCareCount],
        backgroundColor: ['#6366f1', '#cbd5e1'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  document.getElementById('tcare-summary-box').innerHTML = `
    <div class="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 font-medium text-xs">
      <p class="font-bold mb-1">Status T-Care Gianyar Consul</p>
      <p>Total Transaksi T-Care: <span class="font-black text-indigo-700">${tCareJobs.length}</span> dari <span class="font-bold">${monthJobs.length}</span> pekerjaan (${monthJobs.length > 0 ? ((tCareJobs.length/monthJobs.length)*100).toFixed(1) : 0}%)</p>
    </div>
  `;

  // 2. SBE KM Categories Bar Chart (Actual vs Target Overlay for ALL SBE Jobs)
  const kmKeys = ['10 K', '20 K', '30 K', '40 K', '50 K', '60 K', '70 K', '80 K', '90 K', '100 K', '15,25,35 rb km X dst', 'Diatas 100000 km'];
  const kmCounts = {};
  kmKeys.forEach(k => kmCounts[k] = 0);

  // Count ALL SBE Jobs across categories (not just T-Care)
  monthJobs.forEach(j => {
    let catKey = j.sbeKmCategory;
    let mappedKey = 'Diatas 100000 km';
    if (catKey === '10K') mappedKey = '10 K';
    else if (catKey === '20K') mappedKey = '20 K';
    else if (catKey === '30K') mappedKey = '30 K';
    else if (catKey === '40K') mappedKey = '40 K';
    else if (catKey === '50K') mappedKey = '50 K';
    else if (catKey === '60K') mappedKey = '60 K';
    else if (catKey === '70K') mappedKey = '70 K';
    else if (catKey === '80K') mappedKey = '80 K';
    else if (catKey === '90K') mappedKey = '90 K';
    else if (catKey === '100K') mappedKey = '100 K';
    else if (catKey === '15/25K') mappedKey = '15,25,35 rb km X dst';
    else if (catKey === '>100K') mappedKey = 'Diatas 100000 km';
    else if (j.isTCare) {
      let tc = j.tCareCategory.replace('TCARE_', '');
      if (kmCounts[tc + ' K'] !== undefined) mappedKey = tc + ' K';
    }

    if (j.isSbe || j.repairType === 'SBE' || j.isTCare) {
      if (kmCounts.hasOwnProperty(mappedKey)) {
        kmCounts[mappedKey]++;
      } else {
        kmCounts['Diatas 100000 km']++;
      }
    }
  });

  const sbeKmObj = appData.targets.sbeKmCategories || {};
  const targetValues = kmKeys.map(k => {
    const arr = sbeKmObj[k];
    return (arr && arr[monthIdx] !== undefined) ? arr[monthIdx] : 0;
  });

  const ctxKm = document.getElementById('chart-tcare-km').getContext('2d');
  if (chartTCareKm) chartTCareKm.destroy();

  chartTCareKm = new Chart(ctxKm, {
    type: 'bar',
    data: {
      labels: ['10K', '20K', '30K', '40K', '50K', '60K', '70K', '80K', '90K', '100K', '15/25K', '>100K'],
      datasets: [
        {
          label: 'Pencapaian Actual (Unit)',
          data: kmKeys.map(k => kmCounts[k]),
          backgroundColor: '#6366f1',
          borderRadius: 6
        },
        {
          label: 'Target SBE (Unit)',
          data: targetValues,
          backgroundColor: '#f59e0b',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed.y || 0;
              const idx = context.dataIndex;
              const tgt = targetValues[idx] || 0;
              const act = kmKeys.map(k => kmCounts[k])[idx] || 0;
              const pct = tgt > 0 ? ((act / tgt) * 100).toFixed(1) : 0;
              if (context.datasetIndex === 0) {
                return `Actual: ${val} Unit (Ach: ${pct}% vs Target ${tgt} Unit)`;
              }
              return `Target SBE: ${val} Unit`;
            }
          }
        }
      }
    }
  });

  // 3. WEEKLY ACHIEVEMENT CARDS (W1 - W5) matching Image 3
  const weeklyContainer = document.getElementById('tcare-weekly-cards-container');
  if (weeklyContainer) {
    const totalDaysInMonth = getDaysInMonthString(selectedMonth);
    const weekRanges = [
      { name: 'W1', label: '01-07', start: 1, end: 7 },
      { name: 'W2', label: '08-14', start: 8, end: 14 },
      { name: 'W3', label: '15-21', start: 15, end: 21 },
      { name: 'W4', label: '22-28', start: 22, end: 28 },
      { name: 'W5', label: `29-${totalDaysInMonth}`, start: 29, end: totalDaysInMonth }
    ];

    let weeklyHtml = '';
    weekRanges.forEach(w => {
      const wJobs = monthJobs.filter(j => {
        const day = parseInt(j.invDate.split('-')[2], 10);
        return day >= w.start && day <= w.end;
      });

      const wCpus = new Set(wJobs.map(j => `${j.vin}_${j.invDate}`)).size;
      const wRev = wJobs.reduce((acc, j) => acc + j.revenue, 0);
      const wBookings = wJobs.filter(j => bookingVinSet.has(j.vin.toUpperCase())).length;
      const wNonBookings = wJobs.length - wBookings;

      // T-CARE Jobs in Week
      const wTCareJobs = wJobs.filter(j => j.isTCare && ['10K','20K','30K','40K','50K','60K'].includes(j.sbeKmCategory || j.tCareCategory.replace('TCARE_','')));
      const wTCareCpus = new Set(wTCareJobs.map(j => `${j.vin}_${j.invDate}`)).size;
      const wTCareRev = wTCareJobs.reduce((acc, j) => acc + j.revenue, 0);
      const wTCareBookings = wTCareJobs.filter(j => bookingVinSet.has(j.vin.toUpperCase())).length;
      const wTCareNonBookings = wTCareJobs.length - wTCareBookings;

      // NON T-CARE Jobs in Week
      const wNonTCareJobs = wJobs.filter(j => !wTCareJobs.includes(j));
      const wNonTCareCpus = new Set(wNonTCareJobs.map(j => `${j.vin}_${j.invDate}`)).size;
      const wNonTCareRev = wNonTCareJobs.reduce((acc, j) => acc + j.revenue, 0);
      const wNonTCareBookings = wNonTCareJobs.filter(j => bookingVinSet.has(j.vin.toUpperCase())).length;
      const wNonTCareNonBookings = wNonTCareJobs.length - wNonTCareBookings;

      weeklyHtml += `
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div class="flex justify-between items-center mb-3">
            <div>
              <span class="font-black text-lg text-slate-900 mr-1.5">${w.name}</span>
              <span class="text-xs text-slate-400 font-semibold">${w.label}</span>
            </div>
            <span class="text-[10px] font-extrabold px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">ACTUAL</span>
          </div>

          <div class="mb-3">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL CPUS</p>
            <h3 class="text-2xl font-black text-slate-900">${wCpus}</h3>
          </div>

          <div class="space-y-1.5 text-xs mb-3 font-semibold">
            <div class="flex justify-between">
              <span class="text-slate-400">Revenue</span>
              <span class="font-extrabold text-slate-900">${wRev > 0 ? formatRupiah(wRev) : '&mdash;'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Booking / Non Booking</span>
              <span class="font-extrabold text-slate-900">${wBookings} / ${wNonBookings}</span>
            </div>
          </div>

          <!-- T CARE BOX -->
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2">
            <p class="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-2">T CARE</p>
            <div class="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <p class="text-[9px] text-slate-400 font-bold">CPUS</p>
                <p class="font-black text-slate-900 text-sm">${wTCareCpus}</p>
              </div>
              <div>
                <p class="text-[9px] text-slate-400 font-bold">Revenue</p>
                <p class="font-bold text-slate-900 text-xs truncate">${wTCareRev > 0 ? formatRupiah(wTCareRev) : '&mdash;'}</p>
              </div>
            </div>
            <div class="flex justify-between text-[11px] text-slate-600 border-t border-slate-200/60 pt-1.5">
              <span>Booking <b class="text-slate-900">${wTCareBookings}</b></span>
              <span>Non Booking <b class="text-slate-900">${wTCareNonBookings}</b></span>
            </div>
          </div>

          <!-- NON T CARE BOX -->
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p class="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-2">NON T CARE</p>
            <div class="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <p class="text-[9px] text-slate-400 font-bold">CPUS</p>
                <p class="font-black text-slate-900 text-sm">${wNonTCareCpus}</p>
              </div>
              <div>
                <p class="text-[9px] text-slate-400 font-bold">Revenue</p>
                <p class="font-bold text-slate-900 text-xs truncate">${wNonTCareRev > 0 ? formatRupiah(wNonTCareRev) : '&mdash;'}</p>
              </div>
            </div>
            <div class="flex justify-between text-[11px] text-slate-600 border-t border-slate-200/60 pt-1.5">
              <span>Booking <b class="text-slate-900">${wNonTCareBookings}</b></span>
              <span>Non Booking <b class="text-slate-900">${wNonTCareNonBookings}</b></span>
            </div>
          </div>
        </div>
      `;
    });
    weeklyContainer.innerHTML = weeklyHtml;
  }

  // 4. SERVICE MIX PERFORMANCE KATEGORI CARDS matching Image 4
  const mixContainer = document.getElementById('tcare-service-mix-cards');
  if (mixContainer) {
    // Card 1: T CARE 10K - 60K
    const tCareCategoryJobs = monthJobs.filter(j => j.isTCare && ['10K','20K','30K','40K','50K','60K'].includes(j.sbeKmCategory || j.tCareCategory.replace('TCARE_','')));
    const cpus1 = new Set(tCareCategoryJobs.map(j => `${j.vin}_${j.invDate}`)).size;
    const rev1 = tCareCategoryJobs.reduce((acc, j) => acc + j.revenue, 0);
    const su1 = cpus1 > 0 ? Math.round(rev1 / cpus1) : 0;
    const b1 = tCareCategoryJobs.filter(j => bookingVinSet.has(j.vin.toUpperCase())).length;
    const nb1 = tCareCategoryJobs.length - b1;

    const intervals = ['10K', '20K', '30K', '40K', '50K', '60K'];
    let intervalRowsHtml = '';
    intervals.forEach(inv => {
      const invJobs = tCareCategoryJobs.filter(j => (j.sbeKmCategory === inv) || (j.tCareCategory === 'TCARE_' + inv));
      const cpusInv = new Set(invJobs.map(j => `${j.vin}_${j.invDate}`)).size;
      const bInv = invJobs.filter(j => bookingVinSet.has(j.vin.toUpperCase())).length;
      const nbInv = invJobs.length - bInv;
      intervalRowsHtml += `
        <tr class="hover:bg-slate-50">
          <td class="py-1.5 px-2 font-black text-slate-800 text-xs">${inv}</td>
          <td class="py-1.5 px-2 text-center font-bold text-slate-700">${cpusInv}</td>
          <td class="py-1.5 px-2 text-center font-bold text-slate-700">${bInv}</td>
          <td class="py-1.5 px-2 text-center font-bold text-slate-700">${nbInv}</td>
        </tr>
      `;
    });

    // Card 2: SBE NON T CARE (Outside 10K - 60K)
    const sbeNonTCareJobs = monthJobs.filter(j => j.isSbe && !tCareCategoryJobs.includes(j));
    const cpus2 = new Set(sbeNonTCareJobs.map(j => `${j.vin}_${j.invDate}`)).size;
    const rev2 = sbeNonTCareJobs.reduce((acc, j) => acc + j.revenue, 0);
    const su2 = cpus2 > 0 ? Math.round(rev2 / cpus2) : 0;
    const b2 = sbeNonTCareJobs.filter(j => bookingVinSet.has(j.vin.toUpperCase())).length;
    const nb2 = sbeNonTCareJobs.length - b2;

    // Card 3: NON T CARE LAINNYA (GRP / OIL Non T Care)
    const otherJobs = monthJobs.filter(j => !j.isSbe && !tCareCategoryJobs.includes(j));
    const cpus3 = new Set(otherJobs.map(j => `${j.vin}_${j.invDate}`)).size;
    const rev3 = otherJobs.reduce((acc, j) => acc + j.revenue, 0);
    const su3 = cpus3 > 0 ? Math.round(rev3 / cpus3) : 0;
    const b3 = otherJobs.filter(j => bookingVinSet.has(j.vin.toUpperCase())).length;
    const nb3 = otherJobs.length - b3;

    mixContainer.innerHTML = `
      <!-- Card 1 -->
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-4">
            <div>
              <p class="text-[10px] font-black text-rose-600 uppercase tracking-wider">T CARE</p>
              <h3 class="text-lg font-black text-slate-900">10K &ndash; 60K</h3>
            </div>
            <div class="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
              <i class="fa-solid fa-shield-halved text-lg"></i>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 text-xs mb-4">
            <div>
              <p class="text-[10px] text-slate-400 font-bold uppercase">CPUS</p>
              <p class="text-xl font-black text-slate-900">${cpus1}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 font-bold uppercase">Revenue</p>
              <p class="text-xs font-black text-slate-900 truncate">${formatRupiah(rev1)}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 font-bold uppercase">Sales / Unit</p>
              <p class="text-xs font-black text-slate-900 truncate">${formatRupiah(su1)}</p>
            </div>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 flex justify-around text-xs">
            <span class="text-slate-600 font-semibold">Booking <b class="text-slate-900 text-sm ml-1">${b1}</b></span>
            <span class="text-slate-600 font-semibold">Non Booking <b class="text-slate-900 text-sm ml-1">${nb1}</b></span>
          </div>

          <!-- Interval Sub-table -->
          <div class="border-t border-slate-100 pt-3">
            <table class="w-full text-[11px] text-left">
              <thead>
                <tr class="text-slate-400 font-bold border-b border-slate-100">
                  <th class="pb-1 px-2">Interval</th>
                  <th class="pb-1 px-2 text-center">CPUS</th>
                  <th class="pb-1 px-2 text-center">Booking</th>
                  <th class="pb-1 px-2 text-center">Non Booking</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-semibold">
                ${intervalRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Card 2 -->
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-4">
            <div>
              <p class="text-[10px] font-black text-amber-600 uppercase tracking-wider">SBE NON T CARE</p>
              <h3 class="text-lg font-black text-slate-900">Outside 10K &ndash; 60K</h3>
            </div>
            <div class="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
              <i class="fa-solid fa-wrench text-lg"></i>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 text-xs mb-4">
            <div>
              <p class="text-[10px] text-slate-400 font-bold uppercase">CPUS</p>
              <p class="text-xl font-black text-slate-900">${cpus2}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 font-bold uppercase">Revenue</p>
              <p class="text-xs font-black text-slate-900 truncate">${formatRupiah(rev2)}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 font-bold uppercase">Sales / Unit</p>
              <p class="text-xs font-black text-slate-900 truncate">${formatRupiah(su2)}</p>
            </div>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-around text-xs">
            <span class="text-slate-600 font-semibold">Booking <b class="text-slate-900 text-sm ml-1">${b2}</b></span>
            <span class="text-slate-600 font-semibold">Non Booking <b class="text-slate-900 text-sm ml-1">${nb2}</b></span>
          </div>
        </div>
      </div>

      <!-- Card 3 -->
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-4">
            <div>
              <p class="text-[10px] font-black text-blue-600 uppercase tracking-wider">NON T CARE LAINNYA</p>
              <h3 class="text-lg font-black text-slate-900">GRP / OIL Non T Care</h3>
            </div>
            <div class="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
              <i class="fa-solid fa-diagram-project text-lg"></i>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 text-xs mb-4">
            <div>
              <p class="text-[10px] text-slate-400 font-bold uppercase">CPUS</p>
              <p class="text-xl font-black text-slate-900">${cpus3}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 font-bold uppercase">Revenue</p>
              <p class="text-xs font-black text-slate-900 truncate">${formatRupiah(rev3)}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 font-bold uppercase">Sales / Unit</p>
              <p class="text-xs font-black text-slate-900 truncate">${formatRupiah(su3)}</p>
            </div>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-around text-xs">
            <span class="text-slate-600 font-semibold">Booking <b class="text-slate-900 text-sm ml-1">${b3}</b></span>
            <span class="text-slate-600 font-semibold">Non Booking <b class="text-slate-900 text-sm ml-1">${nb3}</b></span>
          </div>
        </div>
      </div>
    `;
  }

  // 5. Details Table
  const tbody = document.getElementById('table-tcare-details');
  if (tbody) {
    tbody.innerHTML = '';
    tCareJobs.slice(0, 100).forEach(j => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50';
      tr.innerHTML = `
        <td class="py-2.5 px-3 font-semibold">${j.invDate}</td>
        <td class="py-2.5 px-3 font-bold text-slate-800">${j.vin}</td>
        <td class="py-2.5 px-3 font-semibold">${j.sa}</td>
        <td class="py-2.5 px-3 font-black text-indigo-600">${j.tCareCategory}</td>
        <td class="py-2.5 px-3 text-slate-600 text-xs">${j.notes}</td>
        <td class="py-2.5 px-3 text-right font-black text-emerald-600">${formatRupiah(j.revenue)}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// -------------------------------------------------------------
// TAB 5: PENCAPAIAN YTM / RANGE BULAN KUMULATIF
// -------------------------------------------------------------
function setYtmRange(start, end) {
  const startSelect = document.getElementById('ytm-start-month');
  const endSelect = document.getElementById('ytm-end-month');
  const mainFilter = document.getElementById('filter-month').value;

  if (startSelect) startSelect.value = start;
  if (endSelect) {
    if (end === 'CURRENT') {
      endSelect.value = mainFilter || '2026-09';
    } else {
      endSelect.value = end;
    }
  }
  renderYtmTab();
}

function renderYtmTab() {
  const startSelect = document.getElementById('ytm-start-month');
  const endSelect = document.getElementById('ytm-end-month');
  const mainFilter = document.getElementById('filter-month').value;

  let startVal = startSelect ? startSelect.value : '2026-01';
  let endVal = endSelect ? endSelect.value : (mainFilter || '2026-09');

  if (startVal > endVal) {
    const tmp = startVal;
    startVal = endVal;
    endVal = tmp;
    if (startSelect) startSelect.value = startVal;
    if (endSelect) endSelect.value = endVal;
  }

  const startIdx = parseInt(startVal.split('-')[1], 10) - 1;
  const endIdx = parseInt(endVal.split('-')[1], 10) - 1;

  const subtitleElem = document.getElementById('ytm-subtitle-text');
  if (subtitleElem) {
    subtitleElem.innerText = `Akumulasi data & target dari ${formatMonthNameOnly(startVal)} hingga ${formatMonthNameOnly(endVal)} 2026`;
  }

  // 1. Calculate Cumulative Actuals for range
  const ytmBookings = appData.bookings.filter(b => b.arrivalDate && b.arrivalDate >= startVal + '-01' && b.arrivalDate <= endVal + '-31');
  const ytmJobs = appData.jobHistory.filter(j => j.invDate && j.invDate >= startVal + '-01' && j.invDate <= endVal + '-31');

  const totalBookingYtm = ytmBookings.length;
  const caiCountYtm = ytmBookings.filter(b => b.isCai).length;
  const caiRateYtm = totalBookingYtm > 0 ? ((caiCountYtm / totalBookingYtm) * 100).toFixed(1) : 0;

  const ytmVinSet = new Set(ytmJobs.map(j => `${j.vin}_${j.invDate}`));
  const totalCpusYtm = ytmVinSet.size;
  const totalRevYtm = ytmJobs.reduce((acc, j) => acc + j.revenue, 0);
  const salesUnitYtm = totalCpusYtm > 0 ? Math.round(totalRevYtm / totalCpusYtm) : 0;

  const sbeCountYtm = ytmJobs.filter(j => j.isSbe || j.repairType === 'SBE').length;
  const grpCountYtm = ytmJobs.filter(j => j.repairType === 'GRP').length;

  // 2. Cumulative Targets (sum from startIdx to endIdx)
  const gTargets = appData.targets.gianyarConsul || {};
  const targetCpusYtm = (gTargets.cpus || []).slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0);
  const targetRevYtm = (gTargets.revenue || []).slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0) * 1000000;
  const targetSbeYtm = (gTargets.sbe || []).slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0);
  const targetGrpYtm = (gTargets.grp || []).slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0);
  const targetSuYtm = targetCpusYtm > 0 ? Math.round(targetRevYtm / targetCpusYtm) : 0;

  // Render KPI Cards
  const cardsContainer = document.getElementById('ytm-kpi-cards');
  if (cardsContainer) {
    cardsContainer.innerHTML = `
      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-xs text-slate-500 font-bold mb-1">CPUS (${formatMonthNameOnly(startVal)} - ${formatMonthNameOnly(endVal)})</p>
        <h3 class="text-2xl font-black text-slate-900">${totalCpusYtm.toLocaleString('id-ID')}</h3>
        <div class="flex justify-between text-xs mt-2 font-semibold">
          <span class="text-slate-500">Target: ${targetCpusYtm.toLocaleString('id-ID')}</span>
          <span class="${totalCpusYtm >= targetCpusYtm ? 'text-emerald-600 font-extrabold' : 'text-rose-600 font-extrabold'}">${targetCpusYtm > 0 ? ((totalCpusYtm/targetCpusYtm)*100).toFixed(1) : 0}%</span>
        </div>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-xs text-slate-500 font-bold mb-1">Revenue (${formatMonthNameOnly(startVal)} - ${formatMonthNameOnly(endVal)})</p>
        <h3 class="text-2xl font-black text-slate-900">${formatRupiah(totalRevYtm)}</h3>
        <div class="flex justify-between text-xs mt-2 font-semibold">
          <span class="text-slate-500">Target: ${formatRupiah(targetRevYtm)}</span>
          <span class="${totalRevYtm >= targetRevYtm ? 'text-emerald-600 font-extrabold' : 'text-rose-600 font-extrabold'}">${targetRevYtm > 0 ? ((totalRevYtm/targetRevYtm)*100).toFixed(1) : 0}%</span>
        </div>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-xs text-slate-500 font-bold mb-1">Sales / Unit (S/U)</p>
        <h3 class="text-2xl font-black text-purple-900">${formatRupiah(salesUnitYtm)}</h3>
        <div class="flex justify-between text-xs mt-2 font-semibold">
          <span class="text-slate-500">Target: ${formatRupiah(targetSuYtm)}</span>
          <span class="${salesUnitYtm >= targetSuYtm ? 'text-emerald-600 font-extrabold' : 'text-rose-600 font-extrabold'}">${targetSuYtm > 0 ? ((salesUnitYtm/targetSuYtm)*100).toFixed(1) : 0}%</span>
        </div>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-xs text-slate-500 font-bold mb-1">CAI Booking Rate</p>
        <h3 class="text-2xl font-black text-emerald-600">${caiRateYtm}%</h3>
        <div class="flex justify-between text-xs mt-2 font-semibold text-slate-500">
          <span>Masuk: ${caiCountYtm} Unit</span>
          <span>Total: ${totalBookingYtm}</span>
        </div>
      </div>
    `;
  }

  // Render Master YTM Table Gianyar
  const tableGianyar = document.getElementById('table-ytm-gianyar');
  if (tableGianyar) {
    const kpis = [
      { name: 'Total CPUS (Unit Unik)', act: totalCpusYtm, tgt: targetCpusYtm, isRev: false },
      { name: 'Total Revenue (Rp)', act: totalRevYtm, tgt: targetRevYtm, isRev: true },
      { name: 'Sales / Unit (S/U)', act: salesUnitYtm, tgt: targetSuYtm, isRev: true },
      { name: 'Job SBE (Unit)', act: sbeCountYtm, tgt: targetSbeYtm, isRev: false },
      { name: 'Job GRP (Unit)', act: grpCountYtm, tgt: targetGrpYtm, isRev: false }
    ];

    let html = '';
    kpis.forEach(k => {
      const achPct = k.tgt > 0 ? ((k.act / k.tgt) * 100).toFixed(1) : 0;
      const gap = k.act - k.tgt;
      const isOk = parseFloat(achPct) >= 100;
      html += `
        <tr class="hover:bg-slate-50">
          <td class="p-3 border font-black text-slate-800">${k.name}</td>
          <td class="p-2.5 border text-right">${k.isRev ? formatRupiah(k.tgt) : k.tgt.toLocaleString('id-ID')}</td>
          <td class="p-2.5 border text-right font-black text-slate-900">${k.isRev ? formatRupiah(k.act) : k.act.toLocaleString('id-ID')}</td>
          <td class="p-2.5 border text-right font-extrabold ${isOk ? 'text-emerald-600' : 'text-rose-600'}">${achPct}%</td>
          <td class="p-2.5 border text-right font-bold ${gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${gap >= 0 ? '+' : ''}${k.isRev ? formatRupiah(gap) : gap.toLocaleString('id-ID')}</td>
        </tr>
      `;
    });
    tableGianyar.innerHTML = html;
  }

  // Render SA YTM Performance Table
  const tableSa = document.getElementById('table-ytm-sa');
  if (tableSa) {
    const saList = ['AYU', 'AJS', 'WBN', 'FIK', 'THS', 'THS2', 'PDS'];
    const saTargets = appData.targets.saTargets || {};

    let saHtml = '';
    saList.forEach(sa => {
      const saJobsYtm = ytmJobs.filter(j => j.sa === sa);
      const actCpus = new Set(saJobsYtm.map(j => `${j.vin}_${j.invDate}`)).size;
      const actRev = saJobsYtm.reduce((acc, j) => acc + j.revenue, 0);
      const actSu = actCpus > 0 ? Math.round(actRev / actCpus) : 0;
      const actSbe = saJobsYtm.filter(j => j.isSbe || j.repairType === 'SBE').length;
      const actGrp = saJobsYtm.filter(j => j.repairType === 'GRP').length;

      const tgtCpus = ((saTargets.CPUS && saTargets.CPUS[sa]) || []).slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0);
      const tgtRev = ((saTargets.REVENUE && saTargets.REVENUE[sa]) || []).slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0) * 1000000;
      const tgtSbe = ((saTargets.SBE && saTargets.SBE[sa]) || []).slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0);
      const tgtGrp = ((saTargets.GRP && saTargets.GRP[sa]) || []).slice(startIdx, endIdx + 1).reduce((a, b) => a + b, 0);

      const achCpus = tgtCpus > 0 ? ((actCpus / tgtCpus) * 100).toFixed(1) : 0;
      const achRev = tgtRev > 0 ? ((actRev / tgtRev) * 100).toFixed(1) : 0;
      const achSbe = tgtSbe > 0 ? ((actSbe / tgtSbe) * 100).toFixed(1) : 0;
      const achGrp = tgtGrp > 0 ? ((actGrp / tgtGrp) * 100).toFixed(1) : 0;

      saHtml += `
        <tr class="hover:bg-slate-50">
          <td class="p-3 border font-black text-slate-900">${sa}</td>
          <td class="p-2.5 border text-center">
            <div><span class="font-extrabold text-slate-900">${actCpus}</span> / <span class="text-slate-400">${tgtCpus}</span></div>
            <span class="text-[11px] ${parseFloat(achCpus) >= 100 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}">${achCpus}%</span>
          </td>
          <td class="p-2.5 border text-center">
            <div><span class="font-extrabold text-slate-900">${formatRupiah(actRev)}</span></div>
            <span class="text-[11px] ${parseFloat(achRev) >= 100 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}">${achRev}% vs Tgt ${formatRupiah(tgtRev)}</span>
          </td>
          <td class="p-2.5 border text-center">
            <span class="font-black text-purple-900">${formatRupiah(actSu)}</span>
          </td>
          <td class="p-2.5 border text-center">
            <div><span class="font-bold text-slate-900">${actSbe}</span> / <span class="text-slate-400">${tgtSbe}</span></div>
            <span class="text-[11px] ${parseFloat(achSbe) >= 100 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}">${achSbe}%</span>
          </td>
          <td class="p-2.5 border text-center">
            <div><span class="font-bold text-slate-900">${actGrp}</span> / <span class="text-slate-400">${tgtGrp}</span></div>
            <span class="text-[11px] ${parseFloat(achGrp) >= 100 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}">${achGrp}%</span>
          </td>
        </tr>
      `;
    });
    tableSa.innerHTML = saHtml;
  }
}

// -------------------------------------------------------------
// TAB: PERFORMA GSO & FLEET (56 CONTRACT CUSTOMERS AT GIANYAR CONSUL)
// -------------------------------------------------------------
const CONTRACT_CUSTOMERS = [
  // GSO (1-28)
  { no: 1, name: "BAGIAN UMUM SETDA KLUNGKUNG", type: "GSO", unit: 14, matchKeys: ["SETDA KLUNGKUNG", "SETDA KAB.KLUNGKUNG", "SETDA KAB KLUNGKUNG", "BAG. UMUM SETDA", "BAGIAN UMUM SETDA"] },
  { no: 2, name: "SEKRETARIAT DPRD KAB. GIANYAR", type: "GSO", unit: 11, matchKeys: ["DPRD KAB GIANYAR", "DPRD KAB. GIANYAR", "DPRD GIANYAR", "SEKRETARIAT DPRD GIANYAR"] },
  { no: 3, name: "SEKRETARIAT DPRD KAB.KLUNGKUNG", type: "GSO", unit: 12, matchKeys: ["DPRD KAB.KLUNGKUNG", "DPRD KAB KLUNGKUNG", "DPRD KLUNGKUNG", "SEKRETARIAT DPRD KLUNGKUNG"] },
  { no: 4, name: "DINAS KESEHATAN KABUPATEN GIANYAR", type: "GSO", unit: 12, matchKeys: ["DINAS KESEHATAN KABUPATEN GIANYAR", "DINKES GIANYAR", "KESEHATAN KABUPATEN GIANYAR"] },
  { no: 5, name: "KANTOR SEKRETARIAT DAERAH KAB GIANYAR", type: "GSO", unit: 43, matchKeys: ["SEKRETARIAT DAERAH KAB GIANYAR", "SETDA KAB GIANYAR", "SETDA GIANYAR", "SEKRETARIAT DAERAH GIANYAR"] },
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

function renderGsoFleetTab() {
  const selectedMonth = document.getElementById('filter-month').value;
  const searchVal = (document.getElementById('gso-fleet-search')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('gso-fleet-type-filter')?.value || 'ALL';

  let totalContractUnits = 0;
  let totalContractCpus = 0;
  let totalContractRev = 0;

  let gsoUnits = 0, gsoCpus = 0, gsoRev = 0;
  let fleetUnits = 0, fleetCpus = 0, fleetRev = 0;

  const contractStats = CONTRACT_CUSTOMERS.map(c => {
    const matchedJobs = appData.jobHistory.filter(j => {
      if (!j.customer) return false;
      const custUpper = j.customer.toUpperCase();
      return c.matchKeys.some(k => custUpper.includes(k.toUpperCase())) || custUpper.includes(c.name.toUpperCase());
    });

    const uniqueVins = new Set(matchedJobs.map(j => `${j.vin}_${j.invDate}`));
    const cpusCount = uniqueVins.size;
    const revSum = matchedJobs.reduce((acc, j) => acc + j.revenue, 0);
    const comePct = c.unit > 0 ? ((cpusCount / c.unit) * 100).toFixed(1) : 0;
    const suVal = cpusCount > 0 ? Math.round(revSum / cpusCount) : 0;

    totalContractUnits += c.unit;
    totalContractCpus += cpusCount;
    totalContractRev += revSum;

    if (c.type === 'GSO') {
      gsoUnits += c.unit;
      gsoCpus += cpusCount;
      gsoRev += revSum;
    } else {
      fleetUnits += c.unit;
      fleetCpus += cpusCount;
      fleetRev += revSum;
    }

    return {
      ...c,
      cpus: cpusCount,
      revenue: revSum,
      comePct: parseFloat(comePct),
      su: suVal
    };
  });

  const kpiCards = document.getElementById('gso-fleet-kpi-cards');
  if (kpiCards) {
    const overallCome = totalContractUnits > 0 ? ((totalContractCpus / totalContractUnits) * 100).toFixed(1) : 0;
    const overallSu = totalContractCpus > 0 ? Math.round(totalContractRev / totalContractCpus) : 0;

    kpiCards.innerHTML = `
      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-xs text-slate-500 font-bold mb-1">Total Unit Kontrak (56 Cust)</p>
        <h3 class="text-2xl font-black text-slate-900">${totalContractUnits} Unit</h3>
        <p class="text-xs text-slate-500 font-semibold mt-1">285 GSO &bull; 171 FLEET</p>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-xs text-slate-500 font-bold mb-1">Total CPUS Realisasi</p>
        <h3 class="text-2xl font-black text-blue-700">${totalContractCpus} Unit</h3>
        <p class="text-xs text-blue-600 font-bold mt-1">GSO: ${gsoCpus} &bull; FLEET: ${fleetCpus}</p>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-xs text-slate-500 font-bold mb-1">Rasio % Come (Realisasi/Unit)</p>
        <h3 class="text-2xl font-black text-emerald-600">${overallCome}%</h3>
        <p class="text-xs text-emerald-700 font-extrabold mt-1">Target Come &ge; 100%</p>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-xs text-slate-500 font-bold mb-1">Total Revenue Kontrak</p>
        <h3 class="text-2xl font-black text-slate-900">${formatRupiah(totalContractRev)}</h3>
        <p class="text-xs text-slate-500 font-semibold mt-1">GSO + FLEET Revenue</p>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-xs text-slate-500 font-bold mb-1">Sales / Unit (S/U)</p>
        <h3 class="text-2xl font-black text-purple-900">${formatRupiah(overallSu)}</h3>
        <p class="text-xs text-purple-600 font-bold mt-1">Rata-rata Revenue / CPUS</p>
      </div>
    `;
  }

  const gsoCome = gsoUnits > 0 ? ((gsoCpus / gsoUnits) * 100).toFixed(1) : 0;
  const fleetCome = fleetUnits > 0 ? ((fleetCpus / fleetUnits) * 100).toFixed(1) : 0;

  if (document.getElementById('gso-summary-units')) document.getElementById('gso-summary-units').innerText = `${gsoUnits} Unit`;
  if (document.getElementById('gso-summary-cpus')) document.getElementById('gso-summary-cpus').innerText = `${gsoCpus} Unit`;
  if (document.getElementById('gso-summary-come')) document.getElementById('gso-summary-come').innerText = `${gsoCome}%`;
  if (document.getElementById('gso-summary-rev')) document.getElementById('gso-summary-rev').innerText = formatRupiah(gsoRev);

  if (document.getElementById('fleet-summary-units')) document.getElementById('fleet-summary-units').innerText = `${fleetUnits} Unit`;
  if (document.getElementById('fleet-summary-cpus')) document.getElementById('fleet-summary-cpus').innerText = `${fleetCpus} Unit`;
  if (document.getElementById('fleet-summary-come')) document.getElementById('fleet-summary-come').innerText = `${fleetCome}%`;
  if (document.getElementById('fleet-summary-rev')) document.getElementById('fleet-summary-rev').innerText = formatRupiah(fleetRev);

  const filteredList = contractStats.filter(c => {
    if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;
    if (searchVal && !c.name.toLowerCase().includes(searchVal)) return false;
    return true;
  });

  const tbody = document.getElementById('table-gso-fleet-contracts');
  if (tbody) {
    if (filteredList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400 font-bold">Tidak ada data kontrak yang cocok</td></tr>`;
      return;
    }

    let rowsHtml = '';
    filteredList.forEach(c => {
      const typeBadge = c.type === 'GSO' 
        ? `<span class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">GSO</span>`
        : `<span class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">FLEET</span>`;

      let comeBadgeClass = 'bg-rose-50 text-rose-600 border-rose-200';
      if (c.comePct >= 100) {
        comeBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black';
      } else if (c.comePct > 0) {
        comeBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
      }

      rowsHtml += `
        <tr class="hover:bg-slate-50 transition-all">
          <td class="p-3 border text-center font-bold text-slate-500">${c.no}</td>
          <td class="p-3 border font-black text-slate-900">${c.name}</td>
          <td class="p-2.5 border text-center">${typeBadge}</td>
          <td class="p-2.5 border text-right font-extrabold text-slate-800">${c.unit}</td>
          <td class="p-2.5 border text-right font-black text-blue-700">${c.cpus}</td>
          <td class="p-2.5 border text-center">
            <span class="px-2.5 py-1 rounded-lg text-xs border ${comeBadgeClass}">${c.comePct}%</span>
          </td>
          <td class="p-2.5 border text-right font-black text-slate-900">${formatRupiah(c.revenue)}</td>
          <td class="p-2.5 border text-right font-black text-purple-900">${formatRupiah(c.su)}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  }
}

// -------------------------------------------------------------
// TAB: PENCAPAIAN TEKNISI & FOREMAN (WAH, WJY, PHW)
// -------------------------------------------------------------
const FOREMAN_MAPPING = {
  WAH: ['WPA', 'TAN', 'EDY', 'EKA'],
  WJY: ['KDW', 'ASP', 'ADT', 'IKA'],
  PHW: ['MAP', 'GNR', 'DWP', 'SPT']
};

function getForemanTeamsForTech(tech) {
  const teams = [];
  if (FOREMAN_MAPPING.WAH.includes(tech)) teams.push('WAH');
  if (FOREMAN_MAPPING.WJY.includes(tech)) teams.push('WJY');
  if (FOREMAN_MAPPING.PHW.includes(tech)) teams.push('PHW');
  return teams;
}

function renderTechPerformance() {
  const { startDate, endDate, selectedMonth, monthIdx } = getActiveDateRange();
  const monthJobs = appData.jobHistory.filter(j => j.invDate && j.invDate >= startDate && j.invDate <= endDate);
  const totalRevMonth = monthJobs.reduce((acc, j) => acc + j.revenue, 0);

  // Group by Technician
  const techMap = {};
  monthJobs.forEach(j => {
    const tech = (j.tech && j.tech.trim()) ? j.tech.trim().toUpperCase() : 'OTHER';
    if (!techMap[tech]) {
      techMap[tech] = {
        code: tech,
        jobs: [],
        vins: new Set(),
        revenue: 0,
        jasa: 0,
        part: 0,
        oil: 0,
        sbeCount: 0,
        grpCount: 0
      };
    }
    techMap[tech].jobs.push(j);
    techMap[tech].vins.add(`${j.vin}_${j.invDate}`);
    techMap[tech].revenue += j.revenue;
    techMap[tech].jasa += j.jasa;
    techMap[tech].part += j.part;
    techMap[tech].oil += j.oil;
    if (j.repairType === 'SBE') techMap[tech].sbeCount++;
    if (j.repairType === 'GRP') techMap[tech].grpCount++;
  });

  const techList = Object.values(techMap).map(t => {
    const cpus = t.vins.size;
    const su = cpus > 0 ? Math.round(t.revenue / cpus) : 0;
    const teams = getForemanTeamsForTech(t.code);
    const pctRev = totalRevMonth > 0 ? ((t.revenue / totalRevMonth) * 100).toFixed(1) : 0;
    return {
      ...t,
      cpus,
      su,
      teams,
      pctRev: parseFloat(pctRev)
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Foreman aggregates
  const foremanData = {
    WAH: { name: 'FO 1 WAH', techs: FOREMAN_MAPPING.WAH, cpusSet: new Set(), revenue: 0, sbeCount: 0, grpCount: 0, color: 'emerald', icon: 'fa-user-gear' },
    WJY: { name: 'FO 2 WJY', techs: FOREMAN_MAPPING.WJY, cpusSet: new Set(), revenue: 0, sbeCount: 0, grpCount: 0, color: 'blue', icon: 'fa-wrench' },
    PHW: { name: 'FO 3 PHW', techs: FOREMAN_MAPPING.PHW, cpusSet: new Set(), revenue: 0, sbeCount: 0, grpCount: 0, color: 'purple', icon: 'fa-screwdriver' }
  };

  monthJobs.forEach(j => {
    const tech = (j.tech && j.tech.trim()) ? j.tech.trim().toUpperCase() : '';
    if (!tech) return;

    if (FOREMAN_MAPPING.WAH.includes(tech)) {
      foremanData.WAH.cpusSet.add(`${j.vin}_${j.invDate}`);
      foremanData.WAH.revenue += j.revenue;
      if (j.repairType === 'SBE') foremanData.WAH.sbeCount++;
      if (j.repairType === 'GRP') foremanData.WAH.grpCount++;
    }
    if (FOREMAN_MAPPING.WJY.includes(tech)) {
      foremanData.WJY.cpusSet.add(`${j.vin}_${j.invDate}`);
      foremanData.WJY.revenue += j.revenue;
      if (j.repairType === 'SBE') foremanData.WJY.sbeCount++;
      if (j.repairType === 'GRP') foremanData.WJY.grpCount++;
    }
    if (FOREMAN_MAPPING.PHW.includes(tech)) {
      foremanData.PHW.cpusSet.add(`${j.vin}_${j.invDate}`);
      foremanData.PHW.revenue += j.revenue;
      if (j.repairType === 'SBE') foremanData.PHW.sbeCount++;
      if (j.repairType === 'GRP') foremanData.PHW.grpCount++;
    }
  });

  // Calculate Foreman & Best Tech metrics
  const maxForemanRev = Math.max(...Object.values(foremanData).map(f => f.revenue), 1);
  let bestForemanKey = 'WAH';
  let bestForemanRev = -1;

  Object.keys(foremanData).forEach(key => {
    const f = foremanData[key];
    f.cpus = f.cpusSet.size;
    f.su = f.cpus > 0 ? Math.round(f.revenue / f.cpus) : 0;
    if (f.revenue > bestForemanRev) {
      bestForemanRev = f.revenue;
      bestForemanKey = key;
    }
  });

  let bestTechCode = '-';
  let bestTechRev = -1;
  let bestTechCpus = 0;
  techList.forEach(t => {
    if (t.code !== 'LAINNYA' && t.code !== 'OTHER' && t.revenue > bestTechRev) {
      bestTechRev = t.revenue;
      bestTechCode = t.code;
      bestTechCpus = t.cpus;
    }
  });

  // Render KPI Summary Cards (5 Cards)
  const totalTechCPUS = new Set(monthJobs.filter(j => j.tech && j.tech.trim()).map(j => `${j.vin}_${j.invDate}`)).size;
  const totalTechRev = monthJobs.filter(j => j.tech && j.tech.trim()).reduce((acc, j) => acc + j.revenue, 0);
  const avgTechSu = totalTechCPUS > 0 ? Math.round(totalTechRev / totalTechCPUS) : 0;

  const kpiCardsContainer = document.getElementById('tech-kpi-cards');
  if (kpiCardsContainer) {
    kpiCardsContainer.innerHTML = `
      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Total CPUS Teknisi</p>
          <h3 class="text-2xl font-black text-slate-900 mt-1">${totalTechCPUS.toLocaleString('id-ID')} <span class="text-xs font-bold text-slate-400">Unit</span></h3>
          <p class="text-[11px] text-emerald-600 font-bold mt-1"><i class="fa-solid fa-car mr-1"></i>Realisasi Periode</p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-car-side"></i>
        </div>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue Teknisi</p>
          <h3 class="text-2xl font-black text-blue-900 mt-1">${formatRupiahShort(totalTechRev)}</h3>
          <p class="text-[11px] text-blue-600 font-bold mt-1"><i class="fa-solid fa-chart-line mr-1"></i>${formatRupiah(totalTechRev)}</p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-sack-dollar"></i>
        </div>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Sales / Unit Teknisi</p>
          <h3 class="text-2xl font-black text-purple-900 mt-1">${formatRupiahShort(avgTechSu)}</h3>
          <p class="text-[11px] text-purple-600 font-bold mt-1"><i class="fa-solid fa-receipt mr-1"></i>${formatRupiah(avgTechSu)} / Unit</p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-calculator"></i>
        </div>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Foreman Terbaik</p>
          <h3 class="text-2xl font-black text-amber-600 mt-1">${foremanData[bestForemanKey].name}</h3>
          <p class="text-[11px] text-amber-600 font-bold mt-1"><i class="fa-solid fa-trophy mr-1"></i>${formatRupiahShort(bestForemanRev)} Revenue</p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-crown"></i>
        </div>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Teknisi Terbaik</p>
          <h3 class="text-2xl font-black text-emerald-700 mt-1">${bestTechCode}</h3>
          <p class="text-[11px] text-emerald-600 font-bold mt-1"><i class="fa-solid fa-award mr-1"></i>${formatRupiahShort(bestTechRev)} (${bestTechCpus} Unit)</p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-medal"></i>
        </div>
      </div>
    `;
  }

  // Render 3 Foreman Cards
  const foremanCardsContainer = document.getElementById('foreman-cards-container');
  if (foremanCardsContainer) {
    let html = '';
    ['WAH', 'WJY', 'PHW'].forEach(key => {
      const f = foremanData[key];
      const pctMax = Math.round((f.revenue / maxForemanRev) * 100);
      const isBest = key === bestForemanKey;

      const techBadges = f.techs.map(t => `<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200">${t}</span>`).join(' ');

      html += `
        <div class="bg-white p-5 rounded-2xl border ${isBest ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-md' : 'border-slate-200'} shadow-sm relative overflow-hidden">
          ${isBest ? `<div class="absolute top-0 right-0 bg-amber-500 text-slate-900 font-black text-[10px] px-3 py-1 rounded-bl-xl uppercase tracking-wider"><i class="fa-solid fa-trophy mr-1"></i>Top Performer</div>` : ''}
          
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center text-lg font-bold">
              <i class="fa-solid ${f.icon}"></i>
            </div>
            <div>
              <h4 class="font-extrabold text-sm text-slate-900">${f.name}</h4>
              <div class="flex items-center space-x-1 mt-1">
                ${techBadges}
              </div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 my-3 py-2 bg-slate-50 rounded-xl text-center border border-slate-100">
            <div>
              <p class="text-[10px] font-extrabold text-slate-400 uppercase">CPUS</p>
              <p class="text-sm font-black text-slate-800">${f.cpus}</p>
            </div>
            <div>
              <p class="text-[10px] font-extrabold text-slate-400 uppercase">Revenue</p>
              <p class="text-xs font-black text-emerald-600">${formatRupiahShort(f.revenue)}</p>
            </div>
            <div>
              <p class="text-[10px] font-extrabold text-slate-400 uppercase">S / U</p>
              <p class="text-xs font-black text-purple-700">${formatRupiahShort(f.su)}</p>
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex justify-between text-[11px] font-bold text-slate-600">
              <span>Pencapaian vs Top FO:</span>
              <span class="font-black text-slate-800">${pctMax}%</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div class="bg-amber-500 h-full rounded-full transition-all duration-500" style="width: ${pctMax}%"></div>
            </div>
          </div>

          <div class="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-500">
            <span><i class="fa-solid fa-shield-halved text-amber-600 mr-1"></i>SBE: <strong class="text-slate-800">${f.sbeCount}</strong></span>
            <span><i class="fa-solid fa-car-burst text-indigo-600 mr-1"></i>GRP: <strong class="text-slate-800">${f.grpCount}</strong></span>
          </div>
        </div>
      `;
    });
    foremanCardsContainer.innerHTML = html;
  }

  // Filter Master Table Rows
  const searchInput = document.getElementById('tech-search-input');
  const foFilterSelect = document.getElementById('tech-fo-filter');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const foFilter = foFilterSelect ? foFilterSelect.value : 'ALL';

  let filteredTechs = techList.filter(t => {
    if (query) {
      const matchCode = t.code.toLowerCase().includes(query);
      const matchTeams = t.teams.some(team => team.toLowerCase().includes(query));
      if (!matchCode && !matchTeams) return false;
    }

    if (foFilter !== 'ALL') {
      if (foFilter === 'OTHER') {
        if (t.teams.length > 0) return false;
      } else {
        if (!t.teams.includes(foFilter)) return false;
      }
    }
    return true;
  });

  const tbody = document.getElementById('table-tech-performance');
  if (tbody) {
    if (filteredTechs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-400 font-bold">Tidak ada data teknisi yang cocok dengan filter</td></tr>`;
      return;
    }

    let rowsHtml = '';
    filteredTechs.forEach((t, idx) => {
      let teamBadges = t.teams.map(team => {
        let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
        if (team === 'WAH') badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black';
        if (team === 'WJY') badgeColor = 'bg-blue-100 text-blue-800 border-blue-300 font-black';
        if (team === 'PHW') badgeColor = 'bg-purple-100 text-purple-800 border-purple-300 font-black';
        return `<span class="px-2 py-0.5 rounded-md text-[10px] border ${badgeColor}">${team}</span>`;
      }).join(' ');

      if (!teamBadges) {
        teamBadges = `<span class="px-2 py-0.5 rounded-md text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold">OTHER / BELUM TERISI</span>`;
      }

      const isOther = t.code === 'LAINNYA' || t.code === 'OTHER';
      const displayCode = isOther 
        ? `<span class="text-amber-800 font-black flex items-center" title="Nama teknisi belum terisi di CSV / di luar Tim FO"><i class="fa-solid fa-user-gear text-amber-600 mr-2"></i>OTHER <span class="ml-1.5 text-[10px] text-amber-600 font-bold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">(BELUM TERISI)</span></span>`
        : `<span class="text-slate-900 font-black flex items-center"><i class="fa-solid fa-user-gear text-amber-600 mr-2"></i>${t.code}</span>`;

      rowsHtml += `
        <tr class="hover:bg-slate-50 transition-all">
          <td class="p-3 border text-center font-bold text-slate-500">${idx + 1}</td>
          <td class="p-3 border">${displayCode}</td>
          <td class="p-2.5 border text-center">${teamBadges}</td>
          <td class="p-2.5 border text-right font-extrabold text-slate-800">${t.jobs.length}</td>
          <td class="p-2.5 border text-right font-black text-blue-700">${t.cpus}</td>
          <td class="p-2.5 border text-right font-black text-emerald-700">${formatRupiah(t.revenue)}</td>
          <td class="p-2.5 border text-right font-black text-purple-900">${formatRupiah(t.su)}</td>
          <td class="p-2.5 border text-center font-bold text-amber-700">${t.sbeCount}</td>
          <td class="p-2.5 border text-center font-bold text-indigo-700">${t.grpCount}</td>
          <td class="p-2.5 border text-right font-black text-slate-800">${t.pctRev}%</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  }
}

// -------------------------------------------------------------
// TAB 5: MENU SETTING TARGET MANUAL (FULL MASTER EDITOR)
// -------------------------------------------------------------
function switchTargetSubTab(subTab) {
  currentTargetSubTab = subTab;
  document.querySelectorAll('.subtab-btn').forEach(btn => btn.classList.remove('active-subtab'));
  document.getElementById(`subtab-target-${subTab}`).classList.add('active-subtab');
  renderTargetEditor();
}

function renderTargetEditor() {
  const container = document.getElementById('target-editor-table-container');
  const targets = appData.targets;

  if (currentTargetSubTab === 'gianyar') {
    const g = targets.gianyarConsul || {};
    let html = `
      <table class="w-full text-xs text-left border-collapse border border-slate-300 rounded-xl overflow-hidden shadow-sm">
        <thead class="bg-slate-900 text-white font-extrabold">
          <tr>
            <th class="p-3 border border-slate-700">Indikator KPI Master</th>
            ${MONTH_SHORT.map(m => `<th class="p-2.5 border border-slate-700 text-center">${m}</th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y font-bold">
          <tr>
            <td class="p-3 border bg-slate-100 font-black text-blue-900">Target OAP (%)</td>
            ${(g.targetOAP || new Array(12).fill(0)).map((v, i) => `<td class="p-1 border"><input type="number" step="0.1" class="w-16 p-1.5 border rounded-lg text-center font-extrabold text-blue-900 focus:ring-2 focus:ring-blue-500" data-target="gianyarConsul.targetOAP.${i}" value="${v}"></td>`).join('')}
          </tr>
          <tr>
            <td class="p-3 border bg-slate-100 font-black text-slate-800">Hari Kerja (Days)</td>
            ${(g.kpiDays || new Array(12).fill(0)).map((v, i) => `<td class="p-1 border"><input type="number" step="0.5" class="w-16 p-1.5 border rounded-lg text-center font-bold" data-target="gianyarConsul.kpiDays.${i}" value="${v}"></td>`).join('')}
          </tr>
          <tr>
            <td class="p-3 border bg-slate-100 font-black text-emerald-800">Target CPUS (Unit)</td>
            ${(g.cpus || new Array(12).fill(0)).map((v, i) => `<td class="p-1 border"><input type="number" class="w-16 p-1.5 border rounded-lg text-center font-extrabold text-emerald-800" data-target="gianyarConsul.cpus.${i}" value="${v}"></td>`).join('')}
          </tr>
          <tr>
            <td class="p-3 border bg-slate-100 font-black text-amber-800">Target SBE (Unit)</td>
            ${(g.sbe || new Array(12).fill(0)).map((v, i) => `<td class="p-1 border"><input type="number" class="w-16 p-1.5 border rounded-lg text-center font-extrabold text-amber-800" data-target="gianyarConsul.sbe.${i}" value="${v}"></td>`).join('')}
          </tr>
          <tr>
            <td class="p-3 border bg-slate-100 font-black text-purple-800">Target GRP (Unit)</td>
            ${(g.grp || new Array(12).fill(0)).map((v, i) => `<td class="p-1 border"><input type="number" class="w-16 p-1.5 border rounded-lg text-center font-extrabold text-purple-800" data-target="gianyarConsul.grp.${i}" value="${v}"></td>`).join('')}
          </tr>
          <tr>
            <td class="p-3 border bg-slate-100 font-black text-blue-900">Revenue Target (Juta Rp)</td>
            ${(g.revenue || new Array(12).fill(0)).map((v, i) => `<td class="p-1 border"><input type="number" class="w-16 p-1.5 border rounded-lg text-center font-extrabold text-blue-900" data-target="gianyarConsul.revenue.${i}" value="${v}"></td>`).join('')}
          </tr>
          <tr>
            <td class="p-3 border bg-slate-100 font-bold text-slate-700">Target SBE / CPUS (%)</td>
            ${(g.sbeCpusPercent || new Array(12).fill(70)).map((v, i) => `<td class="p-1 border"><input type="number" class="w-16 p-1.5 border rounded-lg text-center font-bold" data-target="gianyarConsul.sbeCpusPercent.${i}" value="${v}"></td>`).join('')}
          </tr>
          <tr>
            <td class="p-3 border bg-purple-50 font-black text-purple-900">Sales / Unit Target (S/U)</td>
            ${(g.salesUnit || new Array(12).fill(0)).map((v, i) => `<td class="p-1 border"><input type="number" class="w-16 p-1.5 border rounded-lg text-center font-extrabold text-purple-900" data-target="gianyarConsul.salesUnit.${i}" value="${v}"></td>`).join('')}
          </tr>
        </tbody>
      </table>
    `;
    container.innerHTML = html;

  } else if (currentTargetSubTab === 'sbe-km') {
    const sbeKmObj = targets.sbeKmCategories || {};
    let html = `
      <table class="w-full text-xs text-left border-collapse border border-slate-300 rounded-xl overflow-hidden shadow-sm">
        <thead class="bg-slate-900 text-white font-extrabold">
          <tr>
            <th class="p-3 border border-slate-700">Kategori KM SBE</th>
            ${MONTH_SHORT.map(m => `<th class="p-2.5 border border-slate-700 text-center">${m}</th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y font-bold">
    `;

    Object.keys(sbeKmObj).forEach(catKey => {
      const arr = sbeKmObj[catKey] || new Array(12).fill(0);
      const isTotal = catKey === 'SBE Total';
      html += `
        <tr class="${isTotal ? 'bg-amber-100 font-black text-amber-900' : ''}">
          <td class="p-3 border bg-slate-100 font-black text-slate-900">${catKey}</td>
          ${arr.map((v, i) => `<td class="p-1 border"><input type="number" class="w-16 p-1.5 border rounded-lg text-center font-extrabold text-slate-900 focus:ring-2 focus:ring-amber-500" data-target="sbeKmCategories.${catKey}.${i}" value="${v}"></td>`).join('')}
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

  } else {
    const category = currentTargetSubTab === 'sa-salesunit' ? 'SALES_UNIT' : currentTargetSubTab.replace('sa-', '').toUpperCase();
    const saObj = (targets.saTargets && targets.saTargets[category]) || {};

    let html = `
      <table class="w-full text-xs text-left border-collapse border border-slate-300 rounded-xl overflow-hidden shadow-sm">
        <thead class="bg-slate-900 text-white font-extrabold">
          <tr>
            <th class="p-3 border border-slate-700">Nama SA</th>
            ${MONTH_SHORT.map(m => `<th class="p-2.5 border border-slate-700 text-center">${m}</th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y font-bold">
    `;

    Object.keys(saObj).forEach(saKey => {
      const arr = saObj[saKey] || new Array(12).fill(0);
      html += `
        <tr>
          <td class="p-3 border bg-slate-100 font-black text-slate-900">${saKey}</td>
          ${arr.map((v, i) => `<td class="p-1 border"><input type="number" step="0.1" class="w-16 p-1.5 border rounded-lg text-center font-extrabold text-blue-900 focus:ring-2 focus:ring-blue-500" data-target="saTargets.${category}.${saKey}.${i}" value="${v}"></td>`).join('')}
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }
}

async function saveTargetsToServer() {
  const inputs = document.querySelectorAll('#target-editor-table-container input[data-target]');
  const newTargets = JSON.parse(JSON.stringify(appData.targets));

  inputs.forEach(input => {
    const pathParts = input.getAttribute('data-target').split('.');
    const val = parseFloat(input.value) || 0;

    let curr = newTargets;
    for (let i = 0; i < pathParts.length - 1; i++) {
      const p = pathParts[i];
      if (!curr[p]) curr[p] = {};
      curr = curr[p];
    }
    const lastKey = pathParts[pathParts.length - 1];
    curr[lastKey] = val;
  });

  try {
    const res = await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTargets)
    });
    const json = await res.json();
    if (json.success) {
      alert('Target manual berhasil disimpan!');
      appData.targets = newTargets;
      updateDashboardView();
    } else {
      alert('Gagal menyimpan target: ' + json.error);
    }
  } catch (e) {
    alert('Error saving targets: ' + e.message);
  }
}

// -------------------------------------------------------------
// EXCEL EXPORT FUNCTION
// -------------------------------------------------------------
function downloadExcelReport() {
  if (typeof XLSX === 'undefined') {
    alert('Library Excel belum siap. Silakan refresh halaman.');
    return;
  }

  const selectedMonth = document.getElementById('filter-month').value;
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['DASHBOARD PENCAPAIAN AT GYR (DESAIN BY MDP)'],
    ['Bulan Data', formatMonthNameOnly(selectedMonth)],
    ['Tanggal Export', new Date().toLocaleString('id-ID')],
    [],
    ['METRIK UPTIME', 'NILAI'],
    ['Total Booking (YTM)', appData.bookings.filter(b => b.arrivalDate && b.arrivalDate.startsWith(selectedMonth)).length],
    ['Total CAI (Kedatangan)', appData.bookings.filter(b => b.arrivalDate && b.arrivalDate.startsWith(selectedMonth) && b.isCai).length],
    ['Total Job History', appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth)).length],
    ['Total CPUS (Unit Unik)', new Set(appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth)).map(j => `${j.vin}_${j.invDate}`)).size],
    ['Total Revenue (Rp)', appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth)).reduce((acc, j) => acc + j.revenue, 0)],
    ['Sales Per Unit (S/U)', Math.round(appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth)).reduce((acc, j) => acc + j.revenue, 0) / (new Set(appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth)).map(j => `${j.vin}_${j.invDate}`)).size || 1))]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Dashboard');

  const bookingRows = appData.bookings.map(b => ({
    'Arrival Date': b.arrivalDate,
    'VIN / No Rangka': b.vin,
    'PIC Booking': b.pic,
    'Type Repair': b.repairType,
    'Status CAI': b.isCai ? 'CAI (MASUK)' : 'PENDING'
  }));
  const wsBooking = XLSX.utils.json_to_sheet(bookingRows);
  XLSX.utils.book_append_sheet(wb, wsBooking, 'Detail Booking');

  const jobRows = appData.jobHistory.map(j => ({
    'Inv Date': j.invDate,
    'No Rangka': j.vin,
    'SA': j.sa,
    'Repair Type': j.repairType,
    'Jasa': j.jasa,
    'Part': j.part,
    'Oil': j.oil,
    'Material': j.material,
    'Sublet': j.sublet,
    'Discount': j.disc,
    'Total Revenue': j.revenue,
    'T-Care Category': j.tCareCategory,
    'Notes': j.notes
  }));
  const wsJobs = XLSX.utils.json_to_sheet(jobRows);
  XLSX.utils.book_append_sheet(wb, wsJobs, 'Detail Job History');

  XLSX.writeFile(wb, `Dashboard_AT_GYR_${selectedMonth}.xlsx`);
}

// -------------------------------------------------------------
// HELPER FUNCTIONS
// -------------------------------------------------------------
function formatRupiah(num) {
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

function formatRupiahShort(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const isNeg = num < 0;
  const abs = Math.abs(num);
  let res = '';
  if (abs >= 1000000000) {
    res = (abs / 1000000000).toFixed(1) + ' M';
  } else if (abs >= 1000000) {
    res = (abs / 1000000).toFixed(1) + ' Jt';
  } else if (abs >= 1000) {
    res = (abs / 1000).toFixed(0) + ' Rb';
  } else {
    res = Math.round(abs).toString();
  }
  return (isNeg ? '-' : '') + res;
}

function getDaysInMonthString(ym) {
  if (!ym || ym.length < 7) return 31;
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}
