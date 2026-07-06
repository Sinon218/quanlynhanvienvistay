// ===================================================================
// EMPLOYEE PORTAL JS - employee.js
// ===================================================================

const API_URL = `${window.location.origin}/api`;
let token = localStorage.getItem('vistay_token');
let currentUser = null;

// State data for Room status chart & lists
let roomStatusChart = null;
let modalRoomChart = null;
let selectedChartRoomId = null;
let selectedChartBuilding = 'all';
let apartmentList = [];
let apartmentStatsData = [];
let apartmentFilters = {
  status: 'all',
  search: ''
};
let selectedRoomId = null;
let timelineData = null;

// Bảng giá theo cấp độ kỹ thuật
const TECH_LEVEL_PRICES = { 1: 20000, 2: 40000, 3: 800000, 4: 150000 };
const TECH_LEVEL_NAMES = { 1: 'Dễ', 2: 'Trung bình', 3: 'Khó', 4: 'Cực khó' };
const TECH_LEVEL_COLORS = { 1: '#22c55e', 2: '#f59e0b', 3: '#ef4444', 4: '#dc2626' };
const TECH_LEVEL_BG = { 1: 'rgba(34,197,94,0.15)', 2: 'rgba(245,158,11,0.15)', 3: 'rgba(239,68,68,0.15)', 4: 'rgba(220,38,38,0.15)' };
const TECH_LEVEL_STARS = { 1: '⭐', 2: '⭐⭐', 3: '⭐⭐⭐', 4: '⭐⭐⭐⭐' };

