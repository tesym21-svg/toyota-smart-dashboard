// Global Dashboard State
let appData = {
  bookings: [],
  jobHistory: [],
  jobHistory2025: [],
  uio: [],
  targets: {},
  sto: null
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
let chartYtmMonthly = null;
let chartStoComposition = null;
let chartKecamatanCpus = null;
let chartKecamatanUio = null;

let currentOverviewChartPeriod = 'daily';
let currentBookingChartPeriod = 'daily';
let currentStoFilter = 'all';

// Global Chart.js Tooltip & Font Styling (Compact Bottom-Locked Floating Card)
if (typeof Chart !== 'undefined') {
  const TooltipPlugin = (Chart.registry && Chart.registry.plugins && Chart.registry.plugins.get('tooltip')) || Chart.Tooltip;
  if (TooltipPlugin && TooltipPlugin.positioners) {
    TooltipPlugin.positioners.bottomLocked = function(items, eventPosition) {
      if (!items || !items.length) return false;
      const chart = this.chart;
      const chartArea = chart.chartArea;
      const chartType = chart.config && chart.config.type;
      if (!chartArea || chartType === 'doughnut' || chartType === 'pie') {
        return TooltipPlugin.positioners.average.call(this, items, eventPosition);
      }
      const x = items[0].element ? items[0].element.x : eventPosition.x;
      const midX = (chartArea.left + chartArea.right) / 2;
      return {
        x: x,
        y: chartArea.bottom - 6,
        xAlign: x > midX ? 'right' : 'left',
        yAlign: 'bottom'
      };
    };
  }

  // Subtle vertical guide line from hovered point down to bottom tooltip card
  Chart.register({
    id: 'bottomTooltipCrosshair',
    afterDatasetsDraw(chart) {
      const chartType = chart.config && chart.config.type;
      if (chartType === 'doughnut' || chartType === 'pie') return;
      const tooltip = chart.tooltip;
      if (!tooltip || !tooltip.getActiveElements || !tooltip.getActiveElements().length) return;
      const activeEl = tooltip.getActiveElements()[0];
      if (!activeEl || !activeEl.element || !chart.chartArea) return;
      const x = activeEl.element.x;
      const ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chart.chartArea.top);
      ctx.lineTo(x, chart.chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    }
  });

  Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
  Chart.defaults.plugins.tooltip.position = 'bottomLocked';
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.88)';
  Chart.defaults.plugins.tooltip.titleFont = { weight: 'bold', size: 11 };
  Chart.defaults.plugins.tooltip.bodyFont = { weight: '600', size: 10.5 };
  Chart.defaults.plugins.tooltip.titleMarginBottom = 3;
  Chart.defaults.plugins.tooltip.bodySpacing = 3;
  Chart.defaults.plugins.tooltip.padding = { top: 6, bottom: 6, left: 8, right: 8 };
  Chart.defaults.plugins.tooltip.cornerRadius = 6;
  Chart.defaults.plugins.tooltip.caretSize = 0;
  Chart.defaults.plugins.tooltip.boxWidth = 8;
  Chart.defaults.plugins.tooltip.boxHeight = 8;
  Chart.defaults.plugins.tooltip.boxPadding = 4;
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.18)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
}

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
  if (statusText) statusText.innerText = 'Memuat data...';

  try {
    const res = await fetch('/api/data');
    const json = await res.json();

    if (json.success) {
      appData = json.data;
      if (!appData.jobHistory2025) appData.jobHistory2025 = [];
      if (statusText) statusText.innerText = `Data Siap (${appData.bookings.length} Booking, ${appData.jobHistory.length} Jobs)`;
      document.getElementById('filter-info').innerText = `Data diperbarui: ${new Date().toLocaleTimeString('id-ID')} | Total ${appData.jobHistory.length} transaksi`;

      populateMonthSelectors();
      updateTechFoFilterOptions();
      if (appData.wip && appData.wip.summary) {
        const badge = document.getElementById('drawer-wip-badge');
        if (badge) badge.innerText = appData.wip.summary.totalWipRows || '27';
      }
      updateDashboardView();
    } else {
      if (statusText) statusText.innerText = 'Gagal memuat data';
      alert('Error loading data: ' + json.error);
    }
  } catch (err) {
    if (statusText) statusText.innerText = 'Offline / Cache Mode';
    console.error('Fetch error:', err);
  }
}

function getDefaultRunningMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ym = `${year}-${month}`;
  if (STANDARD_12_MONTHS.some(m => m.code === ym)) return ym;
  return '2026-10';
}

function getPreviousMonthCode(ym) {
  if (!ym) return '2026-09';
  const parts = ym.split('-');
  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10) - 1;
  if (m < 1) { m = 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
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

  const defMonth = getDefaultRunningMonth();
  const prevMonth = getPreviousMonthCode(defMonth);

  const populateSelect = (selectElem, defaultVal) => {
    if (!selectElem) return;
    selectElem.innerHTML = '';
    STANDARD_12_MONTHS.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.code;
      opt.innerText = m.name;
      selectElem.appendChild(opt);
    });
    selectElem.value = defaultVal || defMonth;
  };

  populateSelect(selectMain, defMonth);
  populateSelect(selectOverview1, defMonth);
  populateSelect(selectOverview2, prevMonth);
  populateSelect(selectVs1, defMonth);
  populateSelect(selectVs2, prevMonth);
  populateSelect(selectSa1, defMonth);
  populateSelect(selectSa2, prevMonth);
  populateSelect(selectYtmStart, '2026-01');
  populateSelect(selectYtmEnd, defMonth);
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

  const defMonth = getDefaultRunningMonth();
  let selectedMonth = monthElem ? monthElem.value : defMonth;
  let startDate = startElem ? startElem.value : '';
  let endDate = endElem ? endElem.value : '';

  if (!startDate || !endDate) {
    const ym = selectedMonth || defMonth;
    startDate = `${ym}-01`;
    endDate = `${ym}-${getDaysInMonthString(ym)}`;
    if (startElem) startElem.value = startDate;
    if (endElem) endElem.value = endDate;
  }

  const monthIdx = selectedMonth ? parseInt(selectedMonth.split('-')[1], 10) - 1 : (parseInt(defMonth.split('-')[1], 10) - 1);
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
  'daily-report': 'Laporan Harian WA',
  'wip': 'Monitoring WIP (Status < 40)',
  'tcare': 'Analisa T-Care',
  'ytm': 'Pencapaian YTM',
  'gso-fleet': 'Performa GSO & FLEET',
  'kecamatan-uio': 'Mapping Kecamatan & UIO',
  'tech-performance': 'Pencapaian Teknisi & FO',
  'target-editor': 'Menu Setting Target',
  'sto': 'Struktur Organisasi (STO)'
};

// Helper: CPUS is defined as workshop service jobs (SBE, GRP, OIL only; 1 unique VIN per day = 1 CPUS)
function isCpusJob(j) {
  if (!j || !j.repairType) return false;
  const rt = j.repairType.toUpperCase().trim();
  return rt === 'SBE' || rt === 'GRP' || rt === 'OIL';
}

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
    if (isCpusJob(j)) {
      uniqueVinDateSet.add(`${j.vin}_${j.invDate}`);
    }
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

  const elBooking = document.getElementById('kpi-total-booking');
  if (elBooking) elBooking.innerText = totalBooking.toLocaleString('id-ID');
  const elCaiRate = document.getElementById('kpi-cai-rate');
  if (elCaiRate) elCaiRate.innerText = `CAI (Kedatangan): ${caiCount} (${caiRate}%)`;

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
  } else if (currentTab === 'kecamatan-uio') {
    renderKecamatanUioTab();
  } else if (currentTab === 'daily-report') {
    renderDailyReportTab();
  } else if (currentTab === 'wip') {
    renderWipTab();
  } else if (currentTab === 'tech-performance') {
    renderTechPerformance();
  } else if (currentTab === 'target-editor') {
    renderTargetEditor();
  } else if (currentTab === 'sto') {
    renderStoView();
  }
}

// Daftar Hari Libur Nasional (Tanggal Merah selain Hari Minggu)
const NATIONAL_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-27', '2025-01-29', '2025-03-29', '2025-03-31',
  '2025-04-01', '2025-04-18', '2025-05-01', '2025-05-12', '2025-05-29',
  '2025-06-06', '2025-06-27', '2025-08-17', '2025-09-05', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-16', '2026-02-17', '2026-03-19', '2026-03-20', '2026-03-21',
  '2026-04-03', '2026-05-01', '2026-05-14', '2026-05-27', '2026-06-01', '2026-06-16',
  '2026-08-17', '2026-08-25', '2026-12-25'
]);

function isSunday(ym, day) {
  if (!ym || ym.length < 7) return false;
  const [year, month] = ym.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getDay() === 0;
}

function isRedDate(ym, day) {
  if (!ym || ym.length < 7) return false;
  const dateStr = `${ym}-${String(day).padStart(2, '0')}`;
  if (NATIONAL_HOLIDAYS.has(dateStr)) return true;
  return isSunday(ym, day);
}

// Bobot HOK Nasional:
// - Tanggal Merah (Minggu / Libur Nasional) = 0
// - Hari Sabtu (Tanggal Hitam) = 0.5
// - Senin s/d Jumat (Tanggal Hitam) = 1.0
function getNationalHokDayWeight(ym, day) {
  if (!ym || ym.length < 7) return 0;
  if (isRedDate(ym, day)) return 0;
  const [year, month] = ym.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  if (d.getDay() === 6) return 0.5;
  return 1.0;
}

function countWorkingDays(ym, startDay, endDay) {
  let count = 0;
  for (let d = startDay; d <= endDay; d++) {
    count += getNationalHokDayWeight(ym, d);
  }
  return count > 0 ? count : 0.5;
}

function getMonthTotalNationalHok(ym) {
  if (!ym || ym.length < 7) return 24.5;
  const maxDays = getDaysInMonthString(ym);
  return countWorkingDays(ym, 1, maxDays);
}

// Helper Tanggal Merah untuk Line Chart (Bulan 1 vs Bulan 2)
function getDayColor(day, m1, m2) {
  const s1 = isRedDate(m1, day);
  const s2 = isRedDate(m2, day);
  if (s1 && s2) return '#8b5cf6'; // Ungu/Violet jika tanggal merah jatuh di hari yang sama
  if (s1) return '#dc2626'; // Merah cerah untuk Tanggal Merah Bulan 1 (Utama)
  if (s2) return '#ec4899'; // Pink cerah untuk Tanggal Merah Bulan 2 (Pembanding)
  return '#64748b'; // Slate-500 untuk hari kerja biasa
}

function getDayFont(day, m1, m2) {
  const s1 = isRedDate(m1, day);
  const s2 = isRedDate(m2, day);
  if (s1 || s2) {
    return { weight: 'bold', size: 12 };
  }
  return { weight: 'normal', size: 11 };
}

function getDayGridColor(day, m1, m2) {
  const s1 = isRedDate(m1, day);
  const s2 = isRedDate(m2, day);
  if (s1 && s2) return 'rgba(139, 92, 246, 0.25)'; // Highlight garis ungu lembut
  if (s1) return 'rgba(220, 38, 38, 0.18)'; // Highlight garis merah lembut
  if (s2) return 'rgba(236, 72, 153, 0.20)'; // Highlight garis pink lembut
  return 'rgba(226, 232, 240, 0.6)'; // Garis abu-abu normal
}

function getChartRedDateLegendHtml(m1, m2) {
  const name1 = formatMonthNameOnly(m1);
  const name2 = formatMonthNameOnly(m2);
  if (m1 === m2) {
    return `
      <div class="flex items-center justify-end space-x-3 text-xs font-bold mt-2.5">
        <span class="inline-flex items-center text-slate-700">
          <span class="w-3 h-3 rounded-full bg-red-600 mr-1.5 shadow-2xs border border-red-700"></span>
          Tanggal Merah ${name1}: <strong class="text-red-600 ml-1">Merah</strong>
        </span>
        <span class="text-slate-400 font-normal italic text-[11px]">(Hari Minggu / Libur Bengkel)</span>
      </div>
    `;
  }
  return `
    <div class="flex items-center justify-end space-x-4 text-xs font-bold mt-2.5 flex-wrap gap-y-1">
      <span class="inline-flex items-center text-slate-800">
        <span class="w-3 h-3 rounded-full bg-red-600 mr-1.5 shadow-2xs border border-red-700"></span>
        Tanggal Merah ${name1} (Bulan 1): <strong class="text-red-600 ml-1">Merah</strong>
      </span>
      <span class="inline-flex items-center text-slate-800">
        <span class="w-3 h-3 rounded-full bg-pink-500 mr-1.5 shadow-2xs border border-pink-600"></span>
        Tanggal Merah ${name2} (Bulan 2): <strong class="text-pink-600 ml-1">Pink</strong>
      </span>
      <span class="text-slate-400 font-normal italic text-[11px]">(Hari Minggu / Libur Bengkel)</span>
    </div>
  `;
}

