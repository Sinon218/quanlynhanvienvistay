// ===================================================================
// EMPLOYEE PORTAL JS - employee.js
// ===================================================================

const API_URL = 'http://localhost:3000/api';
let token = localStorage.getItem('vistay_token');
let currentUser = null;

// Auth check
function checkAuth() {
  const userStr = localStorage.getItem('vistay_user');
  if (!token || !userStr) {
    handleLogout();
    return;
  }
  try {
    currentUser = JSON.parse(userStr);
    if (currentUser.role !== 'employee') {
      window.location.href = 'admin.html';
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

// ===== API REQUEST HELPER WITH OFFLINE FALLBACK =====
async function apiCall(endpoint, method = 'GET', body = null) {
  let mode = localStorage.getItem('vistay_mode') || 'backend';
  
  if (mode === 'local') {
    return handleLocalMockCall(endpoint, method, body);
  }

  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const options = {
      method,
      headers,
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : null)
    };

    const response = await fetch(`${API_URL}${endpoint}`, options);
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Đã xảy ra lỗi khi gọi API.');
    }
    
    return await response.json();
  } catch (err) {
    console.warn(`API call to ${endpoint} failed: ${err.message}. Falling back to local offline mode.`);
    localStorage.setItem('vistay_mode', 'local');
    setTimeout(() => {
      showToast('Hệ thống đang chạy ở Chế độ Ngoại tuyến do kết nối DB gián đoạn!', 'info');
    }, 100);
    return handleLocalMockCall(endpoint, method, body);
  }
}

// ===== LOCAL SIMULATION DATABASE (OFFLINE MODE) =====
function getLocalData(key, defaultVal) {
  const val = localStorage.getItem(key);
  if (!val) {
    localStorage.setItem(key, JSON.stringify(defaultVal));
    return defaultVal;
  }
  return JSON.parse(val);
}

function saveLocalData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// API Simulation layer for employee
function handleLocalMockCall(endpoint, method, body) {
  let localStaff = getLocalData('vistay_mock_staff', []);
  let localRooms = getLocalData('vistay_mock_apartments', []);
  let localWork = getLocalData('vistay_mock_work', []);
  let localSalary = getLocalData('vistay_mock_salary', []);

  // GET /work/today
  if (endpoint === '/work/today' && method === 'GET') {
    const todayStr = new Date().toISOString().split('T')[0];
    // Filter tasks assigned to current employee today
    const myTasks = localWork.filter(w => w.staff_id === currentUser.staffId && w.assigned_date === todayStr);
    
    // Join with room info
    const joined = myTasks.map(task => {
      const room = localRooms.find(r => r.id === task.apartment_id) || {};
      return {
        id: task.id,
        code: room.code || '???',
        building: room.building || '???',
        is_samsung: room.is_samsung || false,
        task_type: task.task_type || 'out',
        status: task.status,
        assigned_date: task.assigned_date
      };
    });

    return Promise.resolve(joined);
  }

  // PUT /work/:id/complete
  if (endpoint.startsWith('/work/') && endpoint.endsWith('/complete') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localWork = localWork.map(w => {
      if (w.id === id) {
        // Also update the apartment status to available (done cleaning)
        localRooms = localRooms.map(r => r.id === w.apartment_id ? { ...r, status: 'available' } : r);
        saveLocalData('vistay_mock_apartments', localRooms);
        return { ...w, status: 'completed' };
      }
      return w;
    });
    saveLocalData('vistay_mock_work', localWork);
    return Promise.resolve({ message: 'Đã hoàn thành phòng!' });
  }

  // GET /work/stats/:staffId
  if (endpoint.startsWith('/work/stats/') && method === 'GET') {
    const staffId = parseInt(endpoint.split('/')[3]);
    const todayStr = new Date().toISOString().split('T')[0];

    const todayTotal = localWork.filter(w => w.staff_id === staffId && w.assigned_date === todayStr).length;
    const todayDone = localWork.filter(w => w.staff_id === staffId && w.assigned_date === todayStr && w.status === 'completed').length;
    const monthDone = localWork.filter(w => w.staff_id === staffId && w.status === 'completed').length;

    return Promise.resolve({
      today_total: todayTotal,
      today_completed: todayDone,
      month_completed: monthDone
    });
  }

  // GET /salary/:staffId
  if (endpoint.startsWith('/salary/') && method === 'GET') {
    const staffId = parseInt(endpoint.split('/')[2]);
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const staff = localStaff.find(s => s.id === staffId) || {};
    const savedConfig = localSalary.find(sal => sal.staff_id === staffId && sal.month === month && sal.year === year) || {};

    const baseSalary = savedConfig.base_salary !== undefined ? savedConfig.base_salary : (staff.type === 'full-time' ? 6000000 : 0);
    const rate = savedConfig.per_room_rate !== undefined ? savedConfig.per_room_rate : 50000;
    
    const totalRooms = localWork.filter(w => w.staff_id === staffId && w.status === 'completed').length;
    const roomBonus = totalRooms * rate;
    const bonus = savedConfig.bonus || 0;
    const deductions = savedConfig.deductions || 0;
    const totalSalary = baseSalary + roomBonus + bonus - deductions;

    return Promise.resolve({
      staff_id: staffId,
      name: staff.name || '',
      type: staff.type || '',
      base_salary: baseSalary,
      per_room_rate: rate,
      total_rooms: totalRooms,
      room_bonus: roomBonus,
      bonus: bonus,
      deductions: deductions,
      total_salary: totalSalary,
      notes: savedConfig.notes || ''
    });
  }

  // Custom Tasks endpoints
  let localTasksList = getLocalData('vistay_mock_tasks', []);

  if (endpoint === '/tasks/today' && method === 'GET') {
    const todayStr = new Date().toISOString().split('T')[0];
    const myTasks = localTasksList
      .filter(t => t.staff_id === currentUser.staffId && t.assigned_date === todayStr)
      .map(t => ({
        ...t,
        staff_name: (localStaff.find(s => s.id === t.staff_id) || {}).name || ''
      }));
    return Promise.resolve(myTasks);
  }

  if (endpoint.startsWith('/tasks/') && endpoint.endsWith('/complete') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localTasksList = localTasksList.map(t => t.id === id ? { ...t, status: 'completed' } : t);
    saveLocalData('vistay_mock_tasks', localTasksList);
    return Promise.resolve({ message: 'Đã hoàn thành công việc!' });
  }

  return Promise.reject(new Error(`Endpoint mock ${endpoint} chưa được mô phỏng.`));
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', info: 'ℹ️', warning: '⚠️' };
  toast.innerHTML = `<span>${icons[type] || '✅'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ===== LOAD DASHBOARD DATA =====
async function loadDashboard() {
  try {
    // 1. Fetch Today's Tasks (room assignments)
    const tasks = await apiCall('/work/today');
    renderTaskList(tasks);

    // 2. Fetch Personal Work Stats
    const stats = await apiCall(`/work/stats/${currentUser.staffId}`);
    document.getElementById('statTodayTotal').textContent = stats.today_total;
    document.getElementById('statTodayCompleted').textContent = stats.today_completed;
    document.getElementById('statMonthCompleted').textContent = stats.month_completed;

    // 3. Fetch Salary Estimation
    const salary = await apiCall(`/salary/${currentUser.staffId}`);
    renderSalaryEstimate(salary);

    // 4. Fetch Custom Tasks
    const customTasks = await apiCall('/tasks/today');
    renderCustomTaskList(customTasks);

  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderTaskList(tasks) {
  const container = document.getElementById('taskListContainer');

  if (tasks.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
        <span style="font-size: 2rem; display: block; margin-bottom: 10px;">🏝️</span>
        Hôm nay bạn không được phân công căn hộ nào.
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map(task => {
    const sstnBadge = task.is_samsung ? '<span class="samsung-badge" style="background: #3b82f6; color: white; padding: 2px 6px; font-size: 0.6rem; border-radius: 4px; font-weight: 700; margin-left: 10px;">SSTN</span>' : '';

    // Task type tag
    const taskTypeLabel = getTaskTypeLabel(task.task_type);
    const taskTypeClass = getTaskTypeClass(task.task_type);
    const taskTypeTag = `<span class="task-type-tag ${taskTypeClass}">${taskTypeLabel}</span>`;

    // Render action buttons based on status
    let actionHtml = '';
    if (task.status === 'pending') {
      actionHtml = `
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-save" onclick="updateWorkStatus(${task.id}, 'accept')" style="padding: 6px 12px; font-size: 0.8rem; background: linear-gradient(135deg, #10b981, #059669);">Nhận</button>
          <button class="btn btn-cancel" onclick="updateWorkStatus(${task.id}, 'reject')" style="padding: 6px 12px; font-size: 0.8rem; background: linear-gradient(135deg, #ef4444, #dc2626);">Từ chối</button>
        </div>
      `;
    } else if (task.status === 'accepted') {
      actionHtml = `
        <button class="btn btn-save" onclick="updateWorkStatus(${task.id}, 'start')" style="padding: 6px 12px; font-size: 0.8rem; background: linear-gradient(135deg, #a78bfa, #7c3aed);">Bắt đầu làm</button>
      `;
    } else if (task.status === 'in-progress') {
      actionHtml = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="file" id="file-${task.id}" accept="image/*" capture="environment" style="display: none;" onchange="onFileSelected(${task.id})">
          <button class="btn btn-save" onclick="document.getElementById('file-${task.id}').click()" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #eab308, #ca8a04); border: none;">
            <span id="lbl-${task.id}">📸 Chụp ảnh</span>
          </button>
          <button class="btn btn-save" onclick="completeWork(${task.id})" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669);">✓ Hoàn thành</button>
        </div>
      `;
    } else if (task.status === 'completed') {
      actionHtml = `<span class="role-badge main" style="font-size: 0.8rem; padding: 6px 12px;">✓ Đã hoàn thành</span>`;
    } else if (task.status === 'rejected') {
      actionHtml = `<span class="role-badge none" style="font-size: 0.8rem; padding: 6px 12px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.12);">Đã từ chối</span>`;
    }

    return `
      <div class="staff-card" style="flex-direction: row; justify-content: space-between; align-items: center; text-align: left; cursor: default; width: 100%; animation: none;">
        <div style="display: flex; align-items: center;">
          <div class="staff-avatar fulltime" style="background: linear-gradient(135deg, #a78bfa, #8b5cf6); font-size: 0.9rem; width: 36px; height: 36px; margin-right: 12px;">🚪</div>
          <div>
            <div style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              Căn ${task.code}
              ${taskTypeTag}
              ${sstnBadge}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">Tòa: ${task.building}</div>
          </div>
        </div>
        <div>
          ${actionHtml}
        </div>
      </div>
    `;
  }).join('');
}

async function updateWorkStatus(id, action) {
  try {
    const data = await apiCall(`/work/${id}/${action}`, 'PUT');
    showToast(data.message, 'success');
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function onFileSelected(id) {
  const fileInput = document.getElementById(`file-${id}`);
  const label = document.getElementById(`lbl-${id}`);
  if (fileInput.files.length > 0) {
    label.textContent = `📁 ${fileInput.files[0].name.substring(0, 10)}...`;
  } else {
    label.textContent = `📸 Chụp ảnh`;
  }
}

async function completeWork(id) {
  const fileInput = document.getElementById(`file-${id}`);
  if (fileInput.files.length === 0) {
    showToast('Vui lòng chụp hoặc chọn ảnh minh chứng trước khi bấm Hoàn thành.', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('proof', fileInput.files[0]);

  try {
    const data = await apiCall(`/work/${id}/complete`, 'PUT', formData);
    showToast(data.message, 'success');
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderSalaryEstimate(salary) {
  // Update estimation card values
  document.getElementById('estBaseSalary').textContent = formatCurrency(salary.base_salary);
  document.getElementById('estPerRoomRate').textContent = formatCurrency(salary.per_room_rate);
  document.getElementById('estRoomsCount').textContent = `${salary.total_rooms} căn`;
  document.getElementById('estRoomBonus').textContent = `+${formatCurrency(salary.room_bonus)}`;
  document.getElementById('estBonus').textContent = `+${formatCurrency(salary.bonus)}`;
  document.getElementById('estDeductions').textContent = `-${formatCurrency(salary.deductions)}`;
  document.getElementById('estTotalSalary').textContent = formatCurrency(salary.total_salary);
}

// ===== UTILITIES =====
function formatCurrency(value) {
  if (value === null || value === undefined) return '0 đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatDate() {
  const now = new Date();
  const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const day = days[now.getDay()];
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${day}, ${dd}/${mm}/${yyyy}`;
}

// ===== TASK TYPE HELPERS =====
function getTaskTypeLabel(type) {
  switch(type) {
    case 'ss_luu': return '🔄 SS/Lưu';
    case 'out': return '🚪 Out';
    case 'tong_ve_sinh': return '🧹 Tổng VS';
    default: return '🚪 Out';
  }
}

function getTaskTypeClass(type) {
  switch(type) {
    case 'ss_luu': return 'task-tag-ss';
    case 'out': return 'task-tag-out';
    case 'tong_ve_sinh': return 'task-tag-tvs';
    default: return 'task-tag-out';
  }
}

// ===== CUSTOM TASKS =====
function renderCustomTaskList(tasks) {
  const container = document.getElementById('customTaskListContainer');

  if (!tasks || tasks.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 30px; color: var(--text-muted); background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
        <span style="font-size: 1.5rem; display: block; margin-bottom: 8px;">✅</span>
        Không có công việc khác được giao hôm nay.
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map(task => {
    let actionHtml = '';
    if (task.status === 'pending') {
      actionHtml = `
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-save" onclick="updateCustomTaskStatus(${task.id}, 'accept')" style="padding: 6px 12px; font-size: 0.8rem; background: linear-gradient(135deg, #10b981, #059669);">Nhận</button>
          <button class="btn btn-cancel" onclick="updateCustomTaskStatus(${task.id}, 'reject')" style="padding: 6px 12px; font-size: 0.8rem; background: linear-gradient(135deg, #ef4444, #dc2626);">Từ chối</button>
        </div>
      `;
    } else if (task.status === 'accepted') {
      actionHtml = `
        <button class="btn btn-save" onclick="updateCustomTaskStatus(${task.id}, 'start')" style="padding: 6px 12px; font-size: 0.8rem; background: linear-gradient(135deg, #a78bfa, #7c3aed);">Bắt đầu làm</button>
      `;
    } else if (task.status === 'in-progress') {
      actionHtml = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="file" id="tfile-${task.id}" accept="image/*" capture="environment" style="display: none;" onchange="onTaskFileSelected(${task.id})">
          <button class="btn btn-save" onclick="document.getElementById('tfile-${task.id}').click()" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #eab308, #ca8a04); border: none;">
            <span id="tlbl-${task.id}">📸 Chụp ảnh</span>
          </button>
          <button class="btn btn-save" onclick="completeCustomTask(${task.id})" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669);">✓ Hoàn thành</button>
        </div>
      `;
    } else if (task.status === 'completed') {
      actionHtml = `<span class="role-badge main" style="font-size: 0.8rem; padding: 6px 12px;">✓ Đã hoàn thành</span>`;
    } else if (task.status === 'rejected') {
      actionHtml = `<span class="role-badge none" style="font-size: 0.8rem; padding: 6px 12px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.12);">Đã từ chối</span>`;
    }

    return `
      <div class="staff-card" style="flex-direction: row; justify-content: space-between; align-items: center; text-align: left; cursor: default; width: 100%; animation: none;">
        <div style="display: flex; align-items: center;">
          <div class="staff-avatar fulltime" style="background: linear-gradient(135deg, #f59e0b, #d97706); font-size: 0.9rem; width: 36px; height: 36px; margin-right: 12px;">📌</div>
          <div>
            <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-primary);">${task.title}</div>
            ${task.description ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${task.description}</div>` : ''}
          </div>
        </div>
        <div>
          ${actionHtml}
        </div>
      </div>
    `;
  }).join('');
}

async function updateCustomTaskStatus(id, action) {
  try {
    const data = await apiCall(`/tasks/${id}/${action}`, 'PUT');
    showToast(data.message, 'success');
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function onTaskFileSelected(id) {
  const fileInput = document.getElementById(`tfile-${id}`);
  const label = document.getElementById(`tlbl-${id}`);
  if (fileInput.files.length > 0) {
    label.textContent = `📁 ${fileInput.files[0].name.substring(0, 10)}...`;
  } else {
    label.textContent = `📸 Chụp ảnh`;
  }
}

async function completeCustomTask(id) {
  const fileInput = document.getElementById(`tfile-${id}`);
  if (fileInput.files.length === 0) {
    showToast('Vui lòng chụp hoặc chọn ảnh minh chứng trước khi bấm Hoàn thành.', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('proof', fileInput.files[0]);

  try {
    const data = await apiCall(`/tasks/${id}/complete`, 'PUT', formData);
    showToast(data.message, 'success');
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// ===== CHANGE PASSWORD MODAL =====
function openChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');
  document.getElementById('currentPasswordInput').value = '';
  document.getElementById('newPasswordInput').value = '';
  document.getElementById('confirmPasswordInput').value = '';
  modal.classList.add('active');
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.remove('active');
}

async function saveChangePassword() {
  const currentPassword = document.getElementById('currentPasswordInput').value;
  const newPassword = document.getElementById('newPasswordInput').value;
  const confirmPassword = document.getElementById('confirmPasswordInput').value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Vui lòng điền đầy đủ các thông tin.', 'warning');
    return;
  }
  if (newPassword.length < 6) {
    showToast('Mật khẩu mới phải có tối thiểu 6 ký tự.', 'warning');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('Xác nhận mật khẩu mới không khớp.', 'warning');
    return;
  }

  try {
    const res = await apiCall('/auth/change-password', 'PUT', { currentPassword, newPassword });
    showToast(res.message, 'success');
    closeChangePasswordModal();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// ===== EVENT BINDINGS =====
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  document.getElementById('currentDate').textContent = formatDate();
  loadDashboard();

  // Close modals on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeChangePasswordModal();
      }
    });
  });
});