// Auth check
function checkAuth() {
  const userStr = localStorage.getItem('vistay_user');
  if (!token || !userStr) {
    handleLogout();
    return;
  }
  try {
    currentUser = JSON.parse(userStr);

    // Ensure techRole is set for Thiên and Thương (IDs 2 & 3)
    if (currentUser.staffId === 2 || currentUser.staffId === 3 || currentUser.username === 'thien' || currentUser.username === 'thuong') {
      currentUser.techRole = 1;
    }

    if (currentUser.role !== 'employee' && currentUser.role !== 'manager') {
      window.location.href = 'admin.html';
    }
    document.getElementById('employeeName').textContent = currentUser.staffName || currentUser.username;

    // Show "Giao diện QL" button for managers
    if (currentUser.role === 'manager') {
      const switchBtn = document.getElementById('btnSwitchToAdmin');
      if (switchBtn) switchBtn.style.display = 'inline-block';
    }

    // Show "Tạo việc kỹ thuật" button for tech staff (techRole >= 1)
    if (currentUser.techRole && currentUser.techRole >= 1) {
      const selfAssignBtn = document.getElementById('btnSelfAssignCard');
      if (selfAssignBtn) selfAssignBtn.style.display = 'inline-flex';
    }
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
      if (response.status === 401) {
        handleLogout();
        return;
      }
      const data = await response.json();
      const apiErr = new Error(data.error || 'Đã xảy ra lỗi khi gọi API.');
      apiErr.isApiError = true;
      throw apiErr;
    }

    return await response.json();
  } catch (err) {
    if (err.isApiError) {
      throw err;
    }
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

  // PUT /work/:id/accept
  if (endpoint.startsWith('/work/') && endpoint.endsWith('/accept') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localWork = localWork.map(w => w.id === id ? { ...w, status: 'accepted' } : w);
    saveLocalData('vistay_mock_work', localWork);
    return Promise.resolve({ message: 'Đã nhận việc.' });
  }

  // PUT /work/:id/reject
  if (endpoint.startsWith('/work/') && endpoint.endsWith('/reject') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localWork = localWork.map(w => w.id === id ? { ...w, status: 'rejected' } : w);
    saveLocalData('vistay_mock_work', localWork);
    return Promise.resolve({ message: 'Đã từ chối công việc.' });
  }

  // PUT /work/:id/start
  if (endpoint.startsWith('/work/') && endpoint.endsWith('/start') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localWork = localWork.map(w => w.id === id ? { ...w, status: 'in-progress' } : w);
    saveLocalData('vistay_mock_work', localWork);
    return Promise.resolve({ message: 'Bắt đầu làm việc.' });
  }

  // PUT /work/:id/complete
  if (endpoint.startsWith('/work/') && endpoint.endsWith('/complete') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localWork = localWork.map(w => {
      if (w.id === id) {
        return { ...w, status: 'completed', proof_image: '/uploads/mock-proof.jpg' };
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
    const todayDone = localWork.filter(w => w.staff_id === staffId && w.assigned_date === todayStr && w.status === 'approved').length;
    const monthDone = localWork.filter(w => w.staff_id === staffId && w.status === 'approved').length;

    return Promise.resolve({
      today_total: todayTotal,
      today_completed: todayDone,
      month_completed: monthDone
    });
  }

  // GET /tasks/stats/:staffId
  if (endpoint.startsWith('/tasks/stats/') && method === 'GET') {
    const staffId = parseInt(endpoint.split('/')[3]);
    const todayStr = new Date().toISOString().split('T')[0];
    const localTasks = getLocalData('vistay_mock_tasks', []);

    const todayTotal = localTasks.filter(t => t.staff_id === staffId && t.assigned_date === todayStr && t.status !== 'rejected').length;
    const todayDone = localTasks.filter(t => t.staff_id === staffId && t.assigned_date === todayStr && (t.status === 'completed' || t.status === 'approved')).length;
    const monthDone = localTasks.filter(t => t.staff_id === staffId && t.status === 'approved').length;

    const staff = localStaff.find(s => s.id === staffId) || {};
    let kpi = null;
    if (staff.tech_role === 1) {
      const monthlyRoomsDone = localWork.filter(w => w.staff_id === staffId && w.status === 'approved').length;
      kpi = monthDone + (monthlyRoomsDone / 2);
    }

    return Promise.resolve({
      today_total: todayTotal,
      today_completed: todayDone,
      month_completed: monthDone,
      kpi: kpi
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

    // Tech tasks
    const localTasks = getLocalData('vistay_mock_tasks', []);
    const approvedTechTasks = localTasks.filter(t => t.staff_id === staffId && t.status === 'approved');
    const techTaskSalary = approvedTechTasks.reduce((sum, t) => sum + (t.tech_price || 0), 0);

    const bonus = savedConfig.bonus || 0;
    const deductions = savedConfig.deductions || 0;
    const totalSalary = baseSalary + roomBonus + techTaskSalary + bonus - deductions;

    return Promise.resolve({
      staff_id: staffId,
      name: staff.name || '',
      type: staff.type || '',
      base_salary: baseSalary,
      per_room_rate: rate,
      total_rooms: totalRooms,
      room_bonus: roomBonus,
      tech_task_salary: techTaskSalary,
      bonus: bonus,
      deductions: deductions,
      total_salary: totalSalary,
      notes: savedConfig.notes || ''
    });
  }

  // Custom Tasks endpoints
  let localTasksList = getLocalData('vistay_mock_tasks', []);

  // POST /tasks/self-assign
  if (endpoint === '/tasks/self-assign' && method === 'POST') {
    const newTask = {
      id: Date.now(),
      staff_id: currentUser.staffId,
      title: body.title,
      description: body.description || '',
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'accepted',
      is_self_assigned: true,
      before_image: null,
      proof_image: null,
      created_at: new Date().toISOString()
    };
    localTasksList.push(newTask);
    saveLocalData('vistay_mock_tasks', localTasksList);
    return Promise.resolve({ message: 'Tạo công việc kỹ thuật thành công.' });
  }

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

  // PUT /tasks/:id/accept
  if (endpoint.startsWith('/tasks/') && endpoint.endsWith('/accept') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localTasksList = localTasksList.map(t => t.id === id ? { ...t, status: 'accepted' } : t);
    saveLocalData('vistay_mock_tasks', localTasksList);
    return Promise.resolve({ message: 'Đã nhận công việc.' });
  }

  // PUT /tasks/:id/reject
  if (endpoint.startsWith('/tasks/') && endpoint.endsWith('/reject') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localTasksList = localTasksList.map(t => t.id === id ? { ...t, status: 'rejected' } : t);
    saveLocalData('vistay_mock_tasks', localTasksList);
    return Promise.resolve({ message: 'Đã từ chối công việc.' });
  }

  // PUT /tasks/:id/start
  if (endpoint.startsWith('/tasks/') && endpoint.endsWith('/start') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localTasksList = localTasksList.map(t => {
      if (t.id === id) {
        return { ...t, status: 'in-progress', before_image: t.is_self_assigned ? '/uploads/mock-before.jpg' : null };
      }
      return t;
    });
    saveLocalData('vistay_mock_tasks', localTasksList);
    return Promise.resolve({ message: 'Bắt đầu làm việc.' });
  }

  if (endpoint.startsWith('/tasks/') && endpoint.endsWith('/complete') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localTasksList = localTasksList.map(t => t.id === id ? { ...t, status: 'completed', proof_image: '/uploads/mock-proof.jpg' } : t);
    saveLocalData('vistay_mock_tasks', localTasksList);
    return Promise.resolve({ message: 'Đã hoàn thành công việc!' });
  }

  if (endpoint.startsWith('/apartments') && method === 'GET') {
    if (endpoint.startsWith('/apartments/status-history')) {
      const params = new URLSearchParams(endpoint.split('?')[1] || '');
      const mode = params.get('mode') || 'hourly';
      const total = localRooms.length || 150;
      const mockData = [];
      if (mode === 'hourly') {
        for (let h = 24; h >= 0; h--) {
          const d = new Date(Date.now() - h * 3600000);
          const maintenance = Math.floor(Math.random() * 6) + 1;
          const occupied = Math.floor(Math.random() * 40) + 35;
          const available = Math.max(total - occupied - maintenance, 15);
          mockData.push({ time_bucket: d.toISOString(), available_count: available, occupied_count: occupied, maintenance_count: maintenance });
        }
      } else {
        for (let d = 30; d >= 0; d--) {
          const dt = new Date(Date.now() - d * 86400000);
          const maintenance = Math.floor(Math.random() * 8) + 1;
          const occupied = Math.floor(Math.random() * 50) + 30;
          const available = Math.max(total - occupied - maintenance, 10);
          mockData.push({ time_bucket: dt.toISOString().split('T')[0], available_count: available, occupied_count: occupied, maintenance_count: maintenance });
        }
      }
      return Promise.resolve(mockData);
    }

    if (endpoint.startsWith('/apartments/stats')) {
      const stats = {
        total: localRooms.length,
        available: localRooms.filter(r => r.status === 'available').length,
        occupied: localRooms.filter(r => r.status === 'occupied').length,
        cleaning: localRooms.filter(r => r.status === 'cleaning').length,
        maintenance: localRooms.filter(r => r.status === 'maintenance').length
      };
      return Promise.resolve({ totals: stats });
    }

    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const status = params.get('status');
    const search = params.get('search');

    let filtered = [...localRooms];
    if (status && status !== 'all') filtered = filtered.filter(r => r.status === status);
    if (search) filtered = filtered.filter(r => r.code.toLowerCase().includes(search.toLowerCase()));

    // Hide password for normal employees (mock check matching backend)
    const allowedUsernames = ['vistay', 'loc', 'dieu'];
    const allowedNames = ['Lộc', 'Diệu'];
    const isPrivileged = currentUser && (
      currentUser.role === 'admin' ||
      allowedUsernames.includes(currentUser.username) ||
      allowedNames.includes(currentUser.staffName)
    );
    if (!isPrivileged) {
      filtered = filtered.map(a => ({ ...a, password: '******' }));
    }

    return Promise.resolve(filtered);
  }

  if (endpoint.startsWith('/apartments/') && endpoint.endsWith('/status') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    const { status } = body;
    localRooms = localRooms.map(r => r.id === id ? { ...r, status: status || r.status } : r);
    saveLocalData('vistay_mock_apartments', localRooms);
    return Promise.resolve({ message: 'Cập nhật trạng thái phòng thành công.' });
  }

  if (endpoint.startsWith('/apartments/') && endpoint.endsWith('/password') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    const { password } = body;
    localRooms = localRooms.map(r => r.id === id ? { ...r, password } : r);
    saveLocalData('vistay_mock_apartments', localRooms);
    return Promise.resolve({ message: 'Cập nhật mật khẩu thành công.' });
  }

  if (endpoint === '/auth/change-password' && method === 'PUT') {
    return Promise.resolve({ message: 'Đổi mật khẩu thành công.' });
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
    const isTechStaff = currentUser.techRole && currentUser.techRole >= 1;

    // Update labels if Tech Staff
    if (isTechStaff) {
      document.getElementById('lblTodayTotal').textContent = "Nhiệm vụ KT được giao (Hôm nay)";
      document.getElementById('lblTodayCompleted').textContent = "🟢 Đã xong (Hôm nay)";
      document.getElementById('lblMonthCompleted').textContent = "🛠️ Đã sửa (Tháng này)";
    } else {
      document.getElementById('lblTodayTotal').textContent = "Căn được giao (Hôm nay)";
      document.getElementById('lblTodayCompleted').textContent = "🟢 Đã xong (Hôm nay)";
      document.getElementById('lblMonthCompleted').textContent = "🧹 Đã dọn (Tháng này)";
    }

    // 1. Fetch Today's Tasks (room assignments)
    const tasks = await apiCall('/work/today');
    renderTaskList(tasks);

    // 2. Fetch Personal Work Stats
    const statsEndpoint = isTechStaff ? `/tasks/stats/${currentUser.staffId}` : `/work/stats/${currentUser.staffId}`;
    const stats = await apiCall(statsEndpoint);
    document.getElementById('statTodayTotal').textContent = stats.today_total;
    document.getElementById('statTodayCompleted').textContent = stats.today_completed;
    document.getElementById('statMonthCompleted').textContent = stats.month_completed;

    // 3. Fetch Salary Estimation
    const salary = await apiCall(`/salary/${currentUser.staffId}`);
    renderSalaryEstimate(salary);

    // 4. Fetch Custom Tasks
    const customTasks = await apiCall('/tasks/today');
    renderCustomTaskList(customTasks);

    // 5. Fetch and Render Employee Apartments
    loadEmployeeApartments();
    loadEmpApartmentStatusTimeline();

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
      const needsPhoto = task.assigned_role === 1;
      if (needsPhoto) {
        actionHtml = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="file" id="file-${task.id}" accept="image/*" capture="environment" style="display: none;" onchange="onFileSelected(${task.id})">
            <button class="btn btn-save" onclick="document.getElementById('file-${task.id}').click()" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #eab308, #ca8a04); border: none;">
              <span id="lbl-${task.id}">📸 Chụp ảnh</span>
            </button>
            <button class="btn btn-save" onclick="completeWork(${task.id}, true)" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669);">✓ Hoàn thành</button>
          </div>
        `;
      } else {
        actionHtml = `
          <button class="btn btn-save" onclick="completeWork(${task.id}, false)" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669);">✓ Hoàn thành</button>
        `;
      }
    } else if (task.status === 'completed') {
      actionHtml = `<span class="role-badge none" style="font-size: 0.8rem; padding: 6px 12px; color: #fbbf24; border-color: rgba(251, 191, 36, 0.3); background: rgba(251, 191, 36, 0.12);">⏳ Chờ duyệt</span>`;
    } else if (task.status === 'approved') {
      actionHtml = `<span class="role-badge main" style="font-size: 0.8rem; padding: 6px 12px; color: #10b981; border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.12);">✓ Đã duyệt</span>`;
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

async function completeWork(id, needsPhoto) {
  const fileInput = document.getElementById(`file-${id}`);
  const formData = new FormData();

  if (needsPhoto) {
    if (!fileInput || fileInput.files.length === 0) {
      showToast('Vui lòng chụp hoặc chọn ảnh minh chứng trước khi bấm Hoàn thành.', 'warning');
      return;
    }
    formData.append('proof', fileInput.files[0]);
  } else {
    if (fileInput && fileInput.files.length > 0) {
      formData.append('proof', fileInput.files[0]);
    }
  }

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
  document.getElementById('estRoomsCount').textContent = `${salary.total_rooms} căn`;
  document.getElementById('estRoomBonus').textContent = `+${formatCurrency(salary.room_bonus)}`;

  const techRow = document.getElementById('estTechRow');
  const techSalaryEl = document.getElementById('estTechSalary');
  if (techRow && techSalaryEl) {
    if (salary.tech_task_salary && salary.tech_task_salary > 0) {
      techRow.style.display = 'flex';
      techSalaryEl.textContent = `+${formatCurrency(salary.tech_task_salary)}`;
    } else {
      techRow.style.display = 'none';
    }
  }

  document.getElementById('estBonus').textContent = `+${formatCurrency(salary.bonus)}`;
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
  switch (type) {
    case 'ss_luu': return '🔄 SS/Lưu';
    case 'out': return '🚪 Out';
    case 'tong_ve_sinh': return '🧹 Tổng VS';
    default: return '🚪 Out';
  }
}

function getTaskTypeClass(type) {
  switch (type) {
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
    const isSelfAssigned = task.is_self_assigned;
    const selfBadge = isSelfAssigned
      ? `<span style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 2px 7px; font-size: 0.6rem; border-radius: 4px; font-weight: 700; margin-left: 8px;">🔧 Tự giao</span>`
      : '';

    let actionHtml = '';
    if (task.status === 'pending') {
      actionHtml = `
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-save" onclick="updateCustomTaskStatus(${task.id}, 'accept')" style="padding: 6px 12px; font-size: 0.8rem; background: linear-gradient(135deg, #10b981, #059669);">Nhận</button>
          <button class="btn btn-cancel" onclick="updateCustomTaskStatus(${task.id}, 'reject')" style="padding: 6px 12px; font-size: 0.8rem; background: linear-gradient(135deg, #ef4444, #dc2626);">Từ chối</button>
        </div>
      `;
    } else if (task.status === 'accepted') {
      // Nếu task tự giao hoặc có techRole (NV kỹ thuật) → bắt buộc chụp ảnh lỗi trước khi bắt đầu
      if (isSelfAssigned || (currentUser.techRole && currentUser.techRole >= 1)) {
        actionHtml = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="file" id="tbefore-${task.id}" accept="image/*" capture="environment" style="display: none;" onchange="onBeforeFileSelected(${task.id})">
            <button class="btn btn-save" onclick="document.getElementById('tbefore-${task.id}').click()" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #ef4444, #dc2626); border: none;">
              <span id="tblbl-${task.id}">📸 Chụp ảnh lỗi</span>
            </button>
            <button class="btn btn-save" onclick="startSelfAssignedTask(${task.id})" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #a78bfa, #7c3aed);">▶ Bắt đầu</button>
          </div>
        `;
      } else {
        actionHtml = `
          <button class="btn btn-save" onclick="updateCustomTaskStatus(${task.id}, 'start')" style="padding: 6px 12px; font-size: 0.8rem; background: linear-gradient(135deg, #a78bfa, #7c3aed);">Bắt đầu làm</button>
        `;
      }
    } else if (task.status === 'in-progress') {
      actionHtml = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="file" id="tfile-${task.id}" accept="image/*" capture="environment" style="display: none;" onchange="onTaskFileSelected(${task.id})">
          <button class="btn btn-save" onclick="document.getElementById('tfile-${task.id}').click()" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #eab308, #ca8a04); border: none;">
            <span id="tlbl-${task.id}">${isSelfAssigned || (currentUser.techRole && currentUser.techRole >= 1) ? '📸 Ảnh đã sửa' : '📸 Chụp ảnh'}</span>
          </button>
          <button class="btn btn-save" onclick="completeCustomTask(${task.id})" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669);">✓ Hoàn thành</button>
        </div>
      `;
    } else if (task.status === 'completed') {
      actionHtml = `<span class="role-badge none" style="font-size: 0.8rem; padding: 6px 12px; color: #fbbf24; border-color: rgba(251, 191, 36, 0.3); background: rgba(251, 191, 36, 0.12);">⏳ Chờ duyệt</span>`;
    } else if (task.status === 'approved') {
      actionHtml = `<span class="role-badge main" style="font-size: 0.8rem; padding: 6px 12px; color: #10b981; border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.12);">✓ Đã duyệt</span>`;
    } else if (task.status === 'rejected') {
      actionHtml = `<span class="role-badge none" style="font-size: 0.8rem; padding: 6px 12px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.12);">Đã từ chối</span>`;
    }

    // Before/After image indicators for self-assigned tasks
    let imageIndicators = '';
    if ((isSelfAssigned || (currentUser.techRole && currentUser.techRole >= 1)) && (task.before_image || task.proof_image)) {
      imageIndicators = `<div style="display: flex; gap: 6px; margin-top: 4px;">`;
      if (task.before_image) {
        imageIndicators += `<span style="font-size: 0.7rem; color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 1px 6px; border-radius: 4px;">📷 Ảnh lỗi</span>`;
      }
      if (task.proof_image) {
        imageIndicators += `<span style="font-size: 0.7rem; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 1px 6px; border-radius: 4px;">📷 Ảnh đã sửa</span>`;
      }
      imageIndicators += `</div>`;
    }

    const rejectReasonHtml = task.reject_reason
      ? `<div style="font-size: 0.85rem; color: #ef4444; font-weight: bold; margin-top: 6px; background: rgba(239, 68, 68, 0.08); padding: 6px 10px; border-radius: 4px; border-left: 3px solid #ef4444;">⚠️ Lý do không duyệt: ${task.reject_reason}</div>`
      : '';

    return `
      <div class="staff-card" style="flex-direction: row; justify-content: space-between; align-items: center; text-align: left; cursor: default; width: 100%; animation: none;">
        <div style="display: flex; align-items: center; width: 70%;">
          <div class="staff-avatar fulltime" style="background: linear-gradient(135deg, #f59e0b, #d97706); font-size: 0.9rem; width: 36px; height: 36px; margin-right: 12px; flex-shrink: 0;">🔧</div>
          <div style="flex-grow: 1;">
            <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-primary); display: flex; align-items: center; flex-wrap: wrap;">${task.title}${selfBadge}
              ${task.tech_level ? `<span style="background: ${TECH_LEVEL_BG[task.tech_level] || 'transparent'}; color: ${TECH_LEVEL_COLORS[task.tech_level] || '#888'}; padding: 2px 7px; font-size: 0.6rem; border-radius: 4px; font-weight: 700; margin-left: 6px;">${TECH_LEVEL_STARS[task.tech_level] || ''} ${TECH_LEVEL_NAMES[task.tech_level] || ''} • ${task.tech_price ? new Intl.NumberFormat('vi-VN').format(task.tech_price) + 'đ' : ''}</span>` : ''}
            </div>
            ${task.description ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${task.description}</div>` : ''}
            ${imageIndicators}
            ${rejectReasonHtml}
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

// ===== BEFORE IMAGE (ẢNH LỖI) cho task tự giao =====
function onBeforeFileSelected(id) {
  const fileInput = document.getElementById(`tbefore-${id}`);
  const label = document.getElementById(`tblbl-${id}`);
  if (fileInput.files.length > 0) {
    label.textContent = `📁 ${fileInput.files[0].name.substring(0, 10)}...`;
  } else {
    label.textContent = `📸 Chụp ảnh lỗi`;
  }
}

async function startSelfAssignedTask(id) {
  const fileInput = document.getElementById(`tbefore-${id}`);
  if (!fileInput || fileInput.files.length === 0) {
    showToast('Vui lòng chụp ảnh lỗi trước khi bắt đầu công việc.', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('before_photo', fileInput.files[0]);

  try {
    const data = await apiCall(`/tasks/${id}/start`, 'PUT', formData);
    showToast(data.message, 'success');
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'warning');
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

// ===== SELF-ASSIGN MODAL =====
function openSelfAssignModal() {
  document.getElementById('selfAssignTitle').value = '';
  document.getElementById('selfAssignDesc').value = '';
  const levelDisplay = document.getElementById('selfAssignLevelDisplay');
  if (levelDisplay) levelDisplay.innerHTML = '<span style="color: var(--text-muted);">Chọn công việc để xem cấp độ</span>';
  document.getElementById('selfAssignModal').classList.add('active');
}

function closeSelfAssignModal() {
  document.getElementById('selfAssignModal').classList.remove('active');
}

// Hiển thị cấp độ & giá khi chọn công việc trong modal tự giao
function onSelfAssignJobSelected() {
  const select = document.getElementById('selfAssignTitle');
  const display = document.getElementById('selfAssignLevelDisplay');
  if (!select || !display) return;

  const selectedOption = select.options[select.selectedIndex];
  const level = selectedOption ? selectedOption.getAttribute('data-level') : null;

  if (!level || !select.value) {
    display.innerHTML = '<span style="color: var(--text-muted);">Chọn công việc để xem cấp độ</span>';
    return;
  }

  const lvl = parseInt(level);
  const name = TECH_LEVEL_NAMES[lvl] || '';
  const color = TECH_LEVEL_COLORS[lvl] || '#888';
  const bg = TECH_LEVEL_BG[lvl] || 'transparent';
  const price = TECH_LEVEL_PRICES[lvl] || 0;
  const priceStr = new Intl.NumberFormat('vi-VN').format(price);
  const stars = TECH_LEVEL_STARS[lvl] || '';

  display.innerHTML = `
    <span style="background: ${bg}; color: ${color}; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">
      ${stars} Cấp ${lvl} — ${name}
    </span>
    <span style="margin-left: 8px; font-weight: 700; color: ${color}; font-size: 0.9rem;">${priceStr}đ</span>
  `;
}

async function submitSelfAssignTask() {
  const select = document.getElementById('selfAssignTitle');
  const title = select.value.trim();
  const description = document.getElementById('selfAssignDesc').value.trim();

  if (!title) {
    showToast('Vui lòng chọn công việc kỹ thuật.', 'warning');
    return;
  }

  // Get tech_level from selected option
  const selectedOption = select.options[select.selectedIndex];
  const techLevel = selectedOption ? selectedOption.getAttribute('data-level') : null;

  try {
    const data = await apiCall('/tasks/self-assign', 'POST', {
      title,
      description,
      tech_level: techLevel ? parseInt(techLevel) : null
    });
    showToast(data.message, 'success');
    closeSelfAssignModal();
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

let lastSeenNotificationId = parseInt(localStorage.getItem('last_seen_noti_id') || '0');

function toggleNotiDropdown() {
  const dropdown = document.getElementById('notiDropdown');
  if (!dropdown) return;
  const isHidden = dropdown.style.display === 'none';
  dropdown.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    loadNotifications();
  }
}

async function loadNotifications() {
  try {
    const list = await apiCall('/apartments/notifications');
    const notiListEl = document.getElementById('notiList');
    if (!notiListEl) return;

    if (list.length === 0) {
      notiListEl.innerHTML = '<div style="padding: 10px 0; text-align: center;">Không có thông báo mới</div>';
      return;
    }

    notiListEl.innerHTML = list.map(n => {
      const dt = new Date(n.created_at);
      const timeStr = dt.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
      return `
        <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 2px;">
          <div style="color: var(--text-primary); font-weight: 500;">${n.message}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${timeStr}</div>
        </div>
      `;
    }).join('');

    if (list.length > 0) {
      const newestId = list[0].id;
      if (document.getElementById('notiDropdown').style.display === 'block') {
        localStorage.setItem('last_seen_noti_id', newestId);
        lastSeenNotificationId = newestId;
        updateNotiBadge(0);
      }
    }
  } catch (err) {
    console.warn('Failed to load notifications:', err.message);
  }
}

function updateNotiBadge(count) {
  const badge = document.getElementById('notiCountBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

function clearNotiBadge() {
  localStorage.setItem('last_seen_noti_id', '9999999');
  updateNotiBadge(0);
  const dropdown = document.getElementById('notiDropdown');
  if (dropdown) dropdown.style.display = 'none';
}

async function checkNewNotifications() {
  try {
    const list = await apiCall('/apartments/notifications');
    const newItems = list.filter(n => n.id > lastSeenNotificationId);
    updateNotiBadge(newItems.length);
  } catch (err) {
    console.warn('Failed to check notifications:', err.message);
  }
}

// ===== EVENT BINDINGS =====
function initializePage() {
  checkAuth();
  setupRealtimeEvents();

  // Khởi động hệ thống kiểm tra thông báo đổi mật khẩu
  checkNewNotifications();
  setInterval(checkNewNotifications, 10000);

  // Close notification dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notiDropdown');
    const container = document.querySelector('.noti-bell-container');
    if (dropdown && dropdown.style.display === 'block' && container && !container.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Close timeline popover when clicking outside
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('timelinePopover');
    if (popover && popover.style.display === 'block') {
      const isSegment = e.target.classList.contains('timeline-segment') || e.target.closest('.timeline-segment');
      const isPopover = e.target.closest('.timeline-popover');
      if (!isSegment && !isPopover) {
        closeTimelinePopover();
      }
    }
  });

  // Auto-recovery: If we are in local mode but server is online, switch back to backend
  if (localStorage.getItem('vistay_mode') === 'local' && token) {
    fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (res.ok) {
        console.log("Server is online. Switching back to backend mode.");
        localStorage.setItem('vistay_mode', 'backend');
        window.location.reload();
      }
    }).catch(err => {
      console.log("Server is offline. Staying in local mode.");
    });
  }

  const currentMode = localStorage.getItem('vistay_mode') || 'backend';
  const offlineBanner = document.getElementById('offlineAlertBanner');
  if (offlineBanner) {
    offlineBanner.style.display = currentMode === 'local' ? 'block' : 'none';
  }

  document.getElementById('currentDate').textContent = formatDate();
  loadDashboard();
  // Tự động làm mới công việc mỗi 15 giây để nhân viên nhận việc real-time từ thiết bị khác
  setInterval(loadDashboard, 15000);

  // Bind employee room filters
  const searchInput = document.getElementById('empRoomSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      apartmentFilters.search = e.target.value.trim();
      loadEmployeeApartments();
    });
  }

  const statusFilter = document.getElementById('empRoomStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      apartmentFilters.status = e.target.value;
      loadEmployeeApartments();
    });
  }

  // Close modals on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeChangePasswordModal();
        closeSelfAssignModal();
        closeEmpRoomStatusModal();
        closeEmpRoomPasswordModal();
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}

// ===== EMPLOYEE APARTMENTS & CHART LOGIC =====
async function loadEmployeeApartments() {
  try {
    const query = new URLSearchParams(apartmentFilters).toString();
    apartmentList = await apiCall(`/apartments?${query}`);

    // Load stats
    const stats = await apiCall('/apartments/stats');
    apartmentStatsData = stats.byBuilding || [];
    renderEmployeeApartmentStats(stats.totals);
    renderEmployeeApartmentSummaryTable();
    renderEmployeeApartmentGrid();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderEmployeeApartmentStats(totals) {
  const container = document.getElementById('empRoomStats');
  if (!container) return;
  container.innerHTML = `
    <div class="stat-item stat-total">
      <span class="stat-num">${totals.total}</span>
      <span class="stat-label">Tổng căn hộ</span>
    </div>
    <div class="stat-item stat-available">
      <span class="stat-num">${totals.available}</span>
      <span class="stat-label">🟢 Trống</span>
    </div>
    <div class="stat-item stat-occupied">
      <span class="stat-num">${totals.occupied}</span>
      <span class="stat-label">🔴 Có khách</span>
    </div>
    <div class="stat-item stat-maintenance">
      <span class="stat-num">${totals.maintenance}</span>
      <span class="stat-label">🔧 Sửa chữa</span>
    </div>
  `;
}

function renderEmployeeApartmentGrid() {
  const grid = document.getElementById('empRoomListGrid');
  const countEl = document.getElementById('empFilteredRoomCount');
  if (!grid) return;

  countEl.textContent = `Hiển thị ${apartmentList.length} căn`;

  if (apartmentList.length === 0) {
    grid.innerHTML = '<div class="room-empty">Không tìm thấy căn hộ nào phù hợp bộ lọc.</div>';
    return;
  }

  // Check if current user is admin, Lộc, or Diệu
  const allowedUsernames = ['vistay', 'loc', 'dieu'];
  const allowedNames = ['Lộc', 'Diệu'];
  const isPrivileged = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    allowedUsernames.includes(currentUser.username) ||
    allowedNames.includes(currentUser.staffName)
  );

  grid.innerHTML = apartmentList.map(room => {
    const statusClass = getRoomStatusClass(room.status);
    const statusLabel = getRoomStatusLabel(room.status);
    const statusIcon = getRoomStatusIcon(room.status);

    // Show password block
    const pwHtml = room.password ? `
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; background: rgba(0,0,0,0.15); padding: 4px 8px; border-radius: 4px;">
        <span style="font-size: 0.72rem; color: var(--text-secondary);">MK:</span>
        <span class="pw-text" id="emp-pw-${room.id}" style="font-family: monospace; font-size: 0.8rem; font-weight: 700; flex: 1;">${room.password}</span>
        ${isPrivileged ? `<button class="pw-edit-btn" onclick="event.stopPropagation(); openEmpPasswordModal(${room.id}, '${room.code}', '${room.password}')" style="background: transparent; border: none; cursor: pointer; padding: 0 4px; font-size: 0.75rem; color: var(--accent-amber);">✏️</button>` : ''}
      </div>
    ` : '';

    const cursorStyle = 'cursor: default;';

    return `
      <div class="room-card ${statusClass}" style="display: flex; flex-direction: column; align-items: stretch; text-align: left; padding: 12px 10px; ${cursorStyle}">
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <div class="room-number" style="font-size: 1rem; font-weight: 800;">${room.code}</div>
        </div>
        
        ${pwHtml}

        <div class="room-status-badge ${statusClass}" style="align-self: flex-start; margin-top: auto;">
          <span>${statusIcon}</span>
          <span>${statusLabel}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderEmployeeApartmentSummaryTable() {
  const container = document.getElementById('empRoomSummaryTableBody');
  if (!container) return;

  const rows = apartmentList.filter(room => room.building !== 'HCM' && !room.is_samsung);
  if (rows.length === 0) {
    container.innerHTML = '<tr><td colspan="5" style="text-align: center;">Không có căn hộ nào phù hợp.</td></tr>';
    return;
  }

  const allowedUsernames = ['vistay', 'loc', 'dieu'];
  const allowedNames = ['Lộc', 'Diệu'];
  const isPrivileged = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    allowedUsernames.includes(currentUser.username) ||
    allowedNames.includes(currentUser.staffName)
  );

  const buildingOrder = ['B', 'R6A', 'S1', 'S2', 'S3'];
  const buildingNames = {
    'B': 'Tòa B — Imperia',
    'R6A': 'Tòa R6A — Royal',
    'S1': 'Tòa S1 — SkyLake',
    'S2': 'Tòa S2 — SkyLake',
    'S3': 'Tòa S3 — SkyLake',
  };

  let html = '';
  buildingOrder.forEach(b => {
    const roomsInB = rows.filter(r => r.building === b);
    if (roomsInB.length > 0) {
      // Hàng tiêu đề tòa
      html += `
        <tr class="table-group-header" style="background: rgba(167, 139, 250, 0.08); font-weight: bold;">
          <td colspan="5" style="color: var(--accent-purple); font-size: 0.9rem; padding: 10px 15px; text-align: left;">
            🏢 ${buildingNames[b] || ('Tòa ' + b)}
          </td>
        </tr>
      `;

      roomsInB.forEach(room => {
        const statusClass = getRoomStatusClass(room.status);
        const statusLabel = getRoomStatusLabel(room.status);
        const statusIcon = getRoomStatusIcon(room.status);

        let stayInfo = '';
        if (room.status === 'occupied' && (room.checkin_date || room.checkout_date)) {
          const inDate = room.checkin_date ? new Date(room.checkin_date).toLocaleDateString('vi-VN') : '—';
          const outDate = room.checkout_date ? new Date(room.checkout_date).toLocaleDateString('vi-VN') : '—';
          stayInfo = `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">📅 ${inDate} ${room.checkin_time || ''} → ${outDate} ${room.checkout_time || ''}</div>`;
        } else if (room.status === 'maintenance' && room.maintenance_duration) {
          stayInfo = `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">⏰ Dự kiến: ${room.maintenance_duration} giờ</div>`;
        }

        const statusHtml = isPrivileged
          ? `<div style="display: flex; flex-direction: column; align-items: flex-start;">
              <span class="room-status-badge ${statusClass}" style="padding: 4px 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" onclick="openEmpRoomStatusModal(${room.id})">
                <span>${statusIcon}</span><span>${statusLabel}</span><span style="font-size: 0.7rem; opacity: 0.8;">✏️</span>
              </span>
              ${stayInfo}
             </div>`
          : `<div style="display: flex; flex-direction: column; align-items: flex-start;">
              <span class="room-status-badge ${statusClass}" style="padding: 4px 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px;">
                <span>${statusIcon}</span><span>${statusLabel}</span>
              </span>
              ${stayInfo}
             </div>`;

        html += `
          <tr>
            <td style="font-weight: 800; color: var(--text-primary); padding-left: 25px;">${room.code}</td>
            <td><span class="section-badge">${room.building}</span></td>
            <td>${room.room_type}</td>
            <td style="font-family: monospace; font-weight: 700; color: var(--accent-amber);">${room.password && room.password !== '******' ? room.password : '******'}</td>
            <td>${statusHtml}</td>
          </tr>
        `;
      });
    }
  });

  container.innerHTML = html;
}

function toggleEmpPasswordDisplay(roomId, password) {
  const textEl = document.getElementById(`emp-pw-${roomId}`);
  if (!textEl) return;
  if (textEl.textContent === '••••••') {
    textEl.textContent = password;
  } else {
    textEl.textContent = '••••••';
  }
}

// ===== PRIVILEGED USER MODAL LOGIC =====
function openEmpRoomStatusModal(roomId) {
  selectedRoomId = roomId;
  const room = apartmentList.find(r => r.id === roomId);
  if (!room) return;

  const modal = document.getElementById('empRoomStatusModal');
  if (!modal) return;

  document.getElementById('empRoomModalNumber').textContent = `Căn ${room.code}`;
  document.getElementById('empRoomModalType').textContent = `${room.room_type} · ${room.is_samsung ? 'Thiết bị Samsung' : 'Mật khẩu thường'}`;
  document.getElementById('empRoomModalFloor').textContent = `Tòa: ${room.building}`;

  const radio = document.querySelector(`input[name="empRoomStatus"][value="${room.status}"]`);
  if (radio) radio.checked = true;

  // Pre-fill checkin/checkout date-time
  const checkinDateEl = document.getElementById('ersCheckinDate');
  const checkinTimeEl = document.getElementById('ersCheckinTime');
  const checkoutDateEl = document.getElementById('ersCheckoutDate');
  const checkoutTimeEl = document.getElementById('ersCheckoutTime');

  if (checkinDateEl) {
    if (room.checkin_date) {
      checkinDateEl.value = new Date(room.checkin_date).toISOString().split('T')[0];
    } else {
      checkinDateEl.value = '';
    }
  }
  if (checkinTimeEl) checkinTimeEl.value = room.checkin_time || '';
  if (checkoutDateEl) {
    if (room.checkout_date) {
      checkoutDateEl.value = new Date(room.checkout_date).toISOString().split('T')[0];
    } else {
      checkoutDateEl.value = '';
    }
  }
  if (checkoutTimeEl) checkoutTimeEl.value = room.checkout_time || '';

  // Pre-fill maintenance duration
  const maintDurationEl = document.getElementById('ersMaintenanceDuration');
  if (maintDurationEl) maintDurationEl.value = room.maintenance_duration || '';

  // Trigger toggle fields display
  toggleStatusModalFields('employee');

  modal.classList.add('active');

  const chartContainer = document.getElementById('empModalRoomChartContainer');
  if (chartContainer) {
    if (room.is_samsung) {
      chartContainer.style.display = 'none';
    } else {
      chartContainer.style.display = 'block';
      setTimeout(() => loadModalRoomChart(roomId), 100);
    }
  }
}

function closeEmpRoomStatusModal() {
  const modal = document.getElementById('empRoomStatusModal');
  if (modal) modal.classList.remove('active');
  selectedRoomId = null;
  // Hủy biểu đồ modal
  if (modalRoomChart) {
    modalRoomChart.destroy();
    modalRoomChart = null;
  }
}

function toggleStatusModalFields(type) {
  if (type === 'admin') {
    const radio = document.querySelector('input[name="statusOnlyVal"]:checked');
    const status = radio ? radio.value : '';

    const dtGroup = document.querySelector('#roomStatusEditOnlyModal .datetime-inputs-group');
    const mtGroup = document.getElementById('soMaintenanceGroup');

    if (status === 'occupied') {
      if (dtGroup) dtGroup.style.display = 'block';
      if (mtGroup) mtGroup.style.display = 'none';

      // Pre-fill default dates if empty
      const checkinDateEl = document.getElementById('soCheckinDate');
      const checkinTimeEl = document.getElementById('soCheckinTime');
      const checkoutDateEl = document.getElementById('soCheckoutDate');
      const checkoutTimeEl = document.getElementById('soCheckoutTime');

      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      const pad = val => String(val).padStart(2, '0');
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

      if (checkinDateEl && !checkinDateEl.value) checkinDateEl.value = todayStr;
      if (checkinTimeEl && !checkinTimeEl.value) checkinTimeEl.value = '14:00';
      if (checkoutDateEl && !checkoutDateEl.value) checkoutDateEl.value = tomorrowStr;
      if (checkoutTimeEl && !checkoutTimeEl.value) checkoutTimeEl.value = '12:00';
    } else if (status === 'maintenance') {
      if (dtGroup) dtGroup.style.display = 'none';
      if (mtGroup) mtGroup.style.display = 'block';
    } else {
      if (dtGroup) dtGroup.style.display = 'none';
      if (mtGroup) mtGroup.style.display = 'none';
    }
  } else if (type === 'employee') {
    const radio = document.querySelector('input[name="empRoomStatus"]:checked');
    const status = radio ? radio.value : '';

    const dtGroup = document.querySelector('#empRoomStatusModal .datetime-inputs-group');
    const mtGroup = document.getElementById('ersMaintenanceGroup');

    if (status === 'occupied') {
      if (dtGroup) dtGroup.style.display = 'block';
      if (mtGroup) mtGroup.style.display = 'none';

      // Pre-fill default dates if empty
      const checkinDateEl = document.getElementById('ersCheckinDate');
      const checkinTimeEl = document.getElementById('ersCheckinTime');
      const checkoutDateEl = document.getElementById('ersCheckoutDate');
      const checkoutTimeEl = document.getElementById('ersCheckoutTime');

      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      const pad = val => String(val).padStart(2, '0');
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

      if (checkinDateEl && !checkinDateEl.value) checkinDateEl.value = todayStr;
      if (checkinTimeEl && !checkinTimeEl.value) checkinTimeEl.value = '14:00';
      if (checkoutDateEl && !checkoutDateEl.value) checkoutDateEl.value = tomorrowStr;
      if (checkoutTimeEl && !checkoutTimeEl.value) checkoutTimeEl.value = '12:00';
    } else if (status === 'maintenance') {
      if (dtGroup) dtGroup.style.display = 'none';
      if (mtGroup) mtGroup.style.display = 'block';
    } else {
      if (dtGroup) dtGroup.style.display = 'none';
      if (mtGroup) mtGroup.style.display = 'none';
    }
  }
}

async function saveEmpRoomStatus() {
  if (selectedRoomId === null) return;
  const statusEl = document.querySelector('input[name="empRoomStatus"]:checked');
  if (!statusEl) return;
  const status = statusEl.value;
  const checkin_date = document.getElementById('ersCheckinDate')?.value || null;
  const checkin_time = document.getElementById('ersCheckinTime')?.value || null;
  const checkout_date = document.getElementById('ersCheckoutDate')?.value || null;
  const checkout_time = document.getElementById('ersCheckoutTime')?.value || null;
  const maintenance_duration = document.getElementById('ersMaintenanceDuration')?.value || null;

  if (status === 'occupied') {
    if (!checkin_date || !checkin_time || !checkout_date || !checkout_time) {
      showToast('Vui lòng nhập đầy đủ thông tin ngày/giờ check-in và check-out khi căn hộ có khách.', 'warning');
      return;
    }
  }

  try {
    const res = await apiCall(`/apartments/${selectedRoomId}/status`, 'PUT', {
      status,
      checkin_date,
      checkin_time,
      checkout_date,
      checkout_time,
      maintenance_duration: maintenance_duration ? parseInt(maintenance_duration) : null
    });
    showToast(res.message, 'success');
    closeEmpRoomStatusModal();
    loadEmployeeApartments();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function openEmpPasswordModal(roomId, code, password) {
  selectedRoomId = roomId;
  const modal = document.getElementById('empRoomPasswordModal');
  if (!modal) return;

  document.getElementById('empRoomPwModalNumber').textContent = `Căn ${code}`;
  document.getElementById('empRoomPwModalOld').textContent = password;
  document.getElementById('empRoomNewPassword').value = '';

  modal.classList.add('active');
}

function closeEmpRoomPasswordModal() {
  const modal = document.getElementById('empRoomPasswordModal');
  if (modal) modal.classList.remove('active');
  selectedRoomId = null;
}

async function saveEmpRoomPassword() {
  if (selectedRoomId === null) return;
  const password = document.getElementById('empRoomNewPassword').value.trim();

  if (!password) {
    showToast('Mật khẩu không được để trống.', 'warning');
    return;
  }

  try {
    const res = await apiCall(`/apartments/${selectedRoomId}/password`, 'PUT', { password });
    showToast(res.message, 'success');
    closeEmpRoomPasswordModal();
    loadEmployeeApartments();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// ===== CHART.JS DRAWING LOGIC =====
async function loadRoomStatusChart() {
  try {
    const select = document.getElementById('chartRoomSelect');
    if (!select) return;

    selectedChartBuilding = select.value || 'all';

    const stats = apartmentStatsData.length > 0 ? apartmentStatsData : (await apiCall('/apartments/stats')).byBuilding || [];
    renderApartmentStatusChart(stats);
  } catch (err) {
    console.warn('Failed to load room status chart:', err.message);
  }
}

function onChartRoomChanged() {
  const select = document.getElementById('chartRoomSelect');
  if (select) {
    selectedChartBuilding = select.value;
    loadRoomStatusChart();
  }
}

function renderApartmentStatusChart(byBuilding) {
  const canvas = document.getElementById('roomStatusChart');
  if (!canvas) return;

  const groups = getApartmentChartGroups(byBuilding);
  const labels = groups.map(group => group.label);
  const availableData = groups.map(group => group.available);
  const occupiedData = groups.map(group => group.occupied);
  const maintenanceData = groups.map(group => group.maintenance);

  if (roomStatusChart) {
    roomStatusChart.destroy();
    roomStatusChart = null;
  }

  const ctx = canvas.getContext('2d');

  roomStatusChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Đang trống',
          data: availableData,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          borderWidth: 2.5,
          pointRadius: 3,
          tension: 0.35,
          fill: true
        },
        {
          label: 'Đang có khách',
          data: occupiedData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderWidth: 2.5,
          pointRadius: 3,
          tension: 0.35,
          fill: true
        },
        {
          label: 'Đang bảo trì',
          data: maintenanceData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          borderWidth: 2.5,
          pointRadius: 3,
          tension: 0.35,
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
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            usePointStyle: true,
            boxWidth: 10
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(148, 163, 184, 0.2)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 12 },
          callbacks: {
            title: function (context) {
              return `Cụm căn hộ: ${context[0].label}`;
            },
            label: function (context) {
              return ` ${context.dataset.label}: ${context.parsed.y} căn`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(148, 163, 184, 0.04)',
            drawBorder: false
          },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            autoSkip: true,
            maxTicksLimit: 8
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(148, 163, 184, 0.04)',
            drawBorder: false
          },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            stepSize: 1
          }
        }
      }
    }
  });
}
function getApartmentChartGroups(byBuilding) {
  const buildingMap = new Map((byBuilding || []).map(row => [row.building, row]));
  const selected = selectedChartBuilding || 'all';

  const buildGroup = (label, buildings) => {
    const rows = buildings.map(building => buildingMap.get(building)).filter(Boolean);
    return {
      label,
      available: rows.reduce((sum, row) => sum + Number(row.available || 0), 0),
      occupied: rows.reduce((sum, row) => sum + Number(row.occupied || 0), 0),
      maintenance: rows.reduce((sum, row) => sum + Number(row.maintenance || 0), 0)
    };
  };

  if (selected === 'SkyLake') return [buildGroup('SkyLake', ['S1', 'S2', 'S3'])];
  if (selected === 'Royal') return [buildGroup('Royal', ['R6A'])];
  if (selected === 'Imperia') return [buildGroup('Imperia', ['B'])];
  if (selected && selected !== 'all') return [buildGroup(selected, [selected])];

  const preferredOrder = ['S1', 'S2', 'S3', 'B', 'R6A', 'HCM'];
  const used = new Set();
  const groups = [];

  preferredOrder.forEach(building => {
    if (buildingMap.has(building)) {
      used.add(building);
      groups.push(buildGroup(building, [building]));
    }
  });

  (byBuilding || []).forEach(row => {
    if (!used.has(row.building)) {
      groups.push(buildGroup(row.building, [row.building]));
    }
  });

  return groups;
}

// ===== MODAL ROOM STATUS HISTORY CHART =====
async function loadModalRoomChart(roomId) {
  try {
    const data = await apiCall(`/apartments/status-history?apartment_id=${roomId}&mode=hourly`);
    renderModalRoomChart(data);
  } catch (err) {
    console.warn('Failed to load modal room chart:', err.message);
  }
}

function renderModalRoomChart(data) {
  const canvas = document.getElementById('empModalRoomChart');
  if (!canvas) return;

  const labels = data.map(d => {
    const dt = new Date(d.time_bucket);
    return dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  });

  const occupiedData = data.map(d => d.status === 'occupied' ? 1 : 0);
  const maintenanceData = data.map(d => d.status === 'maintenance' ? 1 : 0);

  if (modalRoomChart) {
    modalRoomChart.destroy();
    modalRoomChart = null;
  }

  const ctx = canvas.getContext('2d');
  modalRoomChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Đang có khách',
          data: occupiedData,
          backgroundColor: '#ef4444',
          borderRadius: 3,
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.9
        },
        {
          label: 'Đang bảo trì',
          data: maintenanceData,
          backgroundColor: '#3b82f6',
          borderRadius: 3,
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.9
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          callbacks: {
            title: () => '',
            label: (context) => context.parsed.y === 1 ? ` Trạng thái: ${context.dataset.label}` : null
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 9 }, autoSkip: true, maxTicksLimit: 6 }
        },
        y: {
          min: 0,
          max: 1,
          grid: { display: false },
          ticks: { display: false }
        }
      }
    }
  });
}

// ===== UTILS =====
function getRoomStatusClass(status) {
  switch (status) {
    case 'available': return 'status-available';
    case 'occupied': return 'status-occupied';
    case 'maintenance': return 'status-maintenance';
    default: return '';
  }
}

function getRoomStatusLabel(status) {
  switch (status) {
    case 'available': return 'Trống';
    case 'occupied': return 'Có khách';
    case 'maintenance': return 'Sửa chữa';
    default: return '';
  }
}

function getRoomStatusIcon(status) {
  switch (status) {
    case 'available': return '🟢';
    case 'occupied': return '🔴';
    case 'maintenance': return '🔧';
    default: return '';
  }
}

// ===== TIMELINE FOR EMPLOYEE =====
let empTimelineMode = 'daily';

function setEmpTimelineMode(mode) {
  empTimelineMode = mode;
  document.getElementById('empTlModeDaily').classList.toggle('active', mode === 'daily');
  document.getElementById('empTlModeHourly').classList.toggle('active', mode === 'hourly');
  loadEmpApartmentStatusTimeline();
}

async function loadEmpApartmentStatusTimeline() {
  try {
    const canvas = document.getElementById('empRoomStatusTimeline');
    if (!canvas) return;

    const data = await apiCall(`/apartments/status-timeline?building=all&mode=${empTimelineMode}`);
    timelineData = data;
    renderEmpApartmentStatusTimeline(data);
  } catch (err) {
    console.warn('Failed to load employee apartment status timeline:', err.message);
  }
}

function getTimelineStatusShortLabel(status) {
  switch (status) {
    case 'available': return 'Trống';
    case 'occupied': return 'Có khách';
    case 'maintenance': return 'Bảo trì';
    default: return status || '—';
  }
}

function renderEmpApartmentStatusTimeline(data) {
  const container = document.getElementById('empRoomStatusTimeline');
  if (!container) return;

  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const rooms = Array.isArray(data?.rooms) ? data.rooms : [];

  if (labels.length === 0 || rooms.length === 0) {
    container.innerHTML = `
      <div class="timeline-empty">
        Không có dữ liệu dòng thời gian cho bộ lọc hiện tại.
      </div>
    `;
    return;
  }

  const buildingOrder = ['B', 'R6A', 'S1', 'S2', 'S3'];
  const buildingNames = {
    'B': '🏢 Tòa B — Imperia',
    'R6A': '🏢 Tòa R6A — Royal',
    'S1': '🏢 Tòa S1 — SkyLake',
    'S2': '🏢 Tòa S2 — SkyLake',
    'S3': '🏢 Tòa S3 — SkyLake',
  };
  const buildingGroups = {};
  buildingOrder.forEach(b => buildingGroups[b] = []);
  rooms.forEach(room => {
    const b = room.building;
    if (buildingGroups[b]) buildingGroups[b].push(room);
    else {
      if (!buildingGroups['other']) buildingGroups['other'] = [];
      buildingGroups['other'].push(room);
    }
  });

  const dateHeaderHtml = `
    <div class="timeline-header">
      <div class="timeline-room-head">Căn hộ</div>
      <div class="timeline-date-row" style="grid-template-columns: repeat(${labels.length}, minmax(18px, 1fr));">
        ${labels.map(label => `<div class="timeline-date-cell">${label}</div>`).join('')}
      </div>
    </div>
  `;

  const allowedUsernames = ['vistay', 'loc', 'dieu'];
  const allowedNames = ['Lộc', 'Diệu'];
  const isPrivileged = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    allowedUsernames.includes(currentUser.username) ||
    allowedNames.includes(currentUser.staffName)
  );

  const groupsHtml = buildingOrder
    .filter(b => buildingGroups[b] && buildingGroups[b].length > 0)
    .map(building => {
      const bRooms = buildingGroups[building];
      const rowsHtml = bRooms.map(room => {
        const currentStatus = room.current_status || 'available';
        const statusClass = getRoomStatusClass(currentStatus);
        const statusIcon = getRoomStatusIcon(currentStatus);

        const segmentsHtml = room.segments.map(segment => {
          const startLabel = labels[segment.start_index] || '';
          const endLabel = labels[segment.start_index + segment.span - 1] || '';
          let timeRangeStr = '';
          const isHourly = empTimelineMode === 'hourly';

          if (startLabel === endLabel) {
            timeRangeStr = isHourly ? `lúc ${startLabel}` : `ngày ${startLabel}`;
          } else {
            timeRangeStr = isHourly
              ? `từ ${startLabel} đến ${endLabel}`
              : `từ ngày ${startLabel} đến ngày ${endLabel}`;
          }

          let statusLabel = getRoomStatusLabel(segment.status);
          if (segment.status === 'maintenance' && room.maintenance_duration) {
            statusLabel = `Bảo trì (dự kiến ${room.maintenance_duration} giờ)`;
          }
          const tooltipText = `${room.code} • ${statusLabel} • ${timeRangeStr}`;

          let segmentContent = '';
          if (segment.status === 'maintenance' && room.maintenance_duration) {
            segmentContent = `<span class="segment-text" style="font-size: 0.62rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px; font-weight: 600; pointer-events: none;">🔧 ${room.maintenance_duration}h</span>`;
          } else if (segment.status !== 'available') {
            if (isHourly && segment.span >= 2) {
              segmentContent = `<span class="segment-text" style="font-size: 0.62rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px; font-weight: 600; pointer-events: none;">${startLabel}-${endLabel}</span>`;
            } else if (!isHourly && segment.span >= 3) {
              segmentContent = `<span class="segment-text" style="font-size: 0.62rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px; font-weight: 600; pointer-events: none;">${startLabel}-${endLabel}</span>`;
            }
          }

          return `
            <button
              class="timeline-segment status-${segment.status}"
              style="grid-column: ${segment.start_index + 1} / span ${segment.span}; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 0;"
              onclick="event.stopPropagation(); showTimelinePopover(this, '${room.code}', '${segment.status}', '${startLabel}', '${endLabel}', ${isHourly}, ${room.id}, ${isPrivileged})"
              title="${tooltipText}"
            >
              ${segmentContent}
            </button>
          `;
        }).join('');

        const labelOnClick = isPrivileged
          ? `onclick="openEmpRoomStatusModal(${room.id})"`
          : `style="cursor: default;"`;

        return `
          <div class="timeline-row">
            <button class="timeline-room-label ${statusClass}" ${labelOnClick} title="${room.code}">
              <span class="timeline-room-code">${room.code}</span>
              <span class="timeline-room-state">${statusIcon}</span>
            </button>
            <div class="timeline-track" style="--bucket-count: ${labels.length}; grid-template-columns: repeat(${labels.length}, minmax(18px, 1fr));">
              ${segmentsHtml}
            </div>
          </div>
        `;
      }).join('');

      const occ = bRooms.filter(r => r.current_status === 'occupied').length;
      const maint = bRooms.filter(r => r.current_status === 'maintenance').length;
      const avail = bRooms.filter(r => r.current_status === 'available').length;
      const statusSummary = `<span class="tl-bld-stat avail">🟢 ${avail}</span><span class="tl-bld-stat occ">🔴 ${occ}</span><span class="tl-bld-stat maint">🔵 ${maint}</span>`;

      return `
        <div class="timeline-building-group">
          <button class="timeline-building-header" onclick="toggleEmpTimelineBuilding('${building}')" id="tl-hdr-${building}">
            <span class="tl-arrow" id="tl-arrow-${building}">▶</span>
            <span class="tl-bld-name">${buildingNames[building] || building}</span>
            <span class="tl-bld-count">${bRooms.length} căn</span>
            <span class="tl-bld-stats">${statusSummary}</span>
          </button>
          <div class="timeline-building-body" id="tl-body-${building}">
            ${rowsHtml}
          </div>
        </div>
      `;
    }).join('');

  container.innerHTML = dateHeaderHtml + `<div class="timeline-body">${groupsHtml}</div>`;
  // Tự động cuộn về phía bên phải (ngày hôm nay/mới nhất)
  setTimeout(() => {
    const scrollContainer = container.closest('.timeline-scroll');
    if (scrollContainer) {
      scrollContainer.scrollLeft = scrollContainer.scrollWidth;
    }
  }, 100);
}

function toggleEmpTimelineBuilding(building) {
  const body = document.getElementById(`tl-body-${building}`);
  const arrow = document.getElementById(`tl-arrow-${building}`);
  if (!body) return;
  const isOpen = body.classList.contains('open');
  if (isOpen) {
    body.classList.remove('open');
    if (arrow) arrow.textContent = '▶';
  } else {
    body.classList.add('open');
    if (arrow) arrow.textContent = '▼';
  }
}

function showTimelinePopover(element, roomCode, status, startLabel, endLabel, isHourly, roomId, isPrivileged) {
  const popover = document.getElementById('timelinePopover');
  if (!popover) return;

  document.getElementById('popoverTitle').textContent = `Căn ${roomCode}`;

  const statusLabel = getRoomStatusLabel(status);
  const statusIcon = getRoomStatusIcon(status);
  const statusValEl = document.getElementById('popoverStatus');
  statusValEl.textContent = `${statusIcon} ${statusLabel}`;
  statusValEl.className = `timeline-popover-value room-status-badge status-${status}`;
  statusValEl.style.padding = '2px 6px';
  statusValEl.style.borderRadius = '4px';

  const timeInLabel = document.getElementById('popoverTimeInLabel');
  const timeOutLabel = document.getElementById('popoverTimeOutLabel');
  const timeInVal = document.getElementById('popoverTimeIn');
  const timeOutVal = document.getElementById('popoverTimeOut');

  if (isHourly) {
    timeInLabel.textContent = 'Check-in:';
    timeOutLabel.textContent = 'Check-out:';
    timeInVal.textContent = startLabel;
    timeOutVal.textContent = endLabel;
  } else {
    timeInLabel.textContent = 'Nhận phòng:';
    timeOutLabel.textContent = 'Trả phòng:';
    timeInVal.textContent = startLabel;
    timeOutVal.textContent = endLabel;
  }

  const cleaningRow = document.getElementById('popoverCleaningRow');
  const cleaningDetails = document.getElementById('popoverCleaningDetails');
  if (cleaningRow && cleaningDetails) {
    const room = timelineData?.rooms?.find(r => r.id === roomId);
    if (room && room.assignments && room.assignments.length > 0) {
      cleaningRow.style.display = 'flex';
      cleaningDetails.innerHTML = room.assignments.map(wa => {
        const startStr = wa.expected_start_at ? new Date(wa.expected_start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';
        const endStr = wa.expected_end_at ? new Date(wa.expected_end_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';
        const taskLabel = getTaskTypeLabel(wa.task_type);
        return `<div style="margin-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px;">👤 <strong>${wa.staff_name}</strong> (${taskLabel})<br>⏰ Dự kiến: ${startStr} - ${endStr}</div>`;
      }).join('');
    } else {
      cleaningRow.style.display = 'none';
    }
  }

  const footer = document.getElementById('popoverFooter');

  if (isPrivileged) {
    footer.innerHTML = `
      <button class="btn btn-cancel" style="padding: 4px 10px; font-size: 0.75rem;" onclick="closeTimelinePopover()">Đóng</button>
      <button class="btn btn-save" style="padding: 4px 10px; font-size: 0.75rem; background: var(--accent-amber); color: #0c1524;" onclick="closeTimelinePopover(); openEmpRoomStatusModal(${roomId})">✏️ Đổi trạng thái</button>
    `;
  } else {
    footer.innerHTML = `
      <button class="btn btn-cancel" style="padding: 4px 10px; font-size: 0.75rem; width: 100%;" onclick="closeTimelinePopover()">Đóng</button>
    `;
  }

  popover.style.display = 'block';
  const rect = element.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  let left = rect.left + scrollLeft + (rect.width / 2) - (popover.offsetWidth / 2);
  let top = rect.bottom + scrollTop + 6;

  if (left + popover.offsetWidth > window.innerWidth) {
    left = window.innerWidth - popover.offsetWidth - 16;
  }
  if (left < 16) {
    left = 16;
  }
  if (rect.bottom + popover.offsetHeight > window.innerHeight) {
    top = rect.top + scrollTop - popover.offsetHeight - 6;
  }

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function closeTimelinePopover() {
  const popover = document.getElementById('timelinePopover');
  if (popover) {
    popover.style.display = 'none';
  }
}

let eventSource = null;
function setupRealtimeEvents() {
  try {
    // Lắng nghe storage event cho chế độ offline (local mock)
    window.addEventListener('storage', (e) => {
      if (localStorage.getItem('vistay_mode') === 'local') {
        if (e.key === 'vistay_mock_work' || e.key === 'vistay_mock_tasks_list' || e.key === 'vistay_mock_apartments') {
          console.log('🔄 Offline mode: Local mock data updated. Reloading dashboard...');
          if (typeof loadDashboard === 'function') {
            loadDashboard();
          }
        }
      }
    });

    // Lắng nghe Server-Sent Events cho chế độ online (backend)
    if (localStorage.getItem('vistay_mode') !== 'local') {
      if (eventSource) eventSource.close();
      eventSource = new EventSource(`${API_URL}/events`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📢 Received real-time event:', data);

          // Hiển thị Toast thông báo cho nhân viên nếu có tin nhắn chi tiết
          if (data.message) {
            const type = (data.action === 'reject' || data.action === 'reject_completed') ? 'warning' : 'success';
            showToast(data.message, type);
          }

          if (typeof loadDashboard === 'function') {
            console.log('🔄 Reloading dashboard...');
            loadDashboard();
          }
        } catch (err) {
          console.error('Failed to parse SSE data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE connection lost. Retrying in 5 seconds...", err);
        eventSource.close();
        setTimeout(setupRealtimeEvents, 5000);
      };
    }
  } catch (err) {
    console.error('Failed to setup real-time events:', err);
  }
}