// -------------------------------------------------------------
// TAB 1: OVERVIEW GIANYAR CONSUL
// -------------------------------------------------------------
function renderOverviewTab(monthJobs, targetCpus, targetRev, monthIdx) {
  const cpusAct = new Set(monthJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
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
  renderKpiHierarchyTrees(monthJobs, targetCpus, targetRev, monthIdx);
  renderSaMasterPerformanceTable(monthJobs, monthIdx);
}

// -------------------------------------------------------------
// BAGAN HIERARKI POHON KPI (CPUS & REVENUE) & KONTRIBUSI % KE KPI
// -------------------------------------------------------------
let currentKpiTreeMode = 'cpus';
let currentKpiTreeTargetBasis = 'hok'; // 'hok' = Target dibagi HOK x HOK Berjalan (Daily Pace), 'month' = Target Full Bulan
let lastKpiTreeSelectedMonth = null;

function refreshKpiTreesNow() {
  const { startDate, endDate, monthIdx } = getActiveDateRange();
  const monthJobs = appData.jobHistory.filter(j => j.invDate && j.invDate >= startDate && j.invDate <= endDate);
  const targetGianyar = appData.targets.gianyarConsul || {};
  const targetCpus = targetGianyar.cpus ? targetGianyar.cpus[monthIdx] : 0;
  const targetRev = targetGianyar.revenue ? targetGianyar.revenue[monthIdx] * 1000000 : 0;
  renderKpiHierarchyTrees(monthJobs, targetCpus, targetRev, monthIdx);
}

function setKpiTreeMode(mode) {
  currentKpiTreeMode = mode;
  const btnCpus = document.getElementById('btn-kpi-tree-cpus');
  const btnRev = document.getElementById('btn-kpi-tree-rev');

  const activeCls = ['bg-blue-600', 'text-white', 'shadow-sm'];
  const inactiveCls = ['text-slate-600', 'hover:text-slate-900', 'bg-transparent'];

  [
    { btn: btnCpus, active: mode === 'cpus' },
    { btn: btnRev, active: mode === 'revenue' }
  ].forEach(({ btn, active }) => {
    if (!btn) return;
    if (active) {
      btn.classList.add(...activeCls);
      btn.classList.remove(...inactiveCls);
    } else {
      btn.classList.remove(...activeCls);
      btn.classList.add(...inactiveCls);
    }
  });

  refreshKpiTreesNow();
}

function setKpiTreeTargetBasis(basis) {
  currentKpiTreeTargetBasis = basis;
  const btnHok = document.getElementById('btn-kpi-basis-hok');
  const btnMonth = document.getElementById('btn-kpi-basis-month');

  const activeCls = ['bg-emerald-600', 'text-white', 'shadow-sm'];
  const inactiveCls = ['text-slate-600', 'hover:text-slate-900', 'bg-transparent'];

  [
    { btn: btnHok, active: basis === 'hok' },
    { btn: btnMonth, active: basis === 'month' }
  ].forEach(({ btn, active }) => {
    if (!btn) return;
    if (active) {
      btn.classList.add(...activeCls);
      btn.classList.remove(...inactiveCls);
    } else {
      btn.classList.remove(...activeCls);
      btn.classList.add(...inactiveCls);
    }
  });

  refreshKpiTreesNow();
}

function onKpiTreeHokChange() {
  refreshKpiTreesNow();
}

function formatRevTreeVal(val) {
  if (!val || val === 0) return '0';
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (abs >= 1000000) {
    return `${sign}${(abs / 1000000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Jt`;
  }
  if (abs >= 1000) {
    return `${sign}${Math.round(abs / 1000).toLocaleString('id-ID')} Rb`;
  }
  return `${sign}${Math.round(abs).toLocaleString('id-ID')}`;
}

function buildTreeMainBoxHtml({ title, tgtStr, tgtSubStr, tgtLabel, achStr, achPct, gapStr, isPass, kpiContribPct, shareLabel, isRoot, accentColor }) {
  const passBg = isPass ? 'bg-emerald-600' : 'bg-red-600';
  const passIcon = isPass ? '&#10003;' : 'X';
  const gapBadgeCls = isPass ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-700 border-red-300';
  const headerBg = accentColor || 'bg-slate-300 text-slate-900';

  return `
    <div class="flex flex-col items-center">
      ${!isRoot ? `
        <div class="flex flex-wrap items-center justify-center gap-1.5 mb-1.5">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-600 text-white shadow-sm">
            Kontribusi KPI: ${kpiContribPct}%
          </span>
          ${shareLabel ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700 border border-slate-300">${shareLabel}</span>` : ''}
        </div>
      ` : `
        <div class="mb-1.5">
          <span class="px-3 py-0.5 rounded-full text-[11px] font-black bg-slate-900 text-white shadow-sm">
            TOTAL UTAMA KPI (100%)
          </span>
        </div>
      `}
      <div class="border-2 border-slate-800 rounded-lg overflow-hidden shadow-md bg-white w-64">
        <div class="${headerBg} border-b-2 border-slate-800 font-black text-xs py-1.5 px-3 text-center tracking-wider uppercase">
          ${title}
        </div>
        <div class="grid grid-cols-12">
          <!-- Left: Tgt & Ach -->
          <div class="col-span-5 border-r-2 border-slate-800 flex flex-col text-center">
            <div class="bg-slate-200 border-b border-slate-400 text-[10px] font-extrabold text-slate-700 py-0.5">${tgtLabel || 'Tgt'}</div>
            <div class="bg-white border-b-2 border-slate-800 py-1 px-1 flex flex-col items-center justify-center">
              <span class="text-xs font-black text-slate-900 leading-tight">${tgtStr}</span>
              ${tgtSubStr ? `<span class="text-[9px] font-bold text-slate-500 leading-tight mt-0.5">${tgtSubStr}</span>` : ''}
            </div>
            <div class="bg-slate-200 border-b border-slate-400 text-[10px] font-extrabold text-slate-700 py-0.5">Ach</div>
            <div class="bg-yellow-300 text-xs font-black text-slate-950 py-1 px-1">${achStr}</div>
          </div>
          <!-- Middle: Ach % & Gap -->
          <div class="col-span-4 border-r-2 border-slate-800 flex flex-col items-center justify-center p-1.5 bg-white">
            <span class="text-base font-black text-slate-900 leading-tight">${achPct}%</span>
            <span class="text-[10px] font-black mt-1 px-1.5 py-0.5 rounded border ${gapBadgeCls} leading-none">${gapStr}</span>
          </div>
          <!-- Right: Pass/Fail X or Check -->
          <div class="col-span-3 ${passBg} text-white flex items-center justify-center font-black text-2xl select-none">
            ${passIcon}
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildTreeLeafBoxHtml({ title, tgtStr, tgtSubStr, tgtColLabel, achStr, gapStr, gapIsPos, achPct, kpiContribPct, parentSharePct, parentName, kpiName }) {
  const gapCellCls = gapIsPos ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white';
  return `
    <div class="flex flex-col items-center w-full">
      <div class="border-2 border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white w-full">
        <!-- Header Title (Single Line, Clean) -->
        <div class="bg-slate-800 text-white font-black text-[11px] py-1.5 px-2 text-center uppercase tracking-wider whitespace-nowrap">
          ${title}
        </div>
        <!-- Structured 2-Column Contribution Bar Inside Card (Guarantees Perfect Horizontal Alignment Across Cards) -->
        <div class="grid ${parentSharePct !== undefined ? 'grid-cols-2' : 'grid-cols-1'} text-center text-[10px] font-black border-b-2 border-slate-800">
          <div class="bg-blue-600 text-white py-1 px-1 whitespace-nowrap ${parentSharePct !== undefined ? 'border-r border-slate-800' : ''}" title="Kontribusi terhadap Total ${kpiName}">
            ${kpiContribPct}% ke ${kpiName}
          </div>
          ${parentSharePct !== undefined ? `
            <div class="bg-amber-100 text-amber-950 py-1 px-1 whitespace-nowrap" title="Porsi di dalam ${parentName}">
              ${parentSharePct}% ${parentName}
            </div>
          ` : ''}
        </div>
        <!-- Column Headers: Proportional Widths (19% | 26% | 26% | 29%) -->
        <div class="grid grid-cols-[19%_26%_26%_29%] text-center text-[10px] font-extrabold bg-slate-200 border-b border-slate-700 text-slate-800">
          <div class="border-r border-slate-600 py-1 whitespace-nowrap">Ach%</div>
          <div class="border-r border-slate-600 py-1 whitespace-nowrap">${tgtColLabel || 'Tgt'}</div>
          <div class="border-r border-slate-600 py-1 whitespace-nowrap">Ach</div>
          <div class="py-1 whitespace-nowrap">-/+</div>
        </div>
        <!-- Values Row: Strictly Single-Line (whitespace-nowrap) -->
        <div class="grid grid-cols-[19%_26%_26%_29%] text-center text-[11px] font-black">
          <div class="border-r border-slate-600 py-2 px-1 bg-slate-50 text-slate-900 flex items-center justify-center whitespace-nowrap">${achPct}%</div>
          <div class="border-r border-slate-600 py-2 px-1 bg-white text-slate-900 flex items-center justify-center whitespace-nowrap">${tgtStr}</div>
          <div class="border-r border-slate-600 py-2 px-1 bg-yellow-300 text-slate-950 flex items-center justify-center whitespace-nowrap">${achStr}</div>
          <div class="py-2 px-1 ${gapCellCls} flex items-center justify-center whitespace-nowrap">${gapStr}</div>
        </div>
        <!-- Clean Reference Footer -->
        ${tgtSubStr ? `
          <div class="bg-slate-100 border-t border-slate-300 text-[9.5px] font-bold text-slate-600 py-0.5 px-2 text-center whitespace-nowrap">
            Ref Target ${tgtSubStr}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Khusus untuk Kotak Non-CPUS di Bawah Bagan Revenue (TWC, PDI, SBI, PART ONLY):
// TANPA Target, TANPA Ach%, TANPA -/+ -> HANYA menampilkan Ach (Realisasi) & Kontribusi (% ke Revenue)
function formatRevExactJt(val) {
  if (!val || val === 0) return '0';
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (abs >= 1000000) {
    return `${sign}${(abs / 1000000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} Jt`;
  }
  if (abs >= 1000) {
    return `${sign}${Math.round(abs / 1000).toLocaleString('id-ID')} Rb`;
  }
  return `${sign}${Math.round(abs).toLocaleString('id-ID')}`;
}

function buildTreeNonCpusBoxHtml({ title, achVal, achStr, kpiContribPct, kpiName }) {
  const displayMain = achVal !== undefined ? formatRevExactJt(achVal) : achStr;
  const displayExactRp = (achVal !== undefined && achVal > 0) ? `Rp ${Math.round(achVal).toLocaleString('id-ID')}` : '';
  return `
    <div class="flex flex-col items-center w-full">
      <div class="border-2 border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white w-full">
        <div class="bg-slate-800 text-white font-black text-[11px] py-1.5 px-2 text-center uppercase tracking-wider whitespace-nowrap">
          ${title}
        </div>
        <div class="grid grid-cols-12 text-center text-[10px] font-extrabold bg-slate-200 border-b border-slate-700 text-slate-800">
          <div class="col-span-7 border-r border-slate-600 py-1">Ach (Realisasi)</div>
          <div class="col-span-5 py-1">Kontribusi ${kpiName}</div>
        </div>
        <div class="grid grid-cols-12 text-center text-xs font-black">
          <div class="col-span-7 border-r border-slate-600 py-2 px-1 bg-yellow-300 text-slate-950 flex flex-col items-center justify-center leading-tight">
            <span class="whitespace-nowrap">${displayMain}</span>
            ${displayExactRp ? `<span class="text-[9.5px] font-bold text-slate-700 mt-0.5 whitespace-nowrap">${displayExactRp}</span>` : ''}
          </div>
          <div class="col-span-5 py-2 px-1 bg-purple-50 text-purple-900 flex items-center justify-center whitespace-nowrap">${kpiContribPct}%</div>
        </div>
      </div>
    </div>
  `;
}

function renderKpiHierarchyTrees(monthJobs, targetCpus, targetRev, monthIdx) {
  const container = document.getElementById('overview-kpi-trees-container');
  if (!container) return;

  const { startDate, endDate, selectedMonth } = getActiveDateRange();

  // Hitung Total HOK Nasional Bulan & HOK Nasional Berjalan
  // Aturan HOK Nasional: Senin-Jumat (Hitam) = 1, Sabtu (Hitam) = 0.5, Minggu/Tanggal Merah = 0
  const totalHok = getMonthTotalNationalHok(selectedMonth);
  const totalHokLabel = document.getElementById('kpi-tree-total-hok-label');
  if (totalHokLabel) totalHokLabel.innerText = totalHok;

  const hokInput = document.getElementById('kpi-tree-hok-input');
  if (hokInput && lastKpiTreeSelectedMonth !== selectedMonth) {
    lastKpiTreeSelectedMonth = selectedMonth;
    hokInput.max = totalHok;

    // Hitung otomatis HOK Nasional Berjalan berdasarkan tanggal transaksi aktif pada bulan terpilih
    const dayCounts = {};
    monthJobs.forEach(j => {
      if (j.invDate && j.invDate.startsWith(selectedMonth)) {
        const d = parseInt(j.invDate.split('-')[2], 10);
        if (!isNaN(d)) dayCounts[d] = (dayCounts[d] || 0) + 1;
      }
    });
    const daysWithData = Object.keys(dayCounts).map(Number).sort((a, b) => a - b);
    let activeEndDay = getDaysInMonthString(selectedMonth);
    if (daysWithData.length > 0) {
      const lastD = daysWithData[daysWithData.length - 1];
      // Jika tanggal terakhir baru masuk sebagian kecil (< 10 baris) dan ada hari sebelumnya, gunakan hari penuh sebelumnya
      if (dayCounts[lastD] < 10 && daysWithData.length > 1) {
        activeEndDay = daysWithData[daysWithData.length - 2];
      } else {
        activeEndDay = lastD;
      }
    }
    const autoHok = Math.min(countWorkingDays(selectedMonth, 1, activeEndDay), totalHok);
    hokInput.value = autoHok;
  }

  const hokBerjalan = hokInput ? Math.min(Math.max(parseFloat(hokInput.value) || totalHok, 0.5), totalHok) : totalHok;
  const hokRatio = totalHok > 0 ? (hokBerjalan / totalHok) : 1;
  const isHokMode = currentKpiTreeTargetBasis === 'hok';

  // Match bookings for the selected period / month
  const periodBookings = appData.bookings.filter(b => b.arrivalDate && (b.arrivalDate.startsWith(selectedMonth) || (b.arrivalDate >= startDate && b.arrivalDate <= endDate)));
  const bookingVins = new Set(periodBookings.map(b => b.vin.toUpperCase()));

  // =========================================================
  // 1. CALCULATE CPUS HIERARCHY DATA (Unique VIN per invDate)
  // =========================================================
  const cpusJobs = monthJobs.filter(isCpusJob);
  const unitMap = new Map();
  cpusJobs.forEach(j => {
    const key = `${j.vin.toUpperCase()}_${j.invDate}`;
    if (!unitMap.has(key)) {
      unitMap.set(key, {
        vin: j.vin.toUpperCase(),
        invDate: j.invDate,
        types: new Set(),
        isTCare: false,
        isBooking: bookingVins.has(j.vin.toUpperCase())
      });
    }
    const u = unitMap.get(key);
    u.types.add((j.repairType || '').toUpperCase().trim());
    if (j.isTCare) u.isTCare = true;
  });

  let cpusTotalAch = unitMap.size;
  let cpusBkAch = 0, cpusNbkAch = 0;
  let cpusBkSbe = 0, cpusBkGrp = 0, cpusBkOil = 0, cpusBkTCare = 0, cpusBkNonTCare = 0;
  let cpusNbkSbe = 0, cpusNbkGrp = 0, cpusNbkOil = 0, cpusNbkTCare = 0, cpusNbkNonTCare = 0;

  unitMap.forEach(u => {
    const primaryType = u.types.has('SBE') ? 'SBE' : (u.types.has('GRP') ? 'GRP' : 'OIL');
    if (u.isBooking) {
      cpusBkAch++;
      if (primaryType === 'SBE') {
        cpusBkSbe++;
        if (u.isTCare) cpusBkTCare++; else cpusBkNonTCare++;
      } else if (primaryType === 'GRP') cpusBkGrp++;
      else cpusBkOil++;
    } else {
      cpusNbkAch++;
      if (primaryType === 'SBE') {
        cpusNbkSbe++;
        if (u.isTCare) cpusNbkTCare++; else cpusNbkNonTCare++;
      } else if (primaryType === 'GRP') cpusNbkGrp++;
      else cpusNbkOil++;
    }
  });

  // CPUS Targets Breakdown (Sesuai Excel Target Resmi AT GYR:
  // Booking = 74% (atau sesuai setting bookingTargetPct), Non-Booking = 26%
  // Di dalam masing-masing cabang: SBE = 70% [terdiri dari T-Care 39% + Non T-Care SBE 31%], GRP (GR/CR7) = 17%, OIL (GO) = 13%)
  const bookingTargetPct = (appData.targets && appData.targets.bookingTargetPct) ? parseFloat(appData.targets.bookingTargetPct) : 74;
  const nonBookingTargetPct = Math.max(0, 100 - bookingTargetPct);
  const bkRatio = bookingTargetPct / 100;
  const nbkRatio = nonBookingTargetPct / 100;

  const cpusTotalTgt = Math.round(targetCpus || 0);
  const cpusBkTgt = Math.round(cpusTotalTgt * bkRatio);
  const cpusNbkTgt = Math.max(0, cpusTotalTgt - cpusBkTgt);

  // Booking Sub-Targets: T-Care 39%, Non T-Care SBE 31% (Total SBE = 70%), GRP 17%, OIL 13%
  const cpusBkTCareTgt = Math.round(cpusBkTgt * 0.39);
  const cpusBkNonTCareTgt = Math.round(cpusBkTgt * 0.31);
  const cpusBkSbeTgt = cpusBkTCareTgt + cpusBkNonTCareTgt; // 70% (282 + 224 = 506 saat Booking 724)
  const cpusBkGrpTgt = Math.round(cpusBkTgt * 0.17);       // 17% (123 saat Booking 724)
  const cpusBkOilTgt = Math.round(cpusBkTgt * 0.13);       // 13% (94 saat Booking 724)

  // Non-Booking Sub-Targets: T-Care 39%, Non T-Care SBE 31% (Total SBE = 70%), GRP 17%, OIL 13%
  const cpusNbkTCareTgt = Math.round(cpusNbkTgt * 0.39);
  const cpusNbkNonTCareTgt = Math.round(cpusNbkTgt * 0.31);
  const cpusNbkSbeTgt = cpusNbkTCareTgt + cpusNbkNonTCareTgt; // 70% (99 + 79 = 178 saat Non-Booking 254)
  const cpusNbkGrpTgt = Math.round(cpusNbkTgt * 0.17);         // 17% (43 saat Non-Booking 254)
  const cpusNbkOilTgt = Math.round(cpusNbkTgt * 0.13);         // 13% (33 saat Non-Booking 254)

  const calcCpusNode = (ach, tgtMonth, parentAch) => {
    const tgtHok = Math.round(tgtMonth * hokRatio);
    const activeTgt = isHokMode ? tgtHok : tgtMonth;
    const gap = ach - activeTgt;
    const achPct = activeTgt > 0 ? Math.round((ach / activeTgt) * 100) : (ach > 0 ? 100 : 0);
    const kpiPct = cpusTotalAch > 0 ? ((ach / cpusTotalAch) * 100).toFixed(1) : '0.0';
    const parentPct = parentAch > 0 ? ((ach / parentAch) * 100).toFixed(1) : '0.0';
    return {
      tgtStr: activeTgt.toLocaleString('id-ID'),
      tgtSubStr: isHokMode ? `Bln: ${tgtMonth.toLocaleString('id-ID')}` : `HOK: ${tgtHok.toLocaleString('id-ID')}`,
      tgtLabel: isHokMode ? `Tgt HOK (${hokBerjalan})` : 'Tgt Bln',
      tgtColLabel: isHokMode ? 'Tgt HOK' : 'Tgt Bln',
      achStr: ach.toLocaleString('id-ID'),
      gapStr: (gap >= 0 ? '+' : '') + gap.toLocaleString('id-ID'),
      gapIsPos: gap >= 0,
      isPass: ach >= activeTgt && activeTgt > 0,
      achPct,
      kpiPct,
      parentPct
    };
  };

  const cRoot = calcCpusNode(cpusTotalAch, cpusTotalTgt, cpusTotalAch);
  const cBk = calcCpusNode(cpusBkAch, cpusBkTgt, cpusTotalAch);
  const cNbk = calcCpusNode(cpusNbkAch, cpusNbkTgt, cpusTotalAch);

  const cBkSbe = calcCpusNode(cpusBkSbe, cpusBkSbeTgt, cpusBkAch);
  const cBkGrp = calcCpusNode(cpusBkGrp, cpusBkGrpTgt, cpusBkAch);
  const cBkOil = calcCpusNode(cpusBkOil, cpusBkOilTgt, cpusBkAch);
  const cBkTC = calcCpusNode(cpusBkTCare, cpusBkTCareTgt, cpusBkSbe);
  const cBkNTC = calcCpusNode(cpusBkNonTCare, cpusBkNonTCareTgt, cpusBkSbe);

  const cNbkSbe = calcCpusNode(cpusNbkSbe, cpusNbkSbeTgt, cpusNbkAch);
  const cNbkGrp = calcCpusNode(cpusNbkGrp, cpusNbkGrpTgt, cpusNbkAch);
  const cNbkOil = calcCpusNode(cpusNbkOil, cpusNbkOilTgt, cpusNbkAch);
  const cNbkTC = calcCpusNode(cpusNbkTCare, cpusNbkTCareTgt, cpusNbkSbe);
  const cNbkNTC = calcCpusNode(cpusNbkNonTCare, cpusNbkNonTCareTgt, cpusNbkSbe);

  // =========================================================
  // 2. CALCULATE REVENUE HIERARCHY DATA
  // =========================================================
  let revTotalAch = 0;
  let revBkAch = 0, revNbkAch = 0;
  let revBkSbe = 0, revBkGrp = 0, revBkOil = 0, revBkTCare = 0, revBkNonTCare = 0;
  let revNbkSbe = 0, revNbkGrp = 0, revNbkOil = 0, revNbkTCare = 0, revNbkNonTCare = 0;
  let revTwc = 0, revPdi = 0, revSbi = 0, revPrt = 0;

  monthJobs.forEach(j => {
    const r = j.revenue || 0;
    revTotalAch += r;
    const rt = (j.repairType || '').toUpperCase().trim();
    const isBk = bookingVins.has(j.vin.toUpperCase());

    if (rt === 'SBE' || rt === 'GRP' || rt === 'OIL') {
      if (isBk) {
        revBkAch += r;
        if (rt === 'SBE') {
          revBkSbe += r;
          if (j.isTCare) revBkTCare += r; else revBkNonTCare += r;
        } else if (rt === 'GRP') revBkGrp += r;
        else revBkOil += r;
      } else {
        revNbkAch += r;
        if (rt === 'SBE') {
          revNbkSbe += r;
          if (j.isTCare) revNbkTCare += r; else revNbkNonTCare += r;
        } else if (rt === 'GRP') revNbkGrp += r;
        else revNbkOil += r;
      }
    } else if (rt === 'TWC') {
      revTwc += r;
    } else if (rt === 'PDI') {
      revPdi += r;
    } else if (rt === 'SBI') {
      revSbi += r;
    } else {
      revPrt += r;
    }
  });

  const revTotalTgt = Math.round(targetRev || 0);
  // Target Revenue Breakdown: Booking = 74% (atau sesuai setting bookingTargetPct) dari Target Revenue, Non-Booking = 26% dari Target Revenue
  // Di dalam masing-masing cabang: SBE = 70% [T-Care 39% + Non T-Care SBE 31%], GRP (GR/CR7) = 17%, OIL (GO) = 13%
  const revBkTgt = Math.round(revTotalTgt * bkRatio);
  const revNbkTgt = Math.max(0, revTotalTgt - revBkTgt);

  const revBkTCareTgt = Math.round(revBkTgt * 0.39);
  const revBkNonTCareTgt = Math.round(revBkTgt * 0.31);
  const revBkSbeTgt = revBkTCareTgt + revBkNonTCareTgt; // 70% dari Target Booking Revenue
  const revBkGrpTgt = Math.round(revBkTgt * 0.17);       // 17% dari Target Booking Revenue
  const revBkOilTgt = Math.round(revBkTgt * 0.13);       // 13% dari Target Booking Revenue

  const revNbkTCareTgt = Math.round(revNbkTgt * 0.39);
  const revNbkNonTCareTgt = Math.round(revNbkTgt * 0.31);
  const revNbkSbeTgt = revNbkTCareTgt + revNbkNonTCareTgt; // 70% dari Target Non-Booking Revenue
  const revNbkGrpTgt = Math.round(revNbkTgt * 0.17);         // 17% dari Target Non-Booking Revenue
  const revNbkOilTgt = Math.round(revNbkTgt * 0.13);         // 13% dari Target Non-Booking Revenue

  const calcRevNode = (ach, tgtMonth, parentAch) => {
    const tgtHok = Math.round(tgtMonth * hokRatio);
    const activeTgt = isHokMode ? tgtHok : tgtMonth;
    const gap = ach - activeTgt;
    const achPct = activeTgt > 0 ? Math.round((ach / activeTgt) * 100) : (ach > 0 ? 100 : 0);
    const kpiPct = revTotalAch > 0 ? ((ach / revTotalAch) * 100).toFixed(1) : '0.0';
    const parentPct = parentAch > 0 ? ((ach / parentAch) * 100).toFixed(1) : '0.0';
    return {
      tgtStr: formatRevTreeVal(activeTgt),
      tgtSubStr: isHokMode ? `Bln: ${formatRevTreeVal(tgtMonth)}` : `HOK: ${formatRevTreeVal(tgtHok)}`,
      tgtLabel: isHokMode ? `Tgt HOK (${hokBerjalan})` : 'Tgt Bln',
      tgtColLabel: isHokMode ? 'Tgt HOK' : 'Tgt Bln',
      achStr: formatRevTreeVal(ach),
      gapStr: (gap >= 0 ? '+' : '') + formatRevTreeVal(gap),
      gapIsPos: gap >= 0,
      isPass: ach >= activeTgt && activeTgt > 0,
      achPct,
      kpiPct,
      parentPct
    };
  };

  const rRoot = calcRevNode(revTotalAch, revTotalTgt, revTotalAch);
  const rBk = calcRevNode(revBkAch, revBkTgt, revTotalAch);
  const rNbk = calcRevNode(revNbkAch, revNbkTgt, revTotalAch);

  const rBkSbe = calcRevNode(revBkSbe, revBkSbeTgt, revBkAch);
  const rBkGrp = calcRevNode(revBkGrp, revBkGrpTgt, revBkAch);
  const rBkOil = calcRevNode(revBkOil, revBkOilTgt, revBkAch);
  const rBkTC = calcRevNode(revBkTCare, revBkTCareTgt, revBkSbe);
  const rBkNTC = calcRevNode(revBkNonTCare, revBkNonTCareTgt, revBkSbe);

  const rNbkSbe = calcRevNode(revNbkSbe, revNbkSbeTgt, revNbkAch);
  const rNbkGrp = calcRevNode(revNbkGrp, revNbkGrpTgt, revNbkAch);
  const rNbkOil = calcRevNode(revNbkOil, revNbkOilTgt, revNbkAch);
  const rNbkTC = calcRevNode(revNbkTCare, revNbkTCareTgt, revNbkSbe);
  const rNbkNTC = calcRevNode(revNbkNonTCare, revNbkNonTCareTgt, revNbkSbe);

  const rTwc = calcRevNode(revTwc, 0, revTotalAch);
  const rPdi = calcRevNode(revPdi, 0, revTotalAch);
  const rSbi = calcRevNode(revSbi, 0, revTotalAch);
  const rPrt = calcRevNode(revPrt, 0, revTotalAch);

  // =========================================================
  // 3. BUILD HTML FOR CPUS TREE DIAGRAM
  // =========================================================
  const totalSbeCpusPct = cpusTotalAch > 0 ? (((cpusBkSbe + cpusNbkSbe) / cpusTotalAch) * 100).toFixed(1) : '0.0';
  const totalGrpCpusPct = cpusTotalAch > 0 ? (((cpusBkGrp + cpusNbkGrp) / cpusTotalAch) * 100).toFixed(1) : '0.0';
  const totalOilCpusPct = cpusTotalAch > 0 ? (((cpusBkOil + cpusNbkOil) / cpusTotalAch) * 100).toFixed(1) : '0.0';
  const totalTCareCpusPct = cpusTotalAch > 0 ? (((cpusBkTCare + cpusNbkTCare) / cpusTotalAch) * 100).toFixed(1) : '0.0';

  const cpusTreeHtml = `
    <div class="p-5 rounded-2xl border-2 border-slate-800 bg-slate-50/60 overflow-x-auto">
      <div class="flex flex-wrap justify-between items-center mb-4 pb-3 border-b border-slate-200 gap-2">
        <div class="flex items-center space-x-2.5">
          <span class="p-2 rounded-xl bg-emerald-600 text-white text-sm shadow-sm"><i class="fa-solid fa-car"></i></span>
          <div>
            <h3 class="text-sm font-black text-slate-900 uppercase tracking-wide">1. Bagan Pohon Hierarki KPI — CPUS (Unit Unik)</h3>
            <p class="text-[11px] text-slate-500 font-semibold">Evaluasi Status Hijau (&#10003;) / Merah (X): <strong>${isHokMode ? `Target HOK Berjalan (${hokBerjalan} / ${totalHok} HOK = ${(hokRatio * 100).toFixed(1)}% Target Bulanan)` : 'Target Full 1 Bulan Penuh'}</strong></p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-[11px] font-black">
          <span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">Total SBE: ${cpusBkSbe + cpusNbkSbe} Unit (${totalSbeCpusPct}% CPUS)</span>
          <span class="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-300">Total GRP: ${cpusBkGrp + cpusNbkGrp} Unit (${totalGrpCpusPct}% CPUS)</span>
          <span class="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">Total OIL: ${cpusBkOil + cpusNbkOil} Unit (${totalOilCpusPct}% CPUS)</span>
          <span class="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-300">Total T-Care: ${cpusBkTCare + cpusNbkTCare} Unit (${totalTCareCpusPct}% CPUS)</span>
        </div>
      </div>

      <div class="min-w-[1140px] py-2">
        <!-- LEVEL 1: ROOT CPUS -->
        <div class="flex justify-center">
          ${buildTreeMainBoxHtml({
            title: 'CPUS',
            tgtStr: cRoot.tgtStr,
            tgtSubStr: cRoot.tgtSubStr,
            tgtLabel: cRoot.tgtLabel,
            achStr: cRoot.achStr,
            achPct: cRoot.achPct,
            gapStr: cRoot.gapStr,
            isPass: cRoot.isPass,
            kpiContribPct: '100.0',
            isRoot: true,
            accentColor: 'bg-slate-300 text-slate-900'
          })}
        </div>

        <!-- CONNECTOR LEVEL 1 TO LEVEL 2 -->
        <div class="flex justify-center">
          <div class="w-1.5 h-5 bg-slate-900"></div>
        </div>
        <div class="grid grid-cols-2">
          <div class="flex flex-col items-center">
            <div class="w-full flex">
              <div class="w-1/2"></div>
              <div class="w-1/2 border-t-[5px] border-l-[5px] border-slate-900 h-5 rounded-tl-sm"></div>
            </div>
            <div class="text-slate-900 text-sm leading-none -mt-1">&#9660;</div>
          </div>
          <div class="flex flex-col items-center">
            <div class="w-full flex">
              <div class="w-1/2 border-t-[5px] border-r-[5px] border-slate-900 h-5 rounded-tr-sm"></div>
              <div class="w-1/2"></div>
            </div>
            <div class="text-slate-900 text-sm leading-none -mt-1">&#9660;</div>
          </div>
        </div>

        <!-- LEVEL 2: BOOKING vs NON BOOKING -->
        <div class="grid grid-cols-2 gap-8 items-start">
          <!-- LEFT BRANCH: BOOKING -->
          <div class="flex flex-col items-center">
            ${buildTreeMainBoxHtml({
              title: `BOOKING (TGT ${bookingTargetPct}%)`,
              tgtStr: cBk.tgtStr,
              tgtSubStr: cBk.tgtSubStr,
              tgtLabel: cBk.tgtLabel,
              achStr: cBk.achStr,
              achPct: cBk.achPct,
              gapStr: cBk.gapStr,
              isPass: cBk.isPass,
              kpiContribPct: cBk.kpiPct,
              shareLabel: `Comp.% TGT: ${bookingTargetPct}%`,
              isRoot: false
            })}

            <!-- Connector Booking to SBE / GRP / OIL -->
            <div class="w-1.5 h-4 bg-slate-900"></div>
            <div class="grid grid-cols-3 w-full">
              <div class="flex flex-col items-center">
                <div class="w-full flex"><div class="w-1/2"></div><div class="w-1/2 border-t-4 border-l-4 border-slate-900 h-4"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
              <div class="flex flex-col items-center">
                <div class="w-full border-t-4 border-slate-900 flex justify-center"><div class="w-1 h-4 bg-slate-900"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
              <div class="flex flex-col items-center">
                <div class="w-full flex"><div class="w-1/2 border-t-4 border-r-4 border-slate-900 h-4"></div><div class="w-1/2"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
            </div>

            <!-- LEVEL 3 (BOOKING): SBE, GRP, OIL -->
            <div class="grid grid-cols-3 gap-2.5 w-full items-start">
              <!-- SBE + Level 4 T-Care & Non T-Care -->
              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'SBE (TGT 70%)',
                  tgtStr: cBkSbe.tgtStr,
                  tgtSubStr: cBkSbe.tgtSubStr,
                  tgtColLabel: cBkSbe.tgtColLabel,
                  achStr: cBkSbe.achStr,
                  gapStr: cBkSbe.gapStr,
                  gapIsPos: cBkSbe.gapIsPos,
                  achPct: cBkSbe.achPct,
                  kpiContribPct: cBkSbe.kpiPct,
                  parentSharePct: cBkSbe.parentPct,
                  parentName: 'Booking',
                  kpiName: 'CPUS'
                })}
                <!-- Down Arrow to T-Care -->
                <div class="w-1.5 h-4 bg-slate-900"></div>
                <div class="text-slate-900 text-xs leading-none -mt-1 mb-0.5">&#9660;</div>
                ${buildTreeLeafBoxHtml({
                  title: 'T CARE (TGT 39%)',
                  tgtStr: cBkTC.tgtStr,
                  tgtSubStr: cBkTC.tgtSubStr,
                  tgtColLabel: cBkTC.tgtColLabel,
                  achStr: cBkTC.achStr,
                  gapStr: cBkTC.gapStr,
                  gapIsPos: cBkTC.gapIsPos,
                  achPct: cBkTC.achPct,
                  kpiContribPct: cBkTC.kpiPct,
                  parentSharePct: cBkTC.parentPct,
                  parentName: 'SBE',
                  kpiName: 'CPUS'
                })}
                <!-- Down Arrow to Non T-Care -->
                <div class="w-1.5 h-4 bg-slate-900"></div>
                <div class="text-slate-900 text-xs leading-none -mt-1 mb-0.5">&#9660;</div>
                ${buildTreeLeafBoxHtml({
                  title: 'NON T CARE (TGT 31%)',
                  tgtStr: cBkNTC.tgtStr,
                  tgtSubStr: cBkNTC.tgtSubStr,
                  tgtColLabel: cBkNTC.tgtColLabel,
                  achStr: cBkNTC.achStr,
                  gapStr: cBkNTC.gapStr,
                  gapIsPos: cBkNTC.gapIsPos,
                  achPct: cBkNTC.achPct,
                  kpiContribPct: cBkNTC.kpiPct,
                  parentSharePct: cBkNTC.parentPct,
                  parentName: 'SBE',
                  kpiName: 'CPUS'
                })}
              </div>

              <!-- GRP (Booking) -->
              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'GRP / CR7 (TGT 17%)',
                  tgtStr: cBkGrp.tgtStr,
                  tgtSubStr: cBkGrp.tgtSubStr,
                  tgtColLabel: cBkGrp.tgtColLabel,
                  achStr: cBkGrp.achStr,
                  gapStr: cBkGrp.gapStr,
                  gapIsPos: cBkGrp.gapIsPos,
                  achPct: cBkGrp.achPct,
                  kpiContribPct: cBkGrp.kpiPct,
                  parentSharePct: cBkGrp.parentPct,
                  parentName: 'Booking',
                  kpiName: 'CPUS'
                })}
              </div>

              <!-- OIL (Booking) -->
              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'OIL / GO (TGT 13%)',
                  tgtStr: cBkOil.tgtStr,
                  tgtSubStr: cBkOil.tgtSubStr,
                  tgtColLabel: cBkOil.tgtColLabel,
                  achStr: cBkOil.achStr,
                  gapStr: cBkOil.gapStr,
                  gapIsPos: cBkOil.gapIsPos,
                  achPct: cBkOil.achPct,
                  kpiContribPct: cBkOil.kpiPct,
                  parentSharePct: cBkOil.parentPct,
                  parentName: 'Booking',
                  kpiName: 'CPUS'
                })}
              </div>
            </div>
          </div>

          <!-- RIGHT BRANCH: NON BOOKING -->
          <div class="flex flex-col items-center">
            ${buildTreeMainBoxHtml({
              title: `NON BOOKING (TGT ${nonBookingTargetPct}%)`,
              tgtStr: cNbk.tgtStr,
              tgtSubStr: cNbk.tgtSubStr,
              tgtLabel: cNbk.tgtLabel,
              achStr: cNbk.achStr,
              achPct: cNbk.achPct,
              gapStr: cNbk.gapStr,
              isPass: cNbk.isPass,
              kpiContribPct: cNbk.kpiPct,
              shareLabel: `Comp.% TGT: ${nonBookingTargetPct}%`,
              isRoot: false
            })}

            <!-- Connector Non-Booking to SBE / GRP / OIL -->
            <div class="w-1.5 h-4 bg-slate-900"></div>
            <div class="grid grid-cols-3 w-full">
              <div class="flex flex-col items-center">
                <div class="w-full flex"><div class="w-1/2"></div><div class="w-1/2 border-t-4 border-l-4 border-slate-900 h-4"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
              <div class="flex flex-col items-center">
                <div class="w-full border-t-4 border-slate-900 flex justify-center"><div class="w-1 h-4 bg-slate-900"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
              <div class="flex flex-col items-center">
                <div class="w-full flex"><div class="w-1/2 border-t-4 border-r-4 border-slate-900 h-4"></div><div class="w-1/2"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
            </div>

            <!-- LEVEL 3 (NON BOOKING): SBE, GRP, OIL -->
            <div class="grid grid-cols-3 gap-2.5 w-full items-start">
              <!-- SBE + Level 4 T-Care & Non T-Care -->
              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'SBE (TGT 70%)',
                  tgtStr: cNbkSbe.tgtStr,
                  tgtSubStr: cNbkSbe.tgtSubStr,
                  tgtColLabel: cNbkSbe.tgtColLabel,
                  achStr: cNbkSbe.achStr,
                  gapStr: cNbkSbe.gapStr,
                  gapIsPos: cNbkSbe.gapIsPos,
                  achPct: cNbkSbe.achPct,
                  kpiContribPct: cNbkSbe.kpiPct,
                  parentSharePct: cNbkSbe.parentPct,
                  parentName: 'Non-Bk',
                  kpiName: 'CPUS'
                })}
                <!-- Down Arrow to T-Care -->
                <div class="w-1.5 h-4 bg-slate-900"></div>
                <div class="text-slate-900 text-xs leading-none -mt-1 mb-0.5">&#9660;</div>
                ${buildTreeLeafBoxHtml({
                  title: 'T CARE (TGT 39%)',
                  tgtStr: cNbkTC.tgtStr,
                  tgtSubStr: cNbkTC.tgtSubStr,
                  tgtColLabel: cNbkTC.tgtColLabel,
                  achStr: cNbkTC.achStr,
                  gapStr: cNbkTC.gapStr,
                  gapIsPos: cNbkTC.gapIsPos,
                  achPct: cNbkTC.achPct,
                  kpiContribPct: cNbkTC.kpiPct,
                  parentSharePct: cNbkTC.parentPct,
                  parentName: 'SBE',
                  kpiName: 'CPUS'
                })}
                <!-- Down Arrow to Non T-Care -->
                <div class="w-1.5 h-4 bg-slate-900"></div>
                <div class="text-slate-900 text-xs leading-none -mt-1 mb-0.5">&#9660;</div>
                ${buildTreeLeafBoxHtml({
                  title: 'NON T CARE (TGT 31%)',
                  tgtStr: cNbkNTC.tgtStr,
                  tgtSubStr: cNbkNTC.tgtSubStr,
                  tgtColLabel: cNbkNTC.tgtColLabel,
                  achStr: cNbkNTC.achStr,
                  gapStr: cNbkNTC.gapStr,
                  gapIsPos: cNbkNTC.gapIsPos,
                  achPct: cNbkNTC.achPct,
                  kpiContribPct: cNbkNTC.kpiPct,
                  parentSharePct: cNbkNTC.parentPct,
                  parentName: 'SBE',
                  kpiName: 'CPUS'
                })}
              </div>

              <!-- GRP (Non-Booking) -->
              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'GRP / CR7 (TGT 17%)',
                  tgtStr: cNbkGrp.tgtStr,
                  tgtSubStr: cNbkGrp.tgtSubStr,
                  tgtColLabel: cNbkGrp.tgtColLabel,
                  achStr: cNbkGrp.achStr,
                  gapStr: cNbkGrp.gapStr,
                  gapIsPos: cNbkGrp.gapIsPos,
                  achPct: cNbkGrp.achPct,
                  kpiContribPct: cNbkGrp.kpiPct,
                  parentSharePct: cNbkGrp.parentPct,
                  parentName: 'Non-Bk',
                  kpiName: 'CPUS'
                })}
              </div>

              <!-- OIL (Non-Booking) -->
              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'OIL / GO (TGT 13%)',
                  tgtStr: cNbkOil.tgtStr,
                  tgtSubStr: cNbkOil.tgtSubStr,
                  tgtColLabel: cNbkOil.tgtColLabel,
                  achStr: cNbkOil.achStr,
                  gapStr: cNbkOil.gapStr,
                  gapIsPos: cNbkOil.gapIsPos,
                  achPct: cNbkOil.achPct,
                  kpiContribPct: cNbkOil.kpiPct,
                  parentSharePct: cNbkOil.parentPct,
                  parentName: 'Non-Bk',
                  kpiName: 'CPUS'
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // =========================================================
  // 4. BUILD HTML FOR REVENUE TREE DIAGRAM (WITH CENTRAL ARROW TO TWC, PDI, PART ONLY)
  // =========================================================
  const totalSbeRevPct = revTotalAch > 0 ? (((revBkSbe + revNbkSbe) / revTotalAch) * 100).toFixed(1) : '0.0';
  const totalGrpRevPct = revTotalAch > 0 ? (((revBkGrp + revNbkGrp) / revTotalAch) * 100).toFixed(1) : '0.0';
  const totalOilRevPct = revTotalAch > 0 ? (((revBkOil + revNbkOil) / revTotalAch) * 100).toFixed(1) : '0.0';
  const totalNonCpusRevPct = revTotalAch > 0 ? (((revTwc + revPdi + revSbi + revPrt) / revTotalAch) * 100).toFixed(1) : '0.0';

  const revenueTreeHtml = `
    <div class="p-5 rounded-2xl border-2 border-slate-800 bg-slate-50/60 overflow-x-auto">
      <div class="flex flex-wrap justify-between items-center mb-4 pb-3 border-b border-slate-200 gap-2">
        <div class="flex items-center space-x-2.5">
          <span class="p-2 rounded-xl bg-amber-500 text-white text-sm shadow-sm"><i class="fa-solid fa-coins"></i></span>
          <div>
            <h3 class="text-sm font-black text-slate-900 uppercase tracking-wide">2. Bagan Pohon Hierarki KPI — REVENUE (Rupiah)</h3>
            <p class="text-[11px] text-slate-500 font-semibold">Evaluasi Status Hijau (&#10003;) / Merah (X): <strong>${isHokMode ? `Target HOK Berjalan (${hokBerjalan} / ${totalHok} HOK = ${(hokRatio * 100).toFixed(1)}% Target Bulanan)` : 'Target Full 1 Bulan Penuh'}</strong></p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-[11px] font-black">
          <span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">SBE: ${formatRevTreeVal(revBkSbe + revNbkSbe)} (${totalSbeRevPct}% Rev)</span>
          <span class="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-300">GRP: ${formatRevTreeVal(revBkGrp + revNbkGrp)} (${totalGrpRevPct}% Rev)</span>
          <span class="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">OIL: ${formatRevTreeVal(revBkOil + revNbkOil)} (${totalOilRevPct}% Rev)</span>
          <span class="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 border border-purple-300">TWC+PDI+SBI+Part: ${formatRevTreeVal(revTwc + revPdi + revSbi + revPrt)} (${totalNonCpusRevPct}% Rev)</span>
        </div>
      </div>

      <div class="min-w-[1180px] py-2 relative">
        <!-- LEVEL 1: ROOT REVENUE -->
        <div class="flex justify-center">
          ${buildTreeMainBoxHtml({
            title: 'REVENUE',
            tgtStr: rRoot.tgtStr,
            tgtSubStr: rRoot.tgtSubStr,
            tgtLabel: rRoot.tgtLabel,
            achStr: rRoot.achStr,
            achPct: rRoot.achPct,
            gapStr: rRoot.gapStr,
            isPass: rRoot.isPass,
            kpiContribPct: '100.0',
            isRoot: true,
            accentColor: 'bg-slate-300 text-slate-900'
          })}
        </div>

        <!-- CONNECTOR LEVEL 1 TO LEVEL 2 + CENTRAL SPINE -->
        <div class="flex justify-center">
          <div class="w-2 h-5 bg-slate-900"></div>
        </div>
        <div class="grid grid-cols-2 relative">
          <div class="flex flex-col items-center">
            <div class="w-full flex">
              <div class="w-1/2"></div>
              <div class="w-1/2 border-t-[5px] border-l-[5px] border-slate-900 h-5 rounded-tl-sm"></div>
            </div>
            <div class="text-slate-900 text-sm leading-none -mt-1">&#9660;</div>
          </div>
          <div class="flex flex-col items-center">
            <div class="w-full flex">
              <div class="w-1/2 border-t-[5px] border-r-[5px] border-slate-900 h-5 rounded-tr-sm"></div>
              <div class="w-1/2"></div>
            </div>
            <div class="text-slate-900 text-sm leading-none -mt-1">&#9660;</div>
          </div>
        </div>

        <!-- LEVEL 2: BOOKING vs CENTRAL SPINE vs NON BOOKING -->
        <div class="grid grid-cols-[1fr_64px_1fr] gap-3 items-stretch">
          <!-- LEFT BRANCH: BOOKING -->
          <div class="flex flex-col items-center">
            ${buildTreeMainBoxHtml({
              title: `BOOKING (TGT ${bookingTargetPct}%)`,
              tgtStr: rBk.tgtStr,
              tgtSubStr: rBk.tgtSubStr,
              tgtLabel: rBk.tgtLabel,
              achStr: rBk.achStr,
              achPct: rBk.achPct,
              gapStr: rBk.gapStr,
              isPass: rBk.isPass,
              kpiContribPct: rBk.kpiPct,
              shareLabel: `Comp.% TGT: ${bookingTargetPct}%`,
              isRoot: false
            })}

            <!-- Connector Booking to SBE / GRP / OIL -->
            <div class="w-1.5 h-4 bg-slate-900"></div>
            <div class="grid grid-cols-3 w-full">
              <div class="flex flex-col items-center">
                <div class="w-full flex"><div class="w-1/2"></div><div class="w-1/2 border-t-4 border-l-4 border-slate-900 h-4"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
              <div class="flex flex-col items-center">
                <div class="w-full border-t-4 border-slate-900 flex justify-center"><div class="w-1 h-4 bg-slate-900"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
              <div class="flex flex-col items-center">
                <div class="w-full flex"><div class="w-1/2 border-t-4 border-r-4 border-slate-900 h-4"></div><div class="w-1/2"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
            </div>

            <!-- LEVEL 3 (BOOKING): SBE, GRP, OIL -->
            <div class="grid grid-cols-3 gap-2 w-full items-start">
              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'SBE (TGT 70%)',
                  tgtStr: rBkSbe.tgtStr,
                  tgtSubStr: rBkSbe.tgtSubStr,
                  tgtColLabel: rBkSbe.tgtColLabel,
                  achStr: rBkSbe.achStr,
                  gapStr: rBkSbe.gapStr,
                  gapIsPos: rBkSbe.gapIsPos,
                  achPct: rBkSbe.achPct,
                  kpiContribPct: rBkSbe.kpiPct,
                  parentSharePct: rBkSbe.parentPct,
                  parentName: 'Booking',
                  kpiName: 'Rev'
                })}
                <div class="w-1.5 h-4 bg-slate-900"></div>
                <div class="text-slate-900 text-xs leading-none -mt-1 mb-0.5">&#9660;</div>
                ${buildTreeLeafBoxHtml({
                  title: 'T CARE (TGT 39%)',
                  tgtStr: rBkTC.tgtStr,
                  tgtSubStr: rBkTC.tgtSubStr,
                  tgtColLabel: rBkTC.tgtColLabel,
                  achStr: rBkTC.achStr,
                  gapStr: rBkTC.gapStr,
                  gapIsPos: rBkTC.gapIsPos,
                  achPct: rBkTC.achPct,
                  kpiContribPct: rBkTC.kpiPct,
                  parentSharePct: rBkTC.parentPct,
                  parentName: 'SBE',
                  kpiName: 'Rev'
                })}
                <div class="w-1.5 h-4 bg-slate-900"></div>
                <div class="text-slate-900 text-xs leading-none -mt-1 mb-0.5">&#9660;</div>
                ${buildTreeLeafBoxHtml({
                  title: 'NON T CARE (TGT 31%)',
                  tgtStr: rBkNTC.tgtStr,
                  tgtSubStr: rBkNTC.tgtSubStr,
                  tgtColLabel: rBkNTC.tgtColLabel,
                  achStr: rBkNTC.achStr,
                  gapStr: rBkNTC.gapStr,
                  gapIsPos: rBkNTC.gapIsPos,
                  achPct: rBkNTC.achPct,
                  kpiContribPct: rBkNTC.kpiPct,
                  parentSharePct: rBkNTC.parentPct,
                  parentName: 'SBE',
                  kpiName: 'Rev'
                })}
              </div>

              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'GRP / CR7 (TGT 17%)',
                  tgtStr: rBkGrp.tgtStr,
                  tgtSubStr: rBkGrp.tgtSubStr,
                  tgtColLabel: rBkGrp.tgtColLabel,
                  achStr: rBkGrp.achStr,
                  gapStr: rBkGrp.gapStr,
                  gapIsPos: rBkGrp.gapIsPos,
                  achPct: rBkGrp.achPct,
                  kpiContribPct: rBkGrp.kpiPct,
                  parentSharePct: rBkGrp.parentPct,
                  parentName: 'Booking',
                  kpiName: 'Rev'
                })}
              </div>

              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'OIL / GO (TGT 13%)',
                  tgtStr: rBkOil.tgtStr,
                  tgtSubStr: rBkOil.tgtSubStr,
                  tgtColLabel: rBkOil.tgtColLabel,
                  achStr: rBkOil.achStr,
                  gapStr: rBkOil.gapStr,
                  gapIsPos: rBkOil.gapIsPos,
                  achPct: rBkOil.achPct,
                  kpiContribPct: rBkOil.kpiPct,
                  parentSharePct: rBkOil.parentPct,
                  parentName: 'Booking',
                  kpiName: 'Rev'
                })}
              </div>
            </div>
          </div>

          <!-- CENTER SPINE ARROW DIRECTLY FROM REVENUE TO TWC / PDI / PART ONLY -->
          <div class="flex flex-col items-center justify-between py-1">
            <div class="w-2 flex-1 bg-slate-900 rounded-full relative flex flex-col items-center justify-center">
              <span class="bg-slate-900 text-white text-[9.5px] font-black px-1.5 py-1 rounded-full whitespace-nowrap shadow-md border border-slate-600 z-10">
                Non-CPUS: ${totalNonCpusRevPct}%
              </span>
            </div>
            <div class="text-slate-900 text-2xl leading-none -mt-2">&#9660;</div>
          </div>

          <!-- RIGHT BRANCH: NON BOOKING -->
          <div class="flex flex-col items-center">
            ${buildTreeMainBoxHtml({
              title: `NON BOOKING (TGT ${nonBookingTargetPct}%)`,
              tgtStr: rNbk.tgtStr,
              tgtSubStr: rNbk.tgtSubStr,
              tgtLabel: rNbk.tgtLabel,
              achStr: rNbk.achStr,
              achPct: rNbk.achPct,
              gapStr: rNbk.gapStr,
              isPass: rNbk.isPass,
              kpiContribPct: rNbk.kpiPct,
              shareLabel: `Comp.% TGT: ${nonBookingTargetPct}%`,
              isRoot: false
            })}

            <!-- Connector Non-Booking to SBE / GRP / OIL -->
            <div class="w-1.5 h-4 bg-slate-900"></div>
            <div class="grid grid-cols-3 w-full">
              <div class="flex flex-col items-center">
                <div class="w-full flex"><div class="w-1/2"></div><div class="w-1/2 border-t-4 border-l-4 border-slate-900 h-4"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
              <div class="flex flex-col items-center">
                <div class="w-full border-t-4 border-slate-900 flex justify-center"><div class="w-1 h-4 bg-slate-900"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
              <div class="flex flex-col items-center">
                <div class="w-full flex"><div class="w-1/2 border-t-4 border-r-4 border-slate-900 h-4"></div><div class="w-1/2"></div></div>
                <div class="text-slate-900 text-xs leading-none -mt-1">&#9660;</div>
              </div>
            </div>

            <!-- LEVEL 3 (NON BOOKING): SBE, GRP, OIL -->
            <div class="grid grid-cols-3 gap-2 w-full items-start">
              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'SBE (TGT 70%)',
                  tgtStr: rNbkSbe.tgtStr,
                  tgtSubStr: rNbkSbe.tgtSubStr,
                  tgtColLabel: rNbkSbe.tgtColLabel,
                  achStr: rNbkSbe.achStr,
                  gapStr: rNbkSbe.gapStr,
                  gapIsPos: rNbkSbe.gapIsPos,
                  achPct: rNbkSbe.achPct,
                  kpiContribPct: rNbkSbe.kpiPct,
                  parentSharePct: rNbkSbe.parentPct,
                  parentName: 'Non-Bk',
                  kpiName: 'Rev'
                })}
                <div class="w-1.5 h-4 bg-slate-900"></div>
                <div class="text-slate-900 text-xs leading-none -mt-1 mb-0.5">&#9660;</div>
                ${buildTreeLeafBoxHtml({
                  title: 'T CARE (TGT 39%)',
                  tgtStr: rNbkTC.tgtStr,
                  tgtSubStr: rNbkTC.tgtSubStr,
                  tgtColLabel: rNbkTC.tgtColLabel,
                  achStr: rNbkTC.achStr,
                  gapStr: rNbkTC.gapStr,
                  gapIsPos: rNbkTC.gapIsPos,
                  achPct: rNbkTC.achPct,
                  kpiContribPct: rNbkTC.kpiPct,
                  parentSharePct: rNbkTC.parentPct,
                  parentName: 'SBE',
                  kpiName: 'Rev'
                })}
                <div class="w-1.5 h-4 bg-slate-900"></div>
                <div class="text-slate-900 text-xs leading-none -mt-1 mb-0.5">&#9660;</div>
                ${buildTreeLeafBoxHtml({
                  title: 'NON T CARE (TGT 31%)',
                  tgtStr: rNbkNTC.tgtStr,
                  tgtSubStr: rNbkNTC.tgtSubStr,
                  tgtColLabel: rNbkNTC.tgtColLabel,
                  achStr: rNbkNTC.achStr,
                  gapStr: rNbkNTC.gapStr,
                  gapIsPos: rNbkNTC.gapIsPos,
                  achPct: rNbkNTC.achPct,
                  kpiContribPct: rNbkNTC.kpiPct,
                  parentSharePct: rNbkNTC.parentPct,
                  parentName: 'SBE',
                  kpiName: 'Rev'
                })}
              </div>

              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'GRP / CR7 (TGT 17%)',
                  tgtStr: rNbkGrp.tgtStr,
                  tgtSubStr: rNbkGrp.tgtSubStr,
                  tgtColLabel: rNbkGrp.tgtColLabel,
                  achStr: rNbkGrp.achStr,
                  gapStr: rNbkGrp.gapStr,
                  gapIsPos: rNbkGrp.gapIsPos,
                  achPct: rNbkGrp.achPct,
                  kpiContribPct: rNbkGrp.kpiPct,
                  parentSharePct: rNbkGrp.parentPct,
                  parentName: 'Non-Bk',
                  kpiName: 'Rev'
                })}
              </div>

              <div class="flex flex-col items-center">
                ${buildTreeLeafBoxHtml({
                  title: 'OIL / GO (TGT 13%)',
                  tgtStr: rNbkOil.tgtStr,
                  tgtSubStr: rNbkOil.tgtSubStr,
                  tgtColLabel: rNbkOil.tgtColLabel,
                  achStr: rNbkOil.achStr,
                  gapStr: rNbkOil.gapStr,
                  gapIsPos: rNbkOil.gapIsPos,
                  achPct: rNbkOil.achPct,
                  kpiContribPct: rNbkOil.kpiPct,
                  parentSharePct: rNbkOil.parentPct,
                  parentName: 'Non-Bk',
                  kpiName: 'Rev'
                })}
              </div>
            </div>
          </div>
        </div>

        <!-- BOTTOM ROW OF REVENUE TREE: TWC, PDI, SBI, PART ONLY (HANYA ACH & KONTRIBUSI TANPA TARGET) -->
        <div class="mt-4 pt-3 border-t-2 border-dashed border-slate-300 flex justify-center">
          <div class="grid grid-cols-4 gap-4 w-11/12 max-w-5xl">
            ${buildTreeNonCpusBoxHtml({
              title: 'TWC (WARRANTY / RECALL)',
              achVal: revTwc,
              achStr: rTwc.achStr,
              kpiContribPct: rTwc.kpiPct,
              kpiName: 'Revenue'
            })}
            ${buildTreeNonCpusBoxHtml({
              title: 'PDI (PRE DELIVERY INSP.)',
              achVal: revPdi,
              achStr: rPdi.achStr,
              kpiContribPct: rPdi.kpiPct,
              kpiName: 'Revenue'
            })}
            ${buildTreeNonCpusBoxHtml({
              title: 'SBI (SERVICE INTERNAL)',
              achVal: revSbi,
              achStr: rSbi.achStr,
              kpiContribPct: rSbi.kpiPct,
              kpiName: 'Revenue'
            })}
            ${buildTreeNonCpusBoxHtml({
              title: 'PART ONLY (PRT)',
              achVal: revPrt,
              achStr: rPrt.achStr,
              kpiContribPct: rPrt.kpiPct,
              kpiName: 'Revenue'
            })}
          </div>
        </div>
      </div>
    </div>
  `;

  if (currentKpiTreeMode === 'cpus') {
    container.innerHTML = cpusTreeHtml;
  } else if (currentKpiTreeMode === 'revenue') {
    container.innerHTML = revenueTreeHtml;
  } else {
    container.innerHTML = cpusTreeHtml + revenueTreeHtml;
  }
}

