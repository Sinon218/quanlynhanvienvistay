// ===================================================================
// PART-TIME PORTAL JS - parttime.js
// Chỉ có chức năng chấm công (check-in / check-out)
// ===================================================================

const API_URL = (window.location.protocol === 'file:') ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
let token = localStorage.getItem('vistay_token');
let currentUser = null;

// ===== AUTH CHECK =====
function checkAuth() {
  const userStr = localStorage.getItem('vistay_user');
  if (!token || !userStr) {
    handleLogout();
    return;
  }

  if (token !== 'local_fallback_token') {
    localStorage.setItem('vistay_mode', 'backend');
    localStorage.removeItem('vistay_offline_warning');
  }

  try {
    currentUser = JSON.parse(userStr);
    // Chỉ cho phép role 'parttime' truy cập trang này
    if (currentUser.role !== 'parttime') {
      if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'employee.html';
      }
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
  let mode = localStorage.getItem('vistay_mode') || 'backend';

  if (mode === 'local') {
    return handleLocalMockCall(endpoint, method, body);
  }

  try {
    const headers = { 'Authorization': `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
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
    if (err.message && (err.message.includes('Failed to fetch') || err.name === 'TypeError')) {
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

// ===== DATE DISPLAY =====
function updateCurrentDate() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('currentDate').textContent = now.toLocaleDateString('vi-VN', options);
}

// ===== CHECK-IN =====
async function doCheckIn() {
  const btn = document.getElementById('btnCheckIn');
  btn.disabled = true;
  btn.innerHTML = '⏳ Đang check-in...';

  try {
    const data = await apiCall('/attendance/check-in', 'POST');
    showToast(data.message, 'success');
    loadTodayStatus();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔍 Check In';
  }
}

// ===== CHECK-OUT =====
async function doCheckOut() {
  const btn = document.getElementById('btnCheckOut');
  btn.disabled = true;
  btn.innerHTML = '⏳ Đang check-out...';

  try {
    const data = await apiCall('/attendance/check-out', 'POST');
    showToast(data.message, 'success');
    loadTodayStatus();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚪 Check Out';
  }
}

// ===== LOAD TODAY STATUS =====
async function loadTodayStatus() {
  try {
    const data = await apiCall('/attendance/today');
    
    const statusText = document.getElementById('statusText');
    const statusTime = document.getElementById('statusTime');
    const btnCheckIn = document.getElementById('btnCheckIn');
    const btnCheckOut = document.getElementById('btnCheckOut');

    if (!data.checked_in) {
      // Chưa check-in
      statusText.textContent = '🔴 Chưa Check In';
      statusText.style.color = '#ef4444';
      statusTime.textContent = 'Nhấn nút Check In khi đến công ty';
      btnCheckIn.style.opacity = '1';
      btnCheckIn.style.pointerEvents = 'auto';
      btnCheckOut.style.opacity = '0.5';
      btnCheckOut.style.pointerEvents = 'none';
      
      document.getElementById('todayCheckIn').textContent = '--:--';
      document.getElementById('todayCheckOut').textContent = '--:--';
      document.getElementById('todayTotalHours').textContent = '--';
    } else if (data.checked_in && !data.checked_out) {
      // Đã check-in, chưa check-out
      statusText.textContent = '🟢 Đã Check In';
      statusText.style.color = '#10b981';
      statusTime.textContent = `Lúc ${data.check_in_rounded}`;
      btnCheckIn.style.opacity = '0.5';
      btnCheckIn.style.pointerEvents = 'none';
      btnCheckOut.style.opacity = '1';
      btnCheckOut.style.pointerEvents = 'auto';
      
      document.getElementById('todayCheckIn').textContent = data.check_in_rounded;
      document.getElementById('todayCheckOut').textContent = '--:--';
      document.getElementById('todayTotalHours').textContent = 'Đang làm...';
    } else {
      // Đã check-out
      statusText.textContent = '✅ Đã Check Out';
      statusText.style.color = '#3b82f6';
      statusTime.textContent = `Đến: ${data.check_in_rounded} | Về: ${data.check_out_rounded}`;
      btnCheckIn.style.opacity = '0.5';
      btnCheckIn.style.pointerEvents = 'none';
      btnCheckOut.style.opacity = '0.5';
      btnCheckOut.style.pointerEvents = 'none';
      
      document.getElementById('todayCheckIn').textContent = data.check_in_rounded;
      document.getElementById('todayCheckOut').textContent = data.check_out_rounded;
      document.getElementById('todayTotalHours').textContent = data.total_hours ? `${data.total_hours}h` : '--';
    }
  } catch (err) {
    console.error('Load today status error:', err);
  }
}

// ===== LOAD HISTORY =====
async function loadHistory() {
  const month = document.getElementById('historyMonth').value;
  const year = document.getElementById('historyYear').value;

  try {
    const data = await apiCall(`/attendance/history?month=${month}&year=${year}`);
    const tbody = document.getElementById('historyTableBody');
    
    document.getElementById('totalHoursMonth').textContent = `${data.total_hours_month} giờ`;

    if (data.records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">Không có dữ liệu chấm công tháng này</td></tr>';
      return;
    }

    tbody.innerHTML = data.records.map(r => {
      const date = new Date(r.work_date);
      const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      return `
        <tr>
          <td>${dateStr}</td>
          <td style="font-weight: 600; color: #10b981;">${r.check_in_rounded || '--:--'}</td>
          <td style="font-weight: 600; color: #f59e0b;">${r.check_out_rounded || '--:--'}</td>
          <td style="font-weight: 700;">${r.total_hours ? r.total_hours + 'h' : '--'}</td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${r.notes || ''}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Load history error:', err);
  }
}

// ===== INIT MONTH/YEAR FILTERS =====
function initFilters() {
  const monthSelect = document.getElementById('historyMonth');
  const yearSelect = document.getElementById('historyYear');
  const now = new Date();

  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

  for (let m = 0; m < 12; m++) {
    const opt = document.createElement('option');
    opt.value = m + 1;
    opt.textContent = monthNames[m];
    if (m === now.getMonth()) opt.selected = true;
    monthSelect.appendChild(opt);
  }

  const currentYear = now.getFullYear();
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === currentYear) opt.selected = true;
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
