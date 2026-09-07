// ===================================================================
// PART-TIME PORTAL JS - parttime.js
// Chức năng: check-in / check-out + lịch sử chấm công
// ===================================================================

const API_URL = (window.location.protocol === 'file:') ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
let token = localStorage.getItem('vistay_token');
let currentUser = null;

function checkAuth() {
  const userStr = localStorage.getItem('vistay_user');
  if (!token || !userStr) { handleLogout(); return; }

  if (token !== 'local_fallback_token') {
    localStorage.setItem('vistay_mode', 'backend');
    localStorage.removeItem('vistay_offline_warning');
  }

  try {
    currentUser = JSON.parse(userStr);
    if (currentUser.role !== 'parttime') {
      window.location.href = (currentUser.role === 'admin' || currentUser.role === 'manager') ? 'admin.html' : 'employee.html';
      return;
    }
    document.getElementById('employeeName').textContent = currentUser.staffName || currentUser.username;
  } catch (e) {
    handleLogout();
  }
}

function handleLogout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

// ===== API HELPER =====
async function apiCall(endpoint, method = 'GET', body = null) {
  const mode = localStorage.getItem('vistay_mode') || 'backend';
  if (mode === 'local') return handleLocalMockCall(endpoint, method, body);

  try {
    const headers = { 'Authorization': `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${API_URL}${endpoint}`, {
      method, headers,
      body: body ? JSON.stringify(body) : null,
      cache: 'no-store'
    });

    if (!response.ok) {
      if (response.status === 401) { handleLogout(); return; }
      const data = await response.json();
      throw new Error(data.error || 'Lỗi API');
    }
    return await response.json();
  } catch (err) {
    if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
      localStorage.setItem('vistay_mode', 'local');
      localStorage.setItem('vistay_offline_warning', '1');
      document.getElementById('offlineAlertBanner').style.display = 'block';
      return handleLocalMockCall(endpoint, method, body);
    }
    throw err;
  }
}

// ===== TOAST =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', info: 'ℹ️', warning: '⚠️', error: '❌' };
  toast.innerHTML = `<span>${icons[type] || '✅'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== LOCAL MOCK (OFFLINE MODE) =====
let _mockRecords = [];

function roundTo15(date) {
  const h = date.getHours(), m = Math.round(date.getMinutes() / 15) * 15;
  return m >= 60 ? `${String(h + 1).padStart(2, '0')}:00` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calcHours(inTime, outTime) {
  const [iH, iM] = inTime.split(':').map(Number);
  const [oH, oM] = outTime.split(':').map(Number);
  return Math.round(((oH * 60 + oM) - (iH * 60 + iM)) / 60 * 100) / 100;
}

function handleLocalMockCall(endpoint, method, body) {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  if (endpoint === '/attendance/check-in' && method === 'POST') {
    const existing = _mockRecords.find(r => r.work_date === today);
    if (existing) return Promise.reject(new Error(existing.check_out ? 'Bạn đã check-in và check-out hôm nay rồi.' : 'Bạn đã check-in hôm nay rồi.'));
    const rounded = roundTo15(now);
    _mockRecords.push({ check_in_rounded: rounded, check_out_rounded: null, total_hours: null, work_date: today });
    return Promise.resolve({ message: 'Check-in thành công!', check_in_rounded: rounded, work_date: today });
  }

  if (endpoint === '/attendance/check-out' && method === 'POST') {
    const existing = _mockRecords.find(r => r.work_date === today);
    if (!existing) return Promise.reject(new Error('Bạn chưa check-in hôm nay.'));
    if (existing.check_out_rounded) return Promise.reject(new Error('Bạn đã check-out hôm nay rồi.'));
    const rounded = roundTo15(now);
    existing.check_out_rounded = rounded;
    existing.total_hours = calcHours(existing.check_in_rounded, rounded);
    return Promise.resolve({ message: 'Check-out thành công!', check_out_rounded: rounded, total_hours: existing.total_hours, work_date: today });
  }

  if (endpoint === '/attendance/today') {
    const existing = _mockRecords.find(r => r.work_date === today);
    if (!existing) return Promise.resolve({ checked_in: false, checked_out: false });
    return Promise.resolve({ checked_in: true, checked_out: !!existing.check_out_rounded, check_in_rounded: existing.check_in_rounded, check_out_rounded: existing.check_out_rounded, total_hours: existing.total_hours });
  }

  if (endpoint.startsWith('/attendance/history')) {
    return Promise.resolve({ records: _mockRecords, total_hours_month: _mockRecords.reduce((s, r) => s + (r.total_hours || 0), 0), month: now.getMonth() + 1, year: now.getFullYear() });
  }

  return Promise.reject(new Error('Endpoint mock chưa hỗ trợ: ' + endpoint));
}

// ===== UI =====
function updateCurrentDate() {
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function doCheckIn() {
  const btn = document.getElementById('btnCheckIn');
  btn.disabled = true; btn.innerHTML = '⏳ Đang check-in...';
  try {
    const data = await apiCall('/attendance/check-in', 'POST');
    showToast(data.message, 'success');
    loadTodayStatus();
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '🔍 Check In'; }
}

async function doCheckOut() {
  const btn = document.getElementById('btnCheckOut');
  btn.disabled = true; btn.innerHTML = '⏳ Đang check-out...';
  try {
    const data = await apiCall('/attendance/check-out', 'POST');
    showToast(data.message, 'success');
    loadTodayStatus();
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '🚪 Check Out'; }
}

async function loadTodayStatus() {
  try {
    const data = await apiCall('/attendance/today');
    const statusText = document.getElementById('statusText');
    const statusTime = document.getElementById('statusTime');
    const btnIn = document.getElementById('btnCheckIn');
    const btnOut = document.getElementById('btnCheckOut');

    const setBtn = (el, active) => { el.style.opacity = active ? '1' : '0.5'; el.style.pointerEvents = active ? 'auto' : 'none'; };

    if (!data.checked_in) {
      statusText.textContent = '🔴 Chưa Check In'; statusText.style.color = '#ef4444';
      statusTime.textContent = 'Nhấn nút Check In khi đến công ty';
      setBtn(btnIn, true); setBtn(btnOut, false);
      document.getElementById('todayCheckIn').textContent = '--:--';
      document.getElementById('todayCheckOut').textContent = '--:--';
      document.getElementById('todayTotalHours').textContent = '--';
    } else if (!data.checked_out) {
      statusText.textContent = '🟢 Đã Check In'; statusText.style.color = '#10b981';
      statusTime.textContent = `Lúc ${data.check_in_rounded}`;
      setBtn(btnIn, false); setBtn(btnOut, true);
      document.getElementById('todayCheckIn').textContent = data.check_in_rounded;
      document.getElementById('todayCheckOut').textContent = '--:--';
      document.getElementById('todayTotalHours').textContent = 'Đang làm...';
    } else {
      statusText.textContent = '✅ Đã Check Out'; statusText.style.color = '#3b82f6';
      statusTime.textContent = `Đến: ${data.check_in_rounded} | Về: ${data.check_out_rounded}`;
      setBtn(btnIn, false); setBtn(btnOut, false);
      document.getElementById('todayCheckIn').textContent = data.check_in_rounded;
      document.getElementById('todayCheckOut').textContent = data.check_out_rounded;
      document.getElementById('todayTotalHours').textContent = data.total_hours ? `${data.total_hours}h` : '--';
    }
  } catch (err) { console.error('Load today status error:', err); }
}

async function loadHistory() {
  const month = document.getElementById('historyMonth').value;
  const year = document.getElementById('historyYear').value;
  try {
    const data = await apiCall(`/attendance/history?month=${month}&year=${year}`);
    const tbody = document.getElementById('historyTableBody');
    document.getElementById('totalHoursMonth').textContent = `${data.total_hours_month} giờ`;

    if (data.records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);">Không có dữ liệu chấm công tháng này</td></tr>';
      return;
    }

    tbody.innerHTML = data.records.map(r => {
      const d = new Date(r.work_date);
      const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      return `<tr>
        <td>${dateStr}</td>
        <td style="font-weight:600;color:#10b981;">${r.check_in_rounded || '--:--'}</td>
        <td style="font-weight:600;color:#f59e0b;">${r.check_out_rounded || '--:--'}</td>
        <td style="font-weight:700;">${r.total_hours ? r.total_hours + 'h' : '--'}</td>
        <td style="color:var(--text-muted);font-size:0.85rem;">${r.notes || ''}</td>
      </tr>`;
    }).join('');
  } catch (err) { console.error('Load history error:', err); }
}

function initFilters() {
  const monthSelect = document.getElementById('historyMonth');
  const yearSelect = document.getElementById('historyYear');
  const now = new Date();
  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

  monthSelect.innerHTML = '';
  for (let m = 0; m < 12; m++) {
    const opt = document.createElement('option');
    opt.value = m + 1; opt.textContent = monthNames[m];
    if (m === now.getMonth()) opt.selected = true;
    monthSelect.appendChild(opt);
  }

  yearSelect.innerHTML = '';
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    if (y === now.getFullYear()) opt.selected = true;
    yearSelect.appendChild(opt);
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  updateCurrentDate();
  initFilters();
  loadTodayStatus();
  loadHistory();
});