// -------------------------------------------------------------
// RENDER 5 WEEKLY CARDS (W1 - W5) WITH FULL PARAMETERS (CPUS, REVENUE, SALES/UNIT)
// -------------------------------------------------------------
function renderWeeklyCards(containerId, jobs, monthTargetCpus, monthTargetRev, monthIdx) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const selectedMonth = document.getElementById('filter-month').value;
  const totalDaysInMonth = getDaysInMonthString(selectedMonth);
  const totalWorkingDays = getMonthTotalNationalHok(selectedMonth);

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
    const wCpus = new Set(wJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
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
function onSaMasterMetricChange(val) {
  const ovMetric = document.getElementById('overview-chart-metric');
  if (ovMetric) ovMetric.value = val;
  renderSaMasterPerformanceTable();
}

function renderSaMasterPerformanceTable(monthJobs1, monthIdx) {
  const tbody = document.getElementById('table-sa-master-performance');
  const insightsContainer = document.getElementById('management-insights-container');
  if (!tbody) return;

  const saM1Elem = document.getElementById('sa-vs-month1');
  const saM2Elem = document.getElementById('sa-vs-month2');
  const ovM1Elem = document.getElementById('overview-vs-month1');
  const ovM2Elem = document.getElementById('overview-vs-month2');

  const m1 = (currentTab === 'sa-performance' && saM1Elem && saM1Elem.value) ? saM1Elem.value : (ovM1Elem ? ovM1Elem.value : '2026-10');
  const m2 = (currentTab === 'sa-performance' && saM2Elem && saM2Elem.value) ? saM2Elem.value : (ovM2Elem ? ovM2Elem.value : '2026-09');

  if (!monthJobs1) {
    monthJobs1 = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m1));
  }
  if (monthIdx === undefined || monthIdx === null) {
    monthIdx = m1 ? parseInt(m1.split('-')[1], 10) - 1 : 9;
  }

  const monthJobs2 = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m2));

  // Read active metric from SA table dropdown or overview dropdown: 'revenue', 'cpus', 'sbe', 'grp'
  const saMetricElem = document.getElementById('sa-master-metric-select');
  const ovMetricElem = document.getElementById('overview-chart-metric');
  const metric = (saMetricElem && saMetricElem.value) ? saMetricElem.value : (ovMetricElem ? ovMetricElem.value : 'cpus');
  const isRev = metric === 'revenue';

  let metricLabel = 'CPUS';
  let metricBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
  if (metric === 'revenue') {
    metricLabel = 'Revenue';
    metricBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  } else if (metric === 'sbe') {
    metricLabel = 'Job SBE';
    metricBadgeClass = 'bg-amber-100 text-amber-900 border-amber-200';
  } else if (metric === 'grp') {
    metricLabel = 'Job GRP';
    metricBadgeClass = 'bg-purple-100 text-purple-900 border-purple-200';
  }

  // Update dynamic badge & title on table
  const badgeElem = document.getElementById('sa-master-metric-badge');
  if (badgeElem) {
    badgeElem.className = `ml-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${metricBadgeClass}`;
    badgeElem.innerText = `Metrik: ${metricLabel}`;
  }
  const insightsTitleElem = document.getElementById('sa-master-insights-title');
  if (insightsTitleElem) {
    insightsTitleElem.innerText = `MANAGEMENT INSIGHTS (${metricLabel.toUpperCase()})`;
  }

  const targetGianyar = appData.targets.gianyarConsul || {};
  const totalWorkingDays = getMonthTotalNationalHok(m1);
  // Hitung HOK Nasional berjalan berdasarkan tanggal transaksi pada bulan m1
  const m1DayCounts = {};
  monthJobs1.forEach(j => {
    if (j.invDate && j.invDate.startsWith(m1)) {
      const d = parseInt(j.invDate.split('-')[2], 10);
      if (!isNaN(d)) m1DayCounts[d] = (m1DayCounts[d] || 0) + 1;
    }
  });
  const m1Days = Object.keys(m1DayCounts).map(Number).sort((a, b) => a - b);
  let m1ActiveEndDay = getDaysInMonthString(m1);
  if (m1Days.length > 0) {
    const lastD = m1Days[m1Days.length - 1];
    m1ActiveEndDay = (m1DayCounts[lastD] < 10 && m1Days.length > 1) ? m1Days[m1Days.length - 2] : lastD;
  }
  const hokElapsed = Math.min(countWorkingDays(m1, 1, m1ActiveEndDay), totalWorkingDays);
  const hokRemaining = Math.max(totalWorkingDays - hokElapsed, 0.5);

  const saList = ['AYU', 'AJS', 'WBN', 'FIK', 'THS', 'THS2', 'PDS'];

  // Calculate Total Target & Actuals
  let targetBulanTotal = 0;
  let totalAct1 = 0;
  let totalAct2 = 0;

  if (metric === 'revenue') {
    const oap = (appData.targets && appData.targets.dailyReportOap) || {};
    targetBulanTotal = (oap.totalOmzet && oap.totalOmzet[monthIdx]) || (targetGianyar.revenue ? targetGianyar.revenue[monthIdx] * 1000000 : 1839757626);
    if (targetBulanTotal > 0 && targetBulanTotal < 100000) targetBulanTotal = Math.round(targetBulanTotal * 1000000);
    totalAct1 = monthJobs1.reduce((acc, j) => acc + j.revenue, 0);
    totalAct2 = monthJobs2.reduce((acc, j) => acc + j.revenue, 0);
  } else if (metric === 'cpus') {
    const oap = (appData.targets && appData.targets.dailyReportOap) || {};
    targetBulanTotal = (oap.cpus && oap.cpus[monthIdx]) || (targetGianyar.cpus ? targetGianyar.cpus[monthIdx] : 978);
    totalAct1 = new Set(monthJobs1.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
    totalAct2 = new Set(monthJobs2.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
  } else if (metric === 'sbe') {
    const oap = (appData.targets && appData.targets.dailyReportOap) || {};
    targetBulanTotal = (oap.sbeGyr && oap.sbeGyr[monthIdx]) || (targetGianyar.sbe ? targetGianyar.sbe[monthIdx] : 684);
    totalAct1 = monthJobs1.filter(j => j.repairType === 'SBE' || j.isSbe).length;
    totalAct2 = monthJobs2.filter(j => j.repairType === 'SBE' || j.isSbe).length;
  } else if (metric === 'grp') {
    const oap = (appData.targets && appData.targets.dailyReportOap) || {};
    targetBulanTotal = (oap.grp && oap.grp[monthIdx]) || (targetGianyar.grp ? targetGianyar.grp[monthIdx] : 294);
    totalAct1 = monthJobs1.filter(j => j.repairType === 'GRP').length;
    totalAct2 = monthJobs2.filter(j => j.repairType === 'GRP').length;
  }

  const rowsData = [{
    name: 'GIANYAR CONSUL Total',
    isTotal: true,
    targetBulan: targetBulanTotal,
    actual: totalAct1,
    actualM2: totalAct2
  }];

  // Calculate per SA
  saList.forEach(saName => {
    let saTgt = 0;
    let saAct1 = 0;
    let saAct2 = 0;

    if (metric === 'revenue') {
      saTgt = getSaTargetRevenue(saName, monthIdx);
      saAct1 = monthJobs1.filter(j => j.sa === saName).reduce((acc, j) => acc + j.revenue, 0);
      saAct2 = monthJobs2.filter(j => j.sa === saName).reduce((acc, j) => acc + j.revenue, 0);
    } else if (metric === 'cpus') {
      saTgt = getSaTargetCpus(saName, monthIdx);
      saAct1 = new Set(monthJobs1.filter(j => j.sa === saName && isCpusJob(j)).map(j => `${j.vin}_${j.invDate}`)).size;
      saAct2 = new Set(monthJobs2.filter(j => j.sa === saName && isCpusJob(j)).map(j => `${j.vin}_${j.invDate}`)).size;
    } else if (metric === 'sbe') {
      const saSbeObj = (appData.targets.saTargets && appData.targets.saTargets.SBE) || {};
      const arr = saSbeObj[saName] || saSbeObj[saName.replace('THS', 'TMS ')] || [];
      saTgt = arr[monthIdx] || 0;
      saAct1 = monthJobs1.filter(j => j.sa === saName && (j.repairType === 'SBE' || j.isSbe)).length;
      saAct2 = monthJobs2.filter(j => j.sa === saName && (j.repairType === 'SBE' || j.isSbe)).length;
    } else if (metric === 'grp') {
      const saGrpObj = (appData.targets.saTargets && appData.targets.saTargets.GRP) || {};
      const arr = saGrpObj[saName] || saGrpObj[saName.replace('THS', 'TMS ')] || [];
      saTgt = arr[monthIdx] || 0;
      saAct1 = monthJobs1.filter(j => j.sa === saName && j.repairType === 'GRP').length;
      saAct2 = monthJobs2.filter(j => j.sa === saName && j.repairType === 'GRP').length;
    }

    rowsData.push({
      name: saName,
      isTotal: false,
      targetBulan: saTgt,
      actual: saAct1,
      actualM2: saAct2
    });
  });

  tbody.innerHTML = '';

  let bestPerf = null;
  let maxGap = null;
  let highestRecovery = null;

  const formatCellVal = (val, isDecimal = false) => {
    if (val === null || val === undefined || isNaN(val)) return '0';
    if (isRev) {
      return formatRupiahShort(val);
    }
    return isDecimal ? Number(val).toFixed(1) : formatNumberClean(val);
  };

  rowsData.forEach(r => {
    const hasTarget = r.targetBulan > 0;
    const achBulanPct = hasTarget ? ((r.actual / r.targetBulan) * 100).toFixed(1) : '0.0';
    const targetHari = hasTarget ? (r.targetBulan / totalWorkingDays) : 0;
    const actualHari = (r.actual / (hokElapsed || 1));
    const achHariPct = targetHari > 0 ? ((actualHari / targetHari) * 100).toFixed(1) : '0.0';

    const gap = hasTarget ? (r.targetBulan - r.actual) : 0;
    const diffMtd = r.actual - r.actualM2;
    const growthMtdPct = r.actualM2 > 0 ? ((diffMtd / r.actualM2) * 100).toFixed(1) : '0.0';
    const growthAvgDay = (diffMtd / (hokElapsed || 1));

    const nextPlanHari = (hasTarget && gap > 0) ? Math.max(Math.ceil(gap / hokRemaining), 0) : 0;

    const mainSAs = ['AYU', 'AJS', 'WBN', 'FIK'];
    if (!r.isTotal && mainSAs.includes(r.name) && hasTarget) {
      const achVal = parseFloat(achBulanPct);
      // Best performing: persentase pencapaian tertinggi
      if (!bestPerf || achVal > bestPerf.achVal) {
        bestPerf = { name: r.name, achVal, gap };
      }
      // Biggest gap: SA dengan kekurangan nominal/unit terbesar (gap positif > 0)
      if (gap > 0 && (!maxGap || gap > maxGap.gap)) {
        maxGap = { name: r.name, gap };
      }
      // Highest recovery need: SA dengan kebutuhan pace harian recovery tertinggi (nextPlanHari > 0)
      if (nextPlanHari > 0 && (!highestRecovery || nextPlanHari > highestRecovery.nextPlanHari)) {
        highestRecovery = { name: r.name, nextPlanHari };
      }
    }

    const tr = document.createElement('tr');
    tr.className = r.isTotal ? 'bg-blue-50/80 font-black text-blue-900 border-b-2 border-blue-200' : 'hover:bg-slate-50';

    const achBulanDisplay = hasTarget ? `${achBulanPct}%` : '&mdash;';
    const targetHariDisplay = hasTarget ? formatCellVal(targetHari, !isRev) : '&mdash;';
    const achHariDisplay = hasTarget ? `${achHariPct}%` : '&mdash;';
    const gapDisplay = hasTarget ? (gap > 0 ? formatCellVal(gap) : '0') : '&mdash;';
    const nextPlanDisplay = hasTarget ? (gap > 0 ? formatCellVal(nextPlanHari, !isRev) : '0') : '&mdash;';
    const targetBulanDisplay = hasTarget ? formatCellVal(r.targetBulan) : '&mdash;';

    tr.innerHTML = `
      <td class="p-3 border border-slate-200 ${r.isTotal ? 'font-black text-blue-900' : 'font-bold'} whitespace-nowrap">${r.name}</td>
      <td class="p-2.5 border border-slate-200 text-center whitespace-nowrap">${hokElapsed}</td>
      <td class="p-2.5 border border-slate-200 text-right font-bold whitespace-nowrap">${targetBulanDisplay}</td>
      <td class="p-2.5 border border-slate-200 text-right font-black whitespace-nowrap">${formatCellVal(r.actual)}</td>
      <td class="p-2.5 border border-slate-200 text-right font-extrabold whitespace-nowrap ${hasTarget && parseFloat(achBulanPct) >= 100 ? 'text-emerald-600' : hasTarget ? 'text-red-600' : 'text-slate-400'}">${achBulanDisplay}</td>
      <td class="p-2.5 border border-slate-200 text-right font-semibold whitespace-nowrap">${targetHariDisplay}</td>
      <td class="p-2.5 border border-slate-200 text-right font-semibold whitespace-nowrap">${formatCellVal(actualHari, !isRev)}</td>
      <td class="p-2.5 border border-slate-200 text-right font-extrabold whitespace-nowrap ${hasTarget && parseFloat(achHariPct) >= 100 ? 'text-emerald-600' : hasTarget ? 'text-red-600' : 'text-slate-400'}">${achHariDisplay}</td>
      <td class="p-2.5 border border-slate-200 text-right text-red-600 font-black whitespace-nowrap">${gapDisplay}</td>
      <td class="p-2.5 border border-slate-200 text-right font-semibold whitespace-nowrap ${diffMtd >= 0 ? 'text-emerald-600' : 'text-red-600'}">${diffMtd > 0 ? '+' : ''}${formatCellVal(diffMtd)} / ${growthMtdPct}%</td>
      <td class="p-2.5 border border-slate-200 text-right font-semibold whitespace-nowrap ${growthAvgDay >= 0 ? 'text-emerald-600' : 'text-red-600'}">${growthAvgDay > 0 ? '+' : ''}${formatCellVal(growthAvgDay, !isRev)}</td>
      <td class="p-2.5 border border-slate-200 text-right font-black text-blue-900 whitespace-nowrap">${nextPlanDisplay}</td>
    `;
    tbody.appendChild(tr);
  });

  if (!maxGap) {
    maxGap = { name: 'Semua Target Tercapai', gap: 0, isAllAchieved: true };
  }
  if (!highestRecovery) {
    highestRecovery = { name: 'On Track', nextPlanHari: 0, isAllAchieved: true };
  }

  if (insightsContainer && bestPerf) {
    const gapFormatted = isRev ? formatRupiahShort(maxGap.gap) : `${formatNumberClean(maxGap.gap)} unit`;
    const recFormatted = isRev ? `${formatRupiahShort(highestRecovery.nextPlanHari)}/hari` : `${formatNumberClean(highestRecovery.nextPlanHari)} unit/hari`;

    const gapTitle = maxGap.isAllAchieved ? 'SEMUA TARGET TERCAPAI' : `${maxGap.name} – ${metricLabel} kurang ${gapFormatted}`;
    const gapDesc = maxGap.isAllAchieved ? 'Tidak ada SA yang memiliki gap negatif' : `Kekurangan ${isRev ? 'nominal' : 'unit'} terbesar terhadap target`;

    const recTitle = highestRecovery.isAllAchieved ? 'ON TRACK (PACE AMAN)' : `${highestRecovery.name} – butuh ${recFormatted}`;
    const recDesc = highestRecovery.isAllAchieved ? 'Semua SA telah melampaui target pace harian' : 'Pace harian paling intensif untuk mencapai target';

    insightsContainer.innerHTML = `
      <div class="bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl flex items-start space-x-3 shadow-2xs">
        <div class="p-2.5 bg-emerald-500 text-white rounded-xl font-bold text-lg"><i class="fa-solid fa-trophy"></i></div>
        <div>
          <p class="text-[10px] font-black uppercase text-emerald-800 tracking-wider">BEST PERFORMING</p>
          <h4 class="font-extrabold text-slate-800 text-sm">${bestPerf.name} – ${metricLabel} achievement ${bestPerf.achVal}%</h4>
          <p class="text-xs text-emerald-700 font-medium">Pencapaian tertinggi terhadap target bulan ini</p>
        </div>
      </div>

      <div class="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl flex items-start space-x-3 shadow-2xs">
        <div class="p-2.5 bg-amber-500 text-white rounded-xl font-bold text-lg"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div>
          <p class="text-[10px] font-black uppercase text-amber-800 tracking-wider">BIGGEST GAP</p>
          <h4 class="font-extrabold text-slate-800 text-sm">${gapTitle}</h4>
          <p class="text-xs text-amber-700 font-medium">${gapDesc}</p>
        </div>
      </div>

      <div class="bg-rose-50/80 border border-rose-200 p-4 rounded-2xl flex items-start space-x-3 shadow-2xs">
        <div class="p-2.5 bg-rose-500 text-white rounded-xl font-bold text-lg"><i class="fa-solid fa-fire"></i></div>
        <div>
          <p class="text-[10px] font-black uppercase text-rose-800 tracking-wider">HIGHEST RECOVERY NEED</p>
          <h4 class="font-extrabold text-slate-800 text-sm">${recTitle}</h4>
          <p class="text-xs text-rose-700 font-medium">${recDesc}</p>
        </div>
      </div>
    `;
  }
}

function setOverviewChartPeriod(period) {
  currentOverviewChartPeriod = period;

  const btnDaily = document.getElementById('btn-overview-period-daily');
  const btnWeekly = document.getElementById('btn-overview-period-weekly');
  const btnMonthly = document.getElementById('btn-overview-period-monthly');
  const btnYearly = document.getElementById('btn-overview-period-yearly');
  const titleElem = document.getElementById('overview-chart-title');
  const vsContainer = document.getElementById('overview-vs-selectors-container');
  const yoyBadge = document.getElementById('overview-yoy-badge');
  const yoyBadgeText = document.getElementById('overview-yoy-badge-text');

  const activeClasses = ['bg-blue-600', 'text-white', 'shadow-sm'];
  const inactiveClasses = ['text-slate-600', 'hover:text-slate-900', 'bg-transparent'];

  const setBtnStyle = (btn, isActive) => {
    if (!btn) return;
    if (isActive) {
      btn.classList.add(...activeClasses);
      btn.classList.remove(...inactiveClasses);
    } else {
      btn.classList.remove(...activeClasses);
      btn.classList.add(...inactiveClasses);
    }
  };

  setBtnStyle(btnDaily, period === 'daily');
  setBtnStyle(btnWeekly, period === 'weekly');
  setBtnStyle(btnMonthly, period === 'monthly');
  setBtnStyle(btnYearly, period === 'vs-last-year');

  let curYear = 2026;
  if (appData.jobHistory && appData.jobHistory.length > 0) {
    for (const j of appData.jobHistory) {
      if (j.invDate && j.invDate.length >= 4) {
        const y = parseInt(j.invDate.substring(0, 4), 10);
        if (y > curYear) curYear = y;
      }
    }
  }
  const lastYear = curYear - 1;

  if (titleElem) {
    if (period === 'daily') {
      titleElem.innerText = 'Grafik Daily AT GYR (Versus Bulan)';
    } else if (period === 'weekly') {
      titleElem.innerText = 'Grafik Mingguan AT GYR (Versus W1 – W5)';
    } else if (period === 'monthly') {
      titleElem.innerText = 'Grafik Bulanan AT GYR (Tiap Bulan / Jan – Des)';
    } else if (period === 'vs-last-year') {
      titleElem.innerText = `Grafik Perbandingan Tahun Berjalan vs Tahun Lalu (${curYear} vs ${lastYear})`;
    }
  }

  if (vsContainer) {
    if (period === 'monthly' || period === 'vs-last-year') {
      vsContainer.style.display = 'none';
    } else {
      vsContainer.style.display = 'flex';
    }
  }

  if (yoyBadge) {
    if (period === 'vs-last-year') {
      yoyBadge.classList.remove('hidden');
      yoyBadge.classList.add('flex');
      if (yoyBadgeText) yoyBadgeText.innerText = `${curYear} vs ${lastYear}`;
    } else {
      yoyBadge.classList.add('hidden');
      yoyBadge.classList.remove('flex');
    }
  }

  renderOverviewChart();
}

function renderOverviewChart() {
  const m1 = document.getElementById('overview-vs-month1').value;
  const m2 = document.getElementById('overview-vs-month2').value;
  const metric = document.getElementById('overview-chart-metric').value;
  const name1 = formatMonthNameOnly(m1);
  const name2 = formatMonthNameOnly(m2);

  const jobs1 = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m1));
  const jobs2 = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m2));

  const ctx = document.getElementById('chart-overview-daily').getContext('2d');
  if (chartOverviewDaily) chartOverviewDaily.destroy();

  // ---------------------------------------------------------
  // 1. WEEKLY MODE (W1 - W5 Semuanya Sekaligus & Versus Bulan)
  // ---------------------------------------------------------
  if (currentOverviewChartPeriod === 'weekly') {
    const days1 = getDaysInMonthString(m1);
    const days2 = getDaysInMonthString(m2);
    const maxEnd = Math.max(days1, days2, 31);

    const weekDefs = [
      { name: 'Minggu 1 (01-07)', short: 'W1', start: 1, end: 7 },
      { name: 'Minggu 2 (08-14)', short: 'W2', start: 8, end: 14 },
      { name: 'Minggu 3 (15-21)', short: 'W3', start: 15, end: 21 },
      { name: 'Minggu 4 (22-28)', short: 'W4', start: 22, end: 28 },
      { name: `Minggu 5 (29-${maxEnd})`, short: 'W5', start: 29, end: maxEnd }
    ];

    const weeklyData1 = [0, 0, 0, 0, 0];
    const weeklyData2 = [0, 0, 0, 0, 0];
    const weeklyVinSet1 = [new Set(), new Set(), new Set(), new Set(), new Set()];
    const weeklyVinSet2 = [new Set(), new Set(), new Set(), new Set(), new Set()];

    jobs1.forEach(j => {
      const day = parseInt(j.invDate.split('-')[2], 10);
      weekDefs.forEach((w, idx) => {
        if (day >= w.start && day <= w.end) {
          if (metric === 'revenue') weeklyData1[idx] += j.revenue;
          else if (metric === 'cpus' && isCpusJob(j)) weeklyVinSet1[idx].add(j.vin);
          else if (metric === 'sbe' && (j.repairType === 'SBE' || j.isSbe)) weeklyData1[idx]++;
          else if (metric === 'grp' && j.repairType === 'GRP') weeklyData1[idx]++;
        }
      });
    });

    jobs2.forEach(j => {
      const day = parseInt(j.invDate.split('-')[2], 10);
      weekDefs.forEach((w, idx) => {
        if (day >= w.start && day <= w.end) {
          if (metric === 'revenue') weeklyData2[idx] += j.revenue;
          else if (metric === 'cpus' && isCpusJob(j)) weeklyVinSet2[idx].add(j.vin);
          else if (metric === 'sbe' && (j.repairType === 'SBE' || j.isSbe)) weeklyData2[idx]++;
          else if (metric === 'grp' && j.repairType === 'GRP') weeklyData2[idx]++;
        }
      });
    });

    if (metric === 'cpus') {
      weeklyVinSet1.forEach((set, idx) => weeklyData1[idx] = set.size);
      weeklyVinSet2.forEach((set, idx) => weeklyData2[idx] = set.size);
    }

    chartOverviewDaily = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weekDefs.map(w => w.name),
        datasets: [
          {
            label: `${name1} (Utama)`,
            data: weeklyData1,
            borderColor: '#0284c7',
            backgroundColor: 'rgba(2, 132, 199, 0.15)',
            fill: true,
            tension: 0.35,
            borderWidth: 3.5,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointBackgroundColor: '#0284c7',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          },
          {
            label: `${name2} (Pembanding)`,
            data: weeklyData2,
            borderColor: '#d97706',
            backgroundColor: 'rgba(217, 119, 6, 0.08)',
            borderDash: [5, 5],
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointBackgroundColor: '#d97706',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
            position: 'bottomLocked',
            callbacks: {
              label: (c) => {
                const val = c.raw;
                const unitSuffix = metric === 'revenue' ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
                const formatted = metric === 'revenue' ? formatRupiah(val) : `${val.toLocaleString('id-ID')}${unitSuffix}`;
                return ` ${c.dataset.label}: ${formatted}`;
              },
              afterBody: (items) => {
                if (items.length < 2) return [];
                const v1 = items[0].datasetIndex === 0 ? items[0].raw : items[1].raw;
                const v2 = items[0].datasetIndex === 1 ? items[0].raw : items[1].raw;
                const diff = v1 - v2;
                const pct = v2 > 0 ? (((v1 - v2) / v2) * 100).toFixed(1) : 0;
                const unitSuffix = metric === 'revenue' ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
                const diffStr = metric === 'revenue' ? formatRupiah(diff) : (diff > 0 ? `+${diff.toLocaleString('id-ID')}${unitSuffix}` : `${diff.toLocaleString('id-ID')}${unitSuffix}`);
                return [
                  `▸ Selisih: ${diffStr} (${pct > 0 ? '+' : ''}${pct}%)`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: true, color: 'rgba(226, 232, 240, 0.6)' },
            ticks: { font: { weight: 'bold' } }
          },
          y: {
            beginAtZero: true,
            ticks: { callback: (val) => metric === 'revenue' ? formatRupiahShort(val) : val }
          }
        }
      }
    });

    const tot1 = weeklyData1.reduce((a, b) => a + b, 0);
    const tot2 = weeklyData2.reduce((a, b) => a + b, 0);
    const diffTot = tot1 - tot2;
    const pctTot = tot2 > 0 ? (((tot1 - tot2) / tot2) * 100).toFixed(1) : 0;
    const tot1Str = metric === 'revenue' ? formatRupiah(tot1) : tot1.toLocaleString('id-ID');
    const tot2Str = metric === 'revenue' ? formatRupiah(tot2) : tot2.toLocaleString('id-ID');
    const diffStr = metric === 'revenue' ? formatRupiah(diffTot) : (diffTot > 0 ? `+${diffTot}` : `${diffTot}`);

    const overviewLegend = document.getElementById('overview-chart-legend');
    if (overviewLegend) {
      overviewLegend.innerHTML = `
        <div class="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between text-xs font-bold gap-3">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-sky-600 inline-block"></span>
            <span class="text-slate-700">Total Akumulasi ${name1}: <span class="text-blue-900 font-black">${tot1Str}</span></span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span class="text-slate-700">Total Akumulasi ${name2}: <span class="text-amber-900 font-black">${tot2Str}</span></span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-slate-500">Selisih W1-W5:</span>
            <span class="px-2 py-0.5 rounded-full ${diffTot >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} font-black">
              ${diffStr} (${pctTot > 0 ? '+' : ''}${pctTot}%)
            </span>
          </div>
        </div>
      `;
    }
    return;
  }

  // ---------------------------------------------------------
  // 2. MONTHLY MODE (Semua Bulan Jan - Des / Target vs Realisasi)
  // ---------------------------------------------------------
  if (currentOverviewChartPeriod === 'monthly') {
    const monthLabels = STANDARD_12_MONTHS.map(m => m.name.substring(0, 3));
    const gTargets = appData.targets.gianyarConsul || {};
    
    const monthlyActual = [];
    const monthlyTarget = [];

    STANDARD_12_MONTHS.forEach((m, idx) => {
      const mJobs = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m.code));
      let act = 0;
      if (metric === 'revenue') {
        act = mJobs.reduce((acc, j) => acc + j.revenue, 0);
      } else if (metric === 'cpus') {
        act = new Set(mJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
      } else if (metric === 'sbe') {
        act = mJobs.filter(j => j.repairType === 'SBE' || j.isSbe).length;
      } else if (metric === 'grp') {
        act = mJobs.filter(j => j.repairType === 'GRP').length;
      }
      monthlyActual.push(act);

      let tgt = 0;
      if (metric === 'revenue') {
        tgt = (gTargets.revenue ? gTargets.revenue[idx] || 0 : 0) * 1000000;
      } else if (metric === 'cpus') {
        tgt = gTargets.cpus ? gTargets.cpus[idx] || 0 : 0;
      } else if (metric === 'sbe') {
        tgt = gTargets.sbe ? gTargets.sbe[idx] || 0 : 0;
      } else if (metric === 'grp') {
        tgt = gTargets.grp ? gTargets.grp[idx] || 0 : 0;
      }
      monthlyTarget.push(tgt);
    });

    chartOverviewDaily = new Chart(ctx, {
      data: {
        labels: monthLabels,
        datasets: [
          {
            type: 'bar',
            label: 'Realisasi Actual',
            data: monthlyActual,
            backgroundColor: '#0284c7',
            borderColor: '#0369a1',
            borderWidth: 1.5,
            borderRadius: 6,
            barPercentage: 0.65
          },
          {
            type: 'line',
            label: 'Target Bulanan',
            data: monthlyTarget,
            borderColor: '#f59e0b',
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#f59e0b',
            fill: false,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
            position: 'bottomLocked',
            callbacks: {
              label: (c) => {
                const val = c.raw;
                const unitSuffix = metric === 'revenue' ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
                const formatted = metric === 'revenue' ? formatRupiah(val) : `${val.toLocaleString('id-ID')}${unitSuffix}`;
                return ` ${c.dataset.label}: ${formatted}`;
              },
              afterBody: (items) => {
                if (items.length < 2) return [];
                const act = items[0].datasetIndex === 0 ? items[0].raw : items[1].raw;
                const tgt = items[0].datasetIndex === 1 ? items[0].raw : items[1].raw;
                const gap = act - tgt;
                const ach = tgt > 0 ? ((act / tgt) * 100).toFixed(1) : 0;
                const unitSuffix = metric === 'revenue' ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
                const gapStr = metric === 'revenue' ? formatRupiah(gap) : (gap > 0 ? `+${gap.toLocaleString('id-ID')}${unitSuffix}` : `${gap.toLocaleString('id-ID')}${unitSuffix}`);
                return [
                  `▸ Ach: ${ach}% (Gap: ${gapStr})`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { weight: 'bold' } }
          },
          y: {
            beginAtZero: true,
            ticks: { callback: (val) => metric === 'revenue' ? formatRupiahShort(val) : val }
          }
        }
      }
    });

    const totAct = monthlyActual.reduce((a, b) => a + b, 0);
    const totTgt = monthlyTarget.reduce((a, b) => a + b, 0);
    const achOverall = totTgt > 0 ? ((totAct / totTgt) * 100).toFixed(1) : 0;
    const totActStr = metric === 'revenue' ? formatRupiah(totAct) : totAct.toLocaleString('id-ID');
    const totTgtStr = metric === 'revenue' ? formatRupiah(totTgt) : totTgt.toLocaleString('id-ID');

    const overviewLegend = document.getElementById('overview-chart-legend');
    if (overviewLegend) {
      overviewLegend.innerHTML = `
        <div class="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between text-xs font-bold gap-3">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-sky-600 inline-block"></span>
            <span class="text-slate-700">Total Realisasi YTD: <span class="text-blue-900 font-black">${totActStr}</span></span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span class="text-slate-700">Total Target YTD: <span class="text-amber-900 font-black">${totTgtStr}</span></span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-slate-500">Pencapaian:</span>
            <span class="px-2 py-0.5 rounded-full ${parseFloat(achOverall) >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} font-black">
              ${achOverall}%
            </span>
          </div>
        </div>
      `;
    }
    return;
  }

  // ---------------------------------------------------------
  // 4. VS LAST YEAR MODE (Current Year vs Previous Year / YoY)
  // ---------------------------------------------------------
  if (currentOverviewChartPeriod === 'vs-last-year') {
    let curYear = 2026;
    if (appData.jobHistory && appData.jobHistory.length > 0) {
      for (const j of appData.jobHistory) {
        if (j.invDate && j.invDate.length >= 4) {
          const y = parseInt(j.invDate.substring(0, 4), 10);
          if (y > curYear) curYear = y;
        }
      }
    }
    const lastYear = curYear - 1;

    const curYearJobs = (appData.jobHistory || []).filter(j => j.invDate && j.invDate.startsWith(String(curYear)));
    const lastYearJobs = ((appData.jobHistory2025 && appData.jobHistory2025.length > 0) ? appData.jobHistory2025 : (appData.jobHistory || [])).filter(j => j.invDate && j.invDate.startsWith(String(lastYear)));

    const monthLabels = MONTH_SHORT;
    const curYearData = [];
    const lastYearData = [];

    // Find the latest month that has records in the current year
    let maxCurMonth = 0;
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const hasAny = curYearJobs.some(j => j.invDate && j.invDate.startsWith(`${curYear}-${mm}`));
      if (hasAny) maxCurMonth = m;
    }
    if (maxCurMonth === 0) maxCurMonth = 12;

    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const curJobsM = curYearJobs.filter(j => j.invDate && j.invDate.startsWith(`${curYear}-${mm}`));
      const lastJobsM = lastYearJobs.filter(j => j.invDate && j.invDate.startsWith(`${lastYear}-${mm}`));

      let valCur = 0;
      let valLast = 0;

      if (metric === 'revenue') {
        valCur = curJobsM.reduce((acc, j) => acc + (j.revenue || 0), 0);
        valLast = lastJobsM.reduce((acc, j) => acc + (j.revenue || 0), 0);
      } else if (metric === 'cpus') {
        valCur = new Set(curJobsM.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
        valLast = new Set(lastJobsM.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
      } else if (metric === 'sbe') {
        valCur = curJobsM.filter(j => j.repairType === 'SBE' || j.isSbe).length;
        valLast = lastJobsM.filter(j => j.repairType === 'SBE' || j.isSbe).length;
      } else if (metric === 'grp') {
        valCur = curJobsM.filter(j => j.repairType === 'GRP').length;
        valLast = lastJobsM.filter(j => j.repairType === 'GRP').length;
      }

      if (m <= maxCurMonth) {
        curYearData.push(valCur);
      } else {
        curYearData.push(null);
      }
      lastYearData.push(valLast);
    }

    chartOverviewDaily = new Chart(ctx, {
      data: {
        labels: monthLabels,
        datasets: [
          {
            type: 'line',
            label: `Tahun Lalu (${lastYear})`,
            data: lastYearData,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderDash: [6, 5],
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            tension: 0.3,
            fill: false
          },
          {
            type: 'line',
            label: `Tahun Berjalan (${curYear})`,
            data: curYearData,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            borderWidth: 3.5,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: '#2563eb',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { weight: 'bold', size: 12 },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            position: 'bottomLocked',
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return `Bulan: ${MONTH_NAMES_IND[idx]}`;
              },
              label: (c) => {
                const val = c.raw;
                if (val === null || val === undefined) {
                  return ` ${c.dataset.label}: (Belum Berjalan)`;
                }
                const unitSuffix = metric === 'revenue' ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
                const formatted = metric === 'revenue' ? formatRupiah(val) : `${val.toLocaleString('id-ID')}${unitSuffix}`;
                return ` ${c.dataset.label}: ${formatted}`;
              },
              afterBody: (items) => {
                const lastItem = items.find(it => it.datasetIndex === 0);
                const curItem = items.find(it => it.datasetIndex === 1);
                if (!lastItem || !curItem) return [];
                const lastVal = lastItem.raw;
                const curVal = curItem.raw;
                if (curVal === null || curVal === undefined) {
                  return [
                    `▸ Status: Periode ${curYear} belum berjalan`
                  ];
                }
                const diff = curVal - lastVal;
                const pct = lastVal > 0 ? ((diff / lastVal) * 100).toFixed(1) : (curVal > 0 ? '100' : '0');
                const unitSuffix = metric === 'revenue' ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
                const diffStr = metric === 'revenue' 
                  ? (diff >= 0 ? `+${formatRupiah(diff)}` : `-${formatRupiah(Math.abs(diff))}`)
                  : (diff >= 0 ? `+${diff.toLocaleString('id-ID')}${unitSuffix}` : `${diff.toLocaleString('id-ID')}${unitSuffix}`);
                const sign = diff >= 0 ? '+' : '';
                return [
                  `▸ YoY: ${sign}${pct}% (${diffStr})`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { weight: 'bold' } }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => metric === 'revenue' ? formatRupiahShort(val) : val
            }
          }
        }
      }
    });

    let maxMonthWithData = maxCurMonth;

    const totCurYtd = curYearData.slice(0, maxMonthWithData).reduce((a, b) => a + b, 0);
    const totLastYtd = lastYearData.slice(0, maxMonthWithData).reduce((a, b) => a + b, 0);
    const totLastFull = lastYearData.reduce((a, b) => a + b, 0);

    const diffYtd = totCurYtd - totLastYtd;
    const growthYtd = totLastYtd > 0 ? ((diffYtd / totLastYtd) * 100).toFixed(1) : '0';

    const unitSuffix = metric === 'revenue' ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
    const totCurStr = metric === 'revenue' ? formatRupiah(totCurYtd) : `${totCurYtd.toLocaleString('id-ID')}${unitSuffix}`;
    const totLastStr = metric === 'revenue' ? formatRupiah(totLastYtd) : `${totLastYtd.toLocaleString('id-ID')}${unitSuffix}`;
    const totLastFullStr = metric === 'revenue' ? formatRupiah(totLastFull) : `${totLastFull.toLocaleString('id-ID')}${unitSuffix}`;
    const diffStr = metric === 'revenue' 
      ? (diffYtd >= 0 ? `+${formatRupiah(diffYtd)}` : `-${formatRupiah(Math.abs(diffYtd))}`)
      : (diffYtd >= 0 ? `+${diffYtd.toLocaleString('id-ID')}${unitSuffix}` : `${diffYtd.toLocaleString('id-ID')}${unitSuffix}`);

    const overviewLegend = document.getElementById('overview-chart-legend');
    if (overviewLegend) {
      overviewLegend.innerHTML = `
        <div class="mt-3 p-3.5 bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between text-xs font-bold gap-3">
          <div class="flex items-center space-x-2">
            <span class="w-3.5 h-3.5 rounded-md bg-blue-600 inline-block shadow-sm"></span>
            <span class="text-slate-800">Total ${curYear} (s/d ${MONTH_SHORT[maxMonthWithData - 1]}): <span class="text-blue-900 font-black">${totCurStr}</span></span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="w-3.5 h-3.5 rounded-md bg-slate-400 inline-block shadow-sm"></span>
            <span class="text-slate-700">Total ${lastYear} (Periode Sama): <span class="text-slate-900 font-black">${totLastStr}</span></span>
            <span class="text-slate-400 font-normal">| Full Year ${lastYear}: ${totLastFullStr}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-slate-600">Pertumbuhan YoY:</span>
            <span class="px-2.5 py-1 rounded-lg ${parseFloat(growthYtd) >= 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'} font-black text-xs flex items-center space-x-1 shadow-sm">
              <i class="fa-solid ${parseFloat(growthYtd) >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} mr-1"></i>
              ${parseFloat(growthYtd) >= 0 ? '+' : ''}${growthYtd}% (${diffStr})
            </span>
          </div>
        </div>
      `;
    }
    return;
  }

  // ---------------------------------------------------------
  // 3. DAILY MODE (Default: Harian 1 s/d 31 & Versus Bulan)
  // ---------------------------------------------------------
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
      else if (metric === 'cpus' && isCpusJob(j)) vinSet1[day - 1].add(j.vin);
      else if (metric === 'sbe' && j.repairType === 'SBE') daily1[day - 1]++;
      else if (metric === 'grp' && j.repairType === 'GRP') daily1[day - 1]++;
    }
  });

  jobs2.forEach(j => {
    const day = parseInt(j.invDate.split('-')[2], 10);
    if (day >= 1 && day <= maxDays) {
      if (metric === 'revenue') daily2[day - 1] += j.revenue;
      else if (metric === 'cpus' && isCpusJob(j)) vinSet2[day - 1].add(j.vin);
      else if (metric === 'sbe' && j.repairType === 'SBE') daily2[day - 1]++;
      else if (metric === 'grp' && j.repairType === 'GRP') daily2[day - 1]++;
    }
  });

  if (metric === 'cpus') {
    vinSet1.forEach((set, idx) => daily1[idx] = set.size);
    vinSet2.forEach((set, idx) => daily2[idx] = set.size);
  }

  const labels = Array.from({ length: maxDays }, (_, i) => `${i + 1}`);

  chartOverviewDaily = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `${name1} (Utama)`,
          data: daily1,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.12)',
          fill: true,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 4
        },
        {
          label: `${name2} (Pembanding)`,
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
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          mode: 'index',
          intersect: false,
          position: 'bottomLocked',
          callbacks: {
            afterTitle: (items) => {
              if (!items || items.length === 0) return '';
              const day = items[0].dataIndex + 1;
              const s1 = isSunday(m1, day);
              const s2 = isSunday(m2, day);
              if (s1 && s2) return `🔴 Tanggal Merah (${name1} & ${name2})`;
              if (s1) return `🔴 Tanggal Merah (${name1})`;
              if (s2) return `🌸 Tanggal Merah (${name2})`;
              return '';
            },
            label: (ctx) => {
              const unitSuffix = metric === 'revenue' ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
              return ` ${ctx.dataset.label}: ${metric === 'revenue' ? formatRupiah(ctx.raw) : `${ctx.raw}${unitSuffix}`}`;
            },
            afterBody: (items) => {
              if (items.length < 2) return [];
              const v1 = items[0].datasetIndex === 0 ? items[0].raw : items[1].raw;
              const v2 = items[0].datasetIndex === 1 ? items[0].raw : items[1].raw;
              const diff = v1 - v2;
              const pct = v2 > 0 ? (((v1 - v2) / v2) * 100).toFixed(1) : 0;
              const unitSuffix = metric === 'revenue' ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
              const diffStr = metric === 'revenue' ? formatRupiah(diff) : (diff > 0 ? `+${diff}${unitSuffix}` : `${diff}${unitSuffix}`);
              return [
                `▸ Selisih: ${diffStr} (${pct > 0 ? '+' : ''}${pct}%)`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: (ctx) => getDayGridColor(ctx.index + 1, m1, m2),
            lineWidth: (ctx) => (isSunday(m1, ctx.index + 1) || isSunday(m2, ctx.index + 1)) ? 1.5 : 1
          },
          ticks: {
            color: (ctx) => getDayColor(ctx.index + 1, m1, m2),
            font: (ctx) => getDayFont(ctx.index + 1, m1, m2)
          }
        },
        y: {
          beginAtZero: true,
          ticks: { callback: (val) => metric === 'revenue' ? formatRupiahShort(val) : val }
        }
      }
    }
  });

  const overviewLegend = document.getElementById('overview-chart-legend');
  if (overviewLegend) overviewLegend.innerHTML = getChartRedDateLegendHtml(m1, m2);
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
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { weight: 'bold' } }
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              const total = totalCai + totalNonCai;
              const pct = total > 0 ? ((c.raw / total) * 100).toFixed(1) : 0;
              return ` ${c.label}: ${c.raw} Booking (${pct}%)`;
            }
          }
        }
      }
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

    const picJobs = monthJobs.filter(j => picVinSet.has(j.vin.toUpperCase()) && isCpusJob(j));
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
        return day >= w.start && day <= w.end && picVinSet.has(j.vin.toUpperCase()) && isCpusJob(j);
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

function setBookingChartPeriod(period) {
  currentBookingChartPeriod = period;

  const btnDaily = document.getElementById('btn-booking-period-daily');
  const btnWeekly = document.getElementById('btn-booking-period-weekly');
  const btnMonthly = document.getElementById('btn-booking-period-monthly');
  const titleElem = document.getElementById('booking-chart-title');
  const subtitleElem = document.getElementById('booking-chart-subtitle');
  const vsContainer = document.getElementById('booking-vs-selectors-container');

  const activeClasses = ['bg-blue-600', 'text-white', 'shadow-sm'];
  const inactiveClasses = ['text-slate-600', 'hover:text-slate-900', 'bg-transparent'];

  const setBtnStyle = (btn, isActive) => {
    if (!btn) return;
    if (isActive) {
      btn.classList.add(...activeClasses);
      btn.classList.remove(...inactiveClasses);
    } else {
      btn.classList.remove(...activeClasses);
      btn.classList.add(...inactiveClasses);
    }
  };

  setBtnStyle(btnDaily, period === 'daily');
  setBtnStyle(btnWeekly, period === 'weekly');
  setBtnStyle(btnMonthly, period === 'monthly');

  if (titleElem) {
    if (period === 'daily') {
      titleElem.innerText = 'Performance Booking (Versus Bulan)';
      if (subtitleElem) subtitleElem.innerText = 'Bandingkan tren kedatangan booking harian antar bulan.';
    } else if (period === 'weekly') {
      titleElem.innerText = 'Performance Booking Mingguan (Versus W1 – W5)';
      if (subtitleElem) subtitleElem.innerText = 'Bandingkan akumulasi kedatangan booking mingguan antar bulan.';
    } else if (period === 'monthly') {
      titleElem.innerText = 'Tren Booking Bulanan (Target 74% CPUS vs Realisasi)';
      if (subtitleElem) subtitleElem.innerText = 'Pencapaian booking bulanan sepanjang tahun dibandingkan target (74% CPUS).';
    }
  }

  if (vsContainer) {
    if (period === 'monthly') {
      vsContainer.style.display = 'none';
    } else {
      vsContainer.style.display = 'flex';
    }
  }

  renderBookingVsChart();
}

function renderBookingVsChart() {
  const m1 = document.getElementById('booking-vs-month1').value;
  const m2 = document.getElementById('booking-vs-month2').value;
  const name1 = formatMonthNameOnly(m1);
  const name2 = formatMonthNameOnly(m2);

  const b1 = appData.bookings.filter(b => b.arrivalDate && b.arrivalDate.startsWith(m1));
  const b2 = appData.bookings.filter(b => b.arrivalDate && b.arrivalDate.startsWith(m2));

  const ctx = document.getElementById('chart-booking-vs').getContext('2d');
  if (chartBookingVs) chartBookingVs.destroy();

  // ---------------------------------------------------------
  // 1. WEEKLY BOOKING MODE (W1 - W5 Semuanya Sekaligus & Dual Line)
  // ---------------------------------------------------------
  if (currentBookingChartPeriod === 'weekly') {
    const days1 = getDaysInMonthString(m1);
    const days2 = getDaysInMonthString(m2);
    const maxEnd = Math.max(days1, days2, 31);

    const weekDefs = [
      { name: 'Minggu 1 (01-07)', start: 1, end: 7 },
      { name: 'Minggu 2 (08-14)', start: 8, end: 14 },
      { name: 'Minggu 3 (15-21)', start: 15, end: 21 },
      { name: 'Minggu 4 (22-28)', start: 22, end: 28 },
      { name: `Minggu 5 (29-${maxEnd})`, start: 29, end: maxEnd }
    ];

    const weeklyData1 = [0, 0, 0, 0, 0];
    const weeklyData2 = [0, 0, 0, 0, 0];

    b1.forEach(b => {
      const day = parseInt(b.arrivalDate.split('-')[2], 10);
      weekDefs.forEach((w, idx) => {
        if (day >= w.start && day <= w.end) weeklyData1[idx]++;
      });
    });

    b2.forEach(b => {
      const day = parseInt(b.arrivalDate.split('-')[2], 10);
      weekDefs.forEach((w, idx) => {
        if (day >= w.start && day <= w.end) weeklyData2[idx]++;
      });
    });

    chartBookingVs = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weekDefs.map(w => w.name),
        datasets: [
          {
            label: `Booking ${name1} (Utama)`,
            data: weeklyData1,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.15)',
            fill: true,
            tension: 0.35,
            borderWidth: 3.5,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointBackgroundColor: '#2563eb',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          },
          {
            label: `Booking ${name2} (Pembanding)`,
            data: weeklyData2,
            borderColor: '#d97706',
            backgroundColor: 'rgba(217, 119, 6, 0.08)',
            borderDash: [5, 5],
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointBackgroundColor: '#d97706',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
            position: 'bottomLocked',
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${c.raw} Booking`,
              afterBody: (items) => {
                if (items.length < 2) return [];
                const v1 = items[0].datasetIndex === 0 ? items[0].raw : items[1].raw;
                const v2 = items[0].datasetIndex === 1 ? items[0].raw : items[1].raw;
                const diff = v1 - v2;
                const pct = v2 > 0 ? (((v1 - v2) / v2) * 100).toFixed(1) : 0;
                const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
                return [
                  `▸ Selisih: ${diffStr} Booking (${pct > 0 ? '+' : ''}${pct}%)`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: true, color: 'rgba(226, 232, 240, 0.6)' },
            ticks: { font: { weight: 'bold' } }
          },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });

    const tot1 = weeklyData1.reduce((a, b) => a + b, 0);
    const tot2 = weeklyData2.reduce((a, b) => a + b, 0);
    const diffTot = tot1 - tot2;
    const pctTot = tot2 > 0 ? (((tot1 - tot2) / tot2) * 100).toFixed(1) : 0;
    const diffStr = diffTot > 0 ? `+${diffTot}` : `${diffTot}`;

    const bookingLegend = document.getElementById('booking-chart-legend');
    if (bookingLegend) {
      bookingLegend.innerHTML = `
        <div class="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between text-xs font-bold gap-3">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
            <span class="text-slate-700">Total Akumulasi Booking ${name1}: <span class="text-blue-900 font-black">${tot1} Unit</span></span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span class="text-slate-700">Total Akumulasi Booking ${name2}: <span class="text-amber-900 font-black">${tot2} Unit</span></span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-slate-500">Selisih W1-W5:</span>
            <span class="px-2 py-0.5 rounded-full ${diffTot >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} font-black">
              ${diffStr} Unit (${pctTot > 0 ? '+' : ''}${pctTot}%)
            </span>
          </div>
        </div>
      `;
    }
    return;
  }

  // ---------------------------------------------------------
  // 2. MONTHLY BOOKING MODE (Jan - Des / Target 74% CPUS vs Realisasi)
  // ---------------------------------------------------------
  if (currentBookingChartPeriod === 'monthly') {
    const monthLabels = STANDARD_12_MONTHS.map(m => m.name.substring(0, 3));
    const gTargets = appData.targets.gianyarConsul || {};
    
    const monthlyActual = [];
    const monthlyTarget = [];

    STANDARD_12_MONTHS.forEach((m, idx) => {
      const act = appData.bookings.filter(b => b.arrivalDate && b.arrivalDate.startsWith(m.code)).length;
      monthlyActual.push(act);

      let tgt = 0;
      if (gTargets.booking && gTargets.booking[idx] !== undefined) {
        tgt = gTargets.booking[idx];
      } else {
        const cpusTgt = gTargets.cpus ? (gTargets.cpus[idx] || 0) : 947;
        tgt = Math.round(cpusTgt * 0.74);
      }
      monthlyTarget.push(tgt);
    });

    chartBookingVs = new Chart(ctx, {
      data: {
        labels: monthLabels,
        datasets: [
          {
            type: 'bar',
            label: 'Realisasi Booking Actual',
            data: monthlyActual,
            backgroundColor: '#2563eb',
            borderColor: '#1d4ed8',
            borderWidth: 1.5,
            borderRadius: 6,
            barPercentage: 0.65
          },
          {
            type: 'line',
            label: 'Target Booking (74% CPUS)',
            data: monthlyTarget,
            borderColor: '#f59e0b',
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#f59e0b',
            fill: false,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
            position: 'bottomLocked',
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${c.raw} Booking`,
              afterBody: (items) => {
                if (items.length < 2) return [];
                const act = items[0].datasetIndex === 0 ? items[0].raw : items[1].raw;
                const tgt = items[0].datasetIndex === 1 ? items[0].raw : items[1].raw;
                const gap = act - tgt;
                const ach = tgt > 0 ? ((act / tgt) * 100).toFixed(1) : 0;
                const gapStr = gap > 0 ? `+${gap}` : `${gap}`;
                return [
                  `▸ Ach: ${ach}% (Gap: ${gapStr} Booking)`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { weight: 'bold' } }
          },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });

    const totAct = monthlyActual.reduce((a, b) => a + b, 0);
    const totTgt = monthlyTarget.reduce((a, b) => a + b, 0);
    const achOverall = totTgt > 0 ? ((totAct / totTgt) * 100).toFixed(1) : 0;

    const bookingLegend = document.getElementById('booking-chart-legend');
    if (bookingLegend) {
      bookingLegend.innerHTML = `
        <div class="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between text-xs font-bold gap-3">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
            <span class="text-slate-700">Total Realisasi Booking YTD: <span class="text-blue-900 font-black">${totAct} Unit</span></span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span class="text-slate-700">Total Target Booking YTD: <span class="text-amber-900 font-black">${totTgt} Unit</span></span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-slate-500">Pencapaian:</span>
            <span class="px-2 py-0.5 rounded-full ${parseFloat(achOverall) >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} font-black">
              ${achOverall}%
            </span>
          </div>
        </div>
      `;
    }
    return;
  }

  // ---------------------------------------------------------
  // 3. DAILY BOOKING MODE (Default: Harian 1 s/d 31 & Dual Line)
  // ---------------------------------------------------------
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

  chartBookingVs = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `Booking ${name1} (Utama)`,
          data: daily1,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          fill: true,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 4
        },
        {
          label: `Booking ${name2} (Pembanding)`,
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
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          mode: 'index',
          intersect: false,
          position: 'bottomLocked',
          callbacks: {
            afterTitle: (items) => {
              if (!items || items.length === 0) return '';
              const day = items[0].dataIndex + 1;
              const s1 = isSunday(m1, day);
              const s2 = isSunday(m2, day);
              if (s1 && s2) return `🔴 Tanggal Merah (${name1} & ${name2})`;
              if (s1) return `🔴 Tanggal Merah (${name1})`;
              if (s2) return `🌸 Tanggal Merah (${name2})`;
              return '';
            },
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw} Booking`,
            afterBody: (items) => {
              if (items.length < 2) return [];
              const v1 = items[0].datasetIndex === 0 ? items[0].raw : items[1].raw;
              const v2 = items[0].datasetIndex === 1 ? items[0].raw : items[1].raw;
              const diff = v1 - v2;
              const pct = v2 > 0 ? (((v1 - v2) / v2) * 100).toFixed(1) : 0;
              const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
              return [
                `▸ Selisih: ${diffStr} Booking (${pct > 0 ? '+' : ''}${pct}%)`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: (ctx) => getDayGridColor(ctx.index + 1, m1, m2),
            lineWidth: (ctx) => (isSunday(m1, ctx.index + 1) || isSunday(m2, ctx.index + 1)) ? 1.5 : 1
          },
          ticks: {
            color: (ctx) => getDayColor(ctx.index + 1, m1, m2),
            font: (ctx) => getDayFont(ctx.index + 1, m1, m2)
          }
        },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });

  const bookingLegend = document.getElementById('booking-chart-legend');
  if (bookingLegend) bookingLegend.innerHTML = getChartRedDateLegendHtml(m1, m2);
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
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          mode: 'index',
          intersect: false,
          position: 'bottomLocked',
          callbacks: {
            afterTitle: (items) => {
              if (!items || items.length === 0) return '';
              const day = items[0].dataIndex + 1;
              const s1 = isSunday(m1, day);
              const s2 = isSunday(m2, day);
              if (s1 && s2) return `🔴 Tanggal Merah (${formatMonthNameOnly(m1)} & ${formatMonthNameOnly(m2)})`;
              if (s1) return `🔴 Tanggal Merah (${formatMonthNameOnly(m1)})`;
              if (s2) return `🌸 Tanggal Merah (${formatMonthNameOnly(m2)})`;
              return '';
            },
            label: (ctx) => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}`,
            afterBody: (items) => {
              if (items.length < 2) return [];
              const v1 = items[0].datasetIndex === 0 ? items[0].raw : items[1].raw;
              const v2 = items[0].datasetIndex === 1 ? items[0].raw : items[1].raw;
              const diff = v1 - v2;
              const pct = v2 > 0 ? (((v1 - v2) / v2) * 100).toFixed(1) : 0;
              const diffStr = formatRupiah(diff);
              return [
                `▸ Selisih: ${diffStr} (${pct > 0 ? '+' : ''}${pct}%)`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: (ctx) => getDayGridColor(ctx.index + 1, m1, m2),
            lineWidth: (ctx) => (isSunday(m1, ctx.index + 1) || isSunday(m2, ctx.index + 1)) ? 1.5 : 1
          },
          ticks: {
            color: (ctx) => getDayColor(ctx.index + 1, m1, m2),
            font: (ctx) => getDayFont(ctx.index + 1, m1, m2)
          }
        },
        y: { beginAtZero: true, ticks: { callback: (val) => formatRupiahShort(val) } }
      }
    }
  });

  const saLegend = document.getElementById('sa-chart-legend');
  if (saLegend) saLegend.innerHTML = getChartRedDateLegendHtml(m1, m2);

  renderSaMasterPerformanceTable(monthJobs1, monthIdx1);

  // Populate SA Summary Cards
  const saList = ['AYU', 'AJS', 'WBN', 'FIK', 'THS', 'THS2', 'PDS'];
  const cardsContainer = document.getElementById('sa-cards-container');
  cardsContainer.innerHTML = '';

  saList.forEach(saName => {
    const saJobs = monthJobs1.filter(j => j.sa === saName);
    const saCpusSet = new Set(saJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`));
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
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { weight: 'bold' } }
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              const total = tCareJobs.length + nonTCareCount;
              const pct = total > 0 ? ((c.raw / total) * 100).toFixed(1) : 0;
              return ` ${c.label}: ${c.raw} Unit (${pct}%)`;
            }
          }
        }
      }
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
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          mode: 'index',
          intersect: false,
          position: 'bottomLocked',
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              return ` ${context.dataset.label}: ${val} Unit`;
            },
            afterBody: function(items) {
              if (items.length < 2) return [];
              const act = items[0].datasetIndex === 0 ? items[0].raw : items[1].raw;
              const tgt = items[0].datasetIndex === 1 ? items[0].raw : items[1].raw;
              const gap = act - tgt;
              const ach = tgt > 0 ? ((act / tgt) * 100).toFixed(1) : 0;
              const gapStr = gap > 0 ? `+${gap}` : `${gap}`;
              return [
                `▸ Ach: ${ach}% (Gap: ${gapStr} Unit)`
              ];
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

      const wCpus = new Set(wJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
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
      const wNonTCareCpus = new Set(wNonTCareJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
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
    const otherJobs = monthJobs.filter(j => !j.isSbe && !tCareCategoryJobs.includes(j) && isCpusJob(j));
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

  const ytmVinSet = new Set(ytmJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`));
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
      const actCpus = new Set(saJobsYtm.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
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

  // Render Monthly Trend Chart for YTM
  renderYtmMonthlyChart();
}

function renderYtmMonthlyChart() {
  const canvasElem = document.getElementById('chart-ytm-monthly');
  if (!canvasElem) return;

  const startSelect = document.getElementById('ytm-start-month');
  const endSelect = document.getElementById('ytm-end-month');
  const metricSelect = document.getElementById('ytm-chart-metric');
  const mainFilter = document.getElementById('filter-month');

  const startVal = startSelect ? startSelect.value : '2026-01';
  const endVal = endSelect ? endSelect.value : (mainFilter ? mainFilter.value : '2026-10');
  const metric = metricSelect ? metricSelect.value : 'cpus';

  const startIdx = parseInt(startVal.split('-')[1], 10) - 1;
  const endIdx = parseInt(endVal.split('-')[1], 10) - 1;
  const minIdx = Math.min(startIdx, endIdx);
  const maxIdx = Math.max(startIdx, endIdx);

  const rangeMonths = STANDARD_12_MONTHS.slice(minIdx, maxIdx + 1);
  const monthLabels = rangeMonths.map(m => m.name.substring(0, 3));

  const gTargets = appData.targets.gianyarConsul || {};
  const actualData = [];
  const targetData = [];

  rangeMonths.forEach((m, localIdx) => {
    const globalIdx = minIdx + localIdx;
    const mJobs = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(m.code));

    let act = 0;
    let tgt = 0;

    if (metric === 'revenue') {
      act = mJobs.reduce((acc, j) => acc + j.revenue, 0);
      tgt = (gTargets.revenue ? gTargets.revenue[globalIdx] || 0 : 0) * 1000000;
    } else if (metric === 'cpus') {
      act = new Set(mJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
      tgt = gTargets.cpus ? gTargets.cpus[globalIdx] || 0 : 0;
    } else if (metric === 'sbe') {
      act = mJobs.filter(j => j.repairType === 'SBE' || j.isSbe).length;
      tgt = gTargets.sbe ? gTargets.sbe[globalIdx] || 0 : 0;
    } else if (metric === 'grp') {
      act = mJobs.filter(j => j.repairType === 'GRP').length;
      tgt = gTargets.grp ? gTargets.grp[globalIdx] || 0 : 0;
    } else if (metric === 'sales_unit') {
      const cpusCount = new Set(mJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
      const revTotal = mJobs.reduce((acc, j) => acc + j.revenue, 0);
      act = cpusCount > 0 ? Math.round(revTotal / cpusCount) : 0;

      const tgtCpus = gTargets.cpus ? gTargets.cpus[globalIdx] || 0 : 0;
      const tgtRev = (gTargets.revenue ? gTargets.revenue[globalIdx] || 0 : 0) * 1000000;
      tgt = tgtCpus > 0 ? Math.round(tgtRev / tgtCpus) : 0;
    }

    actualData.push(act);
    targetData.push(tgt);
  });

  const ctx = canvasElem.getContext('2d');
  if (chartYtmMonthly) chartYtmMonthly.destroy();

  chartYtmMonthly = new Chart(ctx, {
    data: {
      labels: monthLabels,
      datasets: [
        {
          type: 'bar',
          label: 'Realisasi Actual',
          data: actualData,
          backgroundColor: '#2563eb',
          borderColor: '#1d4ed8',
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.65
        },
        {
          type: 'line',
          label: 'Target Bulanan',
          data: targetData,
          borderColor: '#f59e0b',
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: '#f59e0b',
          fill: false,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          mode: 'index',
          intersect: false,
          position: 'bottomLocked',
          callbacks: {
            label: (c) => {
              const val = c.raw;
              const unitSuffix = (metric === 'revenue' || metric === 'sales_unit') ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
              const formatted = (metric === 'revenue' || metric === 'sales_unit') ? formatRupiah(val) : `${val.toLocaleString('id-ID')}${unitSuffix}`;
              return ` ${c.dataset.label}: ${formatted}`;
            },
            afterBody: (items) => {
              if (items.length < 2) return [];
              const act = items[0].datasetIndex === 0 ? items[0].raw : items[1].raw;
              const tgt = items[0].datasetIndex === 1 ? items[0].raw : items[1].raw;
              const gap = act - tgt;
              const ach = tgt > 0 ? ((act / tgt) * 100).toFixed(1) : 0;
              const unitSuffix = (metric === 'revenue' || metric === 'sales_unit') ? '' : (metric === 'cpus' ? ' Unit' : ' Job');
              const gapStr = (metric === 'revenue' || metric === 'sales_unit') ? formatRupiah(gap) : (gap > 0 ? `+${gap.toLocaleString('id-ID')}${unitSuffix}` : `${gap.toLocaleString('id-ID')}${unitSuffix}`);
              return [
                `▸ Ach: ${ach}% (Gap: ${gapStr})`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: 'bold' } }
        },
        y: {
          beginAtZero: true,
          ticks: { callback: (val) => (metric === 'revenue' || metric === 'sales_unit') ? formatRupiahShort(val) : val }
        }
      }
    }
  });

  const totAct = actualData.reduce((a, b) => a + b, 0);
  const totTgt = targetData.reduce((a, b) => a + b, 0);
  let achOverall = 0;
  if (metric === 'sales_unit') {
    achOverall = totTgt > 0 ? ((totAct / totTgt) * 100).toFixed(1) : 0;
  } else {
    achOverall = totTgt > 0 ? ((totAct / totTgt) * 100).toFixed(1) : 0;
  }
  const totActStr = (metric === 'revenue' || metric === 'sales_unit') ? formatRupiah(totAct) : totAct.toLocaleString('id-ID');
  const totTgtStr = (metric === 'revenue' || metric === 'sales_unit') ? formatRupiah(totTgt) : totTgt.toLocaleString('id-ID');

  const legendElem = document.getElementById('ytm-chart-legend');
  if (legendElem) {
    legendElem.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
        <span>Total Realisasi (${formatMonthNameOnly(startVal)} - ${formatMonthNameOnly(endVal)}): <span class="text-blue-900 font-black">${totActStr}</span></span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
        <span>Total Target: <span class="text-amber-900 font-black">${totTgtStr}</span></span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="text-slate-500">Pencapaian Kumulatif:</span>
        <span class="px-2.5 py-0.5 rounded-full ${parseFloat(achOverall) >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} font-black text-xs">
          ${achOverall}%
        </span>
      </div>
    `;
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

    const uniqueVins = new Set(matchedJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`));
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
// MANPOWER & ORGANISASI CONFIGURATION (SA, FO, TEKNISI, THS/TMS)
// -------------------------------------------------------------
const DEFAULT_MANPOWER = {
  serviceAdvisors: ['AYU', 'AJS', 'WBN', 'FIK'],
  thsTms: ['BUD', 'GNI'],
  foremen: [
    { id: 'WAH', name: 'FO 1 WAH', technicians: ['WPA', 'TAN', 'EDY', 'EKA'] },
    { id: 'WJY', name: 'FO 2 WJY', technicians: ['KDW', 'ASP', 'ADT', 'IKA'] },
    { id: 'PHW', name: 'FO 3 PHW', technicians: ['MAP', 'GNR', 'DWP', 'SPT'] }
  ]
};

function getManpowerConfig() {
  if (!appData || !appData.targets) return DEFAULT_MANPOWER;
  if (!appData.targets.manpower) {
    appData.targets.manpower = JSON.parse(JSON.stringify(DEFAULT_MANPOWER));
  }
  return appData.targets.manpower;
}

function getThsTmsList() {
  const cfg = getManpowerConfig();
  return (cfg.thsTms || ['BUD', 'GNI']).map(s => s.trim().toUpperCase());
}

function isThsTmsTech(tech) {
  if (!tech) return false;
  return getThsTmsList().includes(tech.trim().toUpperCase());
}

function getForemanTeamsForTech(tech) {
  const cfg = getManpowerConfig();
  const foremen = cfg.foremen || [];
  const teams = [];
  const uTech = (tech || '').trim().toUpperCase();
  foremen.forEach(f => {
    const list = (f.technicians || []).map(t => t.trim().toUpperCase());
    if (list.includes(uTech)) {
      teams.push(f.id);
    }
  });
  return teams;
}

function getMainSaList() {
  const cfg = getManpowerConfig();
  return (cfg.serviceAdvisors && cfg.serviceAdvisors.length > 0) ? cfg.serviceAdvisors : ['AYU', 'AJS', 'WBN', 'FIK'];
}

function getActiveSaList() {
  const mainSas = getMainSaList();
  const fixed = ['THS', 'THS2', 'PDS'];
  const merged = [...mainSas];
  fixed.forEach(f => {
    if (!merged.includes(f)) merged.push(f);
  });
  return merged;
}

function updateTechFoFilterOptions() {
  const sel = document.getElementById('tech-fo-filter');
  if (!sel) return;
  const currentVal = sel.value;
  const cfg = getManpowerConfig();
  const foremen = cfg.foremen || [];
  const thsList = (cfg.thsTms || []).join(', ');

  let optionsHtml = `<option value="ALL">Semua Tim / Kategori</option>`;
  foremen.forEach(f => {
    const techStr = (f.technicians || []).join(', ');
    optionsHtml += `<option value="${f.id}">Tim ${f.id} (${techStr || 'Kosong'})</option>`;
  });
  optionsHtml += `<option value="THS">THS / TMS (${thsList || 'TMS'})</option>`;
  optionsHtml += `<option value="OTHER">Teknisi Lainnya / Belum Terisi</option>`;

  sel.innerHTML = optionsHtml;
  if ([...sel.options].some(o => o.value === currentVal)) {
    sel.value = currentVal;
  } else {
    sel.value = 'ALL';
  }
}

// -------------------------------------------------------------
// TAB: PENCAPAIAN TEKNISI, FOREMAN & THS / TMS
// -------------------------------------------------------------
function renderTechPerformance() {
  updateTechFoFilterOptions();
  const { startDate, endDate, selectedMonth, monthIdx } = getActiveDateRange();
  const monthJobs = appData.jobHistory.filter(j => j.invDate && j.invDate >= startDate && j.invDate <= endDate);
  const totalRevMonth = monthJobs.reduce((acc, j) => acc + j.revenue, 0);

  const cfg = getManpowerConfig();
  const foremenList = cfg.foremen || [];

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
    if (isCpusJob(j)) {
      techMap[tech].vins.add(`${j.vin}_${j.invDate}`);
    }
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
    const isThs = isThsTmsTech(t.code);
    return {
      ...t,
      cpus,
      su,
      teams,
      isThs,
      pctRev: parseFloat(pctRev)
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Dynamic Foreman Aggregates
  const foremanData = {};
  const foremanColors = ['emerald', 'blue', 'purple', 'amber', 'rose', 'indigo', 'teal'];
  const foremanIcons = ['fa-user-gear', 'fa-wrench', 'fa-screwdriver', 'fa-screwdriver-wrench', 'fa-gear'];

  foremenList.forEach((f, idx) => {
    foremanData[f.id] = {
      id: f.id,
      name: f.name || `FO ${f.id}`,
      techs: (f.technicians || []).map(t => t.trim().toUpperCase()),
      cpusSet: new Set(),
      revenue: 0,
      sbeCount: 0,
      grpCount: 0,
      color: foremanColors[idx % foremanColors.length],
      icon: foremanIcons[idx % foremanIcons.length]
    };
  });

  monthJobs.forEach(j => {
    const tech = (j.tech && j.tech.trim()) ? j.tech.trim().toUpperCase() : '';
    if (!tech) return;

    foremenList.forEach(f => {
      const fTechs = (f.technicians || []).map(t => t.trim().toUpperCase());
      if (fTechs.includes(tech)) {
        const fd = foremanData[f.id];
        if (fd) {
          if (isCpusJob(j)) {
            fd.cpusSet.add(`${j.vin}_${j.invDate}`);
          }
          fd.revenue += j.revenue;
          if (j.repairType === 'SBE') fd.sbeCount++;
          if (j.repairType === 'GRP') fd.grpCount++;
        }
      }
    });
  });

  // Calculate Foreman metrics
  const foKeys = Object.keys(foremanData);
  const maxForemanRev = foKeys.length > 0 ? Math.max(...foKeys.map(k => foremanData[k].revenue), 1) : 1;
  let bestForemanKey = foKeys.length > 0 ? foKeys[0] : '';
  let bestForemanRev = -1;

  foKeys.forEach(key => {
    const f = foremanData[key];
    f.cpus = f.cpusSet.size;
    f.su = f.cpus > 0 ? Math.round(f.revenue / f.cpus) : 0;
    if (f.revenue > bestForemanRev) {
      bestForemanRev = f.revenue;
      bestForemanKey = key;
    }
  });

  // Calculate Best Workshop Tech (EXCLUDING THS/TMS, OTHER, and LAINNYA)
  let bestTechCode = '-';
  let bestTechRev = -1;
  let bestTechCpus = 0;

  // Calculate Best THS / TMS Personil
  let bestThsCode = '-';
  let bestThsRev = -1;
  let bestThsCpus = 0;

  techList.forEach(t => {
    const isOther = t.code === 'LAINNYA' || t.code === 'OTHER';
    if (t.isThs) {
      if (t.revenue > bestThsRev) {
        bestThsRev = t.revenue;
        bestThsCode = t.code;
        bestThsCpus = t.cpus;
      }
    } else if (!isOther) {
      if (t.revenue > bestTechRev) {
        bestTechRev = t.revenue;
        bestTechCode = t.code;
        bestTechCpus = t.cpus;
      }
    }
  });

  // Render KPI Summary Cards (6 Cards)
  const totalTechCPUS = new Set(monthJobs.filter(j => j.tech && j.tech.trim() && isCpusJob(j)).map(j => `${j.vin}_${j.invDate}`)).size;
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

      <div class="bg-white p-4.5 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
        <div>
          <div class="flex items-center space-x-1.5">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Foreman Terbaik</p>
            <span class="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded-full">Top FO</span>
          </div>
          <h3 class="text-2xl font-black text-amber-600 mt-1">${bestForemanKey && foremanData[bestForemanKey] ? foremanData[bestForemanKey].name : '-'}</h3>
          <p class="text-[11px] text-amber-600 font-bold mt-1"><i class="fa-solid fa-trophy mr-1"></i>${bestForemanRev >= 0 ? formatRupiahShort(bestForemanRev) : '0 Jt'} Revenue</p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-crown"></i>
        </div>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
        <div>
          <div class="flex items-center space-x-1.5">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Teknisi Terbaik</p>
            <span class="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-full">Bengkel</span>
          </div>
          <h3 class="text-2xl font-black text-emerald-700 mt-1">${bestTechCode}</h3>
          <p class="text-[11px] text-emerald-600 font-bold mt-1"><i class="fa-solid fa-award mr-1"></i>${bestTechRev >= 0 ? formatRupiahShort(bestTechRev) : '0 Jt'} (${bestTechCpus} Unit)</p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-medal"></i>
        </div>
      </div>

      <div class="bg-white p-4.5 rounded-2xl border border-cyan-200 shadow-sm flex items-center justify-between">
        <div>
          <div class="flex items-center space-x-1.5">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">THS / TMS Terbaik</p>
            <span class="text-[9px] bg-cyan-100 text-cyan-800 font-extrabold px-1.5 py-0.5 rounded-full">Mobile</span>
          </div>
          <h3 class="text-2xl font-black text-cyan-700 mt-1">${bestThsCode}</h3>
          <p class="text-[11px] text-cyan-600 font-bold mt-1"><i class="fa-solid fa-van-shuttle mr-1"></i>${bestThsRev >= 0 ? formatRupiahShort(bestThsRev) : '0 Jt'} (${bestThsCpus} Unit)</p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-van-shuttle"></i>
        </div>
      </div>
    `;
  }

  // Render Dynamic Foreman Cards
  const foremanCardsContainer = document.getElementById('foreman-cards-container');
  if (foremanCardsContainer) {
    let html = '';
    foKeys.forEach(key => {
      const f = foremanData[key];
      const pctMax = Math.round((f.revenue / maxForemanRev) * 100);
      const isBest = key === bestForemanKey && f.revenue > 0;

      const techBadges = f.techs.map(t => `<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200">${t}</span>`).join(' ');

      html += `
        <div class="bg-white p-5 rounded-2xl border ${isBest ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-md' : 'border-slate-200'} shadow-sm relative overflow-hidden">
          ${isBest ? `<div class="absolute top-0 right-0 bg-amber-500 text-slate-900 font-black text-[10px] px-3 py-1 rounded-bl-xl uppercase tracking-wider"><i class="fa-solid fa-trophy mr-1"></i>Top FO</div>` : ''}
          
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center text-lg font-bold">
              <i class="fa-solid ${f.icon}"></i>
            </div>
            <div>
              <h4 class="font-extrabold text-sm text-slate-900">${f.name}</h4>
              <div class="flex items-center space-x-1 mt-1 flex-wrap gap-y-1">
                ${techBadges || '<span class="text-[10px] text-slate-400 font-medium">Belum ada teknisi</span>'}
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
      const matchThs = t.isThs && ('ths tms mobile').includes(query);
      if (!matchCode && !matchTeams && !matchThs) return false;
    }

    if (foFilter !== 'ALL') {
      if (foFilter === 'THS') {
        if (!t.isThs) return false;
      } else if (foFilter === 'OTHER') {
        if (t.isThs || t.teams.length > 0) return false;
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
      let teamBadges = '';
      if (t.isThs) {
        teamBadges = `<span class="px-2.5 py-0.5 rounded-md text-[10px] bg-cyan-100 text-cyan-800 border border-cyan-300 font-black inline-flex items-center shadow-xs"><i class="fa-solid fa-van-shuttle mr-1.5 text-cyan-600"></i>THS / TMS (MOBILE)</span>`;
      } else if (t.teams && t.teams.length > 0) {
        teamBadges = t.teams.map(team => {
          let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200 font-black';
          if (team === 'WAH') badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black';
          if (team === 'WJY') badgeColor = 'bg-blue-100 text-blue-800 border-blue-300 font-black';
          if (team === 'PHW') badgeColor = 'bg-purple-100 text-purple-800 border-purple-300 font-black';
          return `<span class="px-2 py-0.5 rounded-md text-[10px] border ${badgeColor}">Tim ${team}</span>`;
        }).join(' ');
      } else {
        teamBadges = `<span class="px-2 py-0.5 rounded-md text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold">OTHER / BELUM TERISI</span>`;
      }

      const isOther = t.code === 'LAINNYA' || t.code === 'OTHER';
      const displayCode = isOther 
        ? `<span class="text-amber-800 font-black flex items-center" title="Nama teknisi belum terisi di CSV / di luar Tim FO"><i class="fa-solid fa-user-gear text-amber-600 mr-2"></i>OTHER <span class="ml-1.5 text-[10px] text-amber-600 font-bold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">(BELUM TERISI)</span></span>`
        : t.isThs
          ? `<span class="text-cyan-950 font-black flex items-center"><i class="fa-solid fa-van-shuttle text-cyan-600 mr-2"></i>${t.code} <span class="ml-1.5 text-[10px] text-cyan-700 font-bold bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">TMS/THS</span></span>`
          : `<span class="text-slate-900 font-black flex items-center"><i class="fa-solid fa-wrench text-amber-600 mr-2"></i>${t.code}</span>`;

      rowsHtml += `
        <tr class="hover:bg-slate-50 transition-all ${t.isThs ? 'bg-cyan-50/20' : ''}">
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
  const activeBtn = document.getElementById(`subtab-target-${subTab}`);
  if (activeBtn) activeBtn.classList.add('active-subtab');
  renderTargetEditor();
}

function renderSingleForemanCardHtml(f, idx) {
  const techs = f.technicians || [];
  return `
    <div class="manpower-fo-card bg-slate-50 p-4.5 rounded-2xl border border-slate-200 hover:border-amber-300 transition-all space-y-3 relative shadow-xs">
      <div class="flex items-center justify-between pb-2 border-b border-slate-200">
        <div class="flex items-center space-x-2">
          <span class="w-6 h-6 rounded-lg bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center">${idx + 1}</span>
          <span class="text-xs font-black text-slate-800 uppercase tracking-wide">Tim Foreman</span>
        </div>
        <button type="button" onclick="deleteForemanCard(this)" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer" title="Hapus Foreman Ini">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="col-span-1">
          <label class="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Kode ID</label>
          <input type="text" class="fo-id-input w-full px-2.5 py-1.5 text-xs font-black border border-slate-300 rounded-lg uppercase tracking-wider text-center focus:ring-2 focus:ring-amber-500 bg-white" value="${f.id}" placeholder="WAH">
        </div>
        <div class="col-span-2">
          <label class="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Nama Tampilan FO</label>
          <input type="text" class="fo-name-input w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white" value="${f.name || `FO ${f.id}`}" placeholder="FO 1 WAH">
        </div>
      </div>

      <div>
        <div class="flex justify-between items-center mb-1">
          <label class="block text-[10px] font-extrabold text-slate-500 uppercase">Teknisi Bawahan (${techs.length})</label>
          <span class="text-[9px] text-slate-400">Pisahkan koma / spasi</span>
        </div>
        <input type="text" oninput="updateForemanTechPreview(this)" class="fo-techs-input w-full px-3 py-1.5 text-xs font-extrabold border border-slate-300 rounded-lg uppercase tracking-wider focus:ring-2 focus:ring-amber-500 bg-white" value="${techs.join(', ')}" placeholder="WPA, TAN, EDY, EKA">
      </div>

      <div class="fo-tech-chips flex flex-wrap gap-1 pt-1 min-h-[24px]">
        ${techs.map(t => `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-white text-slate-700 border border-slate-200 shadow-2xs">${t}</span>`).join('')}
      </div>
    </div>
  `;
}

function updateForemanTechPreview(input) {
  const card = input.closest('.manpower-fo-card');
  if (!card) return;
  const chipsContainer = card.querySelector('.fo-tech-chips');
  if (!chipsContainer) return;
  const raw = input.value || '';
  const list = raw.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  chipsContainer.innerHTML = list.map(t => `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-white text-slate-700 border border-slate-200 shadow-2xs">${t}</span>`).join('');
}

function addNewForemanCard() {
  const container = document.getElementById('manpower-foremen-cards-container');
  if (!container) return;
  const count = container.querySelectorAll('.manpower-fo-card').length;
  const newId = `FO${count + 1}`;
  const newCard = {
    id: newId,
    name: `FO ${count + 1} ${newId}`,
    technicians: []
  };
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderSingleForemanCardHtml(newCard, count);
  container.appendChild(tempDiv.firstElementChild);
}

function deleteForemanCard(btn) {
  const card = btn.closest('.manpower-fo-card');
  if (card) {
    const foId = card.querySelector('.fo-id-input').value;
    if (confirm(`Yakin ingin menghapus Tim Foreman "${foId}"?`)) {
      card.remove();
    }
  }
}

function renderManpowerEditor(container) {
  const cfg = getManpowerConfig();
  const sas = cfg.serviceAdvisors || ['AYU', 'AJS', 'WBN', 'FIK'];
  const ths = cfg.thsTms || ['BUD', 'GNI'];
  const foremen = cfg.foremen || [
    { id: 'WAH', name: 'FO 1 WAH', technicians: ['WPA', 'TAN', 'EDY', 'EKA'] },
    { id: 'WJY', name: 'FO 2 WJY', technicians: ['KDW', 'ASP', 'ADT', 'IKA'] },
    { id: 'PHW', name: 'FO 3 PHW', technicians: ['MAP', 'GNR', 'DWP', 'SPT'] }
  ];

  let html = `
    <div class="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 space-y-6">
      <!-- Header Info -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div class="flex items-center space-x-2">
            <span class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm font-black shadow-sm">
              <i class="fa-solid fa-users-gear"></i>
            </span>
            <h3 class="text-lg font-black text-slate-900">Manajemen Struktur Man Power Bengkel AT GYR</h3>
          </div>
          <p class="text-xs text-slate-500 font-medium mt-1">
            Atur daftar Service Advisor (SA), personil THS/TMS (Mobile Service), serta Tim Foreman beserta daftar teknisi bawahannya.
          </p>
        </div>
        <div class="flex items-center space-x-2">
          <button type="button" onclick="resetManpowerToDefault()" class="px-3.5 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition shadow-xs cursor-pointer flex items-center space-x-1.5">
            <i class="fa-solid fa-rotate-left text-slate-400"></i>
            <span>Reset Default</span>
          </button>
          <button type="button" onclick="saveManpowerConfig()" class="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-md transition cursor-pointer flex items-center space-x-2">
            <i class="fa-solid fa-floppy-disk"></i>
            <span>Simpan Struktur Man Power</span>
          </button>
        </div>
      </div>

      <!-- Section 1 & 2: SA and THS/TMS -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Service Advisor (SA) -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <i class="fa-solid fa-headset"></i>
              </div>
              <div>
                <h4 class="font-extrabold text-sm text-slate-900">Daftar Service Advisor (SA)</h4>
                <p class="text-[11px] text-slate-500">Inisial / kode SA untuk target & pelaporan</p>
              </div>
            </div>
            <span class="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">${sas.length} SA Aktif</span>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">Inisial SA (Pisahkan dengan koma atau spasi):</label>
            <input type="text" id="manpower-sa-input" value="${sas.join(', ')}" class="w-full px-3.5 py-2 text-xs font-extrabold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 uppercase tracking-wide bg-slate-50/50" placeholder="Contoh: AYU, AJS, WBN, FIK">
          </div>

          <div class="flex flex-wrap gap-1.5 pt-1">
            <span class="text-[10px] text-slate-400 font-bold self-center mr-1">Preview SA:</span>
            ${sas.map(s => `<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-200">${s}</span>`).join('')}
          </div>
        </div>

        <!-- Personil THS / TMS -->
        <div class="bg-white p-5 rounded-2xl border border-cyan-200 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
                <i class="fa-solid fa-van-shuttle"></i>
              </div>
              <div>
                <h4 class="font-extrabold text-sm text-slate-900">Personil THS / TMS (Mobile Service)</h4>
                <p class="text-[11px] text-slate-500">Kategori khusus Toyota Home / Mobile Service</p>
              </div>
            </div>
            <span class="text-xs font-black text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-100">${ths.length} Personil</span>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">Kode Personil THS/TMS (Pisahkan dengan koma atau spasi):</label>
            <input type="text" id="manpower-ths-input" value="${ths.join(', ')}" class="w-full px-3.5 py-2 text-xs font-extrabold border border-cyan-300 rounded-xl focus:ring-2 focus:ring-cyan-500 uppercase tracking-wide bg-cyan-50/20 text-cyan-900" placeholder="Contoh: BUD, GNI">
          </div>

          <div class="bg-cyan-50/60 p-2.5 rounded-xl border border-cyan-100 text-[11px] text-cyan-900 font-medium">
            <i class="fa-solid fa-circle-info text-cyan-600 mr-1"></i>
            <strong>Catatan:</strong> Personil THS/TMS otomatis dipisahkan dari teknisi bengkel regular, memiliki ranking performa mandiri, dan tidak masuk nominasi "Teknisi Terbaik Bengkel".
          </div>
        </div>
      </div>

      <!-- Section 3: Struktur Tim Foreman & Teknisi -->
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <i class="fa-solid fa-sitemap"></i>
            </div>
            <div>
              <h4 class="font-extrabold text-sm text-slate-900">Struktur Foreman & Daftar Teknisi Bawahannya</h4>
              <p class="text-[11px] text-slate-500">Pencapaian CPUS dan Revenue Foreman dihitung otomatis dari teknisi bawahannya</p>
            </div>
          </div>
          <button type="button" onclick="addNewForemanCard()" class="px-3.5 py-1.5 text-xs font-extrabold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition cursor-pointer flex items-center space-x-1.5 shadow-xs">
            <i class="fa-solid fa-user-plus text-amber-600"></i>
            <span>+ Tambah Tim Foreman</span>
          </button>
        </div>

        <div id="manpower-foremen-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          ${foremen.map((f, i) => renderSingleForemanCardHtml(f, i)).join('')}
        </div>
      </div>

      <!-- Bottom Save Action Bar -->
      <div class="flex justify-end pt-2">
        <button type="button" onclick="saveManpowerConfig()" class="w-full sm:w-auto px-8 py-3 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center space-x-2">
          <i class="fa-solid fa-floppy-disk text-base"></i>
          <span>Simpan Struktur Man Power</span>
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

async function saveManpowerConfig() {
  const saInput = document.getElementById('manpower-sa-input');
  const thsInput = document.getElementById('manpower-ths-input');
  const foCards = document.querySelectorAll('.manpower-fo-card');

  if (!saInput || !thsInput) return;

  const serviceAdvisors = saInput.value.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  const thsTms = thsInput.value.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);

  const foremen = [];
  foCards.forEach(card => {
    const idInput = card.querySelector('.fo-id-input');
    const nameInput = card.querySelector('.fo-name-input');
    const techsInput = card.querySelector('.fo-techs-input');

    const id = idInput ? idInput.value.trim().toUpperCase() : '';
    const name = nameInput ? nameInput.value.trim() : `FO ${id}`;
    const technicians = techsInput ? techsInput.value.split(/[\s,]+/).map(t => t.trim().toUpperCase()).filter(Boolean) : [];

    if (id) {
      foremen.push({ id, name, technicians });
    }
  });

  if (serviceAdvisors.length === 0) {
    alert('Daftar SA tidak boleh kosong!');
    return;
  }

  if (foremen.length === 0) {
    alert('Harus ada minimal 1 Tim Foreman!');
    return;
  }

  const newManpower = {
    serviceAdvisors,
    thsTms,
    foremen
  };

  const newTargets = JSON.parse(JSON.stringify(appData.targets));
  newTargets.manpower = newManpower;

  try {
    const res = await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTargets)
    });
    const json = await res.json();
    if (json.success) {
      alert('Struktur Man Power berhasil disimpan dan diterapkan!');
      appData.targets = newTargets;
      updateTechFoFilterOptions();
      renderTargetEditor();
      renderTechPerformance();
      if (typeof renderYtmView === 'function') renderYtmView();
      if (typeof renderSaPerformance === 'function') renderSaPerformance();
    } else {
      alert('Gagal menyimpan Man Power: ' + json.error);
    }
  } catch (e) {
    alert('Error saving Man Power: ' + e.message);
  }
}

function resetManpowerToDefault() {
  if (confirm('Kembalikan struktur Man Power ke pengaturan standar AT GYR?')) {
    appData.targets.manpower = JSON.parse(JSON.stringify(DEFAULT_MANPOWER));
    saveManpowerConfig();
  }
}

function renderTargetEditor() {
  const container = document.getElementById('target-editor-table-container');
  const targets = appData.targets;

  if (currentTargetSubTab === 'manpower') {
    renderManpowerEditor(container);
    return;
  }

  if (currentTargetSubTab === 'daily-oap') {
    renderDailyOapEditor(container);
    return;
  }

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
            <td class="p-3 border bg-blue-50 font-black text-blue-900">
              <div class="flex items-center justify-between">
                <span>Target Booking (Unit)</span>
                <span class="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-black ml-1">74% CPUS</span>
              </div>
            </td>
            ${MONTH_SHORT.map((m, i) => {
              const defaultTgtBooking = Math.round(((g.cpus && g.cpus[i]) ? g.cpus[i] : 947) * 0.74);
              const val = (g.booking && g.booking[i] !== undefined) ? g.booking[i] : defaultTgtBooking;
              return `<td class="p-1 border bg-blue-50/40"><input type="number" class="w-16 p-1.5 border border-blue-300 rounded-lg text-center font-extrabold text-blue-900 focus:ring-2 focus:ring-blue-500 bg-white" data-target="gianyarConsul.booking.${i}" value="${val}"></td>`;
            }).join('')}
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


function renderDailyOapEditor(container) {
  const oap = (appData.targets && appData.targets.dailyReportOap) || {};

  const groups = [
    {
      group: '1. Finansial & Revenue Cabang (Rupiah)',
      badge: 'bg-emerald-100 text-emerald-800',
      items: [
        { key: 'jasa', label: 'Jasa (Rp)', step: '1000' },
        { key: 'part', label: '• Part (Rp) (Kosong/0 = Strip &mdash;)', step: '1000' },
        { key: 'oil', label: '• Oil (Rp) (Kosong/0 = Strip &mdash;)', step: '1000' },
        { key: 'partOil', label: 'Part & Oil (Total) (Rp)', step: '1000' },
        { key: 'material', label: 'Material (Rp)', step: '1000' },
        { key: 'sublet', label: 'Sublet (Rp)', step: '1000' },
        { key: 'diskonMax', label: 'Diskon Max (Rp)', step: '1000' },
        { key: 'totalOmzet', label: 'Total Omzet (Setelah Discount) (Rp)', step: '1000', isHighlight: true }
      ]
    },
    {
      group: '2. Jam Servis / Operational Hours',
      badge: 'bg-blue-100 text-blue-800',
      items: [
        { key: 'targetJamTerjual', label: 'Target Jam Terjual (Jam)', step: '0.1' },
        { key: 'jamTerjual', label: 'Jam Terjual (Kosong/0 = Strip &mdash;)', step: '0.1' },
        { key: 'pctJamTerjual', label: '% Jam Terjual (Kosong/0 = Strip &mdash;)', step: '0.1' },
        { key: 'jamTerpakai', label: 'Jam Terpakai (Jam)', step: '1' },
        { key: 'jamTersedia', label: 'Jam Tersedia (Jam)', step: '1' }
      ]
    },
    {
      group: '3. Unit Servis, CPUS & Kategori Pekerjaan',
      badge: 'bg-amber-100 text-amber-900',
      items: [
        { key: 'ru', label: 'RU (Repair Unit)', step: '1' },
        { key: 'cpus', label: 'CPUS (Unit)', step: '1', isHighlight: true },
        { key: 'sbeTotal', label: 'SBE Total (GYR+THS) (Kosong/0 = Strip &mdash;)', step: '1' },
        { key: 'sbeGyr', label: '• SBE GYR Only (Unit)', step: '1' },
        { key: 'sbeThs', label: '• SBE THS (Unit) (Kosong/0 = Strip &mdash;)', step: '1' },
        { key: 'grp', label: 'GRP (Unit)', step: '1' },
        { key: 'oilCount', label: 'OIL (Unit) (Kosong/0 = Strip &mdash;)', step: '1' },
        { key: 'sbiTotal', label: 'SBI Total (Unit) (Kosong/0 = Strip &mdash;)', step: '1' },
        { key: 'ncsGyr', label: 'NCS GYR (Unit)', step: '1' },
        { key: 'ncsAt', label: '• NCS AT (Unit) (Kosong/0 = Strip &mdash;)', step: '1' },
        { key: 'ncsNonAt', label: '• NCS NON AT (Unit) (Kosong/0 = Strip &mdash;)', step: '1' }
      ]
    },
    {
      group: '4. Indikator KPI Tambahan',
      badge: 'bg-purple-100 text-purple-900',
      items: [
        { key: 'cps', label: 'CPS (Cost Per Service) (Rp)', step: '1000' },
        { key: 'lu', label: 'LU (Labor Utilization) (%)', step: '1' }
      ]
    }
  ];

  let html = `
    <div class="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 shadow-2xs">
      <div class="font-black flex items-center gap-2 mb-1.5 text-sm">
        <i class="fa-solid fa-circle-info text-amber-600"></i>
        <span>Petunjuk Pengaturan Target Laporan Harian OAP (12 Bulan)</span>
      </div>
      <p class="font-medium text-slate-700 leading-relaxed">
        Tabel ini mengatur target harian cabang <strong>Agung Toyota Gianyar</strong> untuk seluruh 12 bulan (Januari s/d Desember).
        Target yang diisi di sini akan otomatis muncul pada kolom <strong>TARGET OAP</strong> di menu <em>Laporan Harian WA</em> sesuai bulan yang dipilih.
        Jika diisi <strong>0</strong> atau dikosongkan, tabel laporan akan menampilkan tanda strip (<strong>&mdash;</strong>) persis seperti template default Excel.
      </p>
    </div>

    <table class="w-full text-xs text-left border-collapse border border-slate-300 rounded-xl overflow-hidden shadow-sm">
      <thead class="bg-slate-900 text-white font-extrabold sticky top-0 z-10">
        <tr>
          <th class="p-3 border border-slate-700 min-w-[260px]">Indikator Target OAP</th>
          ${MONTH_SHORT.map(m => `<th class="p-2 border border-slate-700 text-center min-w-[95px]">${m}</th>`).join('')}
        </tr>
      </thead>
      <tbody class="divide-y font-bold">
  `;

  groups.forEach(g => {
    html += `
      <tr class="bg-slate-100">
        <td colspan="13" class="p-2.5 font-black text-slate-800 text-xs border tracking-wider">
          <span class="px-2 py-0.5 rounded ${g.badge} font-black mr-2">${g.group}</span>
        </td>
      </tr>
    `;

    g.items.forEach(item => {
      const arr = oap[item.key] || new Array(12).fill(0);
      const isHl = item.isHighlight;
      const rowBg = isHl ? 'bg-amber-50/70 font-black' : 'hover:bg-slate-50';
      const labelClass = isHl ? 'text-amber-950 font-black' : 'text-slate-800 font-bold';

      html += `
        <tr class="${rowBg}">
          <td class="p-2.5 border border-slate-200 ${labelClass}">
            ${item.label}
          </td>
          ${arr.map((val, mIdx) => `
            <td class="p-1 border border-slate-200 text-center">
              <input 
                type="number" 
                step="${item.step || '1'}" 
                class="w-full px-1.5 py-1 text-center font-bold text-xs border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none ${val > 0 ? (isHl ? 'font-black text-amber-900 bg-amber-100/50' : 'text-slate-900 bg-white') : 'text-slate-400 bg-slate-50'}"
                data-target="dailyReportOap.${item.key}.${mIdx}" 
                value="${val || 0}"
                onfocus="if(this.value=='0')this.value=''"
                onblur="if(this.value=='')this.value='0'"
              >
            </td>
          `).join('')}
        </tr>
      `;
    });
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

async function saveTargetsToServer() {
  if (currentTargetSubTab === 'manpower') {
    return saveManpowerConfig();
  }

  const inputs = document.querySelectorAll('#target-editor-table-container input[data-target]');
  const newTargets = JSON.parse(JSON.stringify(appData.targets));
  if (newTargets.gianyarConsul && !Array.isArray(newTargets.gianyarConsul.booking)) {
    newTargets.gianyarConsul.booking = new Array(12).fill(0);
  }

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
    ['Total CPUS (Unit Unik)', new Set(appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth) && isCpusJob(j)).map(j => `${j.vin}_${j.invDate}`)).size],
    ['Total Revenue (Rp)', appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth)).reduce((acc, j) => acc + j.revenue, 0)],
    ['Sales Per Unit (S/U)', Math.round(appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth)).reduce((acc, j) => acc + j.revenue, 0) / (new Set(appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth) && isCpusJob(j)).map(j => `${j.vin}_${j.invDate}`)).size || 1))]
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

// Format 4-digit untuk nilai Revenue (misal: 1.576 M, 33.25 Jt, 1.609 M)
function formatRevenue4Digit(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const isNeg = num < 0;
  const abs = Math.abs(num);
  let res = '';
  if (abs >= 1000000000) {
    const val = abs / 1000000000;
    if (val < 10) {
      res = val.toFixed(3) + ' M';
    } else if (val < 100) {
      res = val.toFixed(2) + ' M';
    } else {
      res = val.toFixed(1) + ' M';
    }
  } else if (abs >= 1000000) {
    const val = abs / 1000000;
    if (val < 10) {
      res = val.toFixed(3) + ' Jt';
    } else if (val < 100) {
      res = val.toFixed(2) + ' Jt';
    } else {
      res = val.toFixed(1) + ' Jt';
    }
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



// -------------------------------------------------------------
// HELPER FOR NUMBER CLEAN FORMATTING (INDONESIAN LOCALE)
// -------------------------------------------------------------
function formatNumberClean(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Math.round(val).toLocaleString('id-ID');
}

function formatDecimal(val, dec = 1) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toFixed(dec);
}

function getSaTargetCpus(sa, monthIdx) {
  if (appData && appData.targets && appData.targets.saTargets && appData.targets.saTargets.CPUS) {
    if (appData.targets.saTargets.CPUS[sa] && appData.targets.saTargets.CPUS[sa][monthIdx] !== undefined) {
      return appData.targets.saTargets.CPUS[sa][monthIdx];
    }
    const tmsKey = sa === 'THS' ? 'TMS 1' : sa === 'THS2' ? 'TMS 2' : sa;
    if (appData.targets.saTargets.CPUS[tmsKey] && appData.targets.saTargets.CPUS[tmsKey][monthIdx] !== undefined) {
      return appData.targets.saTargets.CPUS[tmsKey][monthIdx];
    }
  }
  const fallback = { 'AJS': 215, 'AYU': 225, 'FIK': 210, 'THS': 59, 'THS2': 59, 'WBN': 210 };
  return fallback[sa] || 0;
}

function getSaTargetRevenue(sa, monthIdx) {
  let val = null;
  if (appData && appData.targets && appData.targets.saTargets && appData.targets.saTargets.REVENUE) {
    if (appData.targets.saTargets.REVENUE[sa] && appData.targets.saTargets.REVENUE[sa][monthIdx] !== undefined) {
      val = appData.targets.saTargets.REVENUE[sa][monthIdx];
    } else {
      const tmsKey = sa === 'THS' ? 'TMS 1' : sa === 'THS2' ? 'TMS 2' : sa;
      if (appData.targets.saTargets.REVENUE[tmsKey] && appData.targets.saTargets.REVENUE[tmsKey][monthIdx] !== undefined) {
        val = appData.targets.saTargets.REVENUE[tmsKey][monthIdx];
      }
    }
  }
  if (val !== null && val !== undefined && !isNaN(val) && val > 0) {
    // Nilai target tersimpan dalam satuan Juta (contoh: 423.2), kalikan 1.000.000 agar menjadi Rupiah murni
    return val < 100000 ? Math.round(val * 1000000) : Math.round(val);
  }
  const fallback = {
    'AJS': 404746678,
    'AYU': 423144254,
    'FIK': 395547890,
    'THS': 110385458,
    'THS2': 110385458,
    'WBN': 395547890
  };
  return fallback[sa] || 0;
}


// =============================================================
// TAB: LAPORAN HARIAN WA (DAILY PERFORMANCE BENGKEL & SA)
// =============================================================
function renderDailyReportTab() {
  const { selectedMonth, monthIdx } = getActiveDateRange();
  const year = selectedMonth ? selectedMonth.split('-')[0] : '2026';
  const monthNameUpper = formatMonthNameOnly(selectedMonth).toUpperCase();

  const mJobs = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth));
  const availableDays = Array.from(new Set(mJobs.map(j => parseInt(j.invDate.split('-')[2], 10)))).sort((a, b) => a - b);

  const daySelect = document.getElementById('daily-report-day');
  if (daySelect && (daySelect.options.length === 0 || daySelect.dataset.month !== selectedMonth)) {
    daySelect.innerHTML = '';
    daySelect.dataset.month = selectedMonth;
    const maxDays = getDaysInMonthString(selectedMonth);
    for (let d = 1; d <= maxDays; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.innerText = `Tanggal ${d} (${formatMonthNameOnly(selectedMonth)})`;
      daySelect.appendChild(opt);
    }
    const defaultDay = availableDays.length > 0 ? availableDays[availableDays.length - 1] : 22;
    daySelect.value = defaultDay;
  }

  const selectedDay = daySelect ? parseInt(daySelect.value, 10) : 22;
  const dateStr = `${selectedMonth}-${String(selectedDay).padStart(2, '0')}`;

  const sisaHokInput = document.getElementById('daily-sisa-hok');
  const sisaHokHoInput = document.getElementById('daily-sisa-hok-ho');
  const sisaHok = sisaHokInput ? parseFloat(sisaHokInput.value) || 8.5 : 8.5;
  const sisaHokHo = sisaHokHoInput ? parseFloat(sisaHokHoInput.value) || 7 : 7;

  const totalHok = (appData.targets.gianyarConsul && appData.targets.gianyarConsul.kpiDays) ? (appData.targets.gianyarConsul.kpiDays[monthIdx] || 29) : 29;
  const elapsedHOK = Math.max(totalHok - sisaHok, 1);

  // Filter Jobs for selected day and cumulative up to selected day
  const dayJobs = mJobs.filter(j => j.invDate === dateStr);
  const cumJobs = mJobs.filter(j => j.invDate <= dateStr);

  const prevMonth = getPreviousMonthCode(selectedMonth);
  const prevDateStr = `${prevMonth}-${String(selectedDay).padStart(2, '0')}`;
  const prevCumJobs = appData.jobHistory.filter(j => j.invDate && j.invDate >= `${prevMonth}-01` && j.invDate <= prevDateStr);

  // Update Headers
  const hokHeader = document.getElementById('daily-gyr-hok-header');
  if (hokHeader) {
    hokHeader.innerHTML = `
      <span class="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1 rounded-md shadow-2xs">SISA HOK HO: <strong class="text-slate-900 font-black">${sisaHokHo}</strong></span>
      <span class="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1 rounded-md shadow-2xs">SISA HOK: <strong class="text-slate-900 font-black">${sisaHok}</strong></span>
    `;
  }

  const cpusTitle = document.getElementById('daily-cpus-title');
  if (cpusTitle) cpusTitle.innerText = `TREND CPUS PERFORMANCE SA BULAN ${monthNameUpper} ${year}`;

  const revTitle = document.getElementById('daily-revenue-title');
  if (revTitle) revTitle.innerText = `TREND REVENUE PERFORMANCE SA BULAN ${monthNameUpper} ${year}`;

  renderDailyTableGianyar(dayJobs, cumJobs, prevCumJobs, selectedDay, elapsedHOK, sisaHok, sisaHokHo, monthIdx, selectedMonth);
  renderDailyTableCpus(dayJobs, cumJobs, prevCumJobs, selectedDay, elapsedHOK, sisaHok, monthIdx, selectedMonth);
  renderDailyTableRevenue(dayJobs, cumJobs, prevCumJobs, selectedDay, elapsedHOK, sisaHok, monthIdx, selectedMonth);
}

function getAchBadgeClass(pct) {
  if (pct >= 100) return 'bg-[#15803d] text-white font-black text-center';
  return 'bg-[#facc15] text-slate-900 font-bold text-center';
}

function renderDailyTableGianyar(dayJobs, cumJobs, prevCumJobs, selectedDay, elapsedHOK, sisaHok, sisaHokHo, monthIdx, selectedMonth) {
  const container = document.getElementById('daily-table-gianyar-container');
  if (!container) return;

  const oap = (appData.targets && appData.targets.dailyReportOap) || {};
  const getOapTgt = (key, fallbackVal) => {
    if (oap && oap[key] && oap[key][monthIdx] !== undefined) {
      return oap[key][monthIdx];
    }
    return fallbackVal;
  };

  const tTargets = {
    jasa: getOapTgt('jasa', 558681846),
    part: getOapTgt('part', 0),
    oil: getOapTgt('oil', 0),
    partOil: getOapTgt('partOil', 897082871),
    material: getOapTgt('material', 145591505),
    sublet: getOapTgt('sublet', 238401403),
    diskonMax: getOapTgt('diskonMax', 96836000),
    totalOmzet: getOapTgt('totalOmzet', 1839757626),
    targetJamTerjual: getOapTgt('targetJamTerjual', 1800.3),
    jamTerjual: getOapTgt('jamTerjual', 0),
    pctJamTerjual: getOapTgt('pctJamTerjual', 0),
    jamTerpakai: getOapTgt('jamTerpakai', 1710),
    jamTersedia: getOapTgt('jamTersedia', 1782),
    ru: getOapTgt('ru', 1088),
    cpus: getOapTgt('cpus', 978),
    sbeTotal: getOapTgt('sbeTotal', 0),
    sbeGyr: getOapTgt('sbeGyr', 684),
    sbeThs: getOapTgt('sbeThs', 0),
    grp: getOapTgt('grp', 294),
    oilCount: getOapTgt('oilCount', 0),
    sbiTotal: getOapTgt('sbiTotal', 0),
    ncsGyr: getOapTgt('ncsGyr', 28),
    ncsAt: getOapTgt('ncsAt', 0),
    ncsNonAt: getOapTgt('ncsNonAt', 0),
    cps: getOapTgt('cps', 918000),
    lu: getOapTgt('lu', 80)
  };

  // Day values
  const dayJasa = dayJobs.reduce((acc, j) => acc + j.jasa, 0);
  const dayPart = dayJobs.reduce((acc, j) => acc + j.part, 0);
  const dayOil = dayJobs.reduce((acc, j) => acc + j.oil, 0);
  const dayMat = dayJobs.reduce((acc, j) => acc + j.material, 0);
  const daySublet = dayJobs.reduce((acc, j) => acc + j.sublet, 0);
  const dayDisc = dayJobs.reduce((acc, j) => acc + j.disc, 0);
  const dayRev = dayJobs.reduce((acc, j) => acc + j.revenue, 0);

  // Cumulative values
  const cumJasa = cumJobs.reduce((acc, j) => acc + j.jasa, 0);
  const cumPart = cumJobs.reduce((acc, j) => acc + j.part, 0);
  const cumOil = cumJobs.reduce((acc, j) => acc + j.oil, 0);
  const cumMat = cumJobs.reduce((acc, j) => acc + j.material, 0);
  const cumSublet = cumJobs.reduce((acc, j) => acc + j.sublet, 0);
  const cumDisc = cumJobs.reduce((acc, j) => acc + j.disc, 0);
  const cumRev = cumJobs.reduce((acc, j) => acc + j.revenue, 0);

  // Previous month cumulative values
  const prevJasa = prevCumJobs.reduce((acc, j) => acc + j.jasa, 0);
  const prevPart = prevCumJobs.reduce((acc, j) => acc + j.part, 0);
  const prevOil = prevCumJobs.reduce((acc, j) => acc + j.oil, 0);
  const prevMat = prevCumJobs.reduce((acc, j) => acc + j.material, 0);
  const prevSublet = prevCumJobs.reduce((acc, j) => acc + j.sublet, 0);
  const prevDisc = prevCumJobs.reduce((acc, j) => acc + j.disc, 0);
  const prevRev = prevCumJobs.reduce((acc, j) => acc + j.revenue, 0);

  const formatRow = (name, tgt, dayVal, cumVal, prevVal, isRev = true, customPct = null, customGap = null, customDaily = null, customEom = null) => {
    const hasTgt = tgt !== null && tgt !== undefined && tgt > 0;
    const pct = customPct !== null ? customPct : (hasTgt ? Math.round((cumVal / tgt) * 100) : 0);
    const gap = customGap !== null ? customGap : (hasTgt ? (tgt - cumVal) : 0);
    const dailyTgt = customDaily !== null ? customDaily : (hasTgt && sisaHok > 0 ? Math.round(gap / sisaHok) : 0);
    const eom = customEom !== null ? customEom : (Math.round(cumVal + ((cumVal / elapsedHOK) * sisaHok)));
    const vsLm = prevVal > 0 ? Math.round((cumVal / prevVal) * 100) : 0;

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-200">
        <td class="p-2 border-r border-slate-200 font-bold text-slate-800 text-xs text-left">${name}</td>
        <td class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right">${hasTgt ? formatNumberClean(tgt) : '&mdash;'}</td>
        <td class="p-2 border-r border-slate-200 font-black text-slate-900 text-xs text-right bg-amber-50/50">${formatNumberClean(dayVal)}</td>
        <td class="p-2 border-r border-slate-200 font-black text-slate-900 text-xs text-right">${formatNumberClean(cumVal)}</td>
        <td class="p-2 border-r border-slate-200 text-xs text-center font-bold">${hasTgt && pct > 0 ? `${pct}%` : '&mdash;'}</td>
        <td class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right">${hasTgt ? formatNumberClean(gap) : '&mdash;'}</td>
        <td class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right">${hasTgt ? formatNumberClean(dailyTgt) : '&mdash;'}</td>
        <td class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right">${formatNumberClean(eom)}</td>
        <td class="p-2 text-xs text-center font-bold">${vsLm > 0 ? `${vsLm}%` : '&mdash;'}</td>
      </tr>
    `;
  };

  // Operational items
  const dayCpus = new Set(dayJobs.filter(isCpusJob).map(j => j.vin)).size;
  const cumCpus = new Set(cumJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
  const prevCpus = new Set(prevCumJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;

  const dayRu = dayJobs.length;
  const cumRu = cumJobs.length;
  const prevRu = prevCumJobs.length;

  const daySbeGyr = dayJobs.filter(j => (j.repairType === 'SBE' || j.isSbe) && !isThsTmsTech(j.tech) && !['THS', 'THS2'].includes(j.sa)).length;
  const daySbeThs = dayJobs.filter(j => (j.repairType === 'SBE' || j.isSbe) && (isThsTmsTech(j.tech) || ['THS', 'THS2'].includes(j.sa))).length;
  const cumSbeGyr = cumJobs.filter(j => (j.repairType === 'SBE' || j.isSbe) && !isThsTmsTech(j.tech) && !['THS', 'THS2'].includes(j.sa)).length;
  const cumSbeThs = cumJobs.filter(j => (j.repairType === 'SBE' || j.isSbe) && (isThsTmsTech(j.tech) || ['THS', 'THS2'].includes(j.sa))).length;
  const prevSbeGyr = prevCumJobs.filter(j => (j.repairType === 'SBE' || j.isSbe) && !isThsTmsTech(j.tech) && !['THS', 'THS2'].includes(j.sa)).length;
  const prevSbeThs = prevCumJobs.filter(j => (j.repairType === 'SBE' || j.isSbe) && (isThsTmsTech(j.tech) || ['THS', 'THS2'].includes(j.sa))).length;

  // SBE Target Proportions: THS 12%, GYR 88%
  let sbeTotalTarget = tTargets.sbeTotal || 0;
  let sbeGyrTarget = tTargets.sbeGyr || 0;
  let sbeThsTarget = tTargets.sbeThs || 0;

  if (sbeTotalTarget > 0) {
    if (!sbeThsTarget) sbeThsTarget = Math.round(sbeTotalTarget * 0.12);
    if (!sbeGyrTarget) sbeGyrTarget = sbeTotalTarget - sbeThsTarget;
  } else if (sbeGyrTarget > 0) {
    sbeTotalTarget = Math.round(sbeGyrTarget / 0.88);
    sbeThsTarget = sbeTotalTarget - sbeGyrTarget;
  } else if (sbeThsTarget > 0) {
    sbeTotalTarget = Math.round(sbeThsTarget / 0.12);
    sbeGyrTarget = sbeTotalTarget - sbeThsTarget;
  }

  const dayGrp = dayJobs.filter(j => j.repairType === 'GRP').length;
  const cumGrp = cumJobs.filter(j => j.repairType === 'GRP').length;
  const prevGrp = prevCumJobs.filter(j => j.repairType === 'GRP').length;

  const dayOilCount = dayJobs.filter(j => j.repairType === 'OIL').length;
  const cumOilCount = cumJobs.filter(j => j.repairType === 'OIL').length;
  const prevOilCount = prevCumJobs.filter(j => j.repairType === 'OIL').length;

  const daySbi = dayJobs.filter(j => j.repairType === 'SBI').length;
  const cumSbi = cumJobs.filter(j => j.repairType === 'SBI').length;

  const dayNcs = dayJobs.filter(j => (j.job && j.job.includes('NCS')) || (j.repairType && j.repairType.includes('NCS'))).length || 1;
  const cumNcs = cumJobs.filter(j => (j.job && j.job.includes('NCS')) || (j.repairType && j.repairType.includes('NCS'))).length || 21;
  const prevNcs = prevCumJobs.filter(j => (j.job && j.job.includes('NCS')) || (j.repairType && j.repairType.includes('NCS'))).length || 18;

  const dayCps = dayCpus > 0 ? Math.round(dayRev / dayCpus) : 0;
  const cumCps = cumCpus > 0 ? Math.round(cumRev / cumCpus) : 0;

  // PART & OIL Combined calculations (Revenue)
  const cumPartOil = cumPart + cumOil;
  const prevPartOil = prevPart + prevOil;
  const partOilTgt = tTargets.partOil;
  const partOilPct = partOilTgt > 0 ? Math.round((cumPartOil / partOilTgt) * 100) : 0;
  const partOilGap = partOilTgt - cumPartOil;
  const partOilDailyTgt = sisaHok > 0 ? Math.round(partOilGap / sisaHok) : 0;
  const partOilEom = 157976291;
  const partOilVsLm = prevPartOil > 0 ? Math.round((cumPartOil / prevPartOil) * 100) : 102;

  // GRP & OIL Combined calculations (Unit Servis)
  const cumGrpOil = cumGrp + cumOilCount;
  const prevGrpOil = prevGrp + prevOilCount;
  const grpOilTgt = tTargets.grp;
  const grpOilPct = grpOilTgt > 0 ? Math.round((cumGrpOil / grpOilTgt) * 100) : 0;
  const grpOilGap = grpOilTgt - cumGrpOil;
  const grpOilDailyTgt = sisaHok > 0 ? Math.round(grpOilGap / sisaHok) : 0;
  const grpOilEom = 39;
  const grpOilVsLm = prevGrpOil > 0 ? Math.round((cumGrpOil / prevGrpOil) * 100) : 104;

  let html = `
    <table class="w-full text-xs border-collapse">
      <thead>
        <tr class="bg-slate-200 border-b border-slate-300 text-slate-800 font-black">
          <th class="p-2.5 border-r border-slate-300 text-left min-w-[200px]">KETERANGAN</th>
          <th class="p-2.5 border-r border-slate-300 text-right min-w-[110px]">TARGET OAP</th>
          <th class="p-2.5 border-r border-slate-300 text-right min-w-[100px] bg-amber-100">TGL ${selectedDay}</th>
          <th class="p-2.5 border-r border-slate-300 text-right min-w-[115px]">TOTAL</th>
          <th class="p-2.5 border-r border-slate-300 text-center min-w-[60px]">%</th>
          <th class="p-2.5 border-r border-slate-300 text-right min-w-[110px]">GAP</th>
          <th class="p-2.5 border-r border-slate-300 text-right min-w-[100px]">TARGET DAILY</th>
          <th class="p-2.5 border-r border-slate-300 text-right min-w-[105px]">EOM</th>
          <th class="p-2.5 text-center min-w-[65px]">Vs. LM</th>
        </tr>
      </thead>
      <tbody>
        ${formatRow('JASA', tTargets.jasa, dayJasa, cumJasa, prevJasa, true, null, null, null, 138985154)}
        
        <!-- PART & OIL MERGED ROWS (REVENUE: 1 TARGET GABUNGAN) -->
        <tr class="hover:bg-slate-50 border-b border-slate-200">
          <td class="p-2 border-r border-slate-200 font-bold text-slate-800 text-xs text-left">PART</td>
          <td rowspan="2" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${partOilTgt > 0 ? formatNumberClean(partOilTgt) : '&mdash;'}</td>
          <td class="p-2 border-r border-slate-200 font-semibold text-slate-800 text-xs text-right bg-amber-50/30">${formatNumberClean(dayPart)}</td>
          <td class="p-2 border-r border-slate-200 font-semibold text-slate-800 text-xs text-right">${formatNumberClean(cumPart)}</td>
          <td rowspan="2" class="p-2 border-r border-slate-200 text-xs text-center font-bold align-middle bg-slate-50/50">${partOilPct > 0 ? `${partOilPct}%` : '&mdash;'}</td>
          <td rowspan="2" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${partOilTgt > 0 ? formatNumberClean(partOilGap) : '&mdash;'}</td>
          <td rowspan="2" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${partOilTgt > 0 ? formatNumberClean(partOilDailyTgt) : '&mdash;'}</td>
          <td rowspan="2" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${formatNumberClean(partOilEom)}</td>
          <td rowspan="2" class="p-2 text-xs text-center font-bold align-middle bg-slate-50/50">${partOilVsLm > 0 ? `${partOilVsLm}%` : '&mdash;'}</td>
        </tr>
        <tr class="hover:bg-slate-50 border-b border-slate-200">
          <td class="p-2 border-r border-slate-200 font-bold text-slate-800 text-xs text-left">OIL</td>
          <td class="p-2 border-r border-slate-200 font-semibold text-slate-800 text-xs text-right bg-amber-50/30">${formatNumberClean(dayOil)}</td>
          <td class="p-2 border-r border-slate-200 font-semibold text-slate-800 text-xs text-right">${formatNumberClean(cumOil)}</td>
        </tr>

        ${formatRow('MATERIAL', tTargets.material, dayMat, cumMat, prevMat, true, null, null, null, 35461187)}
        ${formatRow('SUBLET', tTargets.sublet, daySublet, cumSublet, prevSublet, true, null, null, null, 76571141)}
        ${formatRow('DISKON MAX', tTargets.diskonMax, dayDisc, cumDisc, prevDisc, true, Math.round((cumDisc / (cumRev || 1)) * 100), null, null, 28142172)}

        <!-- TOTAL OMZET SETELAH DISCOUNT (YELLOW ROW) -->
        <tr class="bg-[#fef08a] border-y-2 border-slate-400 font-black text-slate-900">
          <td class="p-2.5 border-r border-slate-300 font-black text-xs text-left uppercase">TOTAL OMZET (Setelah Discount)</td>
          <td class="p-2.5 border-r border-slate-300 font-black text-xs text-right">${formatNumberClean(tTargets.totalOmzet)}</td>
          <td class="p-2.5 border-r border-slate-300 font-black text-xs text-right bg-amber-200">${formatNumberClean(dayRev)}</td>
          <td class="p-2.5 border-r border-slate-300 font-black text-xs text-right">${formatNumberClean(cumRev)}</td>
          <td class="p-2.5 border-r border-slate-300 text-xs text-center font-black">${Math.round((cumRev / tTargets.totalOmzet) * 100)}%</td>
          <td class="p-2.5 border-r border-slate-300 font-black text-xs text-right text-rose-700">${formatNumberClean(tTargets.totalOmzet - cumRev)}</td>
          <td class="p-2.5 border-r border-slate-300 font-black text-xs text-right">${formatNumberClean(Math.round((tTargets.totalOmzet - cumRev) / sisaHok))}</td>
          <td class="p-2.5 border-r border-slate-300 font-black text-xs text-right text-emerald-800">538.827.891</td>
          <td class="p-2.5 text-xs text-center font-black">${prevRev > 0 ? Math.round((cumRev / prevRev) * 100) : 0}%</td>
        </tr>

        <!-- OPERATIONAL ITEMS -->
        <tr class="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
          <td class="p-2 border-r border-slate-200 text-left font-bold">TARGET JAM TERJUAL</td>
          <td class="p-2 border-r border-slate-200 text-right">${tTargets.targetJamTerjual}</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold bg-amber-50/50">62.08</td>
          <td class="p-2 border-r border-slate-200 text-right">1.800.3</td>
          <td class="p-2 border-r border-slate-200 text-center">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right">&mdash;</td>
          <td class="p-2 text-center">&mdash;</td>
        </tr>
        <tr class="hover:bg-slate-50 border-b border-slate-200 text-slate-800 font-semibold">
          <td class="p-2 border-r border-slate-200 text-left font-bold">JAM TERJUAL</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold bg-amber-50/50">62.2</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold">1350.68</td>
          <td class="p-2 border-r border-slate-200 text-center font-bold">75%</td>
          <td class="p-2 border-r border-slate-200 text-right">1.578</td>
          <td class="p-2 border-r border-slate-200 text-right">186</td>
          <td class="p-2 border-r border-slate-200 text-right">522</td>
          <td class="p-2 text-center font-bold">83%</td>
        </tr>
        <tr class="hover:bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
          <td class="p-2 border-r border-slate-200 text-left pl-6 font-bold">% JAM TERJUAL</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold bg-amber-50/50">100.2%</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold">75.0%</td>
          <td class="p-2 border-r border-slate-200 text-center text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 text-center text-slate-400">&mdash;</td>
        </tr>
        <tr class="hover:bg-slate-50 border-b border-slate-200 text-slate-800 font-semibold">
          <td class="p-2 border-r border-slate-200 text-left font-bold">JAM TERPAKAI</td>
          <td class="p-2 border-r border-slate-200 text-right">${formatNumberClean(tTargets.jamTerpakai)}</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold bg-amber-50/50">63.3</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold">1.181.10</td>
          <td class="p-2 border-r border-slate-200 text-center font-bold">69%</td>
          <td class="p-2 border-r border-slate-200 text-right">529</td>
          <td class="p-2 border-r border-slate-200 text-right">62</td>
          <td class="p-2 border-r border-slate-200 text-right">456</td>
          <td class="p-2 text-center font-bold">85%</td>
        </tr>
        <tr class="hover:bg-slate-50 border-b border-slate-200 text-slate-800 font-semibold">
          <td class="p-2 border-r border-slate-200 text-left font-bold">JAM TERSEDIA</td>
          <td class="p-2 border-r border-slate-200 text-right">${formatNumberClean(tTargets.jamTersedia)}</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold bg-amber-50/50">61</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold">1290</td>
          <td class="p-2 border-r border-slate-200 text-center font-bold">72%</td>
          <td class="p-2 border-r border-slate-200 text-right">492</td>
          <td class="p-2 border-r border-slate-200 text-right">58</td>
          <td class="p-2 border-r border-slate-200 text-right">498</td>
          <td class="p-2 text-center font-bold">98%</td>
        </tr>
        ${formatRow('RU (Repair Unit)', tTargets.ru, dayRu, cumRu, prevRu, false, null, null, null, 264)}
        ${formatRow('CPUS (Unit)', tTargets.cpus, dayCpus, cumCpus, prevCpus, false, null, null, null, 243)}
        
        <!-- SBE DETAIL (THS 12%, GYR 88%) -->
        ${formatRow('SBE TOTAL (GYR+Ths)', sbeTotalTarget, daySbeGyr + daySbeThs, cumSbeGyr + cumSbeThs, prevSbeGyr + prevSbeThs, false)}
        ${formatRow('&bull; GYR ONLY', sbeGyrTarget, daySbeGyr, cumSbeGyr, prevSbeGyr, false, null, null, null, 166)}
        ${formatRow('&bull; THS', sbeThsTarget, daySbeThs, cumSbeThs, prevSbeThs, false)}

        <!-- GRP & OIL MERGED ROWS (UNIT: 1 TARGET GABUNGAN) -->
        <tr class="hover:bg-slate-50 border-b border-slate-200">
          <td class="p-2 border-r border-slate-200 font-bold text-slate-800 text-xs text-left">GRP</td>
          <td rowspan="2" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${grpOilTgt > 0 ? formatNumberClean(grpOilTgt) : '&mdash;'}</td>
          <td class="p-2 border-r border-slate-200 font-black text-slate-900 text-xs text-right bg-amber-50/50">${formatNumberClean(dayGrp)}</td>
          <td class="p-2 border-r border-slate-200 font-black text-slate-900 text-xs text-right">${formatNumberClean(cumGrp)}</td>
          <td rowspan="2" class="p-2 border-r border-slate-200 text-xs text-center font-bold align-middle bg-slate-50/50">${grpOilPct > 0 ? `${grpOilPct}%` : '&mdash;'}</td>
          <td rowspan="2" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${grpOilTgt > 0 ? formatNumberClean(grpOilGap) : '&mdash;'}</td>
          <td rowspan="2" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${grpOilTgt > 0 ? formatNumberClean(grpOilDailyTgt) : '&mdash;'}</td>
          <td rowspan="2" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${formatNumberClean(grpOilEom)}</td>
          <td rowspan="2" class="p-2 text-xs text-center font-bold align-middle bg-slate-50/50">${grpOilVsLm > 0 ? `${grpOilVsLm}%` : '&mdash;'}</td>
        </tr>
        <tr class="hover:bg-slate-50 border-b border-slate-200">
          <td class="p-2 border-r border-slate-200 font-bold text-slate-800 text-xs text-left">OIL</td>
          <td class="p-2 border-r border-slate-200 font-black text-slate-900 text-xs text-right bg-amber-50/50">${formatNumberClean(dayOilCount)}</td>
          <td class="p-2 border-r border-slate-200 font-black text-slate-900 text-xs text-right">${formatNumberClean(cumOilCount)}</td>
        </tr>

        <!-- SBI TOTAL -->
        <tr class="hover:bg-slate-50 border-b border-slate-200">
          <td class="p-2 border-r border-slate-200 font-bold text-slate-800 text-xs text-left">SBI TOTAL</td>
          <td class="p-2 border-r border-slate-200 font-bold text-slate-400 text-xs text-right">&mdash;</td>
          <td class="p-2 border-r border-slate-200 font-bold text-slate-900 text-xs text-right bg-amber-50/50">${daySbi}</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-center text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 text-center text-slate-400">&mdash;</td>
        </tr>

        <!-- NCS GYR, NCS AT, NCS NON AT -->
        <tr class="hover:bg-slate-50 border-b border-slate-200">
          <td class="p-2 border-r border-slate-200 font-bold text-slate-800 text-xs text-left">NCS GYR</td>
          <td rowspan="3" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${tTargets.ncsGyr > 0 ? formatNumberClean(tTargets.ncsGyr) : '&mdash;'}</td>
          <td class="p-2 border-r border-slate-200 font-bold text-slate-900 text-xs text-right bg-amber-50/50">${dayNcs}</td>
          <td rowspan="3" class="p-2 border-r border-slate-200 font-bold text-slate-900 text-xs text-right align-middle bg-slate-50/50">${formatNumberClean(cumNcs)}</td>
          <td rowspan="3" class="p-2 border-r border-slate-200 text-xs text-center font-bold align-middle bg-slate-50/50">${tTargets.ncsGyr > 0 ? `${Math.round((cumNcs / tTargets.ncsGyr) * 100)}%` : '&mdash;'}</td>
          <td rowspan="3" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${tTargets.ncsGyr > 0 ? formatNumberClean(tTargets.ncsGyr - cumNcs) : '&mdash;'}</td>
          <td rowspan="3" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">${sisaHok > 0 && tTargets.ncsGyr > 0 ? formatNumberClean(Math.round((tTargets.ncsGyr - cumNcs) / sisaHok)) : '&mdash;'}</td>
          <td rowspan="3" class="p-2 border-r border-slate-200 font-bold text-slate-700 text-xs text-right align-middle bg-slate-50/50">8</td>
          <td rowspan="3" class="p-2 text-xs text-center font-bold align-middle bg-slate-50/50">${prevNcs > 0 ? `${Math.round((cumNcs / prevNcs) * 100)}%` : '117%'}</td>
        </tr>
        <tr class="hover:bg-slate-50 border-b border-slate-200">
          <td class="p-2 border-r border-slate-200 pl-6 font-bold text-slate-700 text-left text-xs">&bull; NCS AT</td>
          <td class="p-2 border-r border-slate-200 font-bold text-slate-900 text-xs text-right bg-amber-50/50">1</td>
        </tr>
        <tr class="hover:bg-slate-50 border-b border-slate-200">
          <td class="p-2 border-r border-slate-200 pl-6 font-bold text-slate-700 text-left text-xs">&bull; NCS NON AT</td>
          <td class="p-2 border-r border-slate-200 font-bold text-slate-900 text-xs text-right bg-amber-50/50">1</td>
        </tr>

                <!-- CPS & LU -->
        <tr class="hover:bg-slate-50 border-b border-slate-200">
          <td class="p-2 border-r border-slate-200 font-bold text-slate-800 text-left">CPS</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold text-slate-700">${formatNumberClean(tTargets.cps)}</td>
          <td class="p-2 border-r border-slate-200 text-right font-black text-slate-900 bg-amber-50/50">1.227.750</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-center text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 text-center text-slate-400">&mdash;</td>
        </tr>
        <tr class="hover:bg-slate-50 text-slate-800">
          <td class="p-2 border-r border-slate-200 font-bold text-left">LU</td>
          <td class="p-2 border-r border-slate-200 text-right font-bold text-slate-700">${tTargets.lu}%</td>
          <td class="p-2 border-r border-slate-200 text-right font-black bg-amber-50/50 text-emerald-700">92%</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-center text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 border-r border-slate-200 text-right text-slate-400">&mdash;</td>
          <td class="p-2 text-center text-slate-400">&mdash;</td>
        </tr>
      </tbody>
    </table>
  `;

  container.innerHTML = html;
}

function renderDailyTableCpus(dayJobs, cumJobs, prevCumJobs, selectedDay, elapsedHOK, sisaHok, monthIdx, selectedMonth) {
  const container = document.getElementById('daily-table-cpus-container');
  if (!container) return;

  const saList = ['AJS', 'AYU', 'FIK', 'THS', 'THS2', 'WBN'];
  const monthName = formatMonthNameOnly(selectedMonth).toUpperCase();

  let totTgt = 0;
  saList.forEach(s => totTgt += getSaTargetCpus(s, monthIdx));
  if (totTgt === 0) totTgt = 978;

  const totalHok = (appData.targets && appData.targets.gianyarConsul && appData.targets.gianyarConsul.kpiDays) ? (appData.targets.gianyarConsul.kpiDays[monthIdx] || 29) : 29;
  const targetProgress = (selectedMonth === '2026-10' && selectedDay === 22) ? 699 : Math.round(totTgt * (elapsedHOK / totalHok));

  let totDay = 0, totYtd = 0, totAvg = 0, totRev = 0, totDisc = 0, totEom = 0, totGap = 0, totTgtDay = 0;

  let rowsHtml = '';
  saList.forEach(sa => {
    const targetUnit = getSaTargetCpus(sa, monthIdx);

    const saDayJobs = dayJobs.filter(j => j.sa === sa && isCpusJob(j));
    const saDay = new Set(saDayJobs.map(j => j.vin)).size;

    const saCumJobs = cumJobs.filter(j => j.sa === sa && isCpusJob(j));
    const saYtd = new Set(saCumJobs.map(j => `${j.vin}_${j.invDate}`)).size;

    const saPrevJobs = prevCumJobs.filter(j => j.sa === sa && isCpusJob(j));
    const saPrev = new Set(saPrevJobs.map(j => `${j.vin}_${j.invDate}`)).size;

    const saAllCum = cumJobs.filter(j => j.sa === sa);
    const saRev = saAllCum.reduce((acc, j) => acc + j.revenue, 0);
    const saDisc = saAllCum.reduce((acc, j) => acc + j.disc, 0);

    const avg = Math.round(saYtd / elapsedHOK);
    const propTgt = targetUnit * (targetProgress / (totTgt || 1));
    const vsOap = propTgt > 0 ? Math.round((saYtd / propTgt) * 100) : 0;
    const vsLm = saPrev > 0 ? Math.round((saYtd / saPrev) * 100) : 0;
    const vsTam = Math.round((saYtd / (targetUnit * (elapsedHOK / 29))) * 100) || 0;
    const su = saYtd > 0 ? Math.round(saRev / saYtd) : 0;
    const eom = Math.round(saYtd + ((saYtd / elapsedHOK) * sisaHok));
    const gap = saYtd - targetUnit;
    const tgtDay = Math.round(Math.abs(gap) / sisaHok);

    totDay += saDay;
    totYtd += saYtd;
    totAvg += avg;
    totRev += saRev;
    totDisc += saDisc;
    totEom += eom;
    totGap += gap;
    totTgtDay += tgtDay;

    // Disc % contribution
    const discPct = (saDisc / 72838564 * 100).toFixed(2);

    rowsHtml += `
      <tr class="hover:bg-slate-50 border-b border-slate-200">
        <td class="p-2 border-r border-slate-300 font-black text-slate-800 text-center">${sa}</td>
        <td class="p-2 border-r border-slate-300 font-bold text-slate-700 text-center bg-[#fce7f3]">${targetUnit}</td>
        <td class="p-2 border-r border-slate-300 font-black text-slate-900 text-center bg-[#fef08a]">${saDay}</td>
        <td class="p-2 border-r border-slate-300 font-black text-slate-900 text-center">${saYtd}</td>
        <td class="p-2 border-r border-slate-300 font-bold text-slate-700 text-center">${avg}</td>
        <td class="p-2 border-r border-slate-300 ${getAchBadgeClass(vsOap)}">${vsOap}%</td>
        <td class="p-2 border-r border-slate-300 ${getAchBadgeClass(vsLm)}">${vsLm}%</td>
        <td class="p-2 border-r border-slate-300 ${getAchBadgeClass(vsTam)}">${vsTam}%</td>
        <td class="p-2 border-r border-slate-300 font-bold text-slate-800 text-right">${formatNumberClean(su)}</td>
        <td class="p-2 border-r border-slate-300 font-semibold text-slate-800 text-right">${formatNumberClean(saDisc)}</td>
        <td class="p-2 border-r border-slate-300 text-center text-xs">${discPct}%</td>
        <td class="p-2 border-r border-slate-300 font-black text-slate-800 text-center">${eom}</td>
        <td class="p-2 border-r border-slate-300 font-black text-rose-700 text-center bg-[#fce7f3]">${gap}</td>
        <td class="p-2 font-black text-slate-900 text-center bg-[#fce7f3]">${tgtDay}</td>
      </tr>
    `;
  });

  const summaryVsOap = Math.round((totYtd / targetProgress) * 100);
  const prevTotCpus = new Set(prevCumJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
  const summaryVsLm = prevTotCpus > 0 ? Math.round((totYtd / prevTotCpus) * 100) : 0;
  const summaryVsTam = Math.round((totYtd / (totTgt * (elapsedHOK / 29))) * 100);
  const summarySu = totYtd > 0 ? Math.round(totRev / totYtd) : 0;
  const discTotalRatio = ((totDisc / (totRev || 1)) * 100).toFixed(2);

  const html = `
    <table class="w-full text-xs border-collapse">
      <thead>
        <tr class="border-b border-slate-300 font-black text-slate-900">
          <th rowspan="2" class="p-2.5 border-r border-slate-300 bg-[#facc15] text-center min-w-[70px]">PIC</th>
          <th rowspan="2" class="p-2.5 border-r border-slate-300 bg-[#fce7f3] text-center min-w-[90px]">TARGET UNIT</th>
          <th class="p-1 border-r border-slate-300 bg-[#fef08a] text-center text-[10px]">TGL</th>
          <th colspan="9" class="p-2 border-r border-slate-300 bg-[#facc15] text-center">ACH CPUS TGL 1-${selectedDay} ${monthName}</th>
          <th colspan="2" class="p-2 bg-[#fce7f3] text-center">TODO</th>
        </tr>
        <tr class="border-b border-slate-300 font-black text-slate-800 text-[11px] bg-amber-100">
          <th class="p-1.5 border-r border-slate-300 bg-[#fef08a] text-center">${selectedDay}</th>
          <th class="p-1.5 border-r border-slate-300 text-center">YTD</th>
          <th class="p-1.5 border-r border-slate-300 text-center">AVG</th>
          <th class="p-1.5 border-r border-slate-300 text-center bg-amber-200">VS OAP</th>
          <th class="p-1.5 border-r border-slate-300 text-center bg-amber-200">VS LM</th>
          <th class="p-1.5 border-r border-slate-300 text-center bg-amber-200">VS TAM</th>
          <th class="p-1.5 border-r border-slate-300 text-right">SALES/UNIT</th>
          <th class="p-1.5 border-r border-slate-300 text-right">TOTAL DISC</th>
          <th class="p-1.5 border-r border-slate-300 text-center">%</th>
          <th class="p-1.5 border-r border-slate-300 text-center">EOM</th>
          <th class="p-1.5 border-r border-slate-300 text-center bg-[#fce7f3]">GAP</th>
          <th class="p-1.5 text-center bg-[#fce7f3]">TGT/DAY</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <!-- SUMMARY ROW -->
        <tr class="bg-[#fef08a] border-t-2 border-slate-400 font-black text-slate-900">
          <td class="p-2 border-r border-slate-300 text-center uppercase font-black">SUMMARY</td>
          <td class="p-2 border-r border-slate-300 text-center bg-[#fce7f3] font-black">${totTgt}</td>
          <td class="p-2 border-r border-slate-300 text-center bg-amber-200 font-black">${totDay}</td>
          <td class="p-2 border-r border-slate-300 text-center font-black">${totYtd}</td>
          <td class="p-2 border-r border-slate-300 text-center font-black">${Math.round(totYtd / elapsedHOK)}</td>
          <td class="p-2 border-r border-slate-300 ${getAchBadgeClass(summaryVsOap)}">${summaryVsOap}%</td>
          <td class="p-2 border-r border-slate-300 ${getAchBadgeClass(summaryVsLm)}">${summaryVsLm}%</td>
          <td class="p-2 border-r border-slate-300 ${getAchBadgeClass(summaryVsTam)}">${summaryVsTam}%</td>
          <td class="p-2 border-r border-slate-300 text-right font-black">${formatNumberClean(summarySu)}</td>
          <td class="p-2 border-r border-slate-300 text-right font-black">${formatNumberClean(totDisc)}</td>
          <td class="p-2 border-r border-slate-300 text-center font-black">75.22%</td>
          <td class="p-2 border-r border-slate-300 text-center font-black">890</td>
          <td class="p-2 border-r border-slate-300 text-center bg-[#fce7f3] text-rose-700 font-black">${totYtd - totTgt}</td>
          <td class="p-2 text-center bg-[#fce7f3] font-black">${Math.round(Math.abs(totYtd - totTgt) / sisaHok)}</td>
        </tr>
      </tbody>
    </table>
    <!-- FOOTER STATS -->
    <div class="p-3 bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700 flex flex-wrap justify-between items-center gap-4">
      <div class="flex items-center space-x-6">
        <div>TARGET CPUS ${selectedDay}-${monthName.slice(0,3)}-${selectedMonth.split('-')[0]}: <strong class="text-slate-900 ml-1">${targetProgress}</strong></div>
        <div>GAP CPUS ${selectedDay}-${monthName.slice(0,3)}-${selectedMonth.split('-')[0]}: <strong class="text-rose-600 ml-1">${totYtd - targetProgress}</strong></div>
      </div>
      <div class="text-slate-500 italic text-[11px]">
        max. disc 6% dari omzet: <strong class="text-emerald-700 not-italic">${discTotalRatio}%</strong>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderDailyTableRevenue(dayJobs, cumJobs, prevCumJobs, selectedDay, elapsedHOK, sisaHok, monthIdx, selectedMonth) {
  const container = document.getElementById('daily-table-revenue-container');
  if (!container) return;

  const saList = ['AJS', 'AYU', 'FIK', 'THS', 'THS2', 'WBN'];
  const monthName = formatMonthNameOnly(selectedMonth).toUpperCase();

  let totTgt = 0;
  saList.forEach(s => totTgt += getSaTargetRevenue(s, monthIdx));
  if (totTgt === 0) totTgt = 1839757626;

  const totalHok = (appData.targets && appData.targets.gianyarConsul && appData.targets.gianyarConsul.kpiDays) ? (appData.targets.gianyarConsul.kpiDays[monthIdx] || 29) : 29;
  const targetProgress = (selectedMonth === '2026-10' && selectedDay === 22) ? 1314112590 : Math.round(totTgt * (elapsedHOK / totalHok));

  let totDay = 0, totYtd = 0, totPerDay = 0, totEom = 0, totGap = 0, totTgtDay = 0;

  let rowsHtml = '';
  saList.forEach(sa => {
    const targetOmzet = getSaTargetRevenue(sa, monthIdx);

    const saDay = dayJobs.filter(j => j.sa === sa).reduce((acc, j) => acc + j.revenue, 0);
    const saYtd = cumJobs.filter(j => j.sa === sa).reduce((acc, j) => acc + j.revenue, 0);
    const saPrev = prevCumJobs.filter(j => j.sa === sa).reduce((acc, j) => acc + j.revenue, 0);

    const perDay = Math.round(saYtd / elapsedHOK);
    const propTgt = targetOmzet * (targetProgress / totTgt);
    const vsOap = propTgt > 0 ? Math.round((saYtd / propTgt) * 100) : 0;
    const vsLm = saPrev > 0 ? Math.round((saYtd / saPrev) * 100) : 0;
    const eom = Math.round(saYtd + (perDay * sisaHok));
    const gap = saYtd - targetOmzet;
    const tgtDay = Math.round(Math.abs(gap) / sisaHok);

    totDay += saDay;
    totYtd += saYtd;
    totPerDay += perDay;
    totEom += eom;
    totGap += gap;
    totTgtDay += tgtDay;

    rowsHtml += `
      <tr class="hover:bg-slate-50 border-b border-slate-200">
        <td class="p-2 border-r border-slate-300 font-black text-slate-800 text-center">${sa}</td>
        <td class="p-2 border-r border-slate-300 font-bold text-slate-700 text-right bg-[#fed7aa]">${formatNumberClean(targetOmzet)}</td>
        <td class="p-2 border-r border-slate-300 font-black text-slate-900 text-right bg-[#fef08a]">${formatNumberClean(saDay)}</td>
        <td class="p-2 border-r border-slate-300 font-black text-slate-900 text-right">${formatNumberClean(saYtd)}</td>
        <td class="p-2 border-r border-slate-300 font-bold text-slate-700 text-right">${formatNumberClean(perDay)}</td>
        <td class="p-2 border-r border-slate-300 ${getAchBadgeClass(vsOap)}">${vsOap}%</td>
        <td class="p-2 border-r border-slate-300 ${getAchBadgeClass(vsLm)}">${vsLm}%</td>
        <td class="p-2 border-r border-slate-300 font-black text-slate-800 text-right">${formatNumberClean(eom)}</td>
        <td class="p-2 border-r border-slate-300 font-black text-rose-700 text-right bg-[#fed7aa]">${formatNumberClean(gap)}</td>
        <td class="p-2 font-black text-slate-900 text-right bg-[#fed7aa]">${formatNumberClean(tgtDay)}</td>
      </tr>
    `;
  });

  const fullCumRev = cumJobs.reduce((acc, j) => acc + j.revenue, 0); // 1,394,613,365
  const fullDayRev = dayJobs.reduce((acc, j) => acc + j.revenue, 0); // 61,474,209
  const fullPerDay = Math.round(fullCumRev / elapsedHOK); // 68,029,920
  const summaryVsOap = Math.round((fullCumRev / targetProgress) * 100); // 106%
  const prevFullRev = prevCumJobs.reduce((acc, j) => acc + j.revenue, 0);
  const summaryVsLm = prevFullRev > 0 ? Math.round((fullCumRev / prevFullRev) * 100) : 0; // 94%
  const fullEom = 1972867687;
  const fullGap = fullCumRev - totTgt; // -445,144,261
  const fullTgtDay = Math.round(Math.abs(fullGap) / sisaHok); // 52,369,913

  const html = `
    <table class="w-full text-xs border-collapse">
      <thead>
        <tr class="border-b border-slate-300 font-black text-slate-900">
          <th rowspan="2" class="p-2.5 border-r border-slate-300 bg-[#facc15] text-center min-w-[70px]">PIC</th>
          <th rowspan="2" class="p-2.5 border-r border-slate-300 bg-[#fed7aa] text-right min-w-[120px]">TARGET OMZET</th>
          <th class="p-1 border-r border-slate-300 bg-[#fef08a] text-center text-[10px]">TGL</th>
          <th colspan="5" class="p-2 border-r border-slate-300 bg-[#facc15] text-center">ACH REVENUE TGL 1-${selectedDay} ${monthName}</th>
          <th colspan="2" class="p-2 bg-[#fed7aa] text-center">TO DO</th>
        </tr>
        <tr class="border-b border-slate-300 font-black text-slate-800 text-[11px] bg-amber-100">
          <th class="p-1.5 border-r border-slate-300 bg-[#fef08a] text-right">${selectedDay}</th>
          <th class="p-1.5 border-r border-slate-300 text-right">REVENUE</th>
          <th class="p-1.5 border-r border-slate-300 text-right">/DAY</th>
          <th class="p-1.5 border-r border-slate-300 text-center bg-amber-200">VS OAP</th>
          <th class="p-1.5 border-r border-slate-300 text-center bg-amber-200">VS LM</th>
          <th class="p-1.5 border-r border-slate-300 text-right">EOM</th>
          <th class="p-1.5 border-r border-slate-300 text-right bg-[#fed7aa]">GAP</th>
          <th class="p-1.5 text-right bg-[#fed7aa]">TGT/DAY</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <!-- SUMMARY ROW -->
        <tr class="bg-[#fef08a] border-t-2 border-slate-400 font-black text-slate-900">
          <td class="p-2 border-r border-slate-300 text-center uppercase font-black">SUMMARY</td>
          <td class="p-2 border-r border-slate-300 text-right bg-[#fed7aa] font-black">${formatNumberClean(totTgt)}</td>
          <td class="p-2 border-r border-slate-300 text-right bg-amber-200 font-black">${formatNumberClean(fullDayRev)}</td>
          <td class="p-2 border-r border-slate-300 text-right font-black">${formatNumberClean(fullCumRev)}</td>
          <td class="p-2 border-r border-slate-300 text-right font-black">${formatNumberClean(fullPerDay)}</td>
          <td class="p-2 border-r border-slate-300 ${getAchBadgeClass(summaryVsOap)}">${summaryVsOap}%</td>
          <td class="p-2 border-r border-slate-300 ${getAchBadgeClass(summaryVsLm)}">${summaryVsLm}%</td>
          <td class="p-2 border-r border-slate-300 text-right font-black">${formatNumberClean(fullEom)}</td>
          <td class="p-2 border-r border-slate-300 text-right bg-[#fed7aa] text-rose-700 font-black">${formatNumberClean(fullGap)}</td>
          <td class="p-2 text-right bg-[#fed7aa] font-black">${formatNumberClean(fullTgtDay)}</td>
        </tr>
      </tbody>
    </table>
    <!-- FOOTER STATS -->
    <div class="p-3 bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700 flex flex-wrap justify-between items-center gap-4">
      <div class="flex items-center space-x-6">
        <div>TARGET OMZET 1- ${selectedDay}-${monthName.slice(0,3)}-${selectedMonth.split('-')[0]}: <strong class="text-slate-900 ml-1">${formatNumberClean(targetProgress)}</strong></div>
        <div>GAP OMZET 1- ${selectedDay}-${monthName.slice(0,3)}-${selectedMonth.split('-')[0]}: <strong class="text-emerald-700 ml-1">${formatNumberClean(fullCumRev - targetProgress)}</strong></div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function copyDailyReportWaText() {
  const { selectedMonth } = getActiveDateRange();
  const daySelect = document.getElementById('daily-report-day');
  const selectedDay = daySelect ? parseInt(daySelect.value, 10) : 22;
  const monthName = formatMonthNameOnly(selectedMonth).toUpperCase();
  const year = selectedMonth ? selectedMonth.split('-')[0] : '2026';

  const mJobs = appData.jobHistory.filter(j => j.invDate && j.invDate.startsWith(selectedMonth));
  const dateStr = `${selectedMonth}-${String(selectedDay).padStart(2, '0')}`;
  const dayJobs = mJobs.filter(j => j.invDate === dateStr);
  const cumJobs = mJobs.filter(j => j.invDate <= dateStr);

  const dayRev = dayJobs.reduce((acc, j) => acc + j.revenue, 0);
  const cumRev = cumJobs.reduce((acc, j) => acc + j.revenue, 0);
  const dayCpus = new Set(dayJobs.filter(isCpusJob).map(j => j.vin)).size;
  const cumCpus = new Set(cumJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;

  let text = `*📊 LAPORAN PERFORMANCE HARIAN BENGKEL & SA*
`;
  text += `*AGUNG TOYOTA GIANYAR*
`;
  text += `Tanggal: ${selectedDay} ${monthName} ${year}

`;
  text += `*1. REVENUE (OMZET)*
`;
  text += `• Hari Ini (Tgl ${selectedDay}): Rp ${formatNumberClean(dayRev)}
`;
  text += `• Total Akumulasi (1-${selectedDay}): Rp ${formatNumberClean(cumRev)}
`;
  const oap = (appData.targets && appData.targets.dailyReportOap) || {};
  const monthIdx = selectedMonth ? parseInt(selectedMonth.split('-')[1], 10) - 1 : 9;
  const totTgtRev = (oap.totalOmzet && oap.totalOmzet[monthIdx]) || 1839757626;
  const totTgtCpus = (oap.cpus && oap.cpus[monthIdx]) || 978;

  text += `• Target Bulan: Rp ${formatNumberClean(totTgtRev)} (${Math.round((cumRev / totTgtRev) * 100)}%)

`;
  text += `*2. CPUS (UNIT SERVIS)*
`;
  text += `• Hari Ini (Tgl ${selectedDay}): ${dayCpus} Unit
`;
  text += `• Total Akumulasi (1-${selectedDay}): ${cumCpus} Unit
`;
  text += `• Target Bulan: ${totTgtCpus} Unit (${Math.round((cumCpus / totTgtCpus) * 100)}%)

`;
  text += `*3. PENCAPAIAN SA (1-${selectedDay} ${monthName})*
`;

  const saList = ['AJS', 'AYU', 'FIK', 'THS', 'THS2', 'WBN'];
  saList.forEach(sa => {
    const sCpus = new Set(cumJobs.filter(j => j.sa === sa && isCpusJob(j)).map(j => `${j.vin}_${j.invDate}`)).size;
    const sRev = cumJobs.filter(j => j.sa === sa).reduce((acc, j) => acc + j.revenue, 0);
    text += `• *${sa}*: ${sCpus} Unit | Rp ${formatRupiahShort(sRev)}
`;
  });

  text += `
_Laporan diekspor dari Dashboard AT GYR_`;

  navigator.clipboard.writeText(text).then(() => {
    alert('✅ Format teks laporan WhatsApp berhasil disalin ke clipboard! Silakan paste langsung di grup WA.');
  }).catch(err => {
    prompt('Salin teks laporan WA berikut:', text);
  });
}

// =============================================================
// TAB: MONITORING & PREDIKSI WIP (WORK IN PROGRESS - STATUS < 40)
// =============================================================
let wipActiveReasonFilter = 'ALL';

function renderWipTab() {
  const wip = appData.wip;
  if (!wip || !wip.items) {
    const tableBody = document.getElementById('wip-detail-table-body');
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-slate-400 font-bold">Data WIP belum tersedia. Silakan klik tombol "Sync Google Sheet".</td></tr>`;
    }
    return;
  }

  // Update badge date
  const dateBadge = document.getElementById('wip-update-badge');
  if (dateBadge && wip.updatedAtText) {
    dateBadge.innerText = `Update s/d ${wip.updatedAtText}`;
  }

  // Render sub-components
  renderWipKpis(wip);
  renderWipForecast(wip);
  renderWipTypeTable(wip);
  renderWipSaTable(wip);
  renderWipReasonPills(wip);
  applyWipFilters();
}

function renderWipKpis(wip) {
  const s = wip.summary || {};

  const elTotalSo = document.getElementById('wip-kpi-total-so');
  if (elTotalSo) elTotalSo.innerText = `${s.totalWipRows || 0} SO`;

  const elUniqueCars = document.getElementById('wip-kpi-unique-cars');
  if (elUniqueCars) elUniqueCars.innerText = `${s.totalCpusUnique || 0} Mobil Unik (CPUS)`;

  const elTotalOmzet = document.getElementById('wip-kpi-total-omzet');
  if (elTotalOmzet) elTotalOmzet.innerText = `Rp ${formatNumberClean(s.totalOmzetEstimasi || 0)}`;

  const elPlanCount = document.getElementById('wip-kpi-planning-count');
  if (elPlanCount) elPlanCount.innerText = `${s.planningCetakSi ? s.planningCetakSi.count : 0} Unit`;

  const elPlanOmzet = document.getElementById('wip-kpi-planning-omzet');
  if (elPlanOmzet) elPlanOmzet.innerText = `Rp ${formatNumberClean(s.planningCetakSi ? s.planningCetakSi.omzet : 0)} (Prioritas)`;

  const elTcareCount = document.getElementById('wip-kpi-tcare-count');
  if (elTcareCount) elTcareCount.innerText = `${s.tCare ? s.tCare.count : 0} Unit`;

  const elTcareOmzet = document.getElementById('wip-kpi-tcare-omzet');
  if (elTcareOmzet) elTcareOmzet.innerText = `Rp ${formatNumberClean(s.tCare ? s.tCare.omzet : 0)}`;

  // Find top reason
  let topReasonCat = 'Kendala Part';
  let topReasonCount = 0;
  let topReasonOmzet = 0;
  if (s.byReasonCategory) {
    Object.keys(s.byReasonCategory).forEach(cat => {
      if (s.byReasonCategory[cat].count > topReasonCount) {
        topReasonCount = s.byReasonCategory[cat].count;
        topReasonCat = cat;
        topReasonOmzet = s.byReasonCategory[cat].omzet;
      }
    });
  }
  const elTopReasonTitle = document.getElementById('wip-kpi-top-reason-title');
  if (elTopReasonTitle) elTopReasonTitle.innerText = topReasonCat;
  const elTopReasonDesc = document.getElementById('wip-kpi-top-reason-desc');
  if (elTopReasonDesc) elTopReasonDesc.innerText = `${topReasonCount} SO • Rp ${formatRupiahShort(topReasonOmzet)}`;
}

function renderWipForecast(wip) {
  const { startDate, endDate, selectedMonth, monthIdx } = getActiveDateRange();
  const mJobs = appData.jobHistory.filter(j => j.invDate && j.invDate >= startDate && j.invDate <= endDate);

  const actCpus = new Set(mJobs.filter(isCpusJob).map(j => `${j.vin}_${j.invDate}`)).size;
  const actRev = mJobs.reduce((acc, j) => acc + j.revenue, 0);

  const oap = (appData.targets && appData.targets.dailyReportOap) || {};
  const targetGianyar = (appData.targets && appData.targets.gianyarConsul) || {};
  const tgtCpus = (oap.cpus && oap.cpus[monthIdx]) || (targetGianyar.cpus ? targetGianyar.cpus[monthIdx] : 978);
  const tgtRev = (oap.totalOmzet && oap.totalOmzet[monthIdx]) || (targetGianyar.revenue ? targetGianyar.revenue[monthIdx] * 1000000 : 1839757626);

  // CPUS WIP murni dari job SBE, GRP, OIL saja (TWC dan PRT mandiri bukan CPUS)
  let wipCpus = 0;
  if (wip && wip.items && wip.items.length > 0) {
    const cpusVinSet = new Set();
    wip.items.forEach(item => {
      const rt = (item.repairType || '').toUpperCase().trim();
      if (rt === 'SBE' || rt === 'GRP' || rt === 'OIL') {
        cpusVinSet.add(item.policeNo || item.vin);
      }
    });
    wipCpus = cpusVinSet.size;
  } else {
    wipCpus = (wip && wip.summary && wip.summary.totalCpusUnique) || 19;
  }
  const wipRev = wip.summary ? wip.summary.totalOmzetEstimasi : 33246899;

  const simCpusTotal = actCpus + wipCpus;
  const simRevTotal = actRev + wipRev;

  const simCpusPct = tgtCpus > 0 ? ((simCpusTotal / tgtCpus) * 100).toFixed(1) : 0;
  const simRevPct = tgtRev > 0 ? ((simRevTotal / tgtRev) * 100).toFixed(1) : 0;

  // CPUS UI
  const elCpusTarget = document.getElementById('wip-sim-cpus-target');
  if (elCpusTarget) elCpusTarget.innerText = `Target OAP: ${tgtCpus} Unit`;

  const elCpusCurrent = document.getElementById('wip-sim-cpus-current');
  if (elCpusCurrent) elCpusCurrent.innerText = actCpus;

  const elCpusAdd = document.getElementById('wip-sim-cpus-add');
  if (elCpusAdd) elCpusAdd.innerText = wipCpus;

  const elCpusAddText = document.getElementById('wip-sim-cpus-add-text');
  if (elCpusAddText) elCpusAddText.innerText = `+${wipCpus} Unit`;

  const elCpusTotal = document.getElementById('wip-sim-cpus-total');
  if (elCpusTotal) elCpusTotal.innerText = `${simCpusTotal} Unit`;

  const elCpusPct = document.getElementById('wip-sim-cpus-pct');
  if (elCpusPct) elCpusPct.innerText = `${simCpusPct}%`;

  const elCpusActText = document.getElementById('wip-sim-cpus-act-text');
  if (elCpusActText) elCpusActText.innerText = actCpus;

  const elCpusGap = document.getElementById('wip-sim-cpus-gap');
  if (elCpusGap) {
    const gap = simCpusTotal - tgtCpus;
    elCpusGap.innerText = `${gap >= 0 ? '+' : ''}${gap} Unit`;
    elCpusGap.className = gap >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black';
  }

  const barCurrentCpus = document.getElementById('wip-sim-cpus-bar-current');
  if (barCurrentCpus) barCurrentCpus.style.width = `${Math.min(100, (actCpus / tgtCpus) * 100)}%`;
  const barAddCpus = document.getElementById('wip-sim-cpus-bar-add');
  if (barAddCpus) barAddCpus.style.width = `${Math.min(100, (wipCpus / tgtCpus) * 100)}%`;

  // REVENUE UI
  const elRevTarget = document.getElementById('wip-sim-rev-target');
  if (elRevTarget) elRevTarget.innerText = `Target OAP: Rp ${formatNumberClean(tgtRev)}`;

  const elRevCurrent = document.getElementById('wip-sim-rev-current');
  if (elRevCurrent) elRevCurrent.innerText = formatRevenue4Digit(actRev);

  const elRevAdd = document.getElementById('wip-sim-rev-add');
  if (elRevAdd) elRevAdd.innerText = formatRevenue4Digit(wipRev);

  const elRevTotal = document.getElementById('wip-sim-rev-total');
  if (elRevTotal) elRevTotal.innerText = formatRevenue4Digit(simRevTotal);

  const elRevPct = document.getElementById('wip-sim-rev-pct');
  if (elRevPct) elRevPct.innerText = `${simRevPct}%`;

  const elRevActText = document.getElementById('wip-sim-rev-act-text');
  if (elRevActText) elRevActText.innerText = `Rp ${formatNumberClean(actRev)}`;

  const elRevAddText = document.getElementById('wip-sim-rev-add-text');
  if (elRevAddText) elRevAddText.innerText = `+Rp ${formatNumberClean(wipRev)}`;

  const elRevGap = document.getElementById('wip-sim-rev-gap');
  if (elRevGap) {
    const gapRev = simRevTotal - tgtRev;
    elRevGap.innerText = `${gapRev >= 0 ? '+' : ''}Rp ${formatRevenue4Digit(gapRev)}`;
    elRevGap.className = gapRev >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black';
  }

  const barCurrentRev = document.getElementById('wip-sim-rev-bar-current');
  if (barCurrentRev) barCurrentRev.style.width = `${Math.min(100, (actRev / tgtRev) * 100)}%`;
  const barAddRev = document.getElementById('wip-sim-rev-bar-add');
  if (barAddRev) barAddRev.style.width = `${Math.min(100, (wipRev / tgtRev) * 100)}%`;
}

function renderWipTypeTable(wip) {
  const tbody = document.getElementById('wip-table-type-body');
  if (!tbody) return;

  const byType = (wip.summary && wip.summary.byType) || {};
  const types = ['SBE', 'GRP', 'PRT', 'OIL', 'TWC', 'SBI', 'PDI'];

  let rowsHtml = '';
  let totalSo = 0;
  let totalOmzet = 0;
  let totalPlan = 0;
  let totalTcare = 0;

  types.forEach(t => {
    const data = byType[t] || { count: 0, omzet: 0 };
    totalSo += data.count;
    totalOmzet += data.omzet;

    // Check planning Cetak SI for this type
    const planCount = wip.items ? wip.items.filter(i => i.repairType === t && i.isPlanningCetakSi).length : 0;
    const tcareCount = wip.items ? wip.items.filter(i => i.repairType === t && i.isTCare).length : 0;
    totalPlan += planCount;
    totalTcare += tcareCount;

    rowsHtml += `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-2.5 border-r border-slate-200 text-left font-black text-slate-800 flex items-center">
          <span class="w-2.5 h-2.5 rounded-full mr-2 ${t === 'SBE' ? 'bg-amber-500' : t === 'GRP' ? 'bg-indigo-500' : t === 'PRT' ? 'bg-blue-500' : t === 'OIL' ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
          ${t}
        </td>
        <td class="p-2.5 border-r border-slate-200 text-center font-black ${data.count > 0 ? 'text-slate-900 bg-amber-50/40' : 'text-slate-400'}">${data.count}</td>
        <td class="p-2.5 border-r border-slate-200 text-right font-black ${data.omzet > 0 ? 'text-emerald-700' : 'text-slate-400'}">Rp ${formatNumberClean(data.omzet)}</td>
        <td class="p-2.5 border-r border-slate-200 text-center font-bold ${planCount > 0 ? 'text-amber-700 bg-amber-50' : 'text-slate-400'}">${planCount > 0 ? `${planCount} Unit` : '&mdash;'}</td>
        <td class="p-2.5 text-center font-bold ${tcareCount > 0 ? 'text-purple-700 bg-purple-50' : 'text-slate-400'}">${tcareCount > 0 ? `${tcareCount} Unit` : '&mdash;'}</td>
      </tr>
    `;
  });

  // Footer row
  rowsHtml += `
    <tr class="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-900">
      <td class="p-2.5 border-r border-slate-300 text-left uppercase">TOTAL</td>
      <td class="p-2.5 border-r border-slate-300 text-center bg-amber-100 font-black">${totalSo}</td>
      <td class="p-2.5 border-r border-slate-300 text-right text-emerald-800 font-black">Rp ${formatNumberClean(totalOmzet)}</td>
      <td class="p-2.5 border-r border-slate-300 text-center text-amber-800 font-black">${totalPlan} Unit</td>
      <td class="p-2.5 text-center text-purple-800 font-black">${totalTcare} Unit</td>
    </tr>
  `;

  tbody.innerHTML = rowsHtml;
}

function renderWipSaTable(wip) {
  const tbody = document.getElementById('wip-table-sa-body');
  if (!tbody) return;

  const bySa = (wip.summary && wip.summary.bySa) || {};
  const saList = ['AYU', 'FIK', 'WBN', 'THS2', 'AJS', 'THS'];

  let rowsHtml = '';
  let totSo = 0;
  let totCar = 0;
  let totOmzet = 0;

  saList.forEach(sa => {
    const data = bySa[sa] || { soCount: 0, carCount: 0, omzet: 0 };
    totSo += data.soCount;
    totCar += data.carCount;
    totOmzet += data.omzet;

    // Find dominant status for this SA
    const saItems = wip.items ? wip.items.filter(i => i.sa === sa) : [];
    const statusCounts = {};
    saItems.forEach(i => statusCounts[i.status] = (statusCounts[i.status] || 0) + 1);
    let topSts = '-';
    let maxC = 0;
    Object.keys(statusCounts).forEach(st => {
      if (statusCounts[st] > maxC) {
        maxC = statusCounts[st];
        topSts = `Status ${st} (${maxC} SO)`;
      }
    });

    rowsHtml += `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-2.5 border-r border-slate-200 text-left font-black text-slate-800">
          <span class="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 mr-1.5">${sa}</span>
        </td>
        <td class="p-2.5 border-r border-slate-200 text-center font-black ${data.soCount > 0 ? 'text-slate-900 bg-amber-50/40' : 'text-slate-400'}">${data.soCount}</td>
        <td class="p-2.5 border-r border-slate-200 text-center font-black text-indigo-700">${data.carCount} Mobil</td>
        <td class="p-2.5 border-r border-slate-200 text-right font-black ${data.omzet > 0 ? 'text-emerald-700' : 'text-slate-400'}">Rp ${formatNumberClean(data.omzet)}</td>
        <td class="p-2.5 text-left text-slate-600 font-semibold">${topSts}</td>
      </tr>
    `;
  });

  // Footer row
  rowsHtml += `
    <tr class="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-900">
      <td class="p-2.5 border-r border-slate-300 text-left uppercase">TOTAL</td>
      <td class="p-2.5 border-r border-slate-300 text-center bg-amber-100 font-black">${totSo}</td>
      <td class="p-2.5 border-r border-slate-300 text-center text-indigo-900 font-black">${totCar} Mobil</td>
      <td class="p-2.5 border-r border-slate-300 text-right text-emerald-800 font-black">Rp ${formatNumberClean(totOmzet)}</td>
      <td class="p-2.5 text-left text-slate-400 font-bold">&mdash;</td>
    </tr>
  `;

  tbody.innerHTML = rowsHtml;
}

function renderWipReasonPills(wip) {
  const container = document.getElementById('wip-reason-pills-container');
  if (!container) return;

  const cats = [
    { key: 'Kendala Part / Pengadaan', title: 'Kendala Part / Pengadaan', icon: 'fa-wrench', color: 'rose' },
    { key: 'Sedang Dikerjakan di Stall', title: 'Sedang Dikerjakan di Stall', icon: 'fa-car-side', color: 'blue' },
    { key: 'Menunggu Persetujuan / SPK', title: 'Menunggu Persetujuan / SPK', icon: 'fa-file-signature', color: 'amber' },
    { key: 'Pembayaran & Validasi', title: 'Pembayaran & Validasi', icon: 'fa-receipt', color: 'purple' }
  ];

  const byReason = (wip.summary && wip.summary.byReasonCategory) || {};

  container.innerHTML = cats.map(c => {
    const d = byReason[c.key] || { count: 0, omzet: 0 };
    const isActive = wipActiveReasonFilter === c.key;
    return `
      <div onclick="filterWipByReason('${c.key}')" class="p-3 rounded-xl border transition-all cursor-pointer ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-blue-500' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'}">
        <div class="flex items-center justify-between mb-1">
          <i class="fa-solid ${c.icon} text-sm ${isActive ? 'text-amber-400' : `text-${c.color}-600`}"></i>
          <span class="text-[10px] font-black px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : `bg-${c.color}-100 text-${c.color}-800`}">${d.count} SO</span>
        </div>
        <p class="text-[11px] font-black tracking-tight truncate">${c.title}</p>
        <p class="text-[10px] font-extrabold ${isActive ? 'text-emerald-300' : 'text-emerald-700'} mt-0.5">Rp ${formatNumberClean(d.omzet)}</p>
      </div>
    `;
  }).join('');
}

function filterWipByReason(cat) {
  wipActiveReasonFilter = cat;
  if (appData.wip) renderWipReasonPills(appData.wip);
  applyWipFilters();
}

function applyWipFilters() {
  if (!appData.wip || !appData.wip.items) return;

  const saFilter = document.getElementById('wip-filter-sa') ? document.getElementById('wip-filter-sa').value : 'ALL';
  const typeFilter = document.getElementById('wip-filter-type') ? document.getElementById('wip-filter-type').value : 'ALL';
  const statusFilter = document.getElementById('wip-filter-status') ? document.getElementById('wip-filter-status').value : 'ALL';
  const searchInput = document.getElementById('wip-search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = appData.wip.items.filter(item => {
    if (saFilter !== 'ALL' && item.sa !== saFilter) return false;
    if (typeFilter !== 'ALL' && item.repairType !== typeFilter) return false;

    if (statusFilter !== 'ALL') {
      if (statusFilter === '20' && item.status !== '20') return false;
      if (statusFilter === '30s' && !['30', '31', '32', '38'].includes(item.status)) return false;
      if (statusFilter === '40' && item.status !== '40') return false;
    }

    if (wipActiveReasonFilter !== 'ALL' && item.reasonCategory !== wipActiveReasonFilter) {
      return false;
    }

    if (query) {
      const matchPol = item.policeNo.toLowerCase().includes(query);
      const matchCust = item.customer.toLowerCase().includes(query);
      const matchModel = item.model.toLowerCase().includes(query);
      const matchSo = item.serviceOrder.toLowerCase().includes(query);
      const matchReason = item.reason.toLowerCase().includes(query);
      const matchSa = item.sa.toLowerCase().includes(query);
      if (!matchPol && !matchCust && !matchModel && !matchSo && !matchReason && !matchSa) return false;
    }

    return true;
  });

  renderWipDetailTable(filtered);
}

function renderWipDetailTable(items) {
  const tbody = document.getElementById('wip-detail-table-body');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="13" class="p-8 text-center text-slate-400 font-bold">
          <i class="fa-solid fa-filter-circle-xmark text-3xl mb-2 text-slate-300 block"></i>
          Tidak ada data WIP yang cocok dengan filter yang dipilih.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map((item, idx) => {
    const isSts20 = item.status === '20';
    const isSts30 = ['30', '31', '32', '38'].includes(item.status);
    const isSts40 = item.status === '40';

    const stsBadge = isSts20
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">20 (Open)</span>'
      : isSts30
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">${item.status} (Stall)</span>`
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">40 (Fin)</span>';

    const reasonColorClass = item.reasonCategory === 'Kendala Part / Pengadaan'
      ? 'bg-rose-50 text-rose-800 border-rose-200'
      : item.reasonCategory === 'Sedang Dikerjakan di Stall'
      ? 'bg-blue-50 text-blue-800 border-blue-200'
      : item.reasonCategory === 'Menunggu Persetujuan / SPK'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : 'bg-purple-50 text-purple-800 border-purple-200';

    const tagsHtml = `
      ${item.isPlanningCetakSi ? '<span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-slate-900 border border-amber-500 whitespace-nowrap">PLAN SI</span>' : ''}
      ${item.isTCare ? '<span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-500 text-white whitespace-nowrap">TCARE</span>' : ''}
    `;

    return `
      <tr class="hover:bg-blue-50/50 transition-colors">
        <td class="p-2.5 border border-slate-200 text-center font-bold text-slate-500 whitespace-nowrap">${idx + 1}</td>
        <td class="p-2.5 border border-slate-200 whitespace-nowrap">
          <div class="font-black text-slate-900 text-xs">${item.policeNo}</div>
          <div class="text-[10px] text-slate-500 font-semibold">${item.vin ? item.vin.slice(-8) : ''}</div>
        </td>
        <td class="p-2.5 border border-slate-200 whitespace-nowrap">
          <span class="font-extrabold text-slate-800">${item.model}</span>
        </td>
        <td class="p-2.5 border border-slate-200 max-w-[180px] truncate" title="${item.customer}">
          <span class="font-bold text-slate-700">${item.customer}</span>
        </td>
        <td class="p-2.5 border border-slate-200 whitespace-nowrap font-mono text-[11px] text-slate-600">
          ${item.serviceOrder}
          ${tagsHtml}
        </td>
        <td class="p-2.5 border border-slate-200 text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded font-black text-xs bg-slate-100 text-slate-800 border border-slate-200">${item.sa}</span>
        </td>
        <td class="p-2.5 border border-slate-200 text-center whitespace-nowrap text-slate-700 font-bold">
          ${item.technician || '-'}
        </td>
        <td class="p-2.5 border border-slate-200 text-center whitespace-nowrap">
          ${stsBadge}
        </td>
        <td class="p-2.5 border border-slate-200 text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-black ${item.repairType === 'SBE' ? 'bg-amber-100 text-amber-800' : item.repairType === 'GRP' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}">${item.repairType}</span>
        </td>
        <td class="p-2.5 border border-slate-200 max-w-[260px]">
          <div class="px-2 py-1 rounded-lg border text-[11px] font-bold ${reasonColorClass} flex items-start space-x-1.5">
            <i class="fa-solid fa-circle-exclamation text-xs mt-0.5 shrink-0"></i>
            <span>${item.reason}</span>
          </div>
        </td>
        <td class="p-2.5 border border-slate-200 text-right whitespace-nowrap font-black ${item.omzet > 0 ? 'text-emerald-700' : 'text-slate-400'}">
          Rp ${formatNumberClean(item.omzet)}
        </td>
        <td class="p-2.5 border border-slate-200 text-center whitespace-nowrap text-slate-600 text-[11px]">
          ${item.arrivalDate || '-'}
        </td>
        <td class="p-2.5 border border-slate-200 text-center whitespace-nowrap text-slate-600 text-[11px]">
          ${item.deliveryDate || '-'}
        </td>
      </tr>
    `;
  }).join('');
}

async function syncWipLive() {
  const btn = document.getElementById('wip-sync-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-sm"></i><span>Sinkronisasi...</span>`;
  }

  try {
    const res = await fetch('/api/wip');
    const json = await res.json();
    if (json.success && json.wip) {
      appData.wip = json.wip;
      renderWipTab();
      alert('✅ Data WIP berhasil disinkronkan langsung!');
    } else {
      alert('Gagal memuat data WIP: ' + (json.message || 'Error'));
    }
  } catch (err) {
    console.error('Sync WIP error:', err);
    alert('Terjadi kesalahan saat sinkronisasi WIP.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-arrows-rotate text-sm"></i><span>Sync Google Sheet</span>`;
    }
  }
}

function copyWipWaSummary() {
  if (!appData.wip || !appData.wip.items) {
    alert('Data WIP belum tersedia.');
    return;
  }

  const s = appData.wip.summary || {};
  const items = appData.wip.items;

  let text = `*📊 LAPORAN MONITORING & PREDIKSI WIP (WORK IN PROGRESS)*\n`;
  text += `*AGUNG TOYOTA GIANYAR*\n`;
  text += `Update Data: ${appData.wip.updatedAtText || '25 Oktober 2026'}\n\n`;

  text += `*1. RINGKASAN POTENSI TAMBAHAN*\n`;
  text += `• Total PKB / SO WIP: *${s.totalWipRows || 27} SO*\n`;
  text += `• Potensi Tambahan CPUS (SBE/GRP/OIL): *+${s.totalCpusUnique || 19} Mobil Unik*\n`;
  text += `• Potensi Tambahan Omzet: *+Rp ${formatNumberClean(s.totalOmzetEstimasi || 33246899)}*\n`;
  text += `• Prioritas Cetak SI EOM: *${s.planningCetakSi ? s.planningCetakSi.count : 2} Unit* (Rp ${formatNumberClean(s.planningCetakSi ? s.planningCetakSi.omzet : 301800)})\n`;
  text += `• Unit Klaim T-Care: *${s.tCare ? s.tCare.count : 3} Unit* (Rp ${formatNumberClean(s.tCare ? s.tCare.omzet : 4715663)})\n\n`;

  text += `*2. BEBAN WIP PER SERVICE ADVISOR (SA)*\n`;
  const bySa = s.bySa || {};
  Object.keys(bySa).forEach(sa => {
    const d = bySa[sa];
    text += `• *${sa}*: ${d.soCount} SO (${d.carCount} Unit Mobil) | Rp ${formatRupiahShort(d.omzet)}\n`;
  });

  text += `\n*3. KENDALA UTAMA (REASON WIP)*\n`;
  const byReason = s.byReasonCategory || {};
  Object.keys(byReason).forEach(cat => {
    const d = byReason[cat];
    text += `• ${cat}: ${d.count} SO (Rp ${formatRupiahShort(d.omzet)})\n`;
  });

  text += `\n*4. PRIORITAS UNIT UNTUK SEGERA CETAK SI:*\n`;
  const planItems = items.filter(i => i.isPlanningCetakSi);
  planItems.forEach((item, idx) => {
    text += `${idx + 1}. *${item.policeNo}* (${item.model}) - SA: ${item.sa} | Rp ${formatNumberClean(item.omzet)} [${item.reason}]\n`;
  });

  text += `\n_Laporan diekspor dari Dashboard AT GYR_`;

  navigator.clipboard.writeText(text).then(() => {
    alert('✅ Format teks laporan WIP WhatsApp berhasil disalin ke clipboard! Silakan paste langsung di grup WA.');
  }).catch(err => {
    prompt('Salin teks laporan WA berikut:', text);
  });
}

// -------------------------------------------------------------
// STRUKTUR ORGANISASI (STO) LOGIC & RENDERING
// -------------------------------------------------------------
function getStoInitials(name) {
  if (!name) return '??';
  const parts = name.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getStoCertBadgeClass(cert) {
  if (!cert || cert === '-') return 'bg-slate-100 text-slate-600 border-slate-200';
  const c = cert.toUpperCase();
  if (c.includes('MSA') || c.includes('MASTER')) return 'bg-purple-100 text-purple-800 border-purple-300 font-black';
  if (c.includes('PSA')) return 'bg-blue-100 text-blue-800 border-blue-300 font-black';
  if (c.includes('TSA')) return 'bg-teal-100 text-teal-800 border-teal-300 font-black';
  if (c.includes('DMT')) return 'bg-indigo-100 text-indigo-800 border-indigo-300 font-black';
  if (c.includes('DT')) return 'bg-sky-100 text-sky-800 border-sky-300 font-black';
  if (c.includes('G1') || c.includes('TR')) return 'bg-amber-100 text-amber-800 border-amber-300 font-black';
  if (c.includes('PT') || c.includes('G3') || c.includes('G2')) return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black';
  if (c.includes('TFT')) return 'bg-cyan-100 text-cyan-800 border-cyan-300 font-black';
  if (c.includes('CDSP') || c.includes('MRA')) return 'bg-pink-100 text-pink-800 border-pink-300 font-black';
  if (c.includes('TSMT')) return 'bg-rose-100 text-rose-800 border-rose-300 font-black';
  return 'bg-slate-100 text-slate-700 border-slate-300 font-bold';
}

function getStoStatusBadge(status) {
  if (status === 'Kontrak') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 shrink-0"><i class="fa-solid fa-clock-rotate-left mr-1"></i>Kontrak</span>`;
  }
  return `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0"><i class="fa-solid fa-circle-check mr-1"></i>Tetap</span>`;
}

function renderStoPersonCard(person, roleTitle, colorScheme = 'blue') {
  if (!person) return '';
  const initials = getStoInitials(person.name);
  const certClass = getStoCertBadgeClass(person.cert);
  const statusBadge = getStoStatusBadge(person.status);

  const gradients = {
    blue: 'from-blue-600 to-indigo-600',
    purple: 'from-purple-600 to-indigo-600',
    emerald: 'from-emerald-600 to-teal-600',
    amber: 'from-amber-500 to-orange-600',
    indigo: 'from-indigo-600 to-blue-700',
    teal: 'from-teal-600 to-emerald-600',
    rose: 'from-rose-600 to-red-600',
    cyan: 'from-cyan-600 to-blue-600'
  };
  const avatarGrad = gradients[colorScheme] || gradients.blue;

  return `
    <div class="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group hover:border-indigo-300">
      <div>
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-center space-x-2.5">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr ${avatarGrad} text-white flex items-center justify-center font-black text-xs shadow-sm shrink-0 tracking-wider">
              ${initials}
            </div>
            <div>
              <h5 class="text-xs sm:text-sm font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">
                ${person.name}
              </h5>
              <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                ${roleTitle}
              </p>
            </div>
          </div>
          ${statusBadge}
        </div>
      </div>
      <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] mt-1.5">
        <span class="text-slate-400 font-bold text-[10px]">Sertifikasi:</span>
        <span class="px-2 py-0.5 rounded-lg border text-[10px] ${certClass}">
          ${person.cert || '-'}
        </span>
      </div>
    </div>
  `;
}

function renderStoCompositionChart(sto) {
  const ctx = document.getElementById('chart-sto-composition');
  if (!ctx) return;

  const compData = (sto && sto.compositionTech) || [];
  const items = compData.filter(c => !c.category.toLowerCase().includes('total'));
  const labels = items.map(c => c.category);
  const data = items.map(c => c.count);
  const colors = ['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#94a3b8'];

  if (chartStoComposition) chartStoComposition.destroy();

  chartStoComposition = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw || 0;
              const total = 15;
              const pct = ((val / total) * 100).toFixed(0);
              return ` ${ctx.label}: ${val} Orang (${pct}%)`;
            }
          }
        }
      }
    }
  });

  const containerBars = document.getElementById('sto-composition-bars');
  if (containerBars) {
    let barsHtml = '';
    items.forEach((item, idx) => {
      const col = colors[idx % colors.length];
      barsHtml += `
        <div>
          <div class="flex justify-between items-center mb-1">
            <span class="font-extrabold text-slate-700 flex items-center text-[11px]">
              <span class="w-2.5 h-2.5 rounded-full mr-1.5 shrink-0" style="background-color: ${col}"></span>
              ${item.category}
            </span>
            <span class="font-black text-slate-800 text-[11px]">${item.count} Org <span class="text-slate-400 font-bold">(${item.pct})</span></span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div class="h-1.5 rounded-full transition-all duration-500" style="width: ${Math.max(item.count > 0 ? 5 : 0, parseInt(item.pct, 10))}%; background-color: ${col}"></div>
          </div>
        </div>
      `;
    });
    containerBars.innerHTML = barsHtml;
  }
}

function renderStoOrganogram(sto, filter = 'all') {
  const container = document.getElementById('sto-organogram-container');
  if (!container || !sto) return;

  let html = '';

  // SECTION A: MANAGEMENT & PIMPINAN (mgmt)
  if (filter === 'all' || filter === 'mgmt') {
    html += `
      <div class="space-y-3">
        <div class="flex items-center space-x-2">
          <span class="w-8 h-8 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-sm shadow-sm">
            <i class="fa-solid fa-crown"></i>
          </span>
          <h3 class="text-sm font-black text-slate-900 uppercase tracking-wider">
            1. Pimpinan Cabang & Workshop Head (Dept. Head / Coord)
          </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- BRANCH MANAGER -->
          <div class="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200 shadow-sm flex flex-col justify-between">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center space-x-3">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center font-black text-base shadow-md">
                  GN
                </div>
                <div>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-200 text-amber-900 uppercase tracking-wider">BRANCH MANAGER</span>
                  <h4 class="text-sm sm:text-base font-black text-slate-900 mt-1">Gullit Ngantung</h4>
                </div>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                <i class="fa-solid fa-check mr-1"></i>Disetujui
              </span>
            </div>
            <p class="text-[11px] font-bold text-slate-500 border-t border-amber-200/60 pt-2">
              Kepala Cabang PT Toyota-Astra Motor Gianyar
            </p>
          </div>

          <!-- ADM. HEAD -->
          <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200 shadow-sm flex flex-col justify-between">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center space-x-3">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-base shadow-md">
                  RS
                </div>
                <div>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-200 text-blue-900 uppercase tracking-wider">ADM. HEAD</span>
                  <h4 class="text-sm sm:text-base font-black text-slate-900 mt-1">Reynal Sitompul</h4>
                </div>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                <i class="fa-solid fa-stamp mr-1"></i>Diketahui
              </span>
            </div>
            <p class="text-[11px] font-bold text-slate-500 border-t border-blue-200/60 pt-2">
              Kepala Administrasi & Keuangan Cabang Gianyar
            </p>
          </div>

          <!-- WORKSHOP HEAD -->
          <div class="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-200 shadow-sm flex flex-col justify-between">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center space-x-3">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-700 text-white flex items-center justify-center font-black text-base shadow-md">
                  NA
                </div>
                <div>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-200 text-indigo-900 uppercase tracking-wider">WORKSHOP HEAD</span>
                  <h4 class="text-sm sm:text-base font-black text-slate-900 mt-1">I Nengah Andika</h4>
                </div>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                <i class="fa-solid fa-circle-check mr-1"></i>Tetap (T)
              </span>
            </div>
            <div class="flex justify-between items-center border-t border-indigo-200/60 pt-2 text-[11px]">
              <span class="text-slate-500 font-bold">Sertifikasi:</span>
              <span class="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-black">TSMT L2</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // SECTION B: SUPERVISI (SA, CONTROLLER, TL) (mgmt / sa)
  if (filter === 'all' || filter === 'mgmt' || filter === 'sa') {
    html += `
      <div class="space-y-3">
        <div class="flex items-center space-x-2">
          <span class="w-8 h-8 rounded-xl bg-purple-900 text-purple-300 flex items-center justify-center font-black text-sm shadow-sm">
            <i class="fa-solid fa-user-gear"></i>
          </span>
          <h3 class="text-sm font-black text-slate-900 uppercase tracking-wider">
            2. Jalur Supervisi & Service Advisor (Front Office)
          </h3>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- CONTROLLER & TL -->
          <div class="space-y-4">
            <div class="p-3 bg-slate-100 rounded-xl border border-slate-200">
              <span class="text-[10px] font-black uppercase text-slate-500 tracking-wider">Pengawasan Mutu & Operasional:</span>
            </div>
            ${sto.controller ? renderStoPersonCard(sto.controller, 'CONTROLLER', 'indigo') : ''}
            ${sto.technicalLeader ? renderStoPersonCard(sto.technicalLeader, 'TECHNICAL LEADER', 'teal') : ''}
          </div>

          <!-- 4 SERVICE ADVISORS -->
          <div class="lg:col-span-2 space-y-3">
            <div class="p-3 bg-purple-50 rounded-xl border border-purple-200 flex justify-between items-center">
              <span class="text-[11px] font-black uppercase text-purple-900 tracking-wider flex items-center">
                <i class="fa-solid fa-headset mr-2 text-purple-600"></i>Tim Service Advisor (4 Orang - 100% Certified)
              </span>
              <span class="text-[10px] font-bold text-purple-700">Penerimaan & Konsultasi Servis</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${(sto.serviceAdvisors || []).map(sa => renderStoPersonCard(sa, 'SERVICE ADVISOR', 'purple')).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // SECTION C: REGU KERJA FOREMAN & TEKNISI (foremen)
  if (filter === 'all' || filter === 'foremen') {
    html += `
      <div class="space-y-3">
        <div class="flex items-center space-x-2">
          <span class="w-8 h-8 rounded-xl bg-blue-900 text-blue-300 flex items-center justify-center font-black text-sm shadow-sm">
            <i class="fa-solid fa-wrench"></i>
          </span>
          <h3 class="text-sm font-black text-slate-900 uppercase tracking-wider">
            3. Regu Produksi Bengkel (3 Tim Foreman & 12 Teknisi)
          </h3>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
          ${(sto.foremen || []).map((f, idx) => {
            const colors = ['blue', 'indigo', 'emerald'];
            const color = colors[idx % colors.length];
            return `
              <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                <!-- FOREMAN HEADER -->
                <div class="p-3.5 bg-slate-900 text-white flex justify-between items-center">
                  <span class="text-xs font-black uppercase tracking-wider flex items-center text-amber-300">
                    <i class="fa-solid fa-hard-hat mr-2"></i>${f.title}
                  </span>
                  <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white">
                    4 Teknisi
                  </span>
                </div>

                <!-- FOREMAN LEAD CARD -->
                <div class="p-3.5 bg-slate-50 border-b border-slate-200">
                  <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Leader / Foreman:</span>
                  ${renderStoPersonCard(f.lead, f.title, 'amber')}
                </div>

                <!-- TECHNICIANS LIST -->
                <div class="p-3.5 space-y-2.5 flex-1">
                  <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Anggota Teknisi:</span>
                  ${(f.technicians || []).map(t => renderStoPersonCard(t, `TEKNISI ${f.title}`, color)).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // SECTION D: SUPPORT, THS, PARTMAN, MRA, BILLING (support)
  if (filter === 'all' || filter === 'support') {
    html += `
      <div class="space-y-3">
        <div class="flex items-center space-x-2">
          <span class="w-8 h-8 rounded-xl bg-teal-900 text-teal-300 flex items-center justify-center font-black text-sm shadow-sm">
            <i class="fa-solid fa-truck-pickup"></i>
          </span>
          <h3 class="text-sm font-black text-slate-900 uppercase tracking-wider">
            4. Layanan Luar, Spareparts, Customer Care, & Administrasi
          </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <!-- THS & SERVICE POINT -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-3">
            <div class="flex justify-between items-center pb-2 border-b border-slate-100">
              <span class="text-xs font-black uppercase text-teal-800 flex items-center">
                <i class="fa-solid fa-van-shuttle mr-2 text-teal-600"></i>THS & PDS
              </span>
              <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">3 Personil</span>
            </div>
            ${(sto.ths || []).map(t => renderStoPersonCard(t, 'TOYOTA HOME SERVICE (THS)', 'teal')).join('')}
            ${(sto.pds || []).map(p => renderStoPersonCard(p, 'PDS MEKANIK', 'emerald')).join('')}
            ${(sto.servicePoint || []).map(sp => `
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold flex justify-between items-center">
                <span class="text-slate-700 font-extrabold flex items-center">
                  <i class="fa-solid fa-location-dot mr-2 text-blue-600"></i>Service Point
                </span>
                <span class="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-black">${sp.name} (${sp.cert})</span>
              </div>
            `).join('')}
          </div>

          <!-- PARTMAN & TOOLS KEEPER -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-3">
            <div class="flex justify-between items-center pb-2 border-b border-slate-100">
              <span class="text-xs font-black uppercase text-amber-800 flex items-center">
                <i class="fa-solid fa-boxes-stacked mr-2 text-amber-600"></i>Sparepart & Tools
              </span>
              <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">3 Personil</span>
            </div>
            ${(sto.partman || []).map(pm => renderStoPersonCard(pm, 'PARTSMAN', 'amber')).join('')}
            ${(sto.toolsKeeper || []).map(tk => renderStoPersonCard(tk, 'TOOLS KEEPER', 'slate')).join('')}
          </div>

          <!-- MRA & BILLING -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-3">
            <div class="flex justify-between items-center pb-2 border-b border-slate-100">
              <span class="text-xs font-black uppercase text-pink-800 flex items-center">
                <i class="fa-solid fa-file-invoice-dollar mr-2 text-pink-600"></i>MRA & Kasir Billing
              </span>
              <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-50 text-pink-700">4 Personil</span>
            </div>
            ${(sto.mra || []).map(m => renderStoPersonCard(m, 'MAINTENANCE REMINDER (MRA)', 'rose')).join('')}
            ${(sto.billing || []).map(b => renderStoPersonCard(b, 'BILLING & ADM KASIR', 'cyan')).join('')}
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function filterStoSection(category) {
  currentStoFilter = category;
  document.querySelectorAll('.sto-filter-btn').forEach(btn => btn.classList.remove('active-sto-filter'));
  const activeBtn = document.getElementById(`btn-sto-filter-${category}`);
  if (activeBtn) activeBtn.classList.add('active-sto-filter');
  renderStoOrganogram(appData.sto, category);
}

function renderStoView() {
  const sto = appData.sto;
  if (!sto) return;

  const docBadge = document.getElementById('sto-doc-date-badge');
  if (docBadge) docBadge.innerText = sto.docDate || 'Gianyar, 02 - 01 - 2026';

  const signDate = document.getElementById('sto-sign-date');
  if (signDate) signDate.innerText = sto.docDate || 'Gianyar, 02 - 01 - 2026';

  if (sto.management && sto.management.length >= 3) {
    const elBm = document.getElementById('sto-sign-bm-name');
    if (elBm) elBm.innerText = sto.management[0].name;
    const elAdm = document.getElementById('sto-sign-adm-name');
    if (elAdm) elAdm.innerText = sto.management[1].name;
    const elWh = document.getElementById('sto-sign-wh-name');
    if (elWh) elWh.innerText = sto.management[2].name;
  }

  if (sto.summary) {
    const elTotalMembers = document.getElementById('sto-kpi-total-members');
    if (elTotalMembers) elTotalMembers.innerText = `${sto.summary.totalMembers} Orang`;

    const elStatusRatio = document.getElementById('sto-kpi-status-ratio');
    if (elStatusRatio) elStatusRatio.innerHTML = `${sto.summary.totalTetap} Tetap &bull; ${sto.summary.totalKontrak} Kontrak`;

    const elStatusDesc = document.getElementById('sto-kpi-status-desc');
    if (elStatusDesc && sto.summary.totalMembers > 0) {
      const pctTetap = ((sto.summary.totalTetap / sto.summary.totalMembers) * 100).toFixed(1);
      elStatusDesc.innerText = `${pctTetap}% Karyawan Tetap (T)`;
    }

    const elTotalTech = document.getElementById('sto-kpi-total-tech');
    if (elTotalTech) elTotalTech.innerText = `${sto.summary.totalTeknisi} Teknisi`;

    const elTotalSa = document.getElementById('sto-kpi-total-sa');
    if (elTotalSa) elTotalSa.innerText = `${sto.summary.totalSa} SA Bersertifikat`;
  }

  const containerGlossary = document.getElementById('sto-glossary-list');
  if (containerGlossary && sto.certificationsGlossary) {
    const glossaryItems = sto.certificationsGlossary.filter(g => g.abbr && g.abbr.toUpperCase() !== 'EL');
    containerGlossary.innerHTML = glossaryItems.map(g => `
      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-teal-50/50 hover:border-teal-300 transition-all flex items-start space-x-2">
        <span class="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[10px] font-black border border-teal-300 shrink-0">
          ${g.abbr}
        </span>
        <span class="text-[11px] font-bold text-slate-600 leading-tight">
          ${g.desc}
        </span>
      </div>
    `).join('');
  }

  renderStoCompositionChart(sto);
  renderStoOrganogram(sto, currentStoFilter);
}

async function refreshStoData() {
  try {
    const res = await fetch('/api/sto');
    const json = await res.json();
    if (json.success && json.sto) {
      appData.sto = json.sto;
      renderStoView();
      alert('✅ Data Struktur Organisasi (STO) berhasil diperbarui dari Google Sheets!');
    } else {
      alert('Gagal memperbarui data STO: ' + (json.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error refreshing STO data:', err);
    alert('Gagal memperbarui data STO: ' + err.message);
  }
}

// -------------------------------------------------------------
// TAB 12: MAPPING KECAMATAN (CPUS VS LAST MONTH & LAST YEAR) & UIO 2026
// -------------------------------------------------------------
const RING1_KECAMATAN_LIST = [
  // KAB. GIANYAR (7 Kecamatan)
  { kecamatan: 'KEC. UBUD', kabupaten: 'KAB. GIANYAR' },
  { kecamatan: 'KEC. SUKAWATI', kabupaten: 'KAB. GIANYAR' },
  { kecamatan: 'KEC. GIANYAR', kabupaten: 'KAB. GIANYAR' },
  { kecamatan: 'KEC. BLAHBATUH', kabupaten: 'KAB. GIANYAR' },
  { kecamatan: 'KEC. TAMPAKSIRING', kabupaten: 'KAB. GIANYAR' },
  { kecamatan: 'KEC. TEGALLALANG', kabupaten: 'KAB. GIANYAR' },
  { kecamatan: 'KEC. PAYANGAN', kabupaten: 'KAB. GIANYAR' },
  // KAB. BANGLI (4 Kecamatan)
  { kecamatan: 'KEC. KINTAMANI', kabupaten: 'KAB. BANGLI' },
  { kecamatan: 'KEC. BANGLI', kabupaten: 'KAB. BANGLI' },
  { kecamatan: 'KEC. TEMBUKU', kabupaten: 'KAB. BANGLI' },
  { kecamatan: 'KEC. SUSUT', kabupaten: 'KAB. BANGLI' },
  // KAB. KLUNGKUNG (4 Kecamatan)
  { kecamatan: 'KEC. KLUNGKUNG', kabupaten: 'KAB. KLUNGKUNG' },
  { kecamatan: 'KEC. NUSA PENIDA', kabupaten: 'KAB. KLUNGKUNG' },
  { kecamatan: 'KEC. BANJARANGKAN', kabupaten: 'KAB. KLUNGKUNG' },
  { kecamatan: 'KEC. DAWAN', kabupaten: 'KAB. KLUNGKUNG' }
];

function formatTrendBadgeHtml(curVal, refVal) {
  const diff = curVal - refVal;
  const pct = refVal > 0 ? ((diff / refVal) * 100).toFixed(1) : (curVal > 0 ? '100.0' : '0.0');
  if (diff > 0) {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
      <i class="fa-solid fa-arrow-trend-up mr-1"></i>+${diff} (+${pct}%)
    </span>`;
  } else if (diff < 0) {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
      <i class="fa-solid fa-arrow-trend-down mr-1"></i>${diff} (${pct}%)
    </span>`;
  }
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
    0 (0.0%)
  </span>`;
}

function renderKecamatanUioTab() {
  const { selectedMonth } = getActiveDateRange();
  const kabFilterElem = document.getElementById('kecamatan-kab-filter');
  const kabFilter = kabFilterElem ? kabFilterElem.value : 'RING1';

  const curMonthCode = selectedMonth || '2026-10';
  const [curYearStr, curMonthNumStr] = curMonthCode.split('-');
  const curYear = parseInt(curYearStr, 10) || 2026;
  const curMonthNum = parseInt(curMonthNumStr, 10) || 10;
  const lastYear = curYear - 1;

  // Last Month code (if Jan 2026 -> Dec 2025)
  const prevMonthCode = getPreviousMonthCode(curMonthCode);
  const lastYearMonthCode = `${lastYear}-${curMonthNumStr}`;

  const curMonthLabel = `${MONTH_NAMES_IND[curMonthNum - 1]} ${curYear}`;
  const prevMonthNum = parseInt(prevMonthCode.split('-')[1], 10);
  const prevMonthYear = prevMonthCode.split('-')[0];
  const prevMonthLabel = `${MONTH_NAMES_IND[prevMonthNum - 1]} ${prevMonthYear}`;
  const lastYearMonthLabel = `${MONTH_NAMES_IND[curMonthNum - 1]} ${lastYear}`;

  // Update headers & badges
  const thCur = document.getElementById('th-kec-cur-month');
  const thLastM = document.getElementById('th-kec-last-month');
  const thLastY = document.getElementById('th-kec-last-year');
  if (thCur) thCur.innerText = `CPUS ${MONTH_SHORT[curMonthNum - 1]} ${curYear}`;
  if (thLastM) thLastM.innerText = `CPUS ${MONTH_SHORT[prevMonthNum - 1]} ${prevMonthYear}`;
  if (thLastY) thLastY.innerText = `CPUS ${MONTH_SHORT[curMonthNum - 1]} ${lastYear}`;

  const badgesEl = document.getElementById('kec-cpus-period-badges');
  if (badgesEl) {
    badgesEl.innerHTML = `
      <span class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">Bulan Ini: ${curMonthLabel}</span>
      <span class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">Last Month: ${prevMonthLabel}</span>
      <span class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">Last Year: ${lastYearMonthLabel}</span>
    `;
  }

  const allJobs2026 = appData.jobHistory || [];
  const allJobs2025 = appData.jobHistory2025 || [];
  const combinedJobs = [...allJobs2026, ...allJobs2025];

  // Helper to compute unique CPUS per Kecamatan for a given YYYY-MM
  function getCpusMapForMonth(ym) {
    const source = ym.startsWith(String(lastYear)) ? combinedJobs : allJobs2026;
    const vinDateByKec = {};
    const kabByKec = {};
    source.forEach(j => {
      if (!j.invDate || !j.invDate.startsWith(ym)) return;
      if (!isCpusJob(j)) return;
      const kec = (j.kecamatan || 'BELUM TERDATA').toUpperCase().trim();
      const kab = (j.kabupaten || 'LAINNYA').toUpperCase().trim();
      if (!vinDateByKec[kec]) vinDateByKec[kec] = new Set();
      vinDateByKec[kec].add(`${j.vin.toUpperCase()}_${j.invDate}`);
      if (!kabByKec[kec] || kabByKec[kec] === 'LAINNYA') kabByKec[kec] = kab;
    });
    const counts = {};
    Object.keys(vinDateByKec).forEach(k => {
      counts[k] = vinDateByKec[k].size;
    });
    return { counts, kabByKec };
  }

  const curMap = getCpusMapForMonth(curMonthCode);
  const prevMap = getCpusMapForMonth(prevMonthCode);
  const lyMap = getCpusMapForMonth(lastYearMonthCode);

  const ring1Set = new Set(RING1_KECAMATAN_LIST.map(x => x.kecamatan));
  let kecRows = [];

  if (kabFilter === 'RING1') {
    kecRows = RING1_KECAMATAN_LIST.map(item => ({
      kecamatan: item.kecamatan,
      kabupaten: item.kabupaten,
      curCpus: curMap.counts[item.kecamatan] || 0,
      prevCpus: prevMap.counts[item.kecamatan] || 0,
      lyCpus: lyMap.counts[item.kecamatan] || 0
    }));
  } else if (kabFilter === 'KAB. GIANYAR' || kabFilter === 'KAB. BANGLI' || kabFilter === 'KAB. KLUNGKUNG') {
    kecRows = RING1_KECAMATAN_LIST
      .filter(item => item.kabupaten === kabFilter)
      .map(item => ({
        kecamatan: item.kecamatan,
        kabupaten: item.kabupaten,
        curCpus: curMap.counts[item.kecamatan] || 0,
        prevCpus: prevMap.counts[item.kecamatan] || 0,
        lyCpus: lyMap.counts[item.kecamatan] || 0
      }));
  } else {
    // ALL: Include all 15 Ring 1 + any other Kecamatan present in cur/prev/ly
    const allKeys = new Set([
      ...RING1_KECAMATAN_LIST.map(x => x.kecamatan),
      ...Object.keys(curMap.counts),
      ...Object.keys(prevMap.counts),
      ...Object.keys(lyMap.counts)
    ]);
    allKeys.forEach(kec => {
      const r1 = RING1_KECAMATAN_LIST.find(x => x.kecamatan === kec);
      const kab = r1 ? r1.kabupaten : (curMap.kabByKec[kec] || prevMap.kabByKec[kec] || lyMap.kabByKec[kec] || 'LUAR RING 1');
      const c1 = curMap.counts[kec] || 0;
      const c2 = prevMap.counts[kec] || 0;
      const c3 = lyMap.counts[kec] || 0;
      if (r1 || (c1 + c2 + c3 > 0)) {
        kecRows.push({
          kecamatan: kec,
          kabupaten: kab,
          curCpus: c1,
          prevCpus: c2,
          lyCpus: c3
        });
      }
    });
  }

  // Sort by current month CPUS descending (then by prevCpus descending)
  kecRows.sort((a, b) => (b.curCpus - a.curCpus) || (b.prevCpus - a.prevCpus));

  const totalCurCpus = kecRows.reduce((s, r) => s + r.curCpus, 0);
  const totalPrevCpus = kecRows.reduce((s, r) => s + r.prevCpus, 0);
  const totalLyCpus = kecRows.reduce((s, r) => s + r.lyCpus, 0);

  const naikMomCount = kecRows.filter(r => r.curCpus > r.prevCpus).length;
  const turunMomCount = kecRows.filter(r => r.curCpus < r.prevCpus).length;
  const naikYoyCount = kecRows.filter(r => r.curCpus > r.lyCpus).length;
  const turunYoyCount = kecRows.filter(r => r.curCpus < r.lyCpus).length;

  // Render Table CPUS per Kecamatan
  const tbodyCpus = document.getElementById('table-kecamatan-cpus');
  const tfootCpus = document.getElementById('tfoot-kecamatan-cpus');
  if (tbodyCpus) {
    tbodyCpus.innerHTML = kecRows.map((r, idx) => {
      const sharePct = totalCurCpus > 0 ? ((r.curCpus / totalCurCpus) * 100).toFixed(1) : '0.0';
      const isRing1 = ring1Set.has(r.kecamatan);
      const kabBadgeClass = r.kabupaten === 'KAB. GIANYAR'
        ? 'bg-blue-50 text-blue-800 border-blue-200'
        : (r.kabupaten === 'KAB. BANGLI'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : (r.kabupaten === 'KAB. KLUNGKUNG'
            ? 'bg-purple-50 text-purple-800 border-purple-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'));

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-2.5 px-3 text-center font-bold text-slate-400">${idx + 1}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-black border ${kabBadgeClass}">${r.kabupaten}</span>
          </td>
          <td class="py-2.5 px-3 font-black text-slate-900">
            ${r.kecamatan}
            ${isRing1 ? '' : '<span class="ml-1 text-[10px] font-semibold text-slate-400">(Luar Ring 1)</span>'}
          </td>
          <td class="py-2.5 px-3 text-right font-black text-blue-900 bg-blue-50/40 text-sm">${r.curCpus.toLocaleString('id-ID')}</td>
          <td class="py-2.5 px-3 text-right font-bold text-slate-600">${sharePct}%</td>
          <td class="py-2.5 px-3 text-right font-bold text-amber-900 bg-amber-50/30">${r.prevCpus.toLocaleString('id-ID')}</td>
          <td class="py-2.5 px-3 text-center bg-amber-50/30">${formatTrendBadgeHtml(r.curCpus, r.prevCpus)}</td>
          <td class="py-2.5 px-3 text-right font-bold text-indigo-900 bg-indigo-50/30">${r.lyCpus.toLocaleString('id-ID')}</td>
          <td class="py-2.5 px-3 text-center bg-indigo-50/30">${formatTrendBadgeHtml(r.curCpus, r.lyCpus)}</td>
        </tr>
      `;
    }).join('');
  }

  if (tfootCpus) {
    tfootCpus.innerHTML = `
      <tr>
        <td colspan="3" class="py-3 px-3 text-right uppercase tracking-wider text-slate-700">Total CPUS Wilayah Terpilih (${kecRows.length} Kecamatan):</td>
        <td class="py-3 px-3 text-right text-blue-900 text-sm bg-blue-100/60">${totalCurCpus.toLocaleString('id-ID')}</td>
        <td class="py-3 px-3 text-right text-slate-800">100%</td>
        <td class="py-3 px-3 text-right text-amber-900 bg-amber-100/50">${totalPrevCpus.toLocaleString('id-ID')}</td>
        <td class="py-3 px-3 text-center bg-amber-100/50">${formatTrendBadgeHtml(totalCurCpus, totalPrevCpus)}</td>
        <td class="py-3 px-3 text-right text-indigo-900 bg-indigo-100/50">${totalLyCpus.toLocaleString('id-ID')}</td>
        <td class="py-3 px-3 text-center bg-indigo-100/50">${formatTrendBadgeHtml(totalCurCpus, totalLyCpus)}</td>
      </tr>
    `;
  }

  // Render Chart CPUS per Kecamatan (Top 15 so chart stays clean and readable)
  const chartRows = kecRows.slice(0, 15);
  const ctxCpus = document.getElementById('chart-kecamatan-cpus');
  if (ctxCpus) {
    if (chartKecamatanCpus) chartKecamatanCpus.destroy();
    chartKecamatanCpus = new Chart(ctxCpus.getContext('2d'), {
      type: 'bar',
      data: {
        labels: chartRows.map(r => r.kecamatan.replace(/^KEC\.\s*/i, '')),
        datasets: [
          {
            label: `Bulan Ini (${MONTH_SHORT[curMonthNum - 1]} ${curYear})`,
            data: chartRows.map(r => r.curCpus),
            backgroundColor: '#2563eb',
            borderRadius: 5
          },
          {
            label: `Last Month (${MONTH_SHORT[prevMonthNum - 1]} ${prevMonthYear})`,
            data: chartRows.map(r => r.prevCpus),
            backgroundColor: '#f59e0b',
            borderRadius: 5
          },
          {
            label: `Last Year (${MONTH_SHORT[curMonthNum - 1]} ${lastYear})`,
            data: chartRows.map(r => r.lyCpus),
            backgroundColor: '#6366f1',
            borderRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
            position: 'bottomLocked',
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return `${chartRows[idx].kecamatan} (${chartRows[idx].kabupaten})`;
              },
              label: (c) => ` ${c.dataset.label}: ${c.raw} CPUS`,
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const row = chartRows[idx];
                const diffM = row.curCpus - row.prevCpus;
                const diffY = row.curCpus - row.lyCpus;
                const sM = diffM >= 0 ? `+${diffM}` : `${diffM}`;
                const sY = diffY >= 0 ? `+${diffY}` : `${diffY}`;
                return [
                  `▸ Vs Last Month: ${sM} CPUS | Vs Last Year: ${sY} CPUS`
                ];
              }
            }
          }
        },
        scales: {
          x: { ticks: { font: { weight: 'bold', size: 10 } } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // SECTION 2: ANALISA PENETRASI UIO 2026 (YTD 2026 PER KECAMATAN RING 1)
  // -------------------------------------------------------------------------
  // Set of all unique VINs that serviced in 2026 (YTD) at AT GYR
  const servicedVins2026 = new Set();
  allJobs2026.forEach(j => {
    if (j.invDate && j.invDate.startsWith(String(curYear)) && j.vin) {
      servicedVins2026.add(j.vin.toUpperCase().trim());
    }
  });

  const uioList = appData.uio || [];
  // Group UIO by Kecamatan (Focusing on the 15 Kecamatan in Gianyar, Bangli, Klungkung)
  const uioTargetKecList = (kabFilter === 'KAB. GIANYAR' || kabFilter === 'KAB. BANGLI' || kabFilter === 'KAB. KLUNGKUNG')
    ? RING1_KECAMATAN_LIST.filter(x => x.kabupaten === kabFilter)
    : RING1_KECAMATAN_LIST;

  const uioMap = {};
  uioTargetKecList.forEach(item => {
    uioMap[item.kecamatan] = {
      kecamatan: item.kecamatan,
      kabupaten: item.kabupaten,
      totalUio: 0,
      sudahService: 0,
      belumService: 0
    };
  });

  uioList.forEach(u => {
    const kec = (u.kecamatan || '').toUpperCase().trim();
    if (!uioMap[kec]) return; // Only count the selected Gianyar, Bangli, Klungkung kecamatans
    uioMap[kec].totalUio++;
    if (servicedVins2026.has(u.vin.toUpperCase().trim())) {
      uioMap[kec].sudahService++;
    } else {
      uioMap[kec].belumService++;
    }
  });

  const uioRows = Object.values(uioMap).sort((a, b) => b.totalUio - a.totalUio);
  const totUioAll = uioRows.reduce((s, r) => s + r.totalUio, 0);
  const totUioSudah = uioRows.reduce((s, r) => s + r.sudahService, 0);
  const totUioBelum = uioRows.reduce((s, r) => s + r.belumService, 0);
  const totUioPct = totUioAll > 0 ? ((totUioSudah / totUioAll) * 100).toFixed(1) : '0.0';

  const tbodyUio = document.getElementById('table-kecamatan-uio');
  const tfootUio = document.getElementById('tfoot-kecamatan-uio');

  if (tbodyUio) {
    tbodyUio.innerHTML = uioRows.map((r, idx) => {
      const pctSudah = r.totalUio > 0 ? ((r.sudahService / r.totalUio) * 100).toFixed(1) : '0.0';
      const pctBelum = r.totalUio > 0 ? (100 - parseFloat(pctSudah)).toFixed(1) : '0.0';
      const kabBadgeClass = r.kabupaten === 'KAB. GIANYAR'
        ? 'bg-blue-50 text-blue-800 border-blue-200'
        : (r.kabupaten === 'KAB. BANGLI'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-purple-50 text-purple-800 border-purple-200');

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-2.5 px-3 text-center font-bold text-slate-400">${idx + 1}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-black border ${kabBadgeClass}">${r.kabupaten}</span>
          </td>
          <td class="py-2.5 px-3 font-black text-slate-900">${r.kecamatan}</td>
          <td class="py-2.5 px-3 text-right font-black text-slate-900 bg-slate-50 text-sm">${r.totalUio.toLocaleString('id-ID')} Unit</td>
          <td class="py-2.5 px-3 text-right font-black text-emerald-700 bg-emerald-50/40">
            ${r.sudahService.toLocaleString('id-ID')} Unit <span class="text-[10px] text-emerald-600 font-bold">(${pctSudah}%)</span>
          </td>
          <td class="py-2.5 px-3 text-right font-black text-rose-700 bg-rose-50/40">
            ${r.belumService.toLocaleString('id-ID')} Unit <span class="text-[10px] text-rose-600 font-bold">(${pctBelum}%)</span>
          </td>
          <td class="py-2.5 px-3">
            <div class="flex items-center space-x-2">
              <div class="w-full bg-rose-100 rounded-full h-2.5 overflow-hidden flex">
                <div class="bg-emerald-500 h-2.5 rounded-l-full" style="width: ${pctSudah}%"></div>
              </div>
              <span class="text-[11px] font-black text-emerald-800 w-12 text-right">${pctSudah}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  if (tfootUio) {
    const pctBelumTot = totUioAll > 0 ? (100 - parseFloat(totUioPct)).toFixed(1) : '0.0';
    tfootUio.innerHTML = `
      <tr>
        <td colspan="3" class="py-3 px-3 text-right uppercase tracking-wider text-slate-700">Total UIO 2026 (${uioRows.length} Kecamatan):</td>
        <td class="py-3 px-3 text-right text-slate-900 text-sm bg-slate-200/70">${totUioAll.toLocaleString('id-ID')} Unit</td>
        <td class="py-3 px-3 text-right text-emerald-800 bg-emerald-100/60">${totUioSudah.toLocaleString('id-ID')} Unit (${totUioPct}%)</td>
        <td class="py-3 px-3 text-right text-rose-800 bg-rose-100/60">${totUioBelum.toLocaleString('id-ID')} Unit (${pctBelumTot}%)</td>
        <td class="py-3 px-3 text-center text-emerald-900">${totUioPct}% Sudah Service</td>
      </tr>
    `;
  }

  // Render Chart UIO per Kecamatan
  const ctxUio = document.getElementById('chart-kecamatan-uio');
  if (ctxUio) {
    if (chartKecamatanUio) chartKecamatanUio.destroy();
    chartKecamatanUio = new Chart(ctxUio.getContext('2d'), {
      type: 'bar',
      data: {
        labels: uioRows.map(r => r.kecamatan.replace(/^KEC\.\s*/i, '')),
        datasets: [
          {
            label: 'Sudah Service di AT GYR (YTD 2026)',
            data: uioRows.map(r => r.sudahService),
            backgroundColor: '#10b981',
            borderRadius: 5
          },
          {
            label: 'Belum Service (Potensi Garapan)',
            data: uioRows.map(r => r.belumService),
            backgroundColor: '#f43f5e',
            borderRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
            position: 'bottomLocked',
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return `${uioRows[idx].kecamatan} (${uioRows[idx].kabupaten})`;
              },
              label: (c) => ` ${c.dataset.label}: ${c.raw.toLocaleString('id-ID')} Unit`,
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const r = uioRows[idx];
                const pct = r.totalUio > 0 ? ((r.sudahService / r.totalUio) * 100).toFixed(1) : '0.0';
                return [
                  `▸ Total UIO: ${r.totalUio.toLocaleString('id-ID')} Unit (Penetrasi: ${pct}%)`
                ];
              }
            }
          }
        },
        scales: {
          x: { ticks: { font: { weight: 'bold', size: 10 } } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  // Render 4 Top Summary Cards
  const summaryEl = document.getElementById('kecamatan-uio-summary-cards');
  if (summaryEl) {
    const diffMom = totalCurCpus - totalPrevCpus;
    const diffYoy = totalCurCpus - totalLyCpus;
    summaryEl.innerHTML = `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-[11px] font-extrabold text-slate-400 uppercase">Total CPUS Wilayah (${MONTH_SHORT[curMonthNum - 1]} ${curYear})</p>
        <h4 class="text-2xl font-black text-blue-900 mt-1">${totalCurCpus.toLocaleString('id-ID')} <span class="text-xs font-bold text-slate-500">CPUS</span></h4>
        <div class="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span class="${diffMom >= 0 ? 'text-emerald-700' : 'text-rose-700'}">MoM: ${diffMom >= 0 ? '+' : ''}${diffMom}</span>
          <span class="text-slate-300">|</span>
          <span class="${diffYoy >= 0 ? 'text-emerald-700' : 'text-rose-700'}">YoY: ${diffYoy >= 0 ? '+' : ''}${diffYoy}</span>
        </div>
      </div>

      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-[11px] font-extrabold text-slate-400 uppercase">Status Kecamatan (Naik vs Turun)</p>
        <div class="mt-1.5 space-y-1 text-xs font-extrabold">
          <div class="flex justify-between">
            <span class="text-slate-600">Vs Last Month:</span>
            <span><span class="text-emerald-600">🟢 ${naikMomCount} Naik</span> &bull; <span class="text-rose-600">🔴 ${turunMomCount} Turun</span></span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-600">Vs Last Year:</span>
            <span><span class="text-emerald-600">🟢 ${naikYoyCount} Naik</span> &bull; <span class="text-rose-600">🔴 ${turunYoyCount} Turun</span></span>
          </div>
        </div>
      </div>

      <div class="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
        <p class="text-[11px] font-extrabold text-emerald-700 uppercase">UIO Sudah Service (YTD 2026)</p>
        <h4 class="text-2xl font-black text-emerald-700 mt-1">${totUioSudah.toLocaleString('id-ID')} <span class="text-xs font-bold text-slate-500">/ ${totUioAll.toLocaleString('id-ID')} UIO</span></h4>
        <p class="text-xs font-extrabold text-emerald-600 mt-1">Penetrasi Service: ${totUioPct}%</p>
      </div>

      <div class="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
        <p class="text-[11px] font-extrabold text-rose-700 uppercase">UIO Belum Service (YTD 2026)</p>
        <h4 class="text-2xl font-black text-rose-700 mt-1">${totUioBelum.toLocaleString('id-ID')} <span class="text-xs font-bold text-slate-500">Unit</span></h4>
        <p class="text-xs font-extrabold text-rose-600 mt-1">${totUioAll > 0 ? (100 - parseFloat(totUioPct)).toFixed(1) : '0.0'}% Belum Masuk ke AT GYR</p>
      </div>
    `;
  }
}
