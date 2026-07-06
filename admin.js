// ===================================================================
// ADMIN PORTAL JS - admin.js
// ===================================================================

const API_URL = `${window.location.origin}/api`;
let token = localStorage.getItem('vistay_token');
let currentUser = null;

// State data
let staffList = [];
let apartmentList = [];
let summaryApartmentList = [];
let statsData = [];
let salaryData = [];
let timelineData = null;

// Chart state
let roomStatusChart = null;
let modalRoomChart = null;
let selectedChartRoomId = null;

// Filtering state
let apartmentFilters = {
  city: 'all',
  building: 'all',
  status: 'all',
  room_type: 'all',
  search: ''
};

// Selected items for modals
let selectedStaffId = null;
let selectedRoomId = null;
let selectedSalaryId = null;

// Bảng giá theo cấp độ kỹ thuật
const TECH_LEVEL_PRICES = { 1: 50000, 2: 100000, 3: 150000, 4: 250000 };
const TECH_LEVEL_NAMES = { 1: 'Dễ', 2: 'Trung bình', 3: 'Khó', 4: 'Cực khó' };
const TECH_LEVEL_COLORS = { 1: '#22c55e', 2: '#f59e0b', 3: '#ef4444', 4: '#dc2626' };
const TECH_LEVEL_BG = { 1: 'rgba(34,197,94,0.15)', 2: 'rgba(245,158,11,0.15)', 3: 'rgba(239,68,68,0.15)', 4: 'rgba(220,38,38,0.15)' };
const TECH_LEVEL_STARS = { 1: '⭐', 2: '⭐⭐', 3: '⭐⭐⭐', 4: '⭐⭐⭐⭐' };
const ROOM_TYPE_ORDER = ['1 ngủ', '2 ngủ', '3 ngủ', '4 ngủ'];
const ROOM_TYPE_COLORS = {
  '1 ngủ': '#22c55e',
  '2 ngủ': '#0ea5e9',
  '3 ngủ': '#f59e0b',
  '4 ngủ': '#ef4444'
};

function getCleaningStaffLimit(roomType, taskType = 'out') {
  if (taskType === 'tong_ve_sinh') return Infinity;
  if (roomType === '3 ngủ') return 3;
  if (roomType === '4 ngủ') return 4;
  return 2;
}

function getCleaningSelectCount(roomType, taskType = 'out') {
  if (taskType === 'tong_ve_sinh') return Math.max(staffList.length, 2);
  const limit = getCleaningStaffLimit(roomType);
  return Number.isFinite(limit) ? limit : 2;
}

function toDatetimeLocalValue(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDefaultTvsWindow() {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    start: toDatetimeLocalValue(start),
    end: toDatetimeLocalValue(end)
  };
}
const COMPLEX_GROUPS = [
  { key: 'SkyLake', label: 'Skylake', buildings: ['S1', 'S2', 'S3'] },
  { key: 'Royal', label: 'Royal', buildings: ['R6A'] },
  { key: 'Imperia', label: 'Imperia', buildings: ['B'] },
  { key: 'HCM', label: 'Hồ Chí Minh', buildings: ['HCM'] }
];

function getBuildingsForChartGroup(selectedGroup) {
  if (selectedGroup === 'SkyLake') return ['S1', 'S2', 'S3'];
  if (selectedGroup === 'Royal') return ['R6A'];
  if (selectedGroup === 'Imperia') return ['B'];
  if (selectedGroup === 'HCM') return ['HCM'];
  if (selectedGroup && selectedGroup !== 'all') return [selectedGroup];
  return [];
}

function getChartGroupDefs(selectedGroup) {
  if (selectedGroup === 'SkyLake') {
    return [
      { label: 'S1', buildings: ['S1'] },
      { label: 'S2', buildings: ['S2'] },
      { label: 'S3', buildings: ['S3'] }
    ];
  }
  if (selectedGroup === 'Royal') {
    return [{ label: 'R6A', buildings: ['R6A'] }];
  }
  if (selectedGroup === 'Imperia') {
    return [{ label: 'B', buildings: ['B'] }];
  }
  if (selectedGroup === 'HCM') {
    return [{ label: 'HCM', buildings: ['HCM'] }];
  }
  return COMPLEX_GROUPS.map(group => ({ label: group.label, buildings: group.buildings }));
}

function getRoomTypeSummary(apartments) {
  const summary = {};
  ROOM_TYPE_ORDER.forEach(type => {
    summary[type] = apartments.filter(room => {
      const rType = room.room_type || '';
      return rType.normalize('NFC') === type.normalize('NFC');
    });
  });
  return summary;
}

function getComplexStatsMatrix(apartments) {
  return COMPLEX_GROUPS.map(group => {
    const groupRooms = apartments
      .filter(room => group.buildings.includes(room.building))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi'));

    const byType = ROOM_TYPE_ORDER.map(roomType => {
      const rooms = groupRooms.filter(room => {
        const rType = room.room_type || '';
        return rType.normalize('NFC') === roomType.normalize('NFC');
      });
      return {
        roomType,
        count: rooms.length,
        rooms
      };
    });

    return {
      ...group,
      total: groupRooms.length,
      byType
    };
  });
}

function getChartBuckets(apartments, selectedGroup) {
  const groups = getChartGroupDefs(selectedGroup);
  return groups.map(group => {
    const rooms = apartments
      .filter(room => group.buildings.includes(room.building) && room.building !== 'HCM')
      .sort((a, b) => a.code.localeCompare(b.code, 'vi'));

    const roomTypes = ROOM_TYPE_ORDER.map(roomType => {
      const typeRooms = rooms.filter(room => {
        const rType = room.room_type || '';
        return rType.normalize('NFC') === roomType.normalize('NFC');
      });
      const statuses = {
        available: typeRooms.filter(room => room.status === 'available').length,
        occupied: typeRooms.filter(room => room.status === 'occupied').length,
        maintenance: typeRooms.filter(room => room.status === 'maintenance').length
      };

      return {
        roomType,
        count: typeRooms.length,
        rooms: typeRooms,
        statuses
      };
    });

    return {
      label: group.label,
      roomTypes
    };
  });
}

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
  console.log(`[API CALL] calling ${endpoint} using mode: ${mode}, token length: ${token ? token.length : 0}`);

  if (mode === 'local') {
    console.log(`[API CALL] falling back to mock for ${endpoint}`);
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

    console.log(`[API CALL] fetching ${API_URL}${endpoint}`);
    const response = await fetch(`${API_URL}${endpoint}`, options);
    console.log(`[API CALL] response status for ${endpoint}: ${response.status}`);

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
      console.error(`[API CALL] api error for ${endpoint}:`, err);
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
  { id: 1, name: 'Liên', default_name: 'Liên', type: 'full-time', room_role: 1, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 2, name: 'Thiên', default_name: 'Thiên', type: 'full-time', room_role: 2, tech_role: 1, base_salary: 0, per_room_rate: 50000 },
  { id: 3, name: 'Thương', default_name: 'Thương', type: 'full-time', room_role: 2, tech_role: 1, base_salary: 0, per_room_rate: 50000 },
  { id: 4, name: 'Vân', default_name: 'Vân', type: 'full-time', room_role: 1, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 5, name: 'Diệu', default_name: 'Diệu', type: 'full-time', room_role: 1, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 6, name: 'Hoàn', default_name: 'Hoàn', type: 'full-time', room_role: 1, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 7, name: 'Nhân viên Part-time 1', default_name: 'Nhân viên Part-time 1', type: 'part-time', room_role: 2, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 8, name: 'Nhân viên Part-time 2', default_name: 'Nhân viên Part-time 2', type: 'part-time', room_role: 2, tech_role: 0, base_salary: 0, per_room_rate: 50000 },
  { id: 9, name: 'Lộc', default_name: 'Lộc', type: 'full-time', room_role: 1, tech_role: 0, base_salary: 0, per_room_rate: 50000 }
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

  { id: 58, code: 'B-2102', building: 'B', password: '456456*', is_samsung: false, status: 'available' },

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
        status: 'available',
        room_type: '2 ngủ'
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
  let localTasks = getLocalData('vistay_mock_tasks', []);

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
    if (endpoint.startsWith('/apartments/status-history')) {
      // Mock status history data
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
    const { staff_id, apartment_id, task_type, planned_start_at, planned_end_at } = body;

    // Check limit of assignees based on room type
    const date = new Date().toISOString().split('T')[0];
    const roomObj = localRooms.find(r => r.id === apartment_id) || {};
    const limit = getCleaningStaffLimit(roomObj.room_type, task_type);

    const count = localWork.filter(w => w.apartment_id === apartment_id && w.assigned_date === date && w.status !== 'rejected').length;
    if (Number.isFinite(limit) && count >= limit) {
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
      assigned_role: task_type === 'tong_ve_sinh' ? 2 : (staffObj.room_role || 1),
      status: 'pending',
      assigned_date: date,
      planned_start_at: planned_start_at || null,
      planned_end_at: planned_end_at || null
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

      // Calculate tech tasks approved for this month/year in mock data
      const approvedTechTasks = localTasks.filter(t => t.staff_id === s.id && t.status === 'approved' && new Date(t.assigned_date).getMonth() + 1 === month && new Date(t.assigned_date).getFullYear() === year);
      const techTaskSalary = approvedTechTasks.reduce((sum, t) => sum + (t.tech_price || 0), 0);

      const bonus = savedConfig.bonus || 0;
      const deductions = savedConfig.deductions || 0;
      const totalSalary = baseSalary + roomBonus + techTaskSalary + bonus - deductions;

      return {
        staff_id: s.id,
        name: s.name,
        type: s.type,
        base_salary: baseSalary,
        per_room_rate: rate,
        total_rooms: totalRooms,
        room_bonus: roomBonus,
        tech_task_salary: techTaskSalary,
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
  if (endpoint === '/tasks' && method === 'POST') {
    const { staff_id, title, description, tech_level } = body;
    if (!staff_id || !title) {
      return Promise.reject(new Error('Thiếu thông tin.'));
    }
    const level = tech_level ? parseInt(tech_level) : null;
    const price = level ? (TECH_LEVEL_PRICES[level] || null) : null;
    localTasks.push({
      id: Date.now(),
      staff_id,
      title: title.trim(),
      description: (description || '').trim(),
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      tech_level: level,
      tech_price: price,
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

  if (endpoint.startsWith('/tasks/') && endpoint.endsWith('/approve') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    localTasks = localTasks.map(t => t.id === id ? { ...t, status: 'approved', reject_reason: null } : t);
    saveLocalData('vistay_mock_tasks', localTasks);
    return Promise.resolve({ message: 'Đã phê duyệt hoàn thành công việc.' });
  }

  if (endpoint.startsWith('/tasks/') && endpoint.endsWith('/reject-completed') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    const { reason } = body;
    localTasks = localTasks.map(t => t.id === id ? { ...t, status: 'accepted', reject_reason: reason, before_image: null, proof_image: null } : t);
    saveLocalData('vistay_mock_tasks', localTasks);
    return Promise.resolve({ message: 'Đã từ chối phê duyệt công việc.' });
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
function switchTab(e, tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  if (e && e.currentTarget) {
    e.currentTarget.classList.add('active');
  } else if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add('active');
  } else {
    // Fallback: active tab button based on tabId
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => {
      const onclick = b.getAttribute('onclick') || '';
      return onclick.includes(`'${tabId}'`) || onclick.includes(`"${tabId}"`);
    });
    if (btn) btn.classList.add('active');
  }

  const activeTab = document.getElementById(`tab-${tabId}`);
  if (activeTab) activeTab.classList.add('active');

  // Trigger loads based on active tab
  if (tabId === 'assignment') loadAssignmentTab();
  if (tabId === 'apartments') loadApartmentsTab();
  if (tabId === 'tasks') loadTasksTab();
  if (tabId === 'stats') loadStatsTab();
  if (tabId === 'salary') loadSalaryTab();
}

// ==================== TAB 1: ASSIGNMENT ====================
async function loadAssignmentTab() {
  console.log("[ASSIGNMENT] loadAssignmentTab started");
  try {
    console.log("[ASSIGNMENT] fetching staff...");
    staffList = await apiCall('/staff');
    console.log("[ASSIGNMENT] rendering staff grids. staffList length:", staffList.length);
    renderStaffGrids();

    console.log("[ASSIGNMENT] fetching work/today...");
    const roomAssignments = await apiCall('/work/today');
    console.log("[ASSIGNMENT] rendering room assignments. assignments length:", roomAssignments.length);
    renderRoomAssignmentsTable(roomAssignments);
    renderRejectedAssignments(roomAssignments);

    try {
      console.log("[ASSIGNMENT] fetching tasks/today...");
      const tasks = await apiCall('/tasks/today');
      console.log("[ASSIGNMENT] rendering active tech tasks. tasks length:", tasks.length);
      renderActiveTechTasks(tasks);
    } catch (e) {
      console.warn("Failed to load tasks for notifications:", e.message);
    }

    console.log("[ASSIGNMENT] populating quick assign selects...");
    populateQuickAssignSelects();
    console.log("[ASSIGNMENT] loadAssignmentTab completed successfully");
  } catch (err) {
    console.error("[ASSIGNMENT] loadAssignmentTab error:", err);
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
  const roomTypeSummary = getRoomTypeSummary(apartmentList);
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
    <div class="stat-item stat-total">
      <span class="stat-num">${roomTypeSummary['1 ngủ'].length}</span>
      <span class="stat-label">🛌 1 ngủ</span>
    </div>
    <div class="stat-item stat-total">
      <span class="stat-num">${roomTypeSummary['2 ngủ'].length}</span>
      <span class="stat-label">🛌 2 ngủ</span>
    </div>
    <div class="stat-item stat-total">
      <span class="stat-num">${roomTypeSummary['3 ngủ'].length}</span>
      <span class="stat-label">🛌 3 ngủ</span>
    </div>
    <div class="stat-item stat-total">
      <span class="stat-num">${roomTypeSummary['4 ngủ'].length}</span>
      <span class="stat-label">🛌 4 ngủ</span>
    </div>
  `;
}

function renderRoomCardHtml(room) {
  const statusClass = getRoomStatusClass(room.status);
  const statusLabel = getRoomStatusLabel(room.status);
  const statusIcon = getRoomStatusIcon(room.status);
  const sstnBadge = room.is_samsung ? '<span class="samsung-badge" style="background: #3b82f6; color: white; padding: 2px 6px; font-size: 0.6rem; border-radius: 4px; font-weight: 700; margin-left: auto;">SSTN</span>' : '';
  const roomTypeBadge = `<span class="room-type-badge" style="background: ${ROOM_TYPE_COLORS[room.room_type] || '#64748b'}; color: white; padding: 2px 6px; font-size: 0.6rem; border-radius: 4px; font-weight: 700; white-space: nowrap;">${room.room_type || '—'}</span>`;

  return `
    <div class="room-card ${statusClass}" onclick="openRoomStatusModal(${room.id})" style="display: flex; flex-direction: column; align-items: stretch; text-align: left; padding: 12px 10px;">
      <div style="display: flex; align-items: center; margin-bottom: 4px;">
        <div class="room-number" style="font-size: 1rem; font-weight: 800;">${room.code}</div>
        ${roomTypeBadge}
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
}

function renderApartmentGrid() {
  const grid = document.getElementById('roomListGrid');
  const countEl = document.getElementById('filteredRoomCount');

  countEl.textContent = `Hiển thị ${apartmentList.length} căn`;

  if (apartmentList.length === 0) {
    grid.innerHTML = '<div class="room-empty">Không tìm thấy căn hộ nào phù hợp bộ lọc.</div>';
    return;
  }

  const hnRooms = apartmentList.filter(room => room.building !== 'HCM');
  const hcmRooms = apartmentList.filter(room => room.building === 'HCM');

  let html = '';

  if (hnRooms.length > 0) {
    html += `
      <div style="grid-column: 1 / -1; font-size: 1.05rem; font-weight: 800; color: var(--accent-purple); margin-top: 5px; margin-bottom: 5px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        🏢 KHU VỰC HÀ NỘI
      </div>
    `;
    html += hnRooms.map(room => renderRoomCardHtml(room)).join('');
  }

  if (hcmRooms.length > 0) {
    html += `
      <div style="grid-column: 1 / -1; font-size: 1.05rem; font-weight: 800; color: var(--accent-teal); margin-top: 20px; margin-bottom: 5px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        🌴 KHU VỰC HỒ CHÍ MINH (HCM)
      </div>
    `;
    html += hcmRooms.map(room => renderRoomCardHtml(room)).join('');
  }

  grid.innerHTML = html;
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
function renderRoomAssignmentStaffSelects(room, taskType = 'out') {
  const container = document.getElementById('assignStaffSelectContainer');
  if (!container || !room) return;

  container.innerHTML = `
    <div id="modalStaffSelectsWrapper">
      <div class="modal-staff-select-item" style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
        <select class="room-filter-select modal-staff-sel" style="flex: 1;">
          <option value="">-- Chọn nhân viên để giao phòng --</option>
          ${staffList.map(s => `<option value="${s.id}">${s.name} (${s.type === 'full-time' ? 'FT' : 'PT'})</option>`).join('')}
        </select>
        <button type="button" class="btn btn-cancel" onclick="removeModalStaffSelect(this)" style="padding: 6px 10px; display: none;">✕</button>
      </div>
    </div>
    <button class="btn" type="button" onclick="addModalStaffSelect()" style="margin-top: 8px; padding: 4px 8px; font-size: 0.75rem; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); cursor: pointer;">➕ Thêm người dọn</button>
  `;
}

function addModalStaffSelect() {
  const wrapper = document.getElementById('modalStaffSelectsWrapper');
  if (!wrapper) return;
  
  const newItem = document.createElement('div');
  newItem.className = 'modal-staff-select-item';
  newItem.style.marginTop = '8px';
  newItem.style.display = 'flex';
  newItem.style.alignItems = 'center';
  newItem.style.gap = '8px';
  
  newItem.innerHTML = `
    <select class="room-filter-select modal-staff-sel" style="flex: 1;">
      <option value="">-- Chọn nhân viên để giao phòng --</option>
      ${staffList.map(s => `<option value="${s.id}">${s.name} (${s.type === 'full-time' ? 'FT' : 'PT'})</option>`).join('')}
    </select>
    <button type="button" class="btn btn-cancel" onclick="removeModalStaffSelect(this)" style="padding: 6px 10px;">✕</button>
  `;
  wrapper.appendChild(newItem);
  
  // Show all remove buttons if there are more than 1
  const items = wrapper.querySelectorAll('.modal-staff-select-item');
  if (items.length > 1) {
    wrapper.querySelectorAll('.modal-staff-select-item button').forEach(btn => btn.style.display = 'inline-block');
  }
}

function removeModalStaffSelect(btn) {
  const item = btn.closest('.modal-staff-select-item');
  const wrapper = document.getElementById('modalStaffSelectsWrapper');
  if (item && wrapper) {
    item.remove();
    // Hide remove button if only 1 select left
    const items = wrapper.querySelectorAll('.modal-staff-select-item');
    if (items.length === 1) {
      items[0].querySelector('button').style.display = 'none';
    }
  }
}

function refreshRoomAssignmentStaffSelects() {
  if (selectedRoomId === null) return;
  const room = apartmentList.find(r => r.id === selectedRoomId);
  const taskTypeEl = document.querySelector('input[name="taskType"]:checked');
  const taskType = taskTypeEl ? taskTypeEl.value : 'out';
  renderRoomAssignmentStaffSelects(room, taskType);
  toggleTvsTimeFields(taskType);
}

function toggleTvsTimeFields(taskType) {
  const group = document.getElementById('tvsTimeGroup');
  if (group) group.style.display = 'block';

  const defaults = getDefaultTvsWindow();
  const startEl = document.getElementById('tvsStartAt');
  const endEl = document.getElementById('tvsEndAt');
  if (startEl && !startEl.value) startEl.value = defaults.start;
  if (endEl && !endEl.value) endEl.value = defaults.end;
}

function toggleQuickTvsTimeFields() {
  document.querySelectorAll('.quick-tvs-time-group').forEach(el => {
    el.style.display = 'block';
  });

  const defaults = getDefaultTvsWindow();
  const startEl = document.getElementById('quickTvsStartAt');
  const endEl = document.getElementById('quickTvsEndAt');
  if (startEl && !startEl.value) startEl.value = defaults.start;
  if (endEl && !endEl.value) endEl.value = defaults.end;
}

function openRoomStatusModal(roomId) {
  selectedRoomId = roomId;
  const room = apartmentList.find(r => r.id === roomId);
  if (!room) return;

  const modal = document.getElementById('roomStatusModal');
  document.getElementById('roomModalNumber').textContent = `Căn ${room.code}`;
  document.getElementById('roomModalType').textContent = `${room.room_type} · ${room.is_samsung ? 'Thiết bị Samsung (SSTN)' : 'Mật khẩu thường'}`;
  document.getElementById('roomModalFloor').textContent = `Tòa: ${room.building}`;

  const taskTypeEl = document.querySelector('input[name="taskType"]:checked');
  const taskType = taskTypeEl ? taskTypeEl.value : 'out';
  renderRoomAssignmentStaffSelects(room, taskType);
  toggleTvsTimeFields(taskType);

  modal.classList.add('active');
}

function closeRoomStatusModal() {
  document.getElementById('roomStatusModal').classList.remove('active');
  selectedRoomId = null;
}

async function saveRoomStatus() {
  if (selectedRoomId === null) return;
  const taskTypeEl = document.querySelector('input[name="taskType"]:checked');
  const taskType = taskTypeEl ? taskTypeEl.value : 'out';
  const expectedStart = document.getElementById('tvsStartAt')?.value || null;
  const expectedEnd = document.getElementById('tvsEndAt')?.value || null;

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

  if (staffIds.length === 0) {
    showToast('Vui lòng chọn ít nhất một nhân viên để giao phòng.', 'warning');
    return;
  }

  try {
    // Chỉ thực hiện giao việc cho các nhân viên được chọn
    for (const staffId of staffIds) {
      await apiCall('/work/assign', 'POST', {
        staff_id: staffId,
        apartment_id: selectedRoomId,
        task_type: taskType,
        expected_start_at: expectedStart,
        expected_end_at: expectedEnd
      });
    }
    const taskLabel = getTaskTypeLabel(taskType);
    showToast(`Đã giao việc [${taskLabel}] cho ${staffIds.length} nhân viên thành công!`, 'success');

    closeRoomStatusModal();
    loadApartmentsTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// ===== TASK TYPE HELPERS =====
function getTaskTypeLabel(type) {
  switch (type) {
    case 'ss_luu': return 'SS/Lưu';
    case 'out': return 'Out';
    case 'tong_ve_sinh': return 'Tổng VS';
    default: return 'Out';
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
    loadStatsTab();
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
    // Tải danh sách căn hộ để tổng hợp
    summaryApartmentList = await apiCall('/apartments?building=all&status=all');
    renderRoomSummaryTable();
    renderStatsMatrix();
    loadApartmentStatusTimeline();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// Trạng thái lọc tòa của bảng tổng hợp
let summaryBuildingFilter = 'all';

function setSummaryBuilding(building, btn) {
  summaryBuildingFilter = building;
  document.querySelectorAll('.summary-bld-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderRoomSummaryTable();
}

function renderRoomSummaryTable() {
  const tbody = document.getElementById('roomSummaryTableBody');
  if (!tbody) return;

  // Lọc các căn hộ từ summaryApartmentList: lọc theo tòa
  let filtered = summaryApartmentList;
  if (summaryBuildingFilter && summaryBuildingFilter !== 'all') {
    filtered = filtered.filter(a => a.building === summaryBuildingFilter);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Không có căn hộ nào phù hợp.</td></tr>';
    return;
  }

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
    const roomsInB = filtered.filter(r => r.building === b);
    if (roomsInB.length > 0) {
      // Hàng tiêu đề tòa
      html += `
        <tr class="table-group-header" style="background: rgba(167, 139, 250, 0.08); font-weight: bold;">
          <td colspan="6" style="color: var(--accent-purple); font-size: 0.9rem; padding: 10px 15px; text-align: left;">
            🏢 ${buildingNames[b] || ('Tòa ' + b)}
          </td>
        </tr>
      `;

      roomsInB.forEach(room => {
        const isSstn = room.is_samsung;
        const displayStatus = isSstn ? 'occupied' : room.status;
        const statusClass = getRoomStatusClass(displayStatus);
        const statusLabel = getRoomStatusLabel(displayStatus);
        const statusIcon = getRoomStatusIcon(displayStatus);

        let stayInfo = '';
        if (displayStatus === 'occupied' && (room.checkin_date || room.checkout_date)) {
          const inDate = room.checkin_date ? new Date(room.checkin_date).toLocaleDateString('vi-VN') : '—';
          const outDate = room.checkout_date ? new Date(room.checkout_date).toLocaleDateString('vi-VN') : '—';
          stayInfo = `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">📅 ${inDate} ${room.checkin_time || ''} → ${outDate} ${room.checkout_time || ''}</div>`;
        } else if (displayStatus === 'maintenance' && room.maintenance_duration) {
          stayInfo = `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">⏰ Dự kiến: ${room.maintenance_duration} giờ</div>`;
        }

        let selectHtml = '';
        if (isSstn) {
          selectHtml = `
            <select class="summary-status-select" disabled style="background: rgba(255,255,255,0.05); color: var(--text-muted); cursor: not-allowed; border-color: rgba(255,255,255,0.1);">
              <option value="occupied" selected>🔒 Auto Có khách</option>
            </select>
          `;
        } else {
          selectHtml = `
            <select
              class="summary-status-select"
              onchange="changeRoomStatusInline(${room.id}, this.value, this)"
              data-room-id="${room.id}"
            >
              <option value="available" ${room.status === 'available' ? 'selected' : ''}>🟢 Trống</option>
              <option value="occupied" ${room.status === 'occupied' ? 'selected' : ''}>🔴 Có khách</option>
              ${room.status === 'maintenance' ? `<option value="maintenance" selected disabled>🔵 Bảo trì</option>` : ''}
            </select>
          `;
        }

        html += `
          <tr>
            <td style="font-weight: 800; color: var(--text-primary); padding-left: 25px;">${room.code}</td>
            <td><span class="section-badge">${room.building}</span></td>
            <td>${room.room_type}</td>
            <td style="font-family: monospace; font-weight: 700; color: var(--accent-amber);">${room.password || '******'}</td>
            <td>
              <div style="display: flex; flex-direction: column; align-items: flex-start;">
                <span class="room-status-badge ${statusClass}" style="padding: 4px 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px;">
                  <span>${statusIcon}</span>
                  <span>${statusLabel}</span>
                </span>
                ${stayInfo}
              </div>
            </td>
            <td>
              ${selectHtml}
            </td>
          </tr>
        `;
      });
    }
  });

  tbody.innerHTML = html;
}

function changeRoomStatusInline(roomId, newStatus, selectEl) {
  if (selectEl) {
    const room = apartmentList.find(r => r.id === roomId) || summaryApartmentList.find(r => r.id === roomId);
    if (room) selectEl.value = room.status;
  }
  openRoomStatusEditOnlyModal(roomId);

  setTimeout(() => {
    const radio = document.querySelector(`input[name="statusOnlyVal"][value="${newStatus}"]`);
    if (radio) {
      radio.checked = true;
      toggleStatusModalFields('admin');
    }
  }, 50);
}

// ===== MODAL ĐỔI TRẠNG THÁI CĂN HỘ TRONG THỐNG KÊ =====
let selectedStatusRoomId = null;

function openRoomStatusEditOnlyModal(roomId) {
  selectedStatusRoomId = roomId;
  const room = apartmentList.find(r => r.id === roomId) || summaryApartmentList.find(r => r.id === roomId);
  if (!room) return;

  document.getElementById('statusOnlyModalNumber').textContent = `Cập Nhật Trạng Thái Căn ${room.code}`;
  const radio = document.querySelector(`input[name="statusOnlyVal"][value="${room.status}"]`);
  if (radio) radio.checked = true;

  // Pre-fill checkin/checkout date-time
  const checkinDateEl = document.getElementById('soCheckinDate');
  const checkinTimeEl = document.getElementById('soCheckinTime');
  const checkoutDateEl = document.getElementById('soCheckoutDate');
  const checkoutTimeEl = document.getElementById('soCheckoutTime');

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
  const maintDurationEl = document.getElementById('soMaintenanceDuration');
  if (maintDurationEl) maintDurationEl.value = room.maintenance_duration || '';

  // Trigger toggle fields display
  toggleStatusModalFields('admin');

  document.getElementById('roomStatusEditOnlyModal').classList.add('active');
}

function closeRoomStatusEditOnlyModal() {
  document.getElementById('roomStatusEditOnlyModal').classList.remove('active');
  selectedStatusRoomId = null;
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

async function saveRoomStatusEditOnly() {
  if (!selectedStatusRoomId) return;
  const radio = document.querySelector('input[name="statusOnlyVal"]:checked');
  if (!radio) return;

  const newStatus = radio.value;
  const checkin_date = document.getElementById('soCheckinDate')?.value || null;
  const checkin_time = document.getElementById('soCheckinTime')?.value || null;
  const checkout_date = document.getElementById('soCheckoutDate')?.value || null;
  const checkout_time = document.getElementById('soCheckoutTime')?.value || null;
  const maintenance_duration = document.getElementById('soMaintenanceDuration')?.value || null;

  if (newStatus === 'occupied') {
    if (!checkin_date || !checkin_time || !checkout_date || !checkout_time) {
      showToast('Vui lòng nhập đầy đủ thông tin ngày/giờ check-in và check-out khi căn hộ có khách.', 'warning');
      return;
    }
  }

  try {
    const res = await apiCall(`/apartments/${selectedStatusRoomId}/status`, 'PUT', {
      status: newStatus,
      checkin_date,
      checkin_time,
      checkout_date,
      checkout_time,
      maintenance_duration: maintenance_duration ? parseInt(maintenance_duration) : null
    });
    showToast(res.message, 'success');
    closeRoomStatusEditOnlyModal();
    // Tải lại toàn bộ tab thống kê để cập nhật bảng, ma trận và biểu đồ
    await loadStatsTab();
    await loadApartmentsTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderStatsTable() {
  const tbody = document.getElementById('statsTableBody');
  if (!tbody) return;
  if (statsData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Không có dữ liệu thống kê.</td></tr>';
    return;
  }
  tbody.innerHTML = statsData.map(row => {
    const techTasksHtml = row.tech_role === 1
      ? `<span style="font-weight: 700; color: #0ea5e9;">${row.tech_tasks_completed || 0} việc</span>`
      : '<span style="color: var(--text-muted);">—</span>';
    const kpiHtml = row.kpi !== null && row.kpi !== undefined
      ? `<span style="font-weight: 800; color: #a855f7; background: rgba(168,85,247,0.1); padding: 2px 8px; border-radius: 6px;">${row.kpi}</span>`
      : '<span style="color: var(--text-muted);">—</span>';
    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary);">${row.name}</td>
        <td><span class="section-badge" style="text-transform: uppercase;">${row.type}</span></td>
        <td style="font-weight: 700; color: #22c55e;">${row.today_completed} căn</td>
        <td>${row.today_total} căn</td>
        <td style="font-weight: 800; color: #0ea5e9;">${row.month_completed} căn</td>
        <td>${techTasksHtml}</td>
        <td>${kpiHtml}</td>
      </tr>
    `;
  }).join('');
}

function renderStatsMatrix() {
  const tbody = document.getElementById('statsMatrixTableBody');
  if (!tbody) return;

  const matrix = getComplexStatsMatrix(summaryApartmentList);
  if (matrix.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Không có dữ liệu thống kê.</td></tr>';
    return;
  }

  tbody.innerHTML = matrix.map(group => {
    const cells = group.byType.map(bucket => {
      const chipList = bucket.rooms.length > 0
        ? bucket.rooms.map(room => {
          const statusClass = getRoomStatusClass(room.status);
          const statusLabel = getRoomStatusLabel(room.status);
          return `
              <button class="stats-room-chip ${statusClass}" onclick="event.stopPropagation(); openRoomStatusEditOnlyModal(${room.id})" title="${room.code} • ${statusLabel} • ${room.room_type}">
                <span>${room.code}</span>
                <small>${getRoomStatusIcon(room.status)}</small>
              </button>
            `;
        }).join('')
        : '<div class="stats-empty-cell">Không có căn hộ</div>';

      return `
        <td>
          <div class="stats-matrix-cell" tabindex="0" title="Kéo xuống để xem các mã căn hộ bị ẩn">
            <div class="stats-matrix-cell-head">
              <strong>${bucket.count}</strong>
              <span>${bucket.roomType}</span>
            </div>
            <div class="stats-matrix-room-list">
              ${chipList}
            </div>
          </div>
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td style="font-weight: 800; color: var(--text-primary); white-space: nowrap;">${group.label}</td>
        ${cells}
        <td style="font-weight: 800; color: var(--accent-teal);">${group.total}</td>
      </tr>
    `;
  }).join('');
}

// ===== ROOM STATUS CHART =====
let selectedChartBuilding = 'all';

async function loadRoomStatusChart() {
  try {
    const select = document.getElementById('chartRoomSelect');
    if (!select) return;

    selectedChartBuilding = select.value || 'all';

    renderApartmentStatusChart(summaryApartmentList);
  } catch (err) {
    console.warn('Failed to load room status chart:', err.message);
  }
}

function onChartRoomChanged() {
  const select = document.getElementById('chartRoomSelect');
  if (select) {
    selectedChartBuilding = select.value;
    loadRoomStatusChart();
    loadApartmentStatusTimeline();
  }
}

let timelineMode = 'daily';

function setTimelineMode(mode) {
  timelineMode = mode;
  document.querySelectorAll('.tl-mode-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(mode === 'daily' ? 'tlModeDaily' : 'tlModeHourly');
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  loadApartmentStatusTimeline();
}

async function loadApartmentStatusTimeline() {
  try {
    const canvas = document.getElementById('roomStatusTimeline');
    if (!canvas) return;

    const building = selectedChartBuilding || 'all';
    const data = await apiCall(`/apartments/status-timeline?building=${encodeURIComponent(building)}&mode=${timelineMode}`);
    timelineData = data;
    renderApartmentStatusTimeline(data);
  } catch (err) {
    console.warn('Failed to load apartment status timeline:', err.message);
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

function renderApartmentStatusTimeline(data) {
  const container = document.getElementById('roomStatusTimeline');
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

  // Nhóm phòng theo tòa
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

  // Render header ngày (sticky)
  const dateHeaderHtml = `
    <div class="timeline-header">
      <div class="timeline-room-head">Căn hộ</div>
      <div class="timeline-date-row" style="grid-template-columns: repeat(${labels.length}, minmax(18px, 1fr));">
        ${labels.map(label => `<div class="timeline-date-cell">${label}</div>`).join('')}
      </div>
    </div>
  `;

  // Render các nhóm tòa
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
          const isHourly = timelineMode === 'hourly';

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
              onclick="event.stopPropagation(); showTimelinePopover(this, '${room.code}', '${segment.status}', '${startLabel}', '${endLabel}', ${isHourly}, ${room.id})"
              title="${tooltipText}"
            >
              ${segmentContent}
            </button>
          `;
        }).join('');

        return `
          <div class="timeline-row">
            <button class="timeline-room-label ${statusClass}" onclick="openRoomStatusEditOnlyModal(${room.id})" title="${room.code}">
              <span class="timeline-room-code">${room.code}</span>
              <span class="timeline-room-state">${statusIcon}</span>
            </button>
            <div class="timeline-track" style="--bucket-count: ${labels.length}; grid-template-columns: repeat(${labels.length}, minmax(18px, 1fr));">
              ${segmentsHtml}
            </div>
          </div>
        `;
      }).join('');

      // Đếm số lượng theo trạng thái
      const occ = bRooms.filter(r => r.current_status === 'occupied').length;
      const maint = bRooms.filter(r => r.current_status === 'maintenance').length;
      const avail = bRooms.filter(r => r.current_status === 'available').length;
      const statusSummary = `<span class="tl-bld-stat avail">🟢 ${avail}</span><span class="tl-bld-stat occ">🔴 ${occ}</span><span class="tl-bld-stat maint">🔵 ${maint}</span>`;

      return `
        <div class="timeline-building-group">
          <button class="timeline-building-header" onclick="toggleTimelineBuilding('${building}')" id="tl-hdr-${building}">
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

function toggleTimelineBuilding(building) {
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

function showTimelinePopover(element, roomCode, status, startLabel, endLabel, isHourly, roomId) {
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
  footer.innerHTML = `
    <button class="btn btn-cancel" style="padding: 4px 10px; font-size: 0.75rem;" onclick="closeTimelinePopover()">Đóng</button>
    <button class="btn btn-save" style="padding: 4px 10px; font-size: 0.75rem; background: var(--accent-amber); color: #0c1524;" onclick="closeTimelinePopover(); openRoomStatusEditOnlyModal(${roomId})">✏️ Đổi trạng thái</button>
  `;

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

function renderApartmentStatusChart(apartments) {
  const canvas = document.getElementById('roomStatusChart');
  if (!canvas) return;

  const selected = selectedChartBuilding || 'all';
  const groups = getChartBuckets(apartments, selected);
  const labels = groups.map(group => group.label);
  const datasets = ROOM_TYPE_ORDER.map(roomType => ({
    label: roomType,
    data: groups.map(group => {
      const bucket = group.roomTypes.find(item => item.roomType === roomType);
      return bucket ? bucket.count : 0;
    }),
    backgroundColor: ROOM_TYPE_COLORS[roomType],
    borderColor: ROOM_TYPE_COLORS[roomType],
    borderWidth: 1.5,
    stack: 'rooms',
    borderRadius: 6,
    maxBarThickness: 42
  }));

  // Hủy biểu đồ cũ nếu tồn tại
  if (roomStatusChart) {
    roomStatusChart.destroy();
    roomStatusChart = null;
  }

  const ctx = canvas.getContext('2d');

  roomStatusChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(148, 163, 184, 0.04)',
            drawBorder: false
          },
          ticks: {
            color: '#64748b',
            font: { size: 11, weight: '500' },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8
          }
        },
        y: {
          min: 0,
          grid: {
            color: 'rgba(148, 163, 184, 0.04)',
            drawBorder: false
          },
          ticks: {
            stepSize: 1,
            display: true
          }
        }
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
              return `Nhóm căn hộ: ${context[0].label}`;
            },
            label: function (context) {
              const group = groups[context.dataIndex];
              const bucket = group.roomTypes.find(item => item.roomType === context.dataset.label);
              const statusSummary = bucket
                ? `Trống ${bucket.statuses.available}, Có khách ${bucket.statuses.occupied}, Bảo trì ${bucket.statuses.maintenance}`
                : 'Không có dữ liệu';
              return ` ${context.dataset.label}: ${context.parsed.y} căn (${statusSummary})`;
            }
          }
        }
      },
      animation: {
        duration: 600,
        easing: 'easeOutQuart'
      }
    }
  });
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
    // Tải đồng thời bảng lương và thống kê hoàn thành công việc
    const [salaryResult, statsResult] = await Promise.all([
      apiCall(`/salary?month=${month}&year=${year}`),
      apiCall('/work/all-stats')
    ]);

    salaryData = salaryResult;
    statsData = statsResult;

    renderSalaryTable();
    renderStatsTable();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderSalaryTable() {
  const tbody = document.getElementById('salaryTableBody');
  if (salaryData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align: center;">Không có dữ liệu bảng lương.</td></tr>';
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
        <td style="font-weight: 700; color: #0ea5e9;">${formatCurrency(row.tech_task_salary || 0)}</td>
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
    renderActiveTechTasks(tasks);
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderActiveTechTasks(tasks) {
  const activeTasks = tasks.filter(t => t.status === 'in-progress');
  const assignmentContainer = document.getElementById('activeTechTasksContainer-assignment');
  const tasksContainer = document.getElementById('activeTechTasksContainer-tasks');

  const html = activeTasks.map(t => `
    <div style="background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.3); color: #38bdf8; padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; animation: pulse 2.5s infinite;">
      <span>🔧 Nhân viên kỹ thuật <strong>${t.staff_name}</strong> đang thực hiện công việc: <strong>${t.title}</strong>.</span>
      ${t.before_image ? `<button class="btn btn-save" onclick="viewProof('${t.before_image}', 'Ảnh lỗi - ${t.title}')" style="padding: 4px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #0ea5e9, #0284c7); border: none; color: white; cursor: pointer;">👁️ Xem ảnh lỗi</button>` : ''}
    </div>
  `).join('');

  if (assignmentContainer) assignmentContainer.innerHTML = html;
  if (tasksContainer) tasksContainer.innerHTML = html;
}

function renderTasksTable(tasks) {
  const tbody = document.getElementById('tasksTableBody');
  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">Chưa có công việc nào được giao hôm nay.</td></tr>';
    return;
  }

  tbody.innerHTML = tasks.map(task => {
    const statusBadge = getStatusBadgeHtml(task.status);

    // Tech level badge
    let levelBadge = '<span style="color: var(--text-muted); font-size: 0.8rem;">—</span>';
    if (task.tech_level) {
      const lvl = task.tech_level;
      const lvlName = TECH_LEVEL_NAMES[lvl] || '';
      const lvlColor = TECH_LEVEL_COLORS[lvl] || '#888';
      const lvlBg = TECH_LEVEL_BG[lvl] || 'transparent';
      const priceStr = task.tech_price ? new Intl.NumberFormat('vi-VN').format(task.tech_price) + 'đ' : '';
      levelBadge = `<div style="display: flex; flex-direction: column; gap: 2px;">
        <span style="background: ${lvlBg}; color: ${lvlColor}; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; display: inline-block;">${TECH_LEVEL_STARS[lvl]} ${lvlName}</span>
        ${priceStr ? `<span style="font-size: 0.7rem; color: ${lvlColor}; font-weight: 600;">${priceStr}</span>` : ''}
      </div>`;
    }

    // View images buttons
    let imageButtons = [];
    if (task.before_image) {
      imageButtons.push(`<button class="btn btn-save" onclick="viewProof('${task.before_image}', 'Ảnh lỗi - ${task.title}')" style="padding: 4px 8px; font-size: 0.75rem; background: linear-gradient(135deg, #f59e0b, #d97706); border: none;">📸 Trước</button>`);
    }
    if (task.proof_image) {
      imageButtons.push(`<button class="btn btn-save" onclick="viewProof('${task.proof_image}', 'Ảnh hoàn thành - ${task.title}')" style="padding: 4px 8px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669); border: none;">📸 Sau</button>`);
    }
    const imagesHtml = imageButtons.length > 0 ? imageButtons.join(' ') : '<span style="color: var(--text-muted); font-size: 0.8rem;">Không có</span>';

    let actionButtons = '';
    if (task.status === 'completed') {
      actionButtons += `<button class="btn" onclick="approveTask(${task.id})" style="padding: 4px 8px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 4px; margin-right: 4px; cursor: pointer;">🟢 Duyệt</button>`;
      actionButtons += `<button class="btn" onclick="openRejectTaskModal(${task.id})" style="padding: 4px 8px; font-size: 0.75rem; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 4px; margin-right: 4px; cursor: pointer;">🔴 Không duyệt</button>`;
    }
    actionButtons += `<button class="btn btn-cancel" onclick="deleteTask(${task.id})" style="padding: 4px 8px; font-size: 0.75rem;">🗑️ Xóa</button>`;

    const selfBadge = task.is_self_assigned
      ? `<span style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 2px 6px; font-size: 0.6rem; border-radius: 4px; font-weight: 700; margin-left: 6px;">Tự giao</span>`
      : '';

    const rejectHtml = task.reject_reason
      ? `<div style="color: #f87171; font-size: 0.8rem; font-weight: 600; margin-top: 4px;">⚠️ Từ chối: ${task.reject_reason}</div>`
      : '';

    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary);">${task.staff_name || '—'}</td>
        <td style="font-weight: 600;">
          <div style="display: flex; align-items: center; flex-wrap: wrap;">${task.title}${selfBadge}</div>
          ${rejectHtml}
        </td>
        <td>${levelBadge}</td>
        <td style="color: var(--text-secondary); font-size: 0.85rem;">${task.description || '—'}</td>
        <td>${statusBadge}</td>
        <td><div style="display: flex; gap: 4px; align-items: center;">${imagesHtml}</div></td>
        <td><div style="display: flex; gap: 4px; align-items: center;">${actionButtons}</div></td>
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

// ===== APPROVE/REJECT TECH TASKS =====
async function approveTask(id) {
  if (!confirm('Bạn có chắc chắn muốn phê duyệt hoàn thành công việc này không?')) return;
  try {
    const res = await apiCall(`/tasks/${id}/approve`, 'PUT');
    showToast(res.message, 'success');
    loadTasksTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function openRejectTaskModal(id) {
  document.getElementById('rejectTaskId').value = id;
  document.getElementById('rejectTaskReasonInput').value = '';
  document.getElementById('rejectTaskModal').classList.add('active');
}

function closeRejectTaskModal() {
  document.getElementById('rejectTaskModal').classList.remove('active');
}

async function submitRejectTask() {
  const id = document.getElementById('rejectTaskId').value;
  const reason = document.getElementById('rejectTaskReasonInput').value.trim();

  if (!reason) {
    showToast('Vui lòng nhập lý do không phê duyệt.', 'warning');
    return;
  }

  try {
    const res = await apiCall(`/tasks/${id}/reject-completed`, 'PUT', { reason });
    showToast(res.message, 'success');
    closeRejectTaskModal();
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
function initializePage() {
  console.log("[INIT] initializePage started");
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

  // Check if there is offline data and show sync button
  const hasOfflineData = localStorage.getItem('vistay_mock_staff') || localStorage.getItem('vistay_mock_apartments');
  const currentMode = localStorage.getItem('vistay_mode') || 'backend';

  const offlineBanner = document.getElementById('offlineAlertBanner');
  if (offlineBanner) {
    offlineBanner.style.display = currentMode === 'local' ? 'block' : 'none';
  }

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

  document.getElementById('roomTypeFilter').addEventListener('change', (e) => {
    apartmentFilters.room_type = e.target.value;
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
        closeRejectTaskModal();
        closeRoomStatusEditOnlyModal();
      }
    });
  });

  // Input change triggers for auto role note in modal
  document.querySelectorAll('input[name="roomRole"], input[name="techRole"]').forEach(radio => {
    radio.addEventListener('change', updateAutoNotes);
  });

  document.querySelectorAll('input[name="taskType"]').forEach(radio => {
    radio.addEventListener('change', refreshRoomAssignmentStaffSelects);
  });

  const quickTaskTypeSelect = document.getElementById('quickTaskTypeSelect');
  if (quickTaskTypeSelect) {
    quickTaskTypeSelect.addEventListener('change', () => {
      handleQuickRoomInput(document.getElementById('quickRoomInput')?.value || '');
      toggleQuickTvsTimeInputs();
    });
    toggleQuickTvsTimeInputs();
  }
}

function toggleQuickTvsTimeInputs() {
  const select = document.getElementById('quickTaskTypeSelect');
  if (!select) return;
  const taskType = select.value;
  const timeGroups = document.querySelectorAll('.quick-tvs-time-group');
  timeGroups.forEach(group => {
    if (taskType === 'tong_ve_sinh') {
      group.style.display = 'block';
    } else {
      group.style.display = 'none';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}

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
  const roomCode = document.getElementById('quickRoomInput').value.trim();
  const taskType = document.getElementById('quickTaskTypeSelect').value;
  let expectedStart = document.getElementById('quickTvsStartAt')?.value || null;
  let expectedEnd = document.getElementById('quickTvsEndAt')?.value || null;

  if (taskType !== 'tong_ve_sinh') {
    expectedStart = null;
    expectedEnd = null;
  }

  if (!roomCode) {
    showToast('Vui lòng nhập mã căn hộ.', 'warning');
    return;
  }

  const room = apartmentList.find(a => a.code.toLowerCase() === roomCode.toLowerCase());
  if (!room) {
    showToast('Căn hộ không tồn tại hoặc không hợp lệ.', 'warning');
    return;
  }

  const staffSelects = document.querySelectorAll('.quick-staff-sel');
  const staffIds = [];
  staffSelects.forEach(sel => {
    if (sel.value) {
      const id = parseInt(sel.value);
      if (!staffIds.includes(id)) {
        staffIds.push(id);
      }
    }
  });

  if (staffIds.length === 0) {
    showToast('Vui lòng chọn ít nhất một nhân viên dọn dẹp.', 'warning');
    return;
  }

  try {
    for (const staffId of staffIds) {
      await apiCall('/work/assign', 'POST', {
        staff_id: staffId,
        apartment_id: room.id,
        task_type: taskType,
        expected_start_at: expectedStart,
        expected_end_at: expectedEnd
      });
    }
    showToast('Đã phân công dọn phòng thành công.', 'success');

    // Reset form
    document.getElementById('quickRoomInput').value = '';
    const defaults = getDefaultTvsWindow();
    const startEl = document.getElementById('quickTvsStartAt');
    const endEl = document.getElementById('quickTvsEndAt');
    if (startEl) startEl.value = defaults.start;
    if (endEl) endEl.value = defaults.end;
    renderQuickStaffSelects(1);

    // Reload data
    loadAssignmentTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

async function createTechTask() {
  const staffId = document.getElementById('techTaskStaffSelect').value;
  const select = document.getElementById('techTaskJobSelect');
  const title = select.value;
  const note = document.getElementById('techTaskDescInput').value.trim();

  if (!staffId || !title) {
    showToast('Vui lòng chọn nhân viên kỹ thuật và công việc.', 'warning');
    return;
  }

  // Get tech_level from selected option's data-level attribute
  const selectedOption = select.options[select.selectedIndex];
  const techLevel = selectedOption ? selectedOption.getAttribute('data-level') : null;

  const description = note ? note : '';

  try {
    const data = await apiCall('/tasks', 'POST', {
      staff_id: parseInt(staffId),
      title: title,
      description: description,
      tech_level: techLevel ? parseInt(techLevel) : null
    });

    showToast(data.message, 'success');

    // Clear fields
    document.getElementById('techTaskStaffSelect').value = '';
    document.getElementById('techTaskJobSelect').value = '';
    document.getElementById('techTaskDescInput').value = '';
    onTechJobSelected(); // Reset level display

    // Reload tasks
    loadTasksTab();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// Hiển thị cấp độ & giá khi chọn công việc kỹ thuật
function onTechJobSelected() {
  const select = document.getElementById('techTaskJobSelect');
  const display = document.getElementById('techTaskLevelDisplay');
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

async function populateQuickAssignSelects() {
  const roomList = document.getElementById('quickRoomList');
  if (roomList) {
    try {
      const apartments = await apiCall('/apartments?building=all&status=all');
      roomList.innerHTML = apartments.map(a => `<option value="${a.code}">${a.code} (${a.room_type})</option>`).join('');
    } catch (e) {
      console.error('Failed to load apartments for quick select', e);
    }
  }
  // Reset danh sách select nhân viên về 1 cái mặc định
  renderQuickStaffSelects(1);
}

function renderQuickStaffSelects(count) {
  const listContainer = document.getElementById('quickStaffSelectsList');
  if (!listContainer) return;

  let html = '';
  for (let i = 1; i <= count; i++) {
    const label = count > 1 ? `Người ${i}` : 'Chọn nhân viên';
    html += `
      <div class="quick-staff-select-item" style="display: flex; align-items: center; gap: 4px; flex: 1; min-width: 150px;">
        <select class="room-filter-select quick-staff-sel" style="flex: 1;">
          <option value="">-- ${label} --</option>
          ${staffList.map(s => `<option value="${s.id}">${s.name} (${s.type === 'full-time' ? 'FT' : 'PT'})</option>`).join('')}
        </select>
        <button type="button" class="btn btn-cancel" onclick="removeQuickStaffSelect(this)" style="padding: 4px 8px; display: none;">✕</button>
      </div>
    `;
  }
  listContainer.innerHTML = html;

  // Show remove buttons if count > 1
  if (count > 1) {
    listContainer.querySelectorAll('.quick-staff-select-item button').forEach(btn => btn.style.display = 'inline-block');
  }
}

function addQuickStaffSelect() {
  const listContainer = document.getElementById('quickStaffSelectsList');
  if (!listContainer) return;
  
  const newItem = document.createElement('div');
  newItem.className = 'quick-staff-select-item';
  newItem.style.display = 'flex';
  newItem.style.alignItems = 'center';
  newItem.style.gap = '4px';
  newItem.style.flex = '1';
  newItem.style.minWidth = '150px';
  
  newItem.innerHTML = `
    <select class="room-filter-select quick-staff-sel" style="flex: 1;">
      <option value="">-- Chọn nhân viên --</option>
      ${staffList.map(s => `<option value="${s.id}">${s.name} (${s.type === 'full-time' ? 'FT' : 'PT'})</option>`).join('')}
    </select>
    <button type="button" class="btn btn-cancel" onclick="removeQuickStaffSelect(this)" style="padding: 4px 8px;">✕</button>
  `;
  listContainer.appendChild(newItem);
  
  // Show all remove buttons if there are more than 1
  const items = listContainer.querySelectorAll('.quick-staff-select-item');
  if (items.length > 1) {
    listContainer.querySelectorAll('.quick-staff-select-item button').forEach(btn => btn.style.display = 'inline-block');
  }
}

function removeQuickStaffSelect(btn) {
  const item = btn.closest('.quick-staff-select-item');
  const listContainer = document.getElementById('quickStaffSelectsList');
  if (item && listContainer) {
    item.remove();
    // Hide remove button if only 1 select left
    const items = listContainer.querySelectorAll('.quick-staff-select-item');
    if (items.length === 1) {
      items[0].querySelector('button').style.display = 'none';
    }
  }
}

function handleQuickRoomInput(val) {
  if (!val) {
    renderQuickStaffSelects(1);
    return;
  }
  const room = apartmentList.find(a => a.code.toLowerCase() === val.trim().toLowerCase());
  if (room) {
    const taskType = document.getElementById('quickTaskTypeSelect')?.value || 'out';
    renderQuickStaffSelects(getCleaningSelectCount(room.room_type, taskType));
  } else {
    renderQuickStaffSelects(1);
  }
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
  const canvas = document.getElementById('modalRoomChart');
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

// ===== NOTIFICATION BELL SYSTEM =====
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

let eventSource = null;
function setupRealtimeEvents() {
  try {
    // Offline storage listener
    window.addEventListener('storage', (e) => {
      if (localStorage.getItem('vistay_mode') === 'local') {
        if (e.key === 'vistay_mock_work' || e.key === 'vistay_mock_tasks_list' || e.key === 'vistay_mock_apartments') {
          console.log('🔄 Offline mode: Local mock data updated. Reloading current tab...');
          refreshActiveTab();
        }
      }
    });

    // Online SSE listener
    if (localStorage.getItem('vistay_mode') !== 'local') {
      if (eventSource) eventSource.close();
      eventSource = new EventSource(`${API_URL}/events`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📢 Received real-time event:', data);

          // Hiển thị Toast thông báo nếu có tin nhắn chi tiết
          if (data.message) {
            const type = (data.action === 'reject' || data.action === 'reject_completed') ? 'warning' : 'success';
            showToast(data.message, type);
          }

          refreshActiveTab();
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

function refreshActiveTab() {
  const activeTabBtn = document.querySelector('.tab-btn.active');
  if (activeTabBtn) {
    const onclickAttr = activeTabBtn.getAttribute('onclick') || '';
    const match = onclickAttr.match(/'([^']+)'/);
    if (match && match[1]) {
      const tabId = match[1];
      console.log(`🔄 Refreshing tab: ${tabId}`);
      if (tabId === 'assignment') loadAssignmentTab();
      else if (tabId === 'apartments') loadApartmentsTab();
      else if (tabId === 'tasks') loadTasksTab();
      else if (tabId === 'stats') loadStatsTab();
      else if (tabId === 'salary') loadSalaryTab();
    }
  }
}
