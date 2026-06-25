/* ═══════════════════════════════════════════
   Inventory System — App Logic
   ═══════════════════════════════════════════ */

const API = '/api';

// ── Toast ───────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2000);
}

// ── View Mode ───────────────────────────────────────────
let viewMode = 'card';

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById('vt-card').classList.toggle('active', mode === 'card');
  document.getElementById('vt-list').classList.toggle('active', mode === 'list');
  loadProducts();
}

// ── Load Products ───────────────────────────────────────
async function loadProducts() {
  const search = document.getElementById('search-input').value;
  const category = document.getElementById('category-filter').value;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);

  const res = await fetch(`${API}/products?${params}`);
  const products = await res.json();
  renderProducts(products);
  document.getElementById('product-count').textContent = `${products.length} 件`;
  loadCategories();
}

function renderProducts(products) {
  const grid = document.getElementById('product-grid');
  if (!products.length) {
    grid.className = 'product-grid';
    grid.innerHTML = '<div class="empty-state">尚無商品，點擊「＋ 新增商品」開始</div>';
    return;
  }

  if (viewMode === 'list') {
    grid.className = 'product-list';
    grid.innerHTML = `<div class="list-header">
      <span class="lh-name">商品名稱</span>
      <span class="lh-cat">分類</span>
      <span class="lh-qty">數量</span>
    </div>` + products.map(p => `
      <div class="list-row" onclick="openDetail('${p.id}')">
        <span class="lr-name">${esc(p.name)}</span>
        <span class="lr-cat">${esc(p.category || '-')}</span>
        <span class="lr-qty ${p.min_qty > 0 && p.qty <= p.min_qty ? 'low' : ''}">${p.qty} ${esc(p.unit)}</span>
      </div>
    `).join('');
    return;
  }

  grid.className = 'product-grid';
  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <div style="position:relative;display:flex;flex:1;min-height:0">
        ${p.photo_path
          ? `<img class="card-photo" src="${p.photo_path}?t=${Date.now()}" alt="${esc(p.name)}" loading="lazy" onclick="openDetail('${p.id}')">`
          : `<div class="card-photo" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px" onclick="openDetail('${p.id}')">無照片</div>`}
        ${p.category ? `<span class="card-category-overlay">${esc(p.category)}</span>` : ''}
      </div>
      <div class="card-body" onclick="openDetail('${p.id}')">
        <div class="card-top-row">
          <div class="card-name">${esc(p.name)}</div>
          <span class="card-qty ${p.min_qty > 0 && p.qty <= p.min_qty ? 'low' : ''}">${p.qty} ${esc(p.unit)}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-qty btn-qty-minus" onclick="event.stopPropagation();quickCardAdjust('${p.id}', -1, this)" ${p.qty <= 0 ? 'disabled' : ''}>−</button>
        <button class="btn-qty btn-qty-plus" onclick="event.stopPropagation();quickCardAdjust('${p.id}', 1, this)">+</button>
      </div>
    </div>
  `).join('');
}

async function loadCategories() {
  const res = await fetch(`${API}/categories`);
  const cats = await res.json();
  const sel = document.getElementById('category-filter');
  const current = sel.value;
  sel.innerHTML = '<option value="">全部分類</option>';
  cats.forEach(c => { sel.innerHTML += `<option value="${esc(c)}">${esc(c)}</option>`; });
  sel.value = current;
}

function showDatalist(input) {
  // Force datalist dropdown by briefly clearing and resetting the list attribute
  const listId = input.getAttribute('list');
  input.removeAttribute('list');
  void input.offsetWidth;
  input.setAttribute('list', listId);
  input.focus();
}

// ── Modal ───────────────────────────────────────────────
let _editPhotoFile = null;

function openAddModal() {
  _editPhotoFile = null;
  document.getElementById('modal-title').textContent = '新增商品';
  document.getElementById('prod-barcode').value = '';
  document.getElementById('edit-id').value = '';
  document.getElementById('product-form').reset();
  resetPhoto();
  showModal('product-modal');
}

async function openEditModal(id) {
  const res = await fetch(`${API}/products/${id}`);
  const p = await res.json();
  _editPhotoFile = null;
  document.getElementById('modal-title').textContent = '編輯商品';
  document.getElementById('edit-id').value = p.id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-barcode').value = p.barcode || '';
  document.getElementById('prod-qty').value = p.qty;
  document.getElementById('prod-unit').value = p.unit;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-min-qty').value = p.min_qty;
  document.getElementById('prod-notes').value = p.notes || '';
  if (p.photo_path) {
    setPhotoPreview(p.photo_path);
  } else {
    resetPhoto();
  }
  showModal('product-modal');
  closeDetail();
}

function closeModal() {
  hideModal('product-modal');
}

function showModal(id) {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}
function hideModal(id) {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById(id).classList.remove('open');
}

function resetPhoto() {
  const preview = document.getElementById('photo-preview');
  preview.src = '';
  preview.classList.remove('visible');
  document.getElementById('photo-input').value = '';
  _editPhotoFile = null;
}

// Compress image using Canvas (JPEG 70%, max 1200px)
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Calculate scaled dimensions (max 1200px)
      const MAX_SIZE = 1200;
      let width = img.width;
      let height = img.height;
      
      if (width > height && width > MAX_SIZE) {
        height = Math.round((height * MAX_SIZE) / width);
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width = Math.round((width * MAX_SIZE) / height);
        height = MAX_SIZE;
      }
      
      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Compress to JPEG 70%
      canvas.toBlob(
        (blob) => {
          // Create compressed file with .jpg extension
          const compressedFile = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
          resolve(compressedFile);
        },
        'image/jpeg',
        0.7
      );
    };
    img.src = URL.createObjectURL(file);
  });
}

async function previewPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // Compress image before preview
  const compressedFile = await compressImage(file);
  _editPhotoFile = compressedFile;
  
  const preview = document.getElementById('photo-preview');
  preview.src = URL.createObjectURL(compressedFile);
  preview.classList.add('visible');
  
  // Reset input value to allow re-selecting the same file
  e.target.value = '';
}

function setPhotoPreview(url) {
  const preview = document.getElementById('photo-preview');
  preview.src = url + '?t=' + Date.now();
  preview.classList.add('visible');
}

let _submitting = false;

async function submitProduct(e) {
  e.preventDefault();
  if (_submitting) return;
  _submitting = true;
  const id = document.getElementById('edit-id').value;
  const isEdit = !!id;

  const form = new FormData();
  form.set('name', document.getElementById('prod-name').value);
  form.set('barcode', document.getElementById('prod-barcode').value);
  form.set('category', document.getElementById('prod-category').value);
  form.set('qty', document.getElementById('prod-qty').value);
  form.set('unit', document.getElementById('prod-unit').value);
  form.set('min_qty', document.getElementById('prod-min-qty').value);
  form.set('notes', document.getElementById('prod-notes').value);

  let productId = id;
  if (isEdit) {
    const res = await fetch(`${API}/products/${id}`, { method: 'PUT', body: form });
    if (!res.ok) { toast('儲存失敗'); _submitting = false; return; }
  } else {
    const res = await fetch(`${API}/products`, { method: 'POST', body: form });
    if (!res.ok) { toast('儲存失敗'); _submitting = false; return; }
    const data = await res.json();
    productId = data.id;
  }

  if (_editPhotoFile) {
    const photoForm = new FormData();
    photoForm.set('photo', _editPhotoFile);
    const photoRes = await fetch(`${API}/products/${productId}/photo`, { method: 'POST', body: photoForm });
    if (!photoRes.ok) { toast('照片上傳失敗'); }
  }

  hideModal('product-modal');
  _submitting = false;
  loadProducts();
  toast(isEdit ? '已更新' : '已新增');
}

// ── Adjust ──────────────────────────────────────────────
function openAdjustModal(id, name, currentQty) {
  document.getElementById('adjust-id').value = id;
  document.getElementById('adjust-product-name').textContent = name;
  document.getElementById('adjust-current-qty').textContent = currentQty;
  document.getElementById('adjust-in').value = '';
  document.getElementById('adjust-out').value = '';
  document.getElementById('adjust-notes').value = '';
  showModal('adjust-modal');
}

function closeAdjustModal() {
  hideModal('adjust-modal');
}

// Set in/out by button (quick fill with accumulation)
function setInOut(val) {
  const inEl = document.getElementById('adjust-in');
  const outEl = document.getElementById('adjust-out');
  const currentIn = parseFloat(inEl.value) || 0;
  const currentOut = parseFloat(outEl.value) || 0;
  
  if (val > 0) {
    // 進貨：增加進貨框
    inEl.value = currentIn + 1;
    outEl.value = ''; // 清掉出貨框避免混淆
  } else {
    // 出貨：增加出貨框
    outEl.value = currentOut + 1;
    inEl.value = ''; // 清掉進貨框避免混淆
  }
}

async function submitAdjust(e) {
  e.preventDefault();
  const id = document.getElementById('adjust-id').value;
  const inQty = parseFloat(document.getElementById('adjust-in').value) || 0;
  const outQty = parseFloat(document.getElementById('adjust-out').value) || 0;
  const notes = document.getElementById('adjust-notes').value;
  
  // 如果兩個都填，以進貨為主（或你可以改成相減）
  let change = 0;
  if (inQty > 0 && outQty > 0) {
    // 兩個都有值：進貨 - 出貨（淨異動）
    change = inQty - outQty;
  } else if (inQty > 0) {
    change = inQty;
  } else if (outQty > 0) {
    change = -outQty; // 出貨是負數
  } else {
    toast('請輸入進貨或出貨數量');
    return;
  }
  
  const form = new FormData();
  form.set('change', change);
  form.set('notes', notes);
  const res = await fetch(`${API}/products/${id}/adjust`, { method: 'POST', body: form });
  if (!res.ok) { toast('調整失敗'); return; }
  hideModal('adjust-modal');
  loadProducts();
  openDetail(id);
  toast('已調整');
}

async function quickCardAdjust(id, change, btn) {
  // change: +1 (進貨) 或 -1 (出貨)
  // 改為開啟快速調整視窗，讓使用者輸入異動數量
  const type = change > 0 ? 'in' : 'out';
  openQuickAdjustModal(id, type);
}

// ── Quick Adjust Modal (for card +/- buttons) ───────────────
function openQuickAdjustModal(id, type) {
  // type: 'in' (進貨) 或 'out' (出貨)
  fetch(`${API}/products/${id}`).then(r => r.json()).then(p => {
    const currentQty = parseFloat(p.qty) || 0;
    
    document.getElementById('quick-adjust-id').value = id;
    document.getElementById('quick-adjust-type').value = type;
    document.getElementById('quick-adjust-product-name').textContent = p.name;
    document.getElementById('quick-adjust-current-qty').textContent = `${currentQty} ${p.unit}`;
    
    if (type === 'in') {
      document.getElementById('quick-adjust-label').textContent = '進貨數量';
      document.getElementById('quick-adjust-change').value = '1';
      document.getElementById('quick-adjust-notes').value = '快速進貨';
    } else {
      document.getElementById('quick-adjust-label').textContent = '出貨數量';
      document.getElementById('quick-adjust-change').value = '1';
      document.getElementById('quick-adjust-notes').value = '快速出貨';
    }
    
    showModal('quick-adjust-modal');
  });
}

function closeQuickAdjustModal() {
  hideModal('quick-adjust-modal');
}

function quickSetChange(val) {
  const input = document.getElementById('quick-adjust-change');
  input.value = Math.abs(val);
}

async function submitQuickAdjust(e) {
  e.preventDefault();
  const id = document.getElementById('quick-adjust-id').value;
  const type = document.getElementById('quick-adjust-type').value;
  const changeQty = parseFloat(document.getElementById('quick-adjust-change').value);
  const notes = document.getElementById('quick-adjust-notes').value;
  
  // 根據類型決定正負號
  const delta = type === 'in' ? changeQty : -changeQty;
  
  const form = new FormData();
  form.set('change', delta);
  form.set('notes', notes || (type === 'in' ? '快速進貨' : '快速出貨'));
  
  const res = await fetch(`${API}/products/${id}/adjust`, { method: 'POST', body: form });
  if (!res.ok) { toast('調整失敗'); return; }
  
  hideModal('quick-adjust-modal');
  loadProducts();
  toast('已調整');
}

let _scannerActive = false;

// ── BarcodeDetector API scanner (fast, hardware-accelerated) ──
async function createScanner(onScan, onCancel) {
  console.log('[DEBUG] createScanner called, _scannerActive=', _scannerActive);
  if (_scannerActive) return;
  _scannerActive = true;

  // Check for native BarcodeDetector support (iOS 14.3+, Chrome 88+)
  if (typeof BarcodeDetector !== 'undefined') {
    return _createNativeScanner(onScan, onCancel);
  }
  // Fallback to html5-qrcode
  return _createLegacyScanner(onScan, onCancel);
}

async function _createNativeScanner(onScan, onCancel) {
  let stopped = false;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;';

  const video = document.createElement('video');
  video.style.cssText = 'width:300px;height:300px;object-fit:cover;border-radius:12px;';
  video.setAttribute('playsinline', '');
  video.setAttribute('autoplay', '');
  video.muted = true;

  const hint = document.createElement('div');
  hint.style.cssText = 'color:#fff;font-size:14px;margin-top:16px;text-align:center;';
  hint.textContent = '對準條碼即可自動掃描';

  const closeX = document.createElement('button');
  closeX.textContent = '✕';
  closeX.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;width:40px;height:40px;border:none;border-radius:50%;background:rgba(255,255,255,0.15);color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;';

  overlay.appendChild(video);
  overlay.appendChild(hint);
  document.body.appendChild(overlay);
  document.body.appendChild(closeX);

  const barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code'] });
  let detectTimer = null;

  const cleanup = async () => {
    stopped = true;
    _scannerActive = false;
    if (detectTimer) { clearTimeout(detectTimer); detectTimer = null; }
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
    }
    if (overlay.parentNode) overlay.remove();
    if (closeX.parentNode) closeX.remove();
  };

  closeX.onclick = cleanup;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    if (!stopped) {
      hint.textContent = '相機錯誤: ' + err.message;
      hint.style.color = '#f66';
    }
    _scannerActive = false;
    return;
  }

  // Fast detection loop — try every 150ms
  async function detect() {
    if (stopped) return;
    try {
      const barcodes = await barcodeDetector.detect(video);
      if (barcodes.length > 0 && !stopped) {
        await cleanup();
        onScan(barcodes[0].rawValue);
        return;
      }
    } catch (e) {
      // Detection failed silently (e.g. no frame ready yet)
    }
    detectTimer = setTimeout(detect, 150);
  }
  detectTimer = setTimeout(detect, 300); // Small initial delay for camera to warm up
}

// ── ZXing browser fallback (iOS-compatible, uses @zxing/browser) ──
function _createLegacyScanner(onScan, onCancel) {
  let stopped = false;
  let controls = null;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;';

  const video = document.createElement('video');
  video.style.cssText = 'width:300px;height:300px;object-fit:cover;border-radius:12px;';
  video.setAttribute('playsinline', '');
  video.setAttribute('autoplay', '');
  video.muted = true;

  overlay.appendChild(video);
  document.body.appendChild(overlay);

  const closeX = document.createElement('button');
  closeX.textContent = '✕';
  closeX.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;width:40px;height:40px;border:none;border-radius:50%;background:rgba(255,255,255,0.15);color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  document.body.appendChild(closeX);

  const hint = document.createElement('div');
  hint.style.cssText = 'color:#fff;font-size:14px;margin-top:16px;text-align:center;';
  hint.textContent = '對準條碼即可自動掃描';
  overlay.appendChild(hint);

  const cleanup = () => {
    stopped = true;
    _scannerActive = false;
    if (controls) { controls.stop(); controls = null; }
    if (overlay.parentNode) overlay.remove();
    if (closeX.parentNode) closeX.remove();
  };

  closeX.onclick = cleanup;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  const reader = new ZXingBrowser.BrowserMultiFormatReader();
  reader.timeBetweenScansMillis = 200;

  reader.decodeFromVideoDevice(null, video, (result, err) => {
    if (stopped) return;
    if (result) {
      cleanup();
      onScan(result.getText());
    }
    // err = no barcode in frame, silently continue
  }).then(ctrl => {
    controls = ctrl;
    if (stopped) { ctrl.stop(); }
  }).catch(err => {
    if (!stopped) {
      hint.textContent = '相機錯誤: ' + err.message;
      hint.style.color = '#f66';
    }
    _scannerActive = false;
  });
}
function scanAndAdd() {
  createScanner(async (barcode) => {
    const form = new FormData();
    form.set('barcode', barcode);
    const res = await fetch('/api/scan', { method: 'POST', body: form });
    const data = await res.json();

    if (data.found) {
      toast(`✅ ${data.product} → ${data.new_qty}`);
      loadProducts();
    } else {
      toast('未找到商品，請新增');
      openAddModal();
      document.getElementById('prod-barcode').value = barcode;
    }
  });
}

function scanAndRemove() {
  console.log('[DEBUG] scanAndRemove called, _scannerActive=', _scannerActive);
  createScanner(async (barcode) => {
    const form = new FormData();
    form.set('barcode', barcode);
    const res = await fetch('/api/scan-out', { method: 'POST', body: form });
    const data = await res.json();

    if (!data.found) {
      toast('未找到商品');
      return;
    }
    if (data.zero) {
      toast(`⚠️ ${data.product} 庫存已為 0`);
      return;
    }
    toast(`📤 ${data.product} → ${data.new_qty}`);
    loadProducts();
  });
}

// ── Scan barcode into form field ─────────────────────────
function scanBarcodeToField() {
  createScanner((barcode) => {
    document.getElementById('prod-barcode').value = barcode;
    toast('已掃描');
  });
}

// ── Detail Drawer ───────────────────────────────────────
let _detailId = null;

async function openDetail(id) {
  _detailId = id;
  const res = await fetch(`${API}/products/${id}`);
  const p = await res.json();

  document.getElementById('detail-name').textContent = p.name;
  document.getElementById('detail-qty').textContent = `${p.qty} ${p.unit}`;
  document.getElementById('detail-category').textContent = p.category || '-';
  document.getElementById('detail-min-qty').textContent = p.min_qty || '-';
  document.getElementById('detail-notes').textContent = p.notes || '-';

  if (p.photo_path) {
    document.getElementById('detail-photo').src = p.photo_path + '?t=' + Date.now();
    document.getElementById('detail-photo').style.display = 'block';
  } else {
    document.getElementById('detail-photo').style.display = 'none';
  }

  document.getElementById('detail-edit-btn').onclick = () => openEditModal(id);
  document.getElementById('detail-adjust-btn').onclick = () => openAdjustModal(id, p.name, p.qty);
  document.getElementById('detail-delete-btn').onclick = () => deleteProduct(id);

  const logsRes = await fetch(`${API}/products/${id}/logs`);
  const logs = await logsRes.json();
  renderLogs(logs);

  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-drawer').classList.add('open');
}

function closeDetail() {
  _detailId = null;
  document.getElementById('detail-overlay').classList.remove('open');
  document.getElementById('detail-drawer').classList.remove('open');
}

async function deleteProduct(id) {
  if (!confirm('確定要刪除此商品？此操作無法復原。')) return;
  await fetch(`${API}/products/${id}`, { method: 'DELETE' });
  closeDetail();
  loadProducts();
  toast('已刪除');
}

function renderLogs(logs) {
  const el = document.getElementById('detail-logs');
  if (!logs.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:20px;text-align:center">尚無異動記錄</div>';
    return;
  }
  el.innerHTML = logs.map(l => `
    <div class="log-item">
      <span class="log-delta ${l.type === 'in' ? 'in' : l.type === 'out' ? 'out' : ''}">
        ${l.change_qty > 0 ? '+' : ''}${l.change_qty}
      </span>
      <span>→ ${l.result_qty}</span>
      ${l.notes ? `<span style="color:var(--text-muted);font-size:12px">${esc(l.notes)}</span>` : ''}
      <span class="log-time">${l.created_at.slice(5, 16)}</span>
    </div>
  `).join('');
}

// ── Helpers ─────────────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Keyboard ────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('detail-drawer').classList.contains('open')) {
      closeDetail();
    }
  }
});

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
    loadProducts();
  } else {
    toast('匯入失敗');
  }
}

// ── Init ─────────────────────────────────────────────────
loadProducts();