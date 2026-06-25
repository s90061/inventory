// ── Report JS ──────────────────────────────────────────────
const API = '/api';

async function loadReport() {
  try {
    const [summary, trends] = await Promise.all([
      fetch(`${API}/report/summary`).then(r => r.json()),
      fetch(`${API}/report/trends?days=30`).then(r => r.json())
    ]);
    renderKPIs(summary);
    renderTrendsChart(trends);
    renderCategoryChart(summary.categories);
    renderLowStock(summary.low_stock_items);
    renderLogs(summary.recent_logs);
  } catch (err) {
    console.error('Failed to load report:', err);
  }
}

function renderKPIs(data) {
  document.getElementById('kpi-products').textContent = data.total_products;
  document.getElementById('kpi-products').classList.remove('shimmer');
  document.getElementById('kpi-qty').textContent = data.total_qty;
  document.getElementById('kpi-qty').classList.remove('shimmer');
  document.getElementById('kpi-low').textContent = data.low_stock;
  document.getElementById('kpi-low').classList.remove('shimmer');
}

// ── Trends Chart ──────────────────────────────────────────
let trendsChart = null;
function renderTrendsChart(data) {
  const ctx = document.getElementById('trendsChart').getContext('2d');
  if (trendsChart) trendsChart.destroy();

  trendsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: '進貨',
          data: data.in,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.08)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointBackgroundColor: '#4CAF50'
        },
        {
          label: '出貨',
          data: data.out,
          borderColor: '#E57373',
          backgroundColor: 'rgba(229, 115, 115, 0.08)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointBackgroundColor: '#E57373'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 10, right: 10, bottom: 0, left: 10 } },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#aaa', font: { size: 12 }, padding: 16, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: 'rgba(20,20,20,0.95)',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
          displayColors: true
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#888', font: { size: 10 }, maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 8 }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.08)' },
          ticks: { color: '#888', font: { size: 10 }, padding: 8 }
        }
      }
    }
  });
}

// ── Category Doughnut Chart ───────────────────────────────
let categoryChart = null;
function renderCategoryChart(categories) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (categoryChart) categoryChart.destroy();

  if (!categories || categories.length === 0) {
    document.getElementById('categoryChart').parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">尚無分類資料</div>';
    return;
  }

  const colors = [
    '#c9a84c', '#8B7355', '#6B8E4E', '#4A7C8C', '#9B6B9E',
    '#C4704A', '#5A8A6A', '#7A6A8A', '#AA6A5A', '#6A8AAA'
  ];

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.map(c => c.name),
      datasets: [{
        data: categories.map(c => c.count),
        backgroundColor: colors.slice(0, categories.length),
        borderColor: '#121212',
        borderWidth: 2,
        hoverBorderColor: '#1a1a1a'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 10 },
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#aaa', font: { size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 }
        },
        tooltip: {
          backgroundColor: 'rgba(20,20,20,0.95)',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} 件`
          }
        }
      }
    }
  });
}

// ── Low Stock ─────────────────────────────────────────────
function renderLowStock(items) {
  const section = document.getElementById('low-stock-section');
  const el = document.getElementById('low-stock-list');
  if (!items || items.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  const maxMin = Math.max(...items.map(i => i.min_qty), 1);

  // Group by category
  const groups = {};
  items.forEach(i => {
    const cat = i.category || '-';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(i);
  });

  el.innerHTML = Object.entries(groups).map(([cat, catItems]) => `
    <div class="low-stock-group">
      <div class="low-stock-cat-label">${esc(cat)}</div>
      ${catItems.map(i => {
        const pct = Math.min((i.qty / i.min_qty) * 100, 100);
        return `
          <div class="low-stock-item">
            <span class="low-stock-name">${esc(i.name)}</span>
            <span class="low-stock-status">
              <span>${i.qty}/${i.min_qty} ${esc(i.unit)}</span>
              <div class="low-stock-bar-wrap"><div class="low-stock-bar" style="width:${pct}%"></div></div>
            </span>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');
}

// ── Recent Logs ───────────────────────────────────────────
function renderLogs(logs) {
  const el = document.getElementById('log-list');
  if (!logs || logs.length === 0) {
    el.innerHTML = '<div class="log-item" style="color:var(--text-muted)">尚無異動記錄</div>';
    return;
  }
  el.innerHTML = logs.map(l => {
    const cls = l.type === 'in' ? 'in' : 'out';
    const sign = l.type === 'in' ? '+' : '';
    return `
      <div class="log-item">
        <span class="log-name">${esc(l.product_name)}</span>
        <span class="log-qty ${cls}">${sign}${l.change_qty}</span>
        <span class="log-time">${formatTime(l.created_at)}</span>
      </div>
    `;
  }).join('');
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts.replace(' ', 'T'));
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '剛剛';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分鐘前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小時前';
  return ts.slice(5, 16);
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Toast ───────────────────────────────────────────────
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2000);
}

// ── Export / Import ─────────────────────────────────────
async function exportData() {
  const a = document.createElement('a');
  a.href = '/api/export';
  a.download = 'inventory_export.json';
  a.click();
  toast('📤 已下載');
}

async function importData(input) {
  const file = input.files[0];
  if (!file) return;
  if (!confirm(`確定要匯入「${file.name}」？\n已有商品會更新，新商品會新增。`)) {
    input.value = '';
    return;
  }
  const form = new FormData();
  form.set('file', file);
  const res = await fetch('/api/import', { method: 'POST', body: form });
  const data = await res.json();
  input.value = '';
  if (data.ok) {
    toast(`✅ 匯入 ${data.imported} 件商品`);
    loadReport();
  } else {
    toast('匯入失敗');
  }
}

// ── Init ──────────────────────────────────────────────────
loadReport();