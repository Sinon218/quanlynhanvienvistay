// ===================================================================
// ADMIN PORTAL JS - admin.js
// ===================================================================

const API_URL = `${window.location.origin}/api`;
let token = localStorage.getItem('vistay_token');
let currentUser = null;

// State data
let staffList = [];
let apartmentList = [];
let statsData = [];
let salaryData = [];

// Filtering state
let apartmentFilters = {
  city: 'all',
  building: 'all',
  status: 'all',
  search: ''
};

// Selected items for modals
let selectedStaffId = null;
let selectedRoomId = null;
let selectedSalaryId = null;

// Auth check
function checkAuth() {
  const userStr = localStorage.getItem('vistay_user');
  if (!token || !userStr) {
    handleLogout();
    return;
  }
  try {
    currentUser = JSON.parse(userStr);
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      window.location.href = 'employee.html';
    }
    document.getElementById('adminName').textContent = currentUser.staffName || currentUser.username;
    
    // Hide administrative tabs for managers (assistant admins)
    if (currentUser.role === 'manager') {
      const statsBtn = document.getElementById('tabBtnStats');
      const salaryBtn = document.getElementById('tabBtnSalary');
      if (statsBtn) statsBtn.style.display = 'none';
      if (salaryBtn) salaryBtn.style.display = 'none';
      
      const switchBtn = document.getElementById('btnSwitchToEmployee');
      if (switchBtn) switchBtn.style.display = 'inline-block';
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
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const options = {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    };

    const response = await fetch(`${API_URL}${endpoint}`, options);
    
    if (!response.ok) {
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
    // We delay the toast slightly to let DOM load if called during init
    setTimeout(() => {
      showToast('Hệ thống đang chạy ở Chế độ Ngoại tuyến do kết nối DB gián đoạn!', 'info');
    }, 100);
    return handleLocalMockCall(endpoint, method, body);
  }
}

// ===== LOCAL SIMULATION DATABASE (OFFLINE MODE) =====
const MOCK_STAFF = [
  { id: 1, name: 'Liên',   default_name: 'Liên',   type: 'full-time', room_role: 1, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 2, name: 'Thiên',  default_name: 'Thiên',  type: 'full-time', room_role: 2, tech_role: 1, base_salary: 0, per_room_rate: 50000 },
  { id: 3, name: 'Thương', default_name: 'Thương', type: 'full-time', room_role: 2, tech_role: 1, base_salary: 0, per_room_rate: 50000 },
  { id: 4, name: 'Vân',    default_name: 'Vân',    type: 'full-time', room_role: 1, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 5, name: 'Diệu',  default_name: 'Diệu',  type: 'full-time', room_role: 1, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 6, name: 'Hoàn',   default_name: 'Hoàn',   type: 'full-time', room_role: 1, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 7, name: 'Nhân viên Part-time 1', default_name: 'Nhân viên Part-time 1', type: 'part-time', room_role: 2, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 8, name: 'Nhân viên Part-time 2', default_name: 'Nhân viên Part-time 2', type: 'part-time', room_role: 2, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 9, name: 'Lộc',    default_name: 'Lộc',    type: 'full-time', room_role: 1, tech_role: 0, base_salary: 0, per_room_rate: 50000 }
];

const PROVIDED_ROOMS = [
  { id: 1, code: 'S1-0505', building: 'S1', password: '000555', is_samsung: true, status: 'available' },
  { id: 2, code: 'S1-0508', building: 'S1', password: '585868', is_samsung: true, status: 'available' },
  { id: 3, code: 'S1-0905', building: 'S1', password: '730399', is_samsung: true, status: 'available' },
  { id: 4, code: 'S1-1105', building: 'S1', password: '220704', is_samsung: false, status: 'available' },
  { id: 5, code: 'S1-1605', building: 'S1', password: '166.666', is_samsung: false, status: 'available' },
  { id: 6, code: 'S1-1705', building: 'S1', password: '356835', is_samsung: false, status: 'available' },
  { id: 7, code: 'S1-1905', building: 'S1', password: '199.999', is_samsung: true, status: 'available' },
  { id: 8, code: 'S1-2105', building: 'S1', password: '222111', is_samsung: false, status: 'available' },
  { id: 9, code: 'S1-2305', building: 'S1', password: '160.524', is_samsung: false, status: 'available' },
  { id: 10, code: 'S1-2405', building: 'S1', password: '122.537', is_samsung: true, status: 'available' },
  { id: 11, code: 'S1-2405A', building: 'S1', password: '456789', is_samsung: true, status: 'available' },
  { id: 12, code: 'S1-2505A', building: 'S1', password: '000555', is_samsung: true, status: 'available' },
  { id: 13, code: 'S1-2705', building: 'S1', password: '222777', is_samsung: true, status: 'available' },
  { id: 14, code: 'S1-3105', building: 'S1', password: '333555', is_samsung: true, status: 'available' },

  { id: 15, code: 'S2-0610', building: 'S2', password: '760.200', is_samsung: true, status: 'available' },
  { id: 16, code: 'S2-0715', building: 'S2', password: '686868', is_samsung: false, status: 'available' },
  { id: 17, code: 'S2-1110', building: 'S2', password: '101010', is_samsung: true, status: 'available' },
  { id: 18, code: 'S2-1111', building: 'S2', password: '838688', is_samsung: true, status: 'available' },
  { id: 19, code: 'S2-11A11', building: 'S2', password: '111168', is_samsung: false, status: 'available' },
  { id: 20, code: 'S2-1220', building: 'S2', password: '111222', is_samsung: false, status: 'available' },
  { id: 21, code: 'S2-1511A', building: 'S2', password: '688688', is_samsung: true, status: 'available' },
  { id: 22, code: 'S2-1512', building: 'S2', password: '111222', is_samsung: true, status: 'available' },
  { id: 23, code: 'S2-1712', building: 'S2', password: '320.500', is_samsung: true, status: 'available' },
  { id: 24, code: 'S2-1901', building: 'S2', password: '009966', is_samsung: false, status: 'available' },
  { id: 25, code: 'S2-2106', building: 'S2', password: '222111', is_samsung: false, status: 'available' },
  { id: 26, code: 'S2-2211A', building: 'S2', password: '668868', is_samsung: true, status: 'available' },
  { id: 27, code: 'S2-2411', building: 'S2', password: '135246#', is_samsung: true, status: 'available' },
  { id: 28, code: 'S2-2512', building: 'S2', password: '225588', is_samsung: true, status: 'available' },
  { id: 29, code: 'S2-2916', building: 'S2', password: '929268', is_samsung: true, status: 'available' },
  { id: 30, code: 'S2-3210', building: 'S2', password: '333222', is_samsung: true, status: 'available' },
  { id: 31, code: 'S2-3301', building: 'S2', password: '333111', is_samsung: false, status: 'available' },
  { id: 32, code: 'S2-3316', building: 'S2', password: '333366', is_samsung: true, status: 'available' },
  { id: 33, code: 'S2-3411A', building: 'S2', password: '201099', is_samsung: false, status: 'available' },
  { id: 34, code: 'S2-3420', building: 'S2', password: '202002', is_samsung: false, status: 'available' },
  { id: 35, code: 'S2-3517', building: 'S2', password: '353568', is_samsung: true, status: 'available' },
  { id: 36, code: 'S2-3608', building: 'S2', password: '363636', is_samsung: false, status: 'available' },
  { id: 37, code: 'S2-3810', building: 'S2', password: '383838', is_samsung: true, status: 'available' },
  { id: 38, code: 'S2-3812', building: 'S2', password: '101615', is_samsung: true, status: 'available' },
  { id: 39, code: 'S2-3816', building: 'S2', password: '383883', is_samsung: true, status: 'available' },
  { id: 40, code: 'S2-3908', building: 'S2', password: '999888', is_samsung: false, status: 'available' },

  { id: 41, code: 'S3-0908', building: 'S3', password: '999888', is_samsung: false, status: 'available' },
  { id: 42, code: 'S3-15A12', building: 'S3', password: '111555', is_samsung: true, status: 'available' },
  { id: 43, code: 'S3-1701', building: 'S3', password: '240302', is_samsung: false, status: 'available' },
  { id: 44, code: 'S3-1616', building: 'S3', password: '382838', is_samsung: false, status: 'available' },
  { id: 45, code: 'S3-1811', building: 'S3', password: '333666', is_samsung: true, status: 'available' },
  { id: 46, code: 'S3-1901', building: 'S3', password: '111119', is_samsung: false, status: 'available' },
  { id: 47, code: 'S3-2012', building: 'S3', password: '111222', is_samsung: true, status: 'available' },
  { id: 48, code: 'S3-2412', building: 'S3', password: '333666', is_samsung: true, status: 'available' },
  { id: 49, code: 'S3-2909', building: 'S3', password: '000999', is_samsung: false, status: 'available' },
  { id: 50, code: 'S3-3015', building: 'S3', password: '305305', is_samsung: true, status: 'available' },
  { id: 51, code: 'S3-3409', building: 'S3', password: '399999', is_samsung: false, status: 'available' },
  { id: 52, code: 'S3-3411', building: 'S3', password: '123468', is_samsung: true, status: 'available' },
  { id: 53, code: 'S3-3511', building: 'S3', password: '351168', is_samsung: true, status: 'available' },
  { id: 54, code: 'S3-3512', building: 'S3', password: '333.222', is_samsung: true, status: 'available' },
  { id: 55, code: 'S3-3612', building: 'S3', password: '363663', is_samsung: true, status: 'available' },
  { id: 56, code: 'S3-3906', building: 'S3', password: '336699', is_samsung: false, status: 'available' },
  { id: 57, code: 'S3-3918', building: 'S3', password: '838386', is_samsung: false, status: 'available' },

  { id: 58, code: 'B2102', building: 'B', password: '456456*', is_samsung: false, status: 'available' },

  { id: 59, code: 'R6A-0505', building: 'R6A', password: '111.000.222.33', is_samsung: false, status: 'available' },
  { id: 60, code: 'R6A-2806', building: 'R6A', password: '2222.333.333', is_samsung: false, status: 'available' }
];

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

// Generate remaining 90 placeholder rooms to reach 150 total rooms
function initMockDatabase() {
  getLocalData('vistay_mock_staff', MOCK_STAFF);
  
  const currentRooms = getLocalData('vistay_mock_apartments', []);
  if (currentRooms.length === 0) {
    const allMockRooms = [...PROVIDED_ROOMS];
    const missing = 150 - allMockRooms.length;
    const buildingsList = ['S1', 'S2', 'S3'];
    for (let i = 1; i <= missing; i++) {
      const b = buildingsList[(i - 1) % buildingsList.length];
      allMockRooms.push({
        id: 60 + i,
        code: `${b}-P${String(i).padStart(3, '0')}`,
        building: b,
        password: '???',
        is_samsung: false,
        status: 'available'
      });
    }
    saveLocalData('vistay_mock_apartments', allMockRooms);
  }

  getLocalData('vistay_mock_work', []);
  getLocalData('vistay_mock_salary', []);
}

// API Simulation layer
function handleLocalMockCall(endpoint, method, body) {
  initMockDatabase();
  
  let localStaff = getLocalData('vistay_mock_staff', MOCK_STAFF);
  let localRooms = getLocalData('vistay_mock_apartments', []);
  let localWork = getLocalData('vistay_mock_work', []);
  let localSalary = getLocalData('vistay_mock_salary', []);

  // 1. Staff endpoints
  if (endpoint === '/staff' && method === 'GET') {
    return Promise.resolve(localStaff);
  }

  if (endpoint.startsWith('/staff/') && endpoint.endsWith('/role') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    let { room_role, tech_role } = body;
    
    // Auto mapper constraint
    if (tech_role === 1) room_role = 2;
    if (room_role === 1) tech_role = 0;

    localStaff = localStaff.map(s => s.id === id ? { ...s, room_role, tech_role } : s);
    saveLocalData('vistay_mock_staff', localStaff);
    return Promise.resolve({ message: 'Cập nhật vai trò thành công.', room_role, tech_role });
  }

  if (endpoint.startsWith('/staff/') && endpoint.endsWith('/name') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    const { name } = body;
    localStaff = localStaff.map(s => s.id === id ? { ...s, name: name.trim() || s.default_name } : s);
    saveLocalData('vistay_mock_staff', localStaff);
    return Promise.resolve({ message: 'Đổi tên thành công.' });
  }

  if (endpoint === '/staff/reset-names' && method === 'POST') {
    localStaff = localStaff.map(s => s.type === 'part-time' ? { ...s, name: s.default_name } : s);
    saveLocalData('vistay_mock_staff', localStaff);
    return Promise.resolve({ message: 'Đã reset tên tất cả nhân viên part-time.' });
  }

  // 2. Apartment endpoints
  if (endpoint.startsWith('/apartments') && method === 'GET') {
    if (endpoint.startsWith('/apartments/stats')) {
      const stats = {
        total: localRooms.length,
        available: localRooms.filter(r => r.status === 'available').length,
        occupied: localRooms.filter(r => r.status === 'occupied').length,
        cleaning: localRooms.filter(r => r.status === 'cleaning').length,
        maintenance: localRooms.filter(r => r.status === 'maintenance').length
      };
      return Promise.resolve({ totals: stats, byBuilding: [] });
    }

    // Filter implementation
    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const building = params.get('building');
    const status = params.get('status');
    const search = params.get('search');

    let filtered = [...localRooms];
    if (building && building !== 'all') {
      if (building === 'SkyLake') {
        filtered = filtered.filter(r => ['S1', 'S2', 'S3'].includes(r.building));
      } else if (building === 'Royal') {
        filtered = filtered.filter(r => r.building === 'R6A');
      } else if (building === 'Imperia') {
        filtered = filtered.filter(r => r.building === 'B');
      } else {
        filtered = filtered.filter(r => r.building === building);
      }
    }
    if (status && status !== 'all') filtered = filtered.filter(r => r.status === status);
    if (search) filtered = filtered.filter(r => r.code.toLowerCase().includes(search.toLowerCase()));

    return Promise.resolve(filtered);
  }

  if (endpoint.startsWith('/apartments/') && endpoint.endsWith('/status') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    const { status, room_type } = body;
    localRooms = localRooms.map(r => {
      if (r.id === id) {
        const updated = { ...r };
        if (status) updated.status = status;
        if (room_type) updated.room_type = room_type;
        return updated;
      }
      return r;
    });
    saveLocalData('vistay_mock_apartments', localRooms);
    return Promise.resolve({ message: 'Cập nhật trạng thái thành công.' });
  }

  if (endpoint.startsWith('/apartments/') && endpoint.endsWith('/password') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    const { password } = body;
    localRooms = localRooms.map(r => r.id === id ? { ...r, password } : r);
    saveLocalData('vistay_mock_apartments', localRooms);
    return Promise.resolve({ message: 'Cập nhật mật khẩu thành công.' });
  }

  // 3. Work assignments endpoints
  if (endpoint === '/work/assign' && method === 'POST') {
    const { staff_id, apartment_id, task_type } = body;
    
    // Check limit of assignees based on room type
    const date = new Date().toISOString().split('T')[0];
    const roomObj = localRooms.find(r => r.id === apartment_id) || {};
    let limit = 2; // Mặc định 2 người dọn cho 1~2 ngủ
    if (roomObj.room_type === '3 ngủ') limit = 3;
    if (roomObj.room_type === '4 ngủ') limit = 4;

    const count = localWork.filter(w => w.apartment_id === apartment_id && w.assigned_date === date && w.status !== 'rejected').length;
    if (count >= limit) {
      return Promise.reject(new Error(`Căn hộ này đã được giao cho tối đa ${limit} nhân viên trong ngày.`));
    }

    // Check duplication
    const duplicate = localWork.some(w => w.staff_id === staff_id && w.apartment_id === apartment_id && w.assigned_date === date && w.status !== 'rejected');
    if (duplicate) {
      return Promise.reject(new Error('Phòng này đã được giao cho nhân viên này.'));
    }

    const staffObj = localStaff.find(s => s.id === staff_id) || {};
    localWork.push({
      id: localWork.length + 1,
      staff_id,
      apartment_id,
      task_type: task_type || 'out',
      assigned_role: staffObj.room_role || 1,
      status: 'pending',
      assigned_date: date
    });
    saveLocalData('vistay_mock_work', localWork);
    return Promise.resolve({ message: 'Giao việc thành công.' });
  }

  if (endpoint === '/work/today' && method === 'GET') {
    const todayStr = new Date().toISOString().split('T')[0];
    const joined = localWork
      .filter(w => w.assigned_date === todayStr)
      .map(w => {
        const room = localRooms.find(r => r.id === w.apartment_id) || {};
        const staff = localStaff.find(s => s.id === w.staff_id) || {};
        return {
          ...w,
          code: room.code || '???',
          building: room.building || '???',
          is_samsung: room.is_samsung || false,
          staff_name: staff.name || ''
        };
      });
    return Promise.resolve(joined);
  }

  if (endpoint.startsWith('/work/') && method === 'DELETE') {
    const id = parseInt(endpoint.split('/')[2]);
    localWork = localWork.filter(w => w.id !== id);
    saveLocalData('vistay_mock_work', localWork);
    return Promise.resolve({ message: 'Đã hủy phân công.' });
  }

  if (endpoint === '/work/all-stats' && method === 'GET') {
    const todayStr = new Date().toISOString().split('T')[0];
    const statsList = localStaff.map(s => {
      const todayTotal = localWork.filter(w => w.staff_id === s.id && w.assigned_date === todayStr && w.status !== 'rejected').length;
      const todayDone = localWork.filter(w => w.staff_id === s.id && w.assigned_date === todayStr && w.status === 'approved').length;
      const monthDone = localWork.filter(w => w.staff_id === s.id && w.status === 'approved').length;

      return {
        id: s.id,
        name: s.name,
        type: s.type,
        today_total: todayTotal,
        today_completed: todayDone,
        month_completed: monthDone
      };
    });
    return Promise.resolve(statsList);
  }

  if (endpoint.startsWith('/work/') && endpoint.endsWith('/approve') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    const wa = localWork.find(w => w.id === id);
    if (wa) {
      localRooms = localRooms.map(r => r.id === wa.apartment_id ? { ...r, status: 'available' } : r);
      saveLocalData('vistay_mock_apartments', localRooms);
    }
    localWork = localWork.map(w => w.id === id ? { ...w, status: 'approved' } : w);
    saveLocalData('vistay_mock_work', localWork);
    return Promise.resolve({ message: 'Phê duyệt hoàn thành căn hộ thành công và cập nhật trạng thái phòng thành Trống.' });
  }

  // 4. Salary endpoints
  if (endpoint.startsWith('/salary') && method === 'GET') {
    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const month = parseInt(params.get('month') || new Date().getMonth() + 1);
    const year = parseInt(params.get('year') || new Date().getFullYear());

    const result = localStaff.map(s => {
      const savedConfig = localSalary.find(sal => sal.staff_id === s.id && sal.month === month && sal.year === year) || {};
      
      const baseSalary = savedConfig.base_salary !== undefined ? savedConfig.base_salary : (s.type === 'full-time' ? 6000000 : 0);
      const rate = savedConfig.per_room_rate !== undefined ? savedConfig.per_room_rate : 50000;
      
      const totalRooms = localWork.filter(w => w.staff_id === s.id && w.status === 'completed').length;
      const roomBonus = totalRooms * rate;
      const bonus = savedConfig.bonus || 0;
      const deductions = savedConfig.deductions || 0;
      const totalSalary = baseSalary + roomBonus + bonus - deductions;

      return {
        staff_id: s.id,
        name: s.name,
        type: s.type,
        base_salary: baseSalary,
        per_room_rate: rate,
        total_rooms: totalRooms,
        room_bonus: roomBonus,
        bonus: bonus,
        deductions: deductions,
        total_salary: totalSalary,
        notes: savedConfig.notes || ''
      };
    });

    return Promise.resolve(result);
  }

  if (endpoint === '/salary/save' && method === 'POST') {
    const idx = localSalary.findIndex(sal => sal.staff_id === body.staff_id && sal.month === body.month && sal.year === body.year);
    if (idx > -1) {
      localSalary[idx] = body;
    } else {
      localSalary.push(body);
    }
    saveLocalData('vistay_mock_salary', localSalary);
    return Promise.resolve({ message: 'Lưu bảng lương thành công.' });
  }

  // 5. Tasks endpoints
  let localTasks = getLocalData('vistay_mock_tasks', []);

  if (endpoint === '/tasks' && method === 'POST') {
    const { staff_id, title, description } = body;
    if (!staff_id || !title) {
      return Promise.reject(new Error('Thiếu thông tin.'));
    }
    localTasks.push({
      id: Date.now(),
      staff_id,
      title: title.trim(),
      description: (description || '').trim(),
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      staff_name: (localStaff.find(s => s.id === staff_id) || {}).name || ''
    });
    saveLocalData('vistay_mock_tasks', localTasks);
    return Promise.resolve({ message: 'Giao công việc thành công.' });
  }

  if (endpoint === '/tasks/today' && method === 'GET') {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = localTasks
      .filter(t => t.assigned_date === todayStr)
      .map(t => ({
        ...t,
        staff_name: t.staff_name || (localStaff.find(s => s.id === t.staff_id) || {}).name || ''
      }));
    return Promise.resolve(todayTasks);
  }

  if (endpoint.startsWith('/tasks/') && endpoint.endsWith('/complete') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localTasks = localTasks.map(t => t.id === id ? { ...t, status: 'completed' } : t);
    saveLocalData('vistay_mock_tasks', localTasks);
    return Promise.resolve({ message: 'Đã hoàn thành công việc.' });
  }

  if (endpoint.startsWith('/tasks/') && method === 'DELETE') {
    const id = parseInt(endpoint.split('/')[2]);
    localTasks = localTasks.filter(t => t.id !== id);
    saveLocalData('vistay_mock_tasks', localTasks);
    return Promise.resolve({ message: 'Đã xóa công việc.' });
  }

  if (endpoint === '/auth/change-password' && method === 'PUT') {
    return Promise.resolve({ message: 'Đổi mật khẩu thành công.' });
  }

  return Promise.reject(new Error(`Endpoint mock ${endpoint} chưa được mô phỏng.`));
}

function getInitials(name) {
  const words = name.split(' ').filter(Boolean);
  if (words.length === 0) return '🚪';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
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

// ===== TAB SWITCHING =====
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  event.currentTarget.classList.add('active');
  const activeTab = document.getElementById(`tab-${tabId}`);
  activeTab.classList.add('active');

  // Trigger loads based on active tab
  if (tabId === 'assignment') loadAssignmentTab();
  if (tabId === 'apartments') loadApartmentsTab();
  if (tabId === 'tasks') loadTasksTab();
  if (tabId === 'stats') loadStatsTab();
  if (tabId === 'salary') loadSalaryTab();
}

// ==================== TAB 1: ASSIGNMENT ====================
async function loadAssignmentTab() {
  try {
    staffList = await apiCall('/staff');
    renderStaffGrids();

    const roomAssignments = await apiCall('/work/today');
    renderRoomAssignmentsTable(roomAssignments);
    renderRejectedAssignments(roomAssignments);

    populateQuickAssignSelects();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderRoomAssignmentsTable(assignments) {
  const tbody = document.getElementById('roomAssignmentsTableBody');
  if (!assignments || assignments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">Hôm nay chưa có phân công dọn phòng nào.</td></tr>';
    return;
  }

  const isManagerOrAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager');

  tbody.innerHTML = assignments.map(wa => {
    const statusBadge = getStatusBadgeHtml(wa.status);
    const proofLink = wa.proof_image 
      ? `<button class="btn btn-save" onclick="viewProof('${wa.proof_image}', 'Căn ${wa.code}')" style="padding: 4px 8px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669);">👁️ Xem ảnh</button>`
      : '<span style="color: var(--text-muted); font-size: 0.8rem;">Chưa có</span>';
    
    let approveBtn = '';
    if (wa.status === 'completed' && isManagerOrAdmin) {
      approveBtn = `<button class="btn" onclick="approveAssignment(${wa.id})" style="padding: 4px 8px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 4px; margin-right: 4px; cursor: pointer;">🟢 Duyệt</button>`;
    }
    
    return `
      <tr>
        <td style="font-weight: 800; color: var(--text-primary);">${wa.code}</td>
        <td>${wa.building}</td>
        <td style="font-weight: 700;">${wa.staff_name}</td>
        <td><span class="task-type-tag ${getTaskTypeClass(wa.task_type)}">${getTaskTypeLabel(wa.task_type)}</span></td>
        <td>${statusBadge}</td>
        <td>${proofLink}</td>
        <td>
          ${approveBtn}
          <button class="btn btn-cancel" onclick="deleteAssignment(${wa.id})" style="padding: 4px 8px; font-size: 0.75rem;">🗑️ Hủy</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRejectedAssignments(assignments) {
  const container = document.getElementById('rejectedAssignmentsContainer');
  const rejected = assignments.filter(wa => wa.status === 'rejected');
  
  if (rejected.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = rejected.map(wa => `
    <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; animation: pulse 2s infinite;">
      <span>⚠️ Nhân viên <strong>${wa.staff_name}</strong> từ chối dọn căn <strong>${wa.code}</strong> (${getTaskTypeLabel(wa.task_type)}).</span>
      <button class="btn btn-cancel" onclick="deleteAssignment(${wa.id})" style="padding: 4px 10px; font-size: 0.75rem;">Xóa và phân công lại</button>
    </div>
  `).join('');
}

async function deleteAssignment(id) {
  if (!confirm('Bạn có chắc chắn muốn hủy phân công này?')) return;
  try {
    const res = await apiCall(`/work/${id}`, 'DELETE');
    showToast(res.message, 'success');
    loadAssignmentTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function getStatusBadgeHtml(status) {
  switch (status) {
    case 'pending':
      return '<span class="role-badge none" style="font-size: 0.75rem; padding: 4px 10px; color: #fbbf24; background: rgba(251, 191, 36, 0.12); border-color: rgba(251, 191, 36, 0.3);">⏳ Chờ nhận</span>';
    case 'accepted':
      return '<span class="role-badge sub" style="font-size: 0.75rem; padding: 4px 10px; color: #60a5fa; background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.3);">✓ Đã nhận</span>';
    case 'in-progress':
      return '<span class="role-badge none" style="font-size: 0.75rem; padding: 4px 10px; color: #a78bfa; background: rgba(167, 139, 250, 0.12); border-color: rgba(167, 139, 250, 0.3);">🧹 Đang làm</span>';
    case 'completed':
      return '<span class="role-badge main" style="font-size: 0.75rem; padding: 4px 10px; color: #22c55e; background: rgba(34, 197, 94, 0.12); border-color: rgba(34, 197, 94, 0.3);">🟢 Đã xong</span>';
    case 'approved':
      return '<span class="role-badge main" style="font-size: 0.75rem; padding: 4px 10px; color: #10b981; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.3);">🟢 Đã duyệt</span>';
    case 'rejected':
      return '<span class="role-badge none" style="font-size: 0.75rem; padding: 4px 10px; color: #ef4444; background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.3);">❌ Từ chối</span>';
    default:
      return `<span class="role-badge none" style="font-size: 0.75rem; padding: 4px 10px;">${status}</span>`;
  }
}

function renderStaffGrids() {
  const roomGrid = document.getElementById('roomGrid');
  const techGrid = document.getElementById('techGrid');

  // Render Room
  roomGrid.innerHTML = staffList.map(s => renderStaffCard(s, 'room')).join('');
  // Render Tech
  techGrid.innerHTML = staffList.map(s => renderStaffCard(s, 'tech')).join('');
}

function renderStaffCard(staff, roleType) {
  const roleValue = roleType === 'room' ? staff.room_role : staff.tech_role;
  const roleClass = getRoleClass(roleValue);
  const roleLabel = getRoleLabel(roleValue);
  const avatarClass = staff.type === 'full-time' ? 'fulltime' : 'parttime';
  const initials = getInitials(staff.name);
  const isPartTime = staff.type === 'part-time';

  let editBtn = '';
  if (isPartTime) {
    editBtn = `<button class="btn-edit-name" onclick="event.stopPropagation(); openRenameModal(${staff.id})" title="Đổi tên">✏️</button>`;
  }

  return `
    <div class="staff-card" data-role="${roleValue}" onclick="openAssignModal(${staff.id})">
      ${editBtn}
      <div class="staff-avatar ${avatarClass}">${initials}</div>
      <div class="staff-info">
        <div class="staff-name" title="${staff.name}">${staff.name}</div>
        <div class="staff-type">${staff.type}</div>
      </div>
      <div class="role-badge ${roleClass}">
        <span class="badge-num">${roleValue}</span>
        <span>${roleLabel}</span>
      </div>
    </div>
  `;
}

// ===== ROLE EDIT MODAL =====
function openAssignModal(staffId) {
  selectedStaffId = staffId;
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) return;

  const modal = document.getElementById('assignModal');
  const avatarClass = staff.type === 'full-time' ? 'fulltime' : 'parttime';
  const initials = getInitials(staff.name);

  document.getElementById('modalAvatar').className = `staff-avatar ${avatarClass}`;
  document.getElementById('modalAvatar').textContent = initials;
  document.getElementById('modalName').textContent = staff.name;
  document.getElementById('modalType').textContent = staff.type;

  const roomRadio = document.querySelector(`input[name="roomRole"][value="${staff.room_role}"]`);
  const techRadio = document.querySelector(`input[name="techRole"][value="${staff.tech_role}"]`);
  if (roomRadio) roomRadio.checked = true;
  if (techRadio) techRadio.checked = true;

  updateAutoNotes();
  modal.classList.add('active');
}

function closeAssignModal() {
  document.getElementById('assignModal').classList.remove('active');
  selectedStaffId = null;
}

async function saveAssignment() {
  if (selectedStaffId === null) return;
  const room_role = parseInt(document.querySelector('input[name="roomRole"]:checked').value);
  const tech_role = parseInt(document.querySelector('input[name="techRole"]:checked').value);

  try {
    const data = await apiCall(`/staff/${selectedStaffId}/role`, 'PUT', { room_role, tech_role });
    showToast(data.message, 'success');
    closeAssignModal();
    loadAssignmentTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function updateAutoNotes() {
  const roomChecked = document.querySelector('input[name="roomRole"]:checked');
  const techChecked = document.querySelector('input[name="techRole"]:checked');
  
  const roomNote = document.getElementById('roomAutoNote');
  const techNote = document.getElementById('techAutoNote');

  roomNote.classList.remove('visible');
  techNote.classList.remove('visible');

  if (techChecked && parseInt(techChecked.value) === 1) {
    roomNote.classList.add('visible');
    roomNote.textContent = '⚡ Tự động: Kỹ thuật Chính → Buồng phòng sẽ thành Phụ (2)';
  }

  if (roomChecked && parseInt(roomChecked.value) === 1) {
    techNote.classList.add('visible');
    techNote.textContent = '⚡ Tự động: Buồng phòng Chính → Kỹ thuật sẽ thành Không (0)';
  }
}

// ===== RENAME MODAL (Part-time) =====
function openRenameModal(staffId) {
  selectedStaffId = staffId;
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) return;

  const modal = document.getElementById('renameModal');
  const input = document.getElementById('renameInput');
  const label = document.getElementById('renameLabel');

  label.textContent = `Đổi tên cho: ${staff.default_name}`;
  input.value = staff.name === staff.default_name ? '' : staff.name;
  input.placeholder = staff.default_name;

  modal.classList.add('active');
  setTimeout(() => input.focus(), 300);
}

function closeRenameModal() {
  document.getElementById('renameModal').classList.remove('active');
  selectedStaffId = null;
}

async function saveRename() {
  if (selectedStaffId === null) return;
  const name = document.getElementById('renameInput').value.trim();

  try {
    const data = await apiCall(`/staff/${selectedStaffId}/name`, 'PUT', { name });
    showToast(data.message, 'success');
    closeRenameModal();
    loadAssignmentTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

async function resetAllPartTimeNames() {
  try {
    const data = await apiCall('/staff/reset-names', 'POST');
    showToast(data.message, 'warning');
    loadAssignmentTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// ==================== TAB 2: APARTMENTS ====================
async function loadApartmentsTab() {
  try {
    const query = new URLSearchParams(apartmentFilters).toString();
    apartmentList = await apiCall(`/apartments?${query}`);
    
    // Also load stats
    const stats = await apiCall('/apartments/stats');
    renderApartmentStats(stats.totals);
    renderApartmentGrid();

    // Load staff list if not loaded
    if (staffList.length === 0) {
      staffList = await apiCall('/staff');
    }

  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderApartmentStats(totals) {
  const container = document.getElementById('roomStats');
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

function renderApartmentGrid() {
  const grid = document.getElementById('roomListGrid');
  const countEl = document.getElementById('filteredRoomCount');

  countEl.textContent = `Hiển thị ${apartmentList.length} căn`;

  if (apartmentList.length === 0) {
    grid.innerHTML = '<div class="room-empty">Không tìm thấy căn hộ nào phù hợp bộ lọc.</div>';
    return;
  }

  grid.innerHTML = apartmentList.map(room => {
    const statusClass = getRoomStatusClass(room.status);
    const statusLabel = getRoomStatusLabel(room.status);
    const statusIcon = getRoomStatusIcon(room.status);
    const sstnBadge = room.is_samsung ? '<span class="samsung-badge" style="background: #3b82f6; color: white; padding: 2px 6px; font-size: 0.6rem; border-radius: 4px; font-weight: 700; margin-left: auto;">SSTN</span>' : '';

    return `
      <div class="room-card ${statusClass}" onclick="openRoomStatusModal(${room.id})" style="display: flex; flex-direction: column; align-items: stretch; text-align: left; padding: 12px 10px;">
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <div class="room-number" style="font-size: 1rem; font-weight: 800;">${room.code}</div>
          ${sstnBadge}
        </div>
        
        <!-- Password block -->
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; background: rgba(0,0,0,0.15); padding: 4px 8px; border-radius: 4px;">
          <span style="font-size: 0.72rem; color: var(--text-secondary);">MK:</span>
          <span class="pw-text" id="pw-${room.id}" style="font-family: monospace; font-size: 0.8rem; font-weight: 700; flex: 1;">••••••</span>
          <button class="pw-toggle-btn" onclick="event.stopPropagation(); togglePasswordDisplay(${room.id}, '${room.password}')" style="background: transparent; border: none; cursor: pointer; padding: 0 4px; font-size: 0.8rem;">👁️</button>
          <button class="pw-edit-btn" onclick="event.stopPropagation(); openRoomPasswordModal(${room.id}, '${room.code}', '${room.password}')" style="background: transparent; border: none; cursor: pointer; padding: 0 4px; font-size: 0.75rem; color: var(--accent-amber);">✏️</button>
        </div>

        <div class="room-status-badge ${statusClass}" style="align-self: flex-start; margin-top: auto;">
          <span>${statusIcon}</span>
          <span>${statusLabel}</span>
        </div>
      </div>
    `;
  }).join('');
}

function togglePasswordDisplay(roomId, password) {
  const textEl = document.getElementById(`pw-${roomId}`);
  if (textEl.textContent === '••••••') {
    textEl.textContent = password;
  } else {
    textEl.textContent = '••••••';
  }
}

// ===== ROOM STATUS / ASSIGNMENT MODAL =====
function openRoomStatusModal(roomId) {
  selectedRoomId = roomId;
  const room = apartmentList.find(r => r.id === roomId);
  if (!room) return;

  const modal = document.getElementById('roomStatusModal');
  document.getElementById('roomModalNumber').textContent = `Căn ${room.code}`;
  document.getElementById('roomModalType').textContent = `${room.room_type} · ${room.is_samsung ? 'Thiết bị Samsung (SSTN)' : 'Mật khẩu thường'}`;
  document.getElementById('roomModalFloor').textContent = `Tòa: ${room.building}`;

  // Select the room type radio
  const typeRadio = document.querySelector(`input[name="roomTypeEdit"][value="${room.room_type}"]`);
  if (typeRadio) typeRadio.checked = true;

  const radio = document.querySelector(`input[name="roomStatus"][value="${room.status}"]`);
  if (radio) radio.checked = true;

  // Generate dynamic dropdowns based on room type
  const container = document.getElementById('assignStaffSelectContainer');
  let selectCount = 2; // Mặc định 2 người dọn cho 1~2 ngủ
  if (room.room_type === '3 ngủ') selectCount = 3;
  if (room.room_type === '4 ngủ') selectCount = 4;

  let html = '';
  for (let i = 1; i <= selectCount; i++) {
    const labelText = selectCount > 1 ? `Người dọn ${i}` : 'Người dọn';
    html += `
      <div style="margin-top: 8px;">
        <span style="font-size: 0.8rem; color: var(--text-muted);">${labelText}:</span>
        <select id="assignStaffSelect_${i}" class="room-filter-select" style="width: 100%; margin-top: 4px;">
          <option value="">-- Chọn nhân viên để giao phòng --</option>
          ${staffList.map(s => `<option value="${s.id}">${s.name} (${s.type === 'full-time' ? 'FT' : 'PT'})</option>`).join('')}
        </select>
      </div>
    `;
  }
  container.innerHTML = html;

  modal.classList.add('active');
}

function closeRoomStatusModal() {
  document.getElementById('roomStatusModal').classList.remove('active');
  selectedRoomId = null;
}

async function saveRoomStatus() {
  if (selectedRoomId === null) return;
  const status = document.querySelector('input[name="roomStatus"]:checked').value;
  const taskTypeEl = document.querySelector('input[name="taskType"]:checked');
  const taskType = taskTypeEl ? taskTypeEl.value : 'out';

  // Read multiple staff dropdowns
  const staffIds = [];
  const container = document.getElementById('assignStaffSelectContainer');
  const selects = container.querySelectorAll('select');
  selects.forEach(sel => {
    if (sel.value) {
      const id = parseInt(sel.value);
      if (!staffIds.includes(id)) {
        staffIds.push(id);
      }
    }
  });

  // Get selected room type
  const roomTypeEl = document.querySelector('input[name="roomTypeEdit"]:checked');
  const room_type = roomTypeEl ? roomTypeEl.value : null;

  try {
    // 1. Update status and room type
    await apiCall(`/apartments/${selectedRoomId}/status`, 'PUT', { status, room_type });

    // 2. If staff selected, assign work with task_type for each staff member
    if (staffIds.length > 0) {
      for (const staffId of staffIds) {
        await apiCall('/work/assign', 'POST', {
          staff_id: staffId,
          apartment_id: selectedRoomId,
          task_type: taskType
        });
      }
      const taskLabel = getTaskTypeLabel(taskType);
      showToast(`Đã giao việc [${taskLabel}] cho ${staffIds.length} nhân viên thành công!`, 'success');
    } else {
      showToast('Cập nhật trạng thái thành công!', 'success');
    }

    closeRoomStatusModal();
    loadApartmentsTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// ===== TASK TYPE HELPERS =====
function getTaskTypeLabel(type) {
  switch(type) {
    case 'ss_luu': return 'SS/Lưu';
    case 'out': return 'Out';
    case 'tong_ve_sinh': return 'Tổng VS';
    default: return 'Out';
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

// ===== ROOM PASSWORD MODAL =====
function openRoomPasswordModal(roomId, code, password) {
  selectedRoomId = roomId;
  const modal = document.getElementById('roomPasswordModal');
  document.getElementById('roomPwModalNumber').textContent = `Căn ${code}`;
  document.getElementById('roomPwModalOld').textContent = password;
  document.getElementById('roomNewPassword').value = '';
  modal.classList.add('active');
}

function closeRoomPasswordModal() {
  document.getElementById('roomPasswordModal').classList.remove('active');
  selectedRoomId = null;
}

async function saveRoomPassword() {
  if (selectedRoomId === null) return;
  const password = document.getElementById('roomNewPassword').value.trim();

  if (!password) {
    showToast('Mật khẩu không được để trống.', 'warning');
    return;
  }

  try {
    const data = await apiCall(`/apartments/${selectedRoomId}/password`, 'PUT', { password });
    showToast(data.message, 'success');
    closeRoomPasswordModal();
    loadApartmentsTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function setCityFilter(cityCode) {
  apartmentFilters.city = cityCode;
  apartmentFilters.building = 'all'; // reset complex when city changes
  
  document.querySelectorAll('#cityTabs .floor-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  event.currentTarget.classList.add('active');
  
  renderComplexTabs();
  loadApartmentsTab();
}

function renderComplexTabs() {
  const wrapper = document.getElementById('complexTabsWrapper');
  const container = document.getElementById('complexTabs');
  if (!container) return;
  
  const city = apartmentFilters.city;
  
  if (city === 'all') {
    wrapper.style.display = 'none';
    renderBuildingTabs();
    return;
  }
  
  wrapper.style.display = 'block';
  let html = '';
  const selectedBuilding = apartmentFilters.building;
  const isSkyLakeActive = ['SkyLake', 'S1', 'S2', 'S3'].includes(selectedBuilding);
  
  if (city === 'HN') {
    html = `
      <button class="floor-tab ${selectedBuilding === 'all' ? 'active' : ''}" onclick="setComplexFilter('all')">Tất cả khu HN</button>
      <button class="floor-tab ${isSkyLakeActive ? 'active' : ''}" onclick="setComplexFilter('SkyLake')">SkyLake</button>
      <button class="floor-tab ${selectedBuilding === 'Royal' ? 'active' : ''}" onclick="setComplexFilter('Royal')">Royal City (R6A)</button>
      <button class="floor-tab ${selectedBuilding === 'Imperia' ? 'active' : ''}" onclick="setComplexFilter('Imperia')">Imperia Garden (B)</button>
    `;
  } else if (city === 'HCM') {
    html = `
      <button class="floor-tab active" onclick="setComplexFilter('HCM')">Hồ Chí Minh (Căn chưa có mã)</button>
    `;
    apartmentFilters.building = 'HCM'; // Force building HCM since there's only one complex
  }
  
  container.innerHTML = html;
  renderBuildingTabs();
}

function renderBuildingTabs() {
  const wrapper = document.getElementById('buildingTabsWrapper');
  const container = document.getElementById('buildingTabs');
  if (!container || !wrapper) return;

  const selectedBuilding = apartmentFilters.building;
  const isSkyLakeSelected = ['SkyLake', 'S1', 'S2', 'S3'].includes(selectedBuilding);

  if (!isSkyLakeSelected) {
    wrapper.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  wrapper.style.display = 'block';
  container.innerHTML = `
    <button class="floor-tab ${selectedBuilding === 'SkyLake' ? 'active' : ''}" onclick="setBuildingSubFilter('SkyLake')">Tất cả SkyLake</button>
    <button class="floor-tab ${selectedBuilding === 'S1' ? 'active' : ''}" onclick="setBuildingSubFilter('S1')">S1</button>
    <button class="floor-tab ${selectedBuilding === 'S2' ? 'active' : ''}" onclick="setBuildingSubFilter('S2')">S2</button>
    <button class="floor-tab ${selectedBuilding === 'S3' ? 'active' : ''}" onclick="setBuildingSubFilter('S3')">S3</button>
  `;
}

function setComplexFilter(b) {
  apartmentFilters.building = b;
  renderComplexTabs();
  loadApartmentsTab();
}

function setBuildingSubFilter(b) {
  apartmentFilters.building = b;
  renderComplexTabs();
  loadApartmentsTab();
}

function setBuildingFilter(b) {
  apartmentFilters.building = b;
  loadApartmentsTab();
}

// ==================== TAB 3: STATS ====================
async function loadStatsTab() {
  try {
    statsData = await apiCall('/work/all-stats');
    renderStatsTable();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderStatsTable() {
  const tbody = document.getElementById('statsTableBody');
  if (statsData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Không có dữ liệu thống kê.</td></tr>';
    return;
  }

  tbody.innerHTML = statsData.map(row => {
    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary);">${row.name}</td>
        <td><span class="section-badge" style="text-transform: uppercase;">${row.type}</span></td>
        <td style="font-weight: 700; color: #22c55e;">${row.today_completed} căn</td>
        <td>${row.today_total} căn</td>
        <td style="font-weight: 800; color: #0ea5e9;">${row.month_completed} căn</td>
      </tr>
    `;
  }).join('');
}

// ==================== TAB 4: SALARY ====================
function initSalaryFilters() {
  const mSelect = document.getElementById('salaryMonth');
  const ySelect = document.getElementById('salaryYear');
  
  const current = new Date();
  const cMonth = current.getMonth() + 1;
  const cYear = current.getFullYear();

  let mHtml = '';
  for (let m = 1; m <= 12; m++) {
    mHtml += `<option value="${m}" ${m === cMonth ? 'selected' : ''}>Tháng ${m}</option>`;
  }
  mSelect.innerHTML = mHtml;

  let yHtml = '';
  for (let y = cYear - 2; y <= cYear + 1; y++) {
    yHtml += `<option value="${y}" ${y === cYear ? 'selected' : ''}>Năm ${y}</option>`;
  }
  ySelect.innerHTML = yHtml;
}

async function loadSalaryTab() {
  if (!document.getElementById('salaryMonth').innerHTML) {
    initSalaryFilters();
  }
  await loadSalaryData();
}

async function loadSalaryData() {
  const month = document.getElementById('salaryMonth').value;
  const year = document.getElementById('salaryYear').value;

  try {
    salaryData = await apiCall(`/salary?month=${month}&year=${year}`);
    renderSalaryTable();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderSalaryTable() {
  const tbody = document.getElementById('salaryTableBody');
  if (salaryData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">Không có dữ liệu bảng lương.</td></tr>';
    return;
  }

  tbody.innerHTML = salaryData.map(row => {
    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary);">${row.name}</td>
        <td><span class="section-badge">${row.type}</span></td>
        <td>${formatCurrency(row.base_salary)}</td>
        <td>${formatCurrency(row.per_room_rate)}</td>
        <td style="font-weight: 700; color: #0ea5e9;">${row.total_rooms}</td>
        <td>${formatCurrency(row.room_bonus)}</td>
        <td style="color: #22c55e;">+${formatCurrency(row.bonus)}</td>
        <td style="color: #ef4444;">-${formatCurrency(row.deductions)}</td>
        <td style="font-weight: 800; color: #22c55e;">${formatCurrency(row.total_salary)}</td>
        <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.notes}">${row.notes || '—'}</td>
        <td>
          <button class="btn btn-save" onclick="openSalaryModal(${row.staff_id})" style="padding: 4px 8px; font-size: 0.75rem;">✏️ Cấu hình</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ===== SALARY EDIT MODAL =====
function openSalaryModal(staffId) {
  selectedStaffId = staffId;
  const row = salaryData.find(s => s.staff_id === staffId);
  if (!row) return;

  const modal = document.getElementById('salaryModal');
  const initials = getInitials(row.name);
  const avatarClass = row.type === 'full-time' ? 'fulltime' : 'parttime';

  document.getElementById('salModalAvatar').className = `staff-avatar ${avatarClass}`;
  document.getElementById('salModalAvatar').textContent = initials;
  document.getElementById('salModalName').textContent = row.name;
  document.getElementById('salModalType').textContent = row.type;

  document.getElementById('salBaseInput').value = row.base_salary;
  document.getElementById('salRateInput').value = row.per_room_rate;
  document.getElementById('salRoomsInput').value = row.total_rooms;
  document.getElementById('salBonusInput').value = row.bonus;
  document.getElementById('salDeductionInput').value = row.deductions;
  document.getElementById('salNotesInput').value = row.notes;

  modal.classList.add('active');
}

function closeSalaryModal() {
  document.getElementById('salaryModal').classList.remove('active');
  selectedStaffId = null;
}

async function saveSalaryRecord() {
  if (selectedStaffId === null) return;
  const month = document.getElementById('salaryMonth').value;
  const year = document.getElementById('salaryYear').value;

  const body = {
    staff_id: selectedStaffId,
    month: parseInt(month),
    year: parseInt(year),
    base_salary: parseFloat(document.getElementById('salBaseInput').value) || 0,
    per_room_rate: parseFloat(document.getElementById('salRateInput').value) || 0,
    total_rooms: parseInt(document.getElementById('salRoomsInput').value) || 0,
    bonus: parseFloat(document.getElementById('salBonusInput').value) || 0,
    deductions: parseFloat(document.getElementById('salDeductionInput').value) || 0,
    notes: document.getElementById('salNotesInput').value.trim()
  };

  try {
    const data = await apiCall('/salary/save', 'POST', body);
    showToast(data.message, 'success');
    closeSalaryModal();
    loadSalaryData();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// ===== UTILITIES =====
function getRoleLabel(value) {
  switch (value) {
    case 1: return 'Chính';
    case 2: return 'Phụ';
    case 0: return 'Không';
    default: return '—';
  }
}

function getRoleClass(value) {
  switch (value) {
    case 1: return 'main';
    case 2: return 'sub';
    case 0: return 'none';
    default: return 'none';
  }
}

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

function getInitials(name) {
  const words = name.split(' ').filter(Boolean);
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

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

// ==================== TAB: TASKS ====================
// ==================== TAB: TASKS ====================
async function loadTasksTab() {
  try {
    // Populate staff select
    if (staffList.length === 0) {
      staffList = await apiCall('/staff');
    }
    const select = document.getElementById('taskStaffSelect');
    select.innerHTML = '<option value="">-- Chọn nhân viên --</option>' +
      staffList.map(s => `<option value="${s.id}">${s.name} (${s.type === 'full-time' ? 'FT' : 'PT'})</option>`).join('');

    // Populate tech staff select
    const techSelect = document.getElementById('techTaskStaffSelect');
    if (techSelect) {
      const techStaff = staffList.filter(s => s.tech_role === 1);
      techSelect.innerHTML = '<option value="">-- Chọn nhân viên kỹ thuật --</option>' +
        techStaff.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }

    // Load today's tasks
    const tasks = await apiCall('/tasks/today');
    renderTasksTable(tasks);
    renderRejectedTasks(tasks);
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderTasksTable(tasks) {
  const tbody = document.getElementById('tasksTableBody');
  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">Chưa có công việc nào được giao hôm nay.</td></tr>';
    return;
  }

  tbody.innerHTML = tasks.map(task => {
    const statusBadge = getStatusBadgeHtml(task.status);
    const proofLink = task.proof_image 
      ? `<button class="btn btn-save" onclick="viewProof('${task.proof_image}', 'Công việc: ${task.title}')" style="padding: 4px 8px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669);">👁️ Xem ảnh</button>`
      : '<span style="color: var(--text-muted); font-size: 0.8rem;">Chưa có</span>';
    
    const deleteBtn = `<button class="btn btn-cancel" onclick="deleteTask(${task.id})" style="padding: 4px 8px; font-size: 0.75rem;">🗑️ Xóa</button>`;

    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary);">${task.staff_name || '—'}</td>
        <td style="font-weight: 600;">${task.title}</td>
        <td style="color: var(--text-secondary); font-size: 0.85rem;">${task.description || '—'}</td>
        <td>${statusBadge}</td>
        <td><div style="display: flex; gap: 6px; align-items: center;">${proofLink} ${deleteBtn}</div></td>
      </tr>
    `;
  }).join('');
}

function renderRejectedTasks(tasks) {
  const container = document.getElementById('rejectedTasksContainer');
  const rejected = tasks.filter(t => t.status === 'rejected');
  
  if (rejected.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = rejected.map(t => `
    <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; animation: pulse 2s infinite;">
      <span>⚠️ Nhân viên <strong>${t.staff_name}</strong> từ chối công việc: <strong>${t.title}</strong>.</span>
      <button class="btn btn-cancel" onclick="deleteTask(${t.id})" style="padding: 4px 10px; font-size: 0.75rem;">Xóa và phân công lại</button>
    </div>
  `).join('');
}

async function createTask() {
  const staffId = document.getElementById('taskStaffSelect').value;
  const title = document.getElementById('taskTitleInput').value.trim();
  const description = document.getElementById('taskDescInput').value.trim();

  if (!staffId) {
    showToast('Vui lòng chọn nhân viên.', 'warning');
    return;
  }
  if (!title) {
    showToast('Vui lòng nhập tiêu đề công việc.', 'warning');
    return;
  }

  try {
    const data = await apiCall('/tasks', 'POST', {
      staff_id: parseInt(staffId),
      title,
      description
    });
    showToast(data.message, 'success');

    // Clear form
    document.getElementById('taskTitleInput').value = '';
    document.getElementById('taskDescInput').value = '';
    document.getElementById('taskStaffSelect').value = '';

    // Reload table
    loadTasksTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

async function deleteTask(taskId) {
  try {
    const data = await apiCall(`/tasks/${taskId}`, 'DELETE');
    showToast(data.message, 'success');
    loadTasksTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// ===== VIEW PROOF MODAL =====
function viewProof(url, title) {
  const modal = document.getElementById('viewProofModal');
  document.getElementById('proofModalTitle').textContent = `🖼️ Ảnh Minh Chứng - ${title}`;
  document.getElementById('proofModalImage').src = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  modal.classList.add('active');
}

function closeViewProofModal() {
  document.getElementById('viewProofModal').classList.remove('active');
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

  // Check if there is offline data and show sync button
  const hasOfflineData = localStorage.getItem('vistay_mock_staff') || localStorage.getItem('vistay_mock_apartments');
  const currentMode = localStorage.getItem('vistay_mode') || 'backend';
  const btnSync = document.getElementById('btnSyncOffline');
  if (btnSync) {
    if (hasOfflineData && currentMode === 'local') {
      btnSync.style.display = 'inline-block';
    } else {
      btnSync.style.display = 'none';
    }
  }
  document.getElementById('currentDate').textContent = formatDate();

  // Load first tab data
  loadAssignmentTab();

  // Search & Filter event listeners
  document.getElementById('roomSearchInput').addEventListener('input', (e) => {
    apartmentFilters.search = e.target.value.trim();
    loadApartmentsTab();
  });

  document.getElementById('roomStatusFilter').addEventListener('change', (e) => {
    apartmentFilters.status = e.target.value;
    loadApartmentsTab();
  });

  // Modal backdrop click closes modal
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeAssignModal();
        closeRenameModal();
        closeRoomStatusModal();
        closeRoomPasswordModal();
        closeSalaryModal();
        closeViewProofModal();
        closeChangePasswordModal();
      }
    });
  });

  // Input change triggers for auto role note in modal
  document.querySelectorAll('input[name="roomRole"], input[name="techRole"]').forEach(radio => {
    radio.addEventListener('change', updateAutoNotes);
  });
});

async function syncOfflineData() {
  if (!confirm('Bạn có muốn đồng bộ toàn bộ dữ liệu Offline (Nhân viên, Căn hộ, Phân công) từ điện thoại này lên Server máy tính không? Dữ liệu trên Server sẽ được cập nhật.')) {
    return;
  }

  const btn = document.getElementById('btnSyncOffline');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Đang đồng bộ...';

  try {
    const staff = JSON.parse(localStorage.getItem('vistay_mock_staff') || '[]');
    const apartments = JSON.parse(localStorage.getItem('vistay_mock_apartments') || '[]');
    const work = JSON.parse(localStorage.getItem('vistay_mock_work') || '[]');
    const tasks = JSON.parse(localStorage.getItem('vistay_mock_tasks_list') || '[]');

    // Make direct fetch call to bypass the apiCall interceptor when in local mode
    const response = await fetch(`${API_URL}/auth/migrate-offline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ staff, apartments, work, tasks })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Lỗi đồng bộ dữ liệu.');
    }

    showToast(`Đồng bộ dữ liệu thành công! Ứng dụng đã chuyển sang chế độ Online (Database).`, 'success');
    localStorage.setItem('vistay_mode', 'backend');
    
    setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (err) {
    showToast(`Đồng bộ thất bại: ${err.message}`, 'warning');
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function approveAssignment(id) {
  if (!confirm('Bạn có chắc chắn muốn duyệt hoàn thành căn hộ này không?')) return;
  try {
    const res = await apiCall(`/work/${id}/approve`, 'PUT');
    showToast(res.message, 'success');
    loadAssignmentTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

async function quickAssignRoom() {
  const roomId = document.getElementById('quickRoomSelect').value;
  const staffId = document.getElementById('quickStaffSelect').value;
  const taskType = document.getElementById('quickTaskTypeSelect').value;

  if (!roomId || !staffId) {
    showToast('Vui lòng chọn đầy đủ căn hộ và nhân viên.', 'warning');
    return;
  }

  try {
    const data = await apiCall('/work/assign', 'POST', {
      staff_id: parseInt(staffId),
      apartment_id: parseInt(roomId),
      task_type: taskType
    });
    
    showToast(data.message, 'success');
    
    // Clear selects
    document.getElementById('quickRoomSelect').value = '';
    document.getElementById('quickStaffSelect').value = '';
    
    // Reload data
    loadAssignmentTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

async function createTechTask() {
  const staffId = document.getElementById('techTaskStaffSelect').value;
  const title = document.getElementById('techTaskJobSelect').value;
  const note = document.getElementById('techTaskDescInput').value.trim();

  if (!staffId || !title) {
    showToast('Vui lòng chọn nhân viên kỹ thuật và công việc.', 'warning');
    return;
  }

  const description = note ? note : '';

  try {
    const data = await apiCall('/tasks', 'POST', {
      staff_id: parseInt(staffId),
      title: title,
      description: description
    });
    
    showToast(data.message, 'success');
    
    // Clear fields
    document.getElementById('techTaskStaffSelect').value = '';
    document.getElementById('techTaskJobSelect').value = 'Sơn nhà';
    document.getElementById('techTaskDescInput').value = '';
    
    // Reload tasks
    loadTasksTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

async function populateQuickAssignSelects() {
  const roomSelect = document.getElementById('quickRoomSelect');
  const staffSelect = document.getElementById('quickStaffSelect');
  
  if (staffSelect) {
    staffSelect.innerHTML = '<option value="">-- Chọn nhân viên --</option>' +
      staffList.map(s => `<option value="${s.id}">${s.name} (${s.type === 'full-time' ? 'FT' : 'PT'})</option>`).join('');
  }
  
  if (roomSelect) {
    try {
      const apartments = await apiCall('/apartments?building=all&status=all');
      roomSelect.innerHTML = '<option value="">-- Chọn căn hộ --</option>' +
        apartments.map(a => `<option value="${a.id}">${a.code} (${a.room_type})</option>`).join('');
    } catch (e) {
      console.error('Failed to load apartments for quick select', e);
    }
  }
}
