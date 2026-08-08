// ===================================================================
// EMPLOYEE PORTAL JS - employee.js
// ===================================================================

const API_URL = (window.location.protocol === 'file:') ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
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
let TECH_LEVEL_PRICES = { 1: 50000, 2: 100000, 3: 150000, 4: 250000 };
const TECH_LEVEL_NAMES = { 1: 'Dễ', 2: 'Trung bình', 3: 'Khó', 4: 'Cực khó' };
const TECH_LEVEL_COLORS = { 1: '#22c55e', 2: '#f59e0b', 3: '#ef4444', 4: '#dc2626' };
const TECH_LEVEL_BG = { 1: 'rgba(34,197,94,0.15)', 2: 'rgba(245,158,11,0.15)', 3: 'rgba(239,68,68,0.15)', 4: 'rgba(220,38,38,0.15)' };
const TECH_LEVEL_STARS = { 1: '⭐', 2: '⭐⭐', 3: '⭐⭐⭐', 4: '⭐⭐⭐⭐' };

// ===================================================================
// 技术故障与工作难度分类表 (Technical Faults & Difficulty Data)
// ===================================================================
const TECH_FAULT_LEVELS = {
  1: {
    levelName: "级别 1 - 简单 (Level 1 - Easy)",
    levelNameVi: "Cấp 1 — Dễ",
    price: 50000,
    tasks: [
      { name: "刷墙", nameVi: "Sơn tường", keywords: ["sơn", "tường", "paint", "wall"] },
      { name: "清洗空调", nameVi: "Vệ sinh điều hòa", keywords: ["vệ sinh", "điều hòa", "máy lạnh", "clean", "ac"] },
      { name: "贴贴纸/告示", nameVi: "Dán decal/tờ rơi", keywords: ["dán", "decal", "tờ rơi", "sticker", "notice"] },
      { name: "洗白窗帘", nameVi: "Giặt rèm trắng", keywords: ["giặt", "rèm", "trắng", "wash", "curtain"] },
      { name: "装内锁", nameVi: "Lắp khóa trong", keywords: ["lắp", "khóa", "lock", "install"] },
      { name: "拧紧螺丝", nameVi: "Siết ốc", keywords: ["siết", "ốc", "screw", "tighten"] },
      { name: "换花洒", nameVi: "Thay vòi sen", keywords: ["thay", "vòi sen", "shower", "replace"] },
      { name: "换灯泡", nameVi: "Thay bóng đèn", keywords: ["thay", "bóng đèn", "đèn", "bulb", "light"] },
      { name: "贴门阻/门碰", nameVi: "Dán chặn cửa", keywords: ["chặn cửa", "cửa", "door", "stopper"] },
      { name: "放蟑螂药", nameVi: "Đặt thuốc gián", keywords: ["gián", "thuốc", "cockroach", "pest"] },
      { name: "装净水器", nameVi: "Lắp bộ lọc nước", keywords: ["lọc nước", "máy lọc", "water filter", "install"] },
      { name: "洗风扇", nameVi: "Vệ sinh quạt", keywords: ["quạt", "fan", "clean"] }
    ]
  },
  2: {
    levelName: "级别 2 - 中等 (Level 2 - Medium)",
    levelNameVi: "Cấp 2 — Trung bình",
    price: 100000,
    tasks: [
      { name: "洗波轮洗衣机", nameVi: "Vệ sinh máy giặt cửa đứng", keywords: ["máy giặt", "cửa đứng", "washing machine", "top load"] },
      { name: "打硅胶/密封胶", nameVi: "Silicon/mẻo", keywords: ["silicon", "mẻo", "seal", "silicone"] },
      { name: "刷天花板", nameVi: "Sơn trần", keywords: ["sơn", "trần", "ceiling", "paint"] },
      { name: "刮腻子刷漆", nameVi: "Sơn bả", keywords: ["sơn bả", "bả", "plaster", "putty"] },
      { name: "修门合页/铰链", nameVi: "Xử lý bản lề cửa", keywords: ["bản lề", "cửa", "hinge", "door"] },
      { name: "洗沙发床垫", nameVi: "Vệ sinh sofa và đệm", keywords: ["sofa", "đệm", "nệm", "couch", "mattress"] },
      { name: "洗厚窗帘", nameVi: "Vệ sinh rèm dày", keywords: ["rèm", "dày", "curtain", "thick"] },
      { name: "刷桌椅脚漆", nameVi: "Sơn chân bàn ghế", keywords: ["sơn", "chân bàn", "chân ghế", "table", "chair"] },
      { name: "挂餐厅吊灯/吸顶灯", nameVi: "Treo đèn thả bàn ăn và đèn ốp", keywords: ["đèn", "treo", "thả", "ốp", "lamp", "light", "chandelier"] },
      { name: "洗饮水机", nameVi: "Vệ sinh cây nước", keywords: ["cây nước", "饮水机", "water dispenser", "clean"] }
    ]
  },
  3: {
    levelName: "级别 3 - 困难 (Level 3 - Hard)",
    levelNameVi: "Cấp 3 — Khó",
    price: 150000,
    tasks: [
      { name: "洗滚筒洗衣机", nameVi: "Vệ sinh máy giặt cửa ngang", keywords: ["máy giặt", "cửa ngang", "front load", "washing machine"] },
      { name: "换阳台门框/门槛", nameVi: "Thay miệng cửa ban công", keywords: ["cửa ban công", "khung cửa", "threshold", "balcony"] },
      { name: "换轴承", nameVi: "Thay vòng bi", keywords: ["vòng bi", "bearing", "replace"] },
      { name: "洗中央空调滤网", nameVi: "Vệ sinh lưới điều hòa âm trần", keywords: ["điều hòa âm trần", "lưới", "filter", "central ac"] },
      { name: "通马桶及下水道", nameVi: "Xử lý bồn cầu và cống thoát nước", keywords: ["bồn cầu", "cống", "toilet", "drain", "clog"] },
      { name: "修晾衣架", nameVi: "Sửa giàn phơi", keywords: ["giàn phơi", "phơi đồ", "drying rack", "repair"] }
    ]
  },
  4: {
    levelName: "级别 4 - 需专业技能 (Level 4 - Expert/Specialized)",
    levelNameVi: "Cấp 4 — Cần chuyên môn",
    price: 250000,
    tasks: [
      { name: "修电视", nameVi: "Sửa tivi", keywords: ["tivi", "tv", "sửa", "repair"] },
      { name: "修冰箱", nameVi: "Sửa tủ lạnh", keywords: ["tủ lạnh", "fridge", "refrigerator", "sửa"] },
      { name: "修微波炉", nameVi: "Sửa lò vi sóng", keywords: ["lò vi sóng", "microwave", "sửa"] },
      { name: "修空调", nameVi: "Sửa điều hòa", keywords: ["sửa", "điều hòa", "máy lạnh", "ac repair"] },
      { name: "修防虫纱窗", nameVi: "Sửa rèm chống côn trùng", keywords: ["rèm", "côn trùng", "mạng", "screen", "insect"] }
    ]
  }
};

function buildTechJobDropdownHTML() {
  let html = '<option value="">-- Chọn công việc kỹ thuật --</option>';
  const levelLabels = {
    1: '⭐ Cấp 1 — Dễ (50,000đ)',
    2: '⭐⭐ Cấp 2 — Trung bình (100,000đ)',
    3: '⭐⭐⭐ Cấp 3 — Khó (150,000đ)',
    4: '⭐⭐⭐⭐ Cấp 4 — Cần chuyên môn (250,000đ)'
  };
  for (const [level, data] of Object.entries(TECH_FAULT_LEVELS)) {
    html += `<optgroup label="${levelLabels[level]}">`;
    for (const task of data.tasks) {
      html += `<option value="${task.nameVi}" data-level="${level}">${task.nameVi}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

function assessTaskDifficulty(description) {
  if (!description || !description.trim()) return null;
  const desc = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let bestMatch = { level: null, confidence: 0, taskName: '' };
  for (const [level, data] of Object.entries(TECH_FAULT_LEVELS)) {
    for (const task of data.tasks) {
      for (const kw of task.keywords) {
        const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (desc.includes(kwNorm)) {
          const confidence = kwNorm.length / desc.length;
          if (confidence > bestMatch.confidence) {
            bestMatch = { level: parseInt(level), confidence, taskName: task.nameVi };
          }
        }
      }
    }
  }
  return bestMatch.level ? bestMatch : null;
}

// Global Configuration
let appConfig = null;
async function loadGlobalConfig() {
  try {
    const res = await apiCall('/config');
    appConfig = res;
    if (res.TECH_PRICES) {
      TECH_LEVEL_PRICES = res.TECH_PRICES;
      console.log("[CONFIG] Loaded TECH_PRICES from server:", TECH_LEVEL_PRICES);
    }
  } catch (err) {
    console.warn("[CONFIG] Failed to load config from server, using local fallback. Error:", err.message);
  }
}

// Auth check
function checkAuth() {
  const userStr = localStorage.getItem('vistay_user');
  if (!token || !userStr) {
    handleLogout();
    return;
  }
  
  // Tự động khôi phục chế độ backend khi tải trang nếu không phải token offline
  if (token !== 'local_fallback_token') {
    localStorage.setItem('vistay_mode', 'backend');
    localStorage.removeItem('vistay_offline_warning');
  }

  try {
    currentUser = JSON.parse(userStr);

    // Ensure techRole is set for Thiên and Chiến (IDs 2 & 3)
    if (currentUser.staffId === 2 || currentUser.staffId === 3 || currentUser.username === 'thien' || currentUser.username === 'chien') {
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

    // All employees can see timeline, summary, and apartment grid

    // Show "Tạo việc kỹ thuật" button and load dedicated tech section for tech staff (techRole >= 1)
    if (currentUser.techRole && currentUser.techRole >= 1) {
      const selfAssignBtn = document.getElementById('btnSelfAssignCard');
      if (selfAssignBtn) selfAssignBtn.style.display = 'inline-flex';
      loadEmployeeTechTasks();
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
// In-flight request deduplication & short cache for GET requests
const _pendingRequests = new Map();
const _getCache = new Map();
const _CACHE_TTL = 3000; // 3s cache for identical GET requests

async function apiCall(endpoint, method = 'GET', body = null) {
  let mode = localStorage.getItem('vistay_mode') || 'backend';

  if (mode === 'local') {
    return handleLocalMockCall(endpoint, method, body);
  }

  // Deduplicate in-flight identical GET requests
  const dedupeKey = (method === 'GET' && !body) ? `GET:${endpoint}` : null;
  if (dedupeKey) {
    // Return cached result if fresh
    const cached = _getCache.get(dedupeKey);
    if (cached && Date.now() - cached.ts < _CACHE_TTL) {
      return cached.data;
    }
    // Return existing in-flight request if any
    if (_pendingRequests.has(dedupeKey)) {
      return _pendingRequests.get(dedupeKey);
    }
  }

  const requestPromise = (async () => {
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
        body: body instanceof FormData ? body : (body ? JSON.stringify(body) : null),
        cache: 'no-store'
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

    const data = await response.json();

    // Cache GET results for dedup
    if (dedupeKey) {
      _getCache.set(dedupeKey, { data, ts: Date.now() });
      // Evict stale cache entries
      if (_getCache.size > 50) {
        const now = Date.now();
        for (const [k, v] of _getCache) {
          if (now - v.ts > _CACHE_TTL * 2) _getCache.delete(k);
        }
      }
    }

    return data;
  } catch (err) {
    if (err.isApiError) {
      throw err;
    }
    // Only switch to offline mode for real network failures (server unreachable)
    // Do NOT switch for API errors or timeouts on a reachable server
    const isRealNetworkError = err.message && (
      err.message.includes('Failed to fetch') ||
      err.message.includes('NetworkError') ||
      err.message.includes('ERR_NETWORK') ||
      err.name === 'TypeError'
    );
    if (isRealNetworkError) {
      console.warn(`[API CALL] network error for ${endpoint}: ${err.message}. Switching to offline mode.`);
      localStorage.setItem('vistay_mode', 'local');
      localStorage.setItem('vistay_offline_warning', '1');
      const offlineBanner = document.getElementById('offlineAlertBanner');
      if (offlineBanner) offlineBanner.style.display = 'block';
    }
    return handleLocalMockCall(endpoint, method, body);
  } finally {
    if (dedupeKey) _pendingRequests.delete(dedupeKey);
  }
  })();

  if (dedupeKey) _pendingRequests.set(dedupeKey, requestPromise);
  return requestPromise;
}

// ===== LOCAL SIMULATION DATABASE (OFFLINE MODE) =====
const MOCK_STAFF = [
  { id: 1, name: 'Liên', default_name: 'Liên', type: 'full-time', room_role: 1, tech_role: 0, base_salary: 5000000, per_room_rate: 50000 },
  { id: 2, name: 'Thiên', default_name: 'Thiên', type: 'full-time', room_role: 2, tech_role: 1, base_salary: 5000000, per_room_rate: 50000 },
  { id: 3, name: 'Chiến', default_name: 'Chiến', type: 'full-time', room_role: 2, tech_role: 1, base_salary: 5000000, per_room_rate: 50000 },
  { id: 4, name: 'Vân', default_name: 'Vân', type: 'full-time', room_role: 1, tech_role: 0, base_salary: 5000000, per_room_rate: 50000 },
  { id: 5, name: 'Diệu', default_name: 'Diệu', type: 'full-time', room_role: 1, tech_role: 0, base_salary: 7000000, per_room_rate: 50000 },
  { id: 6, name: 'Hoàn', default_name: 'Hoàn', type: 'full-time', room_role: 1, tech_role: 0, base_salary: 5000000, per_room_rate: 50000 },
  { id: 7, name: 'Lộc', default_name: 'Lộc', type: 'full-time', room_role: 1, tech_role: 0, base_salary: 7000000, per_room_rate: 50000 },
  { id: 8, name: 'Nhân viên Part-time 1', default_name: 'Nhân viên Part-time 1', type: 'part-time', room_role: 2, tech_role: 0, base_salary: 5000000, per_room_rate: 50000 },
  { id: 9, name: 'Nhân viên Part-time 2', default_name: 'Nhân viên Part-time 2', type: 'part-time', room_role: 2, tech_role: 0, base_salary: 5000000, per_room_rate: 50000 },
  { id: 10, name: 'Nhân viên Part-time 3', default_name: 'Nhân viên Part-time 3', type: 'part-time', room_role: 2, tech_role: 0, base_salary: 5000000, per_room_rate: 50000 },
  { id: 11, name: 'Nhân viên Part-time 4', default_name: 'Nhân viên Part-time 4', type: 'part-time', room_role: 2, tech_role: 0, base_salary: 5000000, per_room_rate: 50000 },
  { id: 12, name: 'Nhân viên Part-time 5', default_name: 'Nhân viên Part-time 5', type: 'part-time', room_role: 2, tech_role: 0, base_salary: 5000000, per_room_rate: 50000 }
];

const roomTypeByCodeMap = {
  'S1-0405': '1 ngủ', 'S1-0505': '1 ngủ', 'S1-0905': '1 ngủ', 'S1-1105': '1 ngủ', 'S1-1605': '1 ngủ',
  'S1-1705': '1 ngủ', 'S1-1905': '1 ngủ', 'S1-2105': '1 ngủ', 'S1-2305': '1 ngủ', 'S1-2405': '1 ngủ',
  'S1-2505': '1 ngủ', 'S1-2705': '1 ngủ', 'S1-3105': '1 ngủ',
  'S1-2405A': '2 ngủ', 'S1-2505A': '2 ngủ', 'S1-2809': '2 ngủ', 'S1-1208A': '2 ngủ',
  'S1-0508': '3 ngủ',
  'S2-0401': '2 ngủ', 'S2-0501': '2 ngủ', 'S2-0610': '1 ngủ', 'S2-0715': '2 ngủ', 'S2-0908': '2 ngủ',
  'S2-1110': '1 ngủ', 'S2-1111': '1 ngủ', 'S2-11A11': '2 ngủ', 'S2-11A12': '1 ngủ', 'S2-11A08': '2 ngủ',
  'S2-1209': '2 ngủ', 'S2-1220': '3 ngủ', 'S2-1511A': '2 ngủ', 'S2-1512': '1 ngủ', 'S2-15A11': '2 ngủ',
  'S2-1712': '1 ngủ', 'S2-1808': '2 ngủ', 'S2-1901': '2 ngủ', 'S2-2106': '4 ngủ', 'S2-2117': '2 ngủ',
  'S2-2211A': '2 ngủ', 'S2-2411': '2 ngủ', 'S2-2512': '1 ngủ', 'S2-2810': '1 ngủ', 'S2-2811A': '2 ngủ',
  'S2-2916': '2 ngủ', 'S2-3210': '1 ngủ', 'S2-3301': '2 ngủ', 'S2-3316': '2 ngủ', 'S2-3411A': '2 ngủ',
  'S2-3420': '3 ngủ', 'S2-3501': '2 ngủ', 'S2-3517': '2 ngủ', 'S2-3608': '2 ngủ', 'S2-3612': '1 ngủ',
  'S2-3708': '2 ngủ', 'S2-3810': '1 ngủ', 'S2-3811A': '2 ngủ', 'S2-3812': '1 ngủ', 'S2-3816': '2 ngủ',
  'S2-3908': '2 ngủ',
  'S3-0511': '1 ngủ', 'S3-0715': '2 ngủ', 'S3-0810': '2 ngủ', 'S3-0908': '2 ngủ', 'S3-1001': '2 ngủ',
  'S3-1012': '1 ngủ', 'S3-15A08A': '2 ngủ', 'S3-15A12': '1 ngủ', 'S3-1616': '2 ngủ', 'S3-1701': '2 ngủ',
  'S3-1811': '1 ngủ', 'S3-1901': '2 ngủ', 'S3-2012': '1 ngủ', 'S3-2301': '2 ngủ', 'S3-2406': '3 ngủ',
  'S3-2412': '1 ngủ', 'S3-2712': '1 ngủ', 'S3-2909': '3 ngủ', 'S3-2911': '1 ngủ', 'S3-3001': '2 ngủ',
  'S3-3015': '2 ngủ', 'S3-3316': '2 ngủ', 'S3-3409': '1 ngủ', 'S3-3411': '1 ngủ', 'S3-3511': '1 ngủ',
  'S3-3512': '1 ngủ', 'S3-3612': '1 ngủ', 'S3-3702': '3 ngủ', 'S3-3808A': '2 ngủ', 'S3-3906': '3 ngủ',
  'S3-3918': '4 ngủ',
  'B-2102': '3 ngủ',
  'R4-2519': '2 ngủ', 'R5-2423': '2 ngủ', 'R6A-0505': '1 ngủ', 'R6A-2806': '1 ngủ'
};

const PROVIDED_ROOMS = [
  { id: 1, code: 'S1-0405', building: 'S1', password: '040505', is_samsung: false, status: 'available' },
  { id: 2, code: 'S1-0505', building: 'S1', password: '000555', is_samsung: true, status: 'available' },
  { id: 3, code: 'S1-0508', building: 'S1', password: '585868', is_samsung: true, status: 'available' },
  { id: 4, code: 'S1-0905', building: 'S1', password: '730399', is_samsung: true, status: 'available' },
  { id: 5, code: 'S1-1105', building: 'S1', password: '220704', is_samsung: false, status: 'available' },
  { id: 6, code: 'S1-1605', building: 'S1', password: '166.666', is_samsung: false, status: 'available' },
  { id: 7, code: 'S1-1705', building: 'S1', password: '356835', is_samsung: false, status: 'available' },
  { id: 8, code: 'S1-1905', building: 'S1', password: '199.999', is_samsung: true, status: 'available' },
  { id: 9, code: 'S1-2105', building: 'S1', password: '222111', is_samsung: false, status: 'available' },
  { id: 10, code: 'S1-2305', building: 'S1', password: '160.524', is_samsung: false, status: 'available' },
  { id: 11, code: 'S1-2405', building: 'S1', password: '122.537', is_samsung: true, status: 'available' },
  { id: 12, code: 'S1-2405A', building: 'S1', password: '456789', is_samsung: true, status: 'available' },
  { id: 13, code: 'S1-2505', building: 'S1', password: '123456', is_samsung: true, status: 'available' },
  { id: 14, code: 'S1-2505A', building: 'S1', password: '000555', is_samsung: true, status: 'available' },
  { id: 15, code: 'S1-2705', building: 'S1', password: '222777', is_samsung: true, status: 'available' },
  { id: 16, code: 'S1-2809', building: 'S1', password: '280900', is_samsung: false, status: 'available' },
  { id: 17, code: 'S1-3105', building: 'S1', password: '333555', is_samsung: true, status: 'available' },
  { id: 18, code: 'S1-1208A', building: 'S1', password: '123456', is_samsung: false, status: 'available' },
  { id: 19, code: 'S2-0401', building: 'S2', password: '040100', is_samsung: false, status: 'available' },
  { id: 20, code: 'S2-0501', building: 'S2', password: '050100', is_samsung: false, status: 'available' },
  { id: 21, code: 'S2-0610', building: 'S2', password: '760.200', is_samsung: true, status: 'available' },
  { id: 22, code: 'S2-0715', building: 'S2', password: '686868', is_samsung: false, status: 'available' },
  { id: 23, code: 'S2-0908', building: 'S2', password: '090800', is_samsung: false, status: 'available' },
  { id: 24, code: 'S2-1110', building: 'S2', password: '101010', is_samsung: true, status: 'available' },
  { id: 25, code: 'S2-1111', building: 'S2', password: '838688', is_samsung: true, status: 'available' },
  { id: 26, code: 'S2-11A08', building: 'S2', password: '123456', is_samsung: false, status: 'available' },
  { id: 27, code: 'S2-11A11', building: 'S2', password: '111168', is_samsung: false, status: 'available' },
  { id: 28, code: 'S2-11A12', building: 'S2', password: '123456', is_samsung: false, status: 'available' },
  { id: 29, code: 'S2-1209', building: 'S2', password: '123456', is_samsung: false, status: 'available' },
  { id: 30, code: 'S2-1220', building: 'S2', password: '111222', is_samsung: false, status: 'available' },
  { id: 31, code: 'S2-1511A', building: 'S2', password: '688688', is_samsung: true, status: 'available' },
  { id: 32, code: 'S2-1512', building: 'S2', password: '111222', is_samsung: true, status: 'available' },
  { id: 33, code: 'S2-15A11', building: 'S2', password: '123456', is_samsung: false, status: 'available' },
  { id: 34, code: 'S2-1712', building: 'S2', password: '320.500', is_samsung: true, status: 'available' },
  { id: 35, code: 'S2-1808', building: 'S2', password: '180800', is_samsung: false, status: 'available' },
  { id: 36, code: 'S2-1901', building: 'S2', password: '009966', is_samsung: false, status: 'available' },
  { id: 37, code: 'S2-2106', building: 'S2', password: '222111', is_samsung: false, status: 'available' },
  { id: 38, code: 'S2-2117', building: 'S2', password: '211700', is_samsung: false, status: 'available' },
  { id: 39, code: 'S2-2211A', building: 'S2', password: '668868', is_samsung: true, status: 'available' },
  { id: 40, code: 'S2-2411', building: 'S2', password: '135246#', is_samsung: true, status: 'available' },
  { id: 41, code: 'S2-2512', building: 'S2', password: '225588', is_samsung: true, status: 'available' },
  { id: 42, code: 'S2-2810', building: 'S2', password: '281000', is_samsung: false, status: 'available' },
  { id: 43, code: 'S2-2811A', building: 'S2', password: '281100', is_samsung: false, status: 'available' },
  { id: 44, code: 'S2-2916', building: 'S2', password: '929268', is_samsung: true, status: 'available' },
  { id: 45, code: 'S2-3210', building: 'S2', password: '333222', is_samsung: true, status: 'available' },
  { id: 46, code: 'S2-3301', building: 'S2', password: '333111', is_samsung: false, status: 'available' },
  { id: 47, code: 'S2-3316', building: 'S2', password: '333366', is_samsung: true, status: 'available' },
  { id: 48, code: 'S2-3411A', building: 'S2', password: '201099', is_samsung: false, status: 'available' },
  { id: 49, code: 'S2-3420', building: 'S2', password: '202002', is_samsung: false, status: 'available' },
  { id: 50, code: 'S2-3501', building: 'S2', password: '350100', is_samsung: false, status: 'available' },
  { id: 51, code: 'S2-3517', building: 'S2', password: '353568', is_samsung: true, status: 'available' },
  { id: 52, code: 'S2-3608', building: 'S2', password: '363636', is_samsung: false, status: 'available' },
  { id: 53, code: 'S2-3612', building: 'S2', password: '123456', is_samsung: false, status: 'available' },
  { id: 54, code: 'S2-3708', building: 'S2', password: '370800', is_samsung: false, status: 'available' },
  { id: 55, code: 'S2-3810', building: 'S2', password: '383838', is_samsung: true, status: 'available' },
  { id: 56, code: 'S2-3811A', building: 'S2', password: '381100', is_samsung: false, status: 'available' },
  { id: 57, code: 'S2-3812', building: 'S2', password: '101615', is_samsung: true, status: 'available' },
  { id: 58, code: 'S2-3816', building: 'S2', password: '383883', is_samsung: true, status: 'available' },
  { id: 59, code: 'S2-3908', building: 'S2', password: '999888', is_samsung: false, status: 'available' },
  { id: 60, code: 'S3-0511', building: 'S3', password: '051100', is_samsung: false, status: 'available' },
  { id: 61, code: 'S3-0715', building: 'S3', password: '071500', is_samsung: false, status: 'available' },
  { id: 62, code: 'S3-0810', building: 'S3', password: '081000', is_samsung: false, status: 'available' },
  { id: 63, code: 'S3-0908', building: 'S3', password: '999888', is_samsung: false, status: 'available' },
  { id: 64, code: 'S3-1001', building: 'S3', password: '100100', is_samsung: false, status: 'available' },
  { id: 65, code: 'S3-1012', building: 'S3', password: '101200', is_samsung: false, status: 'available' },
  { id: 66, code: 'S3-15A08A', building: 'S3', password: '150808', is_samsung: false, status: 'available' },
  { id: 67, code: 'S3-15A12', building: 'S3', password: '111555', is_samsung: true, status: 'available' },
  { id: 68, code: 'S3-1616', building: 'S3', password: '382838', is_samsung: false, status: 'available' },
  { id: 69, code: 'S3-1701', building: 'S3', password: '240302', is_samsung: false, status: 'available' },
  { id: 70, code: 'S3-1811', building: 'S3', password: '333666', is_samsung: true, status: 'available' },
  { id: 71, code: 'S3-1901', building: 'S3', password: '111119', is_samsung: false, status: 'available' },
  { id: 72, code: 'S3-2012', building: 'S3', password: '111222', is_samsung: true, status: 'available' },
  { id: 73, code: 'S3-2301', building: 'S3', password: '230100', is_samsung: false, status: 'available' },
  { id: 74, code: 'S3-2406', building: 'S3', password: '240600', is_samsung: false, status: 'available' },
  { id: 75, code: 'S3-2412', building: 'S3', password: '333666', is_samsung: true, status: 'available' },
  { id: 76, code: 'S3-2712', building: 'S3', password: '271200', is_samsung: false, status: 'available' },
  { id: 77, code: 'S3-2909', building: 'S3', password: '000999', is_samsung: false, status: 'available' },
  { id: 78, code: 'S3-2911', building: 'S3', password: '291100', is_samsung: false, status: 'available' },
  { id: 79, code: 'S3-3001', building: 'S3', password: '300100', is_samsung: false, status: 'available' },
  { id: 80, code: 'S3-3015', building: 'S3', password: '305305', is_samsung: true, status: 'available' },
  { id: 81, code: 'S3-3316', building: 'S3', password: '331600', is_samsung: false, status: 'available' },
  { id: 82, code: 'S3-3409', building: 'S3', password: '399999', is_samsung: false, status: 'available' },
  { id: 83, code: 'S3-3411', building: 'S3', password: '123468', is_samsung: true, status: 'available' },
  { id: 84, code: 'S3-3511', building: 'S3', password: '351168', is_samsung: true, status: 'available' },
  { id: 85, code: 'S3-3512', building: 'S3', password: '333.222', is_samsung: true, status: 'available' },
  { id: 86, code: 'S3-3612', building: 'S3', password: '363663', is_samsung: true, status: 'available' },
  { id: 87, code: 'S3-3702', building: 'S3', password: '370200', is_samsung: false, status: 'available' },
  { id: 88, code: 'S3-3808A', building: 'S3', password: '123456', is_samsung: false, status: 'available' },
  { id: 89, code: 'S3-3906', building: 'S3', password: '336699', is_samsung: false, status: 'available' },
  { id: 90, code: 'S3-3918', building: 'S3', password: '838386', is_samsung: false, status: 'available' },
  { id: 91, code: 'B-2102', building: 'B', password: '456456*', is_samsung: false, status: 'available' },
  { id: 92, code: 'R4-2519', building: 'HCM', password: '251900', is_samsung: false, status: 'available' },
  { id: 93, code: 'R5-2423', building: 'HCM', password: '242300', is_samsung: false, status: 'available' },
  { id: 94, code: 'R6A-0505', building: 'R6A', password: '111.000.222.33', is_samsung: false, status: 'available' },
  { id: 95, code: 'R6A-2806', building: 'R6A', password: '2222.333.333', is_samsung: false, status: 'available' }
].map(r => ({ ...r, room_type: roomTypeByCodeMap[r.code] || '2 ngủ' }));

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
  // Initialize mock data if not already set
  const existingStaff = localStorage.getItem('vistay_mock_staff');
  if (!existingStaff || JSON.parse(existingStaff).length === 0) {
    localStorage.setItem('vistay_mock_staff', JSON.stringify(MOCK_STAFF));
  }
  let existingRooms = localStorage.getItem('vistay_mock_apartments');
  if (!existingRooms || JSON.parse(existingRooms).length === 0 || JSON.parse(existingRooms).length !== PROVIDED_ROOMS.length) {
    localStorage.setItem('vistay_mock_apartments', JSON.stringify(PROVIDED_ROOMS));
  }

  let localStaff = getLocalData('vistay_mock_staff', MOCK_STAFF);
  let localRooms = getLocalData('vistay_mock_apartments', PROVIDED_ROOMS);
  let localWork = getLocalData('vistay_mock_work', []);
  let localSalary = getLocalData('vistay_mock_salary', []);

  // GET /config — Trả về cấu hình mặc định
  if (endpoint === '/config' && method === 'GET') {
    return Promise.resolve({
      SALARY: {
        DEFAULT_BASE_SALARY: 5000000,
        SPECIAL_BASE_SALARY: 7000000,
        SPECIAL_STAFF: ['Lộc', 'Diệu'],
      },
      ROOM_RATES: {
        'ss_luu': { '1 ngủ': 30000, '2 ngủ': 60000, '3 ngủ': 100000, '4 ngủ': 120000 },
        'out': { '1 ngủ': 45000, '2 ngủ': 90000, '3 ngủ': 150000, '4 ngủ': 180000 },
        'tong_ve_sinh': { '1 ngủ': 45000, '2 ngủ': 90000, '3 ngủ': 150000, '4 ngủ': 180000 },
        DEFAULT: 50000
      },
      TECH_PRICES: { 1: 50000, 2: 100000, 3: 150000, 4: 250000 }
    });
  }

  // GET /apartments/notifications — Mock thông báo rỗng
  if (endpoint === '/apartments/notifications' && method === 'GET') {
    return Promise.resolve([]);
  }

  // GET /apartments/status-timeline — Mock timeline dữ liệu
  if (endpoint.startsWith('/apartments/status-timeline') && method === 'GET') {
    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const mode = params.get('mode') || 'daily';
    const daysParam = parseInt(params.get('days')) || 15;
    const monthParam = params.get('month') ? parseInt(params.get('month')) : null;
    const yearParam = params.get('year') ? parseInt(params.get('year')) : null;

    const labels = [];
    const todayDate = new Date();
    let todayIndex = 0;

    if (mode === 'hourly') {
      for (let h = 0; h < 24; h++) {
        labels.push(`${String(h).padStart(2, '0')}h`);
      }
      todayIndex = todayDate.getHours();
    } else if (monthParam && yearParam) {
      const daysInMonth = new Date(yearParam, monthParam, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dd = String(d).padStart(2, '0');
        const mm = String(monthParam).padStart(2, '0');
        labels.push(`${dd}/${mm}`);
      }
      if (todayDate.getFullYear() === yearParam && todayDate.getMonth() + 1 === monthParam) {
        todayIndex = todayDate.getDate() - 1;
      } else {
        todayIndex = -1;
      }
    } else {
      todayIndex = 0;
      for (let d = 0; d < daysParam; d++) {
        const dt = new Date(Date.now() + d * 86400000);
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        labels.push(`${dd}/${mm}`);
      }
    }

    const rooms = localRooms.map(room => {
      const currentStatus = room.status || 'available';
      const segments = [{ status: currentStatus, start_index: 0, span: labels.length }];
      return {
        id: room.id,
        code: room.code,
        building: room.building,
        current_status: currentStatus,
        segments,
        assignments: [],
        maintenance_duration: room.maintenance_duration || null,
      };
    });

    return Promise.resolve({ labels, rooms, todayIndex, totalDays: labels.length });
  }

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
      const total = localRooms.length || 95;
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
      return Promise.resolve({ byBuilding: [], totals: stats });
    }

    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const status = params.get('status');
    const search = params.get('search');

    let filtered = [...localRooms];
    if (status && status !== 'all') filtered = filtered.filter(r => r.status === status);
    if (search) filtered = filtered.filter(r => r.code.toLowerCase().includes(search.toLowerCase()));

    // Passwords are visible to all authenticated users (matching backend behavior)

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

  // Run ALL independent API calls in parallel for maximum speed
  const statsEndpoint = isTechStaff ? `/tasks/stats/${currentUser.staffId}` : `/work/stats/${currentUser.staffId}`;
  const apartmentQuery = new URLSearchParams(apartmentFilters).toString();

  const [tasks, stats, salary, customTasks, apartments, apartmentStats, timelineResult] = await Promise.allSettled([
    apiCall('/work/today'),
    apiCall(statsEndpoint),
    apiCall(`/salary/${currentUser.staffId}`),
    apiCall('/tasks/today'),
    apiCall(`/apartments?${apartmentQuery}`),
    apiCall('/apartments/stats'),
    apiCall(`/apartments/status-timeline?building=all&mode=${empTimelineMode}&days=${empTimelineDays}&month=${empTimelineMonth}&year=${empTimelineYear}`),
  ]);

  // Render results that succeeded; skip failures silently
  if (tasks.status === 'fulfilled') renderTaskList(tasks.value);

  if (stats.status === 'fulfilled') {
    document.getElementById('statTodayTotal').textContent = stats.value.today_total;
    document.getElementById('statTodayCompleted').textContent = stats.value.today_completed;
    document.getElementById('statMonthCompleted').textContent = stats.value.month_completed;
  }

  if (salary.status === 'fulfilled') renderSalaryEstimate(salary.value);
  if (customTasks.status === 'fulfilled') renderCustomTaskList(customTasks.value);

  // Render apartment data
  if (apartments.status === 'fulfilled') {
    apartmentList = apartments.value;
  } else {
    apartmentList = [];
  }
  if (apartmentStats.status === 'fulfilled') {
    apartmentStatsData = apartmentStats.value.byBuilding || [];
    renderEmployeeApartmentStats(apartmentStats.value.totals);
  }
  renderEmployeeApartmentSummaryTable();
  renderEmployeeApartmentGrid();

  // Render timeline
  if (timelineResult.status === 'fulfilled') {
    timelineData = timelineResult.value;
    renderEmpApartmentStatusTimeline(timelineResult.value);
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
      const hasPartner = task.has_role2_partner && task.has_role2_partner > 0;
      
      let partnerCheckboxHtml = '';
      if (task.assigned_role === 1 && hasPartner) {
        partnerCheckboxHtml = `
          <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 6px; cursor: pointer; user-select: none;">
            <input type="checkbox" id="partner-worked-${task.id}" checked style="width: 14px; height: 14px; cursor: pointer;">
            <span>Người làm 2 có đi làm cùng</span>
          </label>
        `;
      }

      if (needsPhoto) {
        actionHtml = `
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            ${partnerCheckboxHtml}
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="file" id="file-${task.id}" accept="image/*" capture="environment" style="display: none;" onchange="onFileSelected(${task.id})">
              <button class="btn btn-save" onclick="document.getElementById('file-${task.id}').click()" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #eab308, #ca8a04); border: none;">
                <span id="lbl-${task.id}">📸 Chụp ảnh</span>
              </button>
              <button class="btn btn-save" onclick="completeWork(${task.id}, true)" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669);">✓ Hoàn thành</button>
            </div>
          </div>
        `;
      } else {
        actionHtml = `
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            ${partnerCheckboxHtml}
            <button class="btn btn-save" onclick="completeWork(${task.id}, false)" style="padding: 6px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #10b981, #059669);">✓ Hoàn thành</button>
          </div>
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

  const partnerCheckbox = document.getElementById(`partner-worked-${id}`);
  if (partnerCheckbox) {
    formData.append('partner_worked', partnerCheckbox.checked);
  }

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
  const jobSelect = document.getElementById('selfAssignTitle');
  if (jobSelect && jobSelect.options.length <= 1) {
    jobSelect.innerHTML = buildTechJobDropdownHTML();
  }
  document.getElementById('selfAssignTitle').value = '';
  document.getElementById('selfAssignDesc').value = '';
  const levelDisplay = document.getElementById('selfAssignLevelDisplay');
  if (levelDisplay) levelDisplay.innerHTML = '<span style="color: var(--text-muted);">Chọn công việc để xem cấp độ</span>';
  document.getElementById('selfAssignModal').classList.add('active');
}

function closeSelfAssignModal() {
  document.getElementById('selfAssignModal').classList.remove('active');
}

// AI tự động gợi ý cấp độ từ mô tả lỗi (employee self-assign)
function onSelfAssignDescInput() {
  const descInput = document.getElementById('selfAssignDesc');
  const suggestDisplay = document.getElementById('selfAssignAiSuggest');
  if (!descInput || !suggestDisplay) return;

  const desc = descInput.value.trim();
  if (!desc) {
    suggestDisplay.innerHTML = '';
    return;
  }

  const result = assessTaskDifficulty(desc);
  if (result) {
    const color = TECH_LEVEL_COLORS[result.level] || '#888';
    const stars = TECH_LEVEL_STARS[result.level] || '';
    suggestDisplay.innerHTML = `<span style="color: ${color}; font-weight: 600;">🤖 AI gợi ý: ${stars} Cấp ${result.level} — ${result.taskName}</span>
      <button onclick="applySelfAssignAISuggestion(${result.level}, '${result.taskName.replace(/'/g, "\\'")}')" style="margin-left: 6px; padding: 1px 6px; font-size: 0.75rem; background: ${color}; color: white; border: none; border-radius: 4px; cursor: pointer;">Áp dụng</button>`;
  } else {
    suggestDisplay.innerHTML = '<span style="color: var(--text-muted);">Nhập mô tả để AI gợi ý cấp độ</span>';
  }
}

function applySelfAssignAISuggestion(level, taskName) {
  const jobSelect = document.getElementById('selfAssignTitle');
  if (!jobSelect) return;

  const options = jobSelect.options;
  for (let i = 0; i < options.length; i++) {
    if (options[i].value === taskName) {
      jobSelect.selectedIndex = i;
      onSelfAssignJobSelected();
      return;
    }
  }

  // If exact match not found, just update level display
  const display = document.getElementById('selfAssignLevelDisplay');
  if (display) {
    const color = TECH_LEVEL_COLORS[level] || '#888';
    const bg = TECH_LEVEL_BG[level] || 'transparent';
    const price = TECH_LEVEL_PRICES[level] || 0;
    const priceStr = new Intl.NumberFormat('vi-VN').format(price);
    const stars = TECH_LEVEL_STARS[level] || '';
    const name = TECH_LEVEL_NAMES[level] || '';
    display.innerHTML = `
      <span style="background: ${bg}; color: ${color}; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">
        ${stars} Cấp ${level} — ${name}
      </span>
      <span style="margin-left: 8px; font-weight: 700; color: ${color}; font-size: 0.9rem;">${priceStr}đ</span>
    `;
  }
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
async function initializePage() {
  initTheme();
  checkAuth();
  await loadGlobalConfig();
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
  if (localStorage.getItem('vistay_mode') === 'local') {
    fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store'
    }).then(res => {
      if (res.ok) {
        console.log("Server is online. Switching back to backend mode.");
        localStorage.setItem('vistay_mode', 'backend');
        const offlineBanner = document.getElementById('offlineAlertBanner');
        if (offlineBanner) offlineBanner.style.display = 'none';
        
        if (token === 'local_fallback_token') {
          localStorage.removeItem('vistay_token');
          localStorage.removeItem('vistay_user');
          localStorage.removeItem('vistay_mode');
          window.location.href = 'index.html';
        } else {
          initializePage();
        }
      } else {
        // Server responded (even with error) — it's reachable
        console.log("Server is reachable (status " + res.status + "). Switching back to backend mode.");
        localStorage.setItem('vistay_mode', 'backend');
        const offlineBanner = document.getElementById('offlineAlertBanner');
        if (offlineBanner) offlineBanner.style.display = 'none';
        
        if (token === 'local_fallback_token') {
          localStorage.removeItem('vistay_token');
          localStorage.removeItem('vistay_user');
          localStorage.removeItem('vistay_mode');
          window.location.href = 'index.html';
        } else {
          initializePage();
        }
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
  // Auto-refresh every 30s (debounced to prevent rapid re-renders)
  let _dashTimer = null;
  setInterval(() => {
    if (_dashTimer) clearTimeout(_dashTimer);
    _dashTimer = setTimeout(loadDashboard, 300);
  }, 30000);

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

    // Fetch apartments + stats in parallel
    const [apartments, stats] = await Promise.allSettled([
      apiCall(`/apartments?${query}`),
      apiCall('/apartments/stats'),
    ]);

    if (apartments.status === 'fulfilled') {
      apartmentList = apartments.value;
    } else {
      apartmentList = [];
    }

    if (stats.status === 'fulfilled') {
      apartmentStatsData = stats.value.byBuilding || [];
      renderEmployeeApartmentStats(stats.value.totals);
    }

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
        <span class="pw-text" id="emp-pw-${room.id}" style="font-family: monospace; font-size: 0.8rem; font-weight: 700; flex: 1;">••••••</span>
        <button class="pw-toggle-btn" onclick="event.stopPropagation(); toggleEmpPasswordDisplay(${room.id})" style="background: transparent; border: none; cursor: pointer; padding: 0 4px; font-size: 0.8rem;">👁️</button>
        ${isPrivileged ? `<button class="pw-edit-btn" onclick="event.stopPropagation(); openEmpPasswordModal(${room.id}, '${room.code}')" style="background: transparent; border: none; cursor: pointer; padding: 0 4px; font-size: 0.75rem; color: var(--accent-amber);">✏️</button>` : ''}
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

function toggleEmpPasswordDisplay(roomId) {
  const textEl = document.getElementById(`emp-pw-${roomId}`);
  if (!textEl) return;
  const room = apartmentList.find(r => r.id === roomId);
  if (!room) return;
  if (textEl.textContent === '••••••') {
    textEl.textContent = room.password;
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

function openEmpPasswordModal(roomId, code) {
  selectedRoomId = roomId;
  const room = apartmentList.find(r => r.id === roomId);
  const password = room ? room.password : '—';
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
          label: 'Tổng vệ sinh',
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
          label: 'Tổng vệ sinh',
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
let empTimelineMonth = new Date().getMonth() + 1;
let empTimelineYear = new Date().getFullYear();
let empTimelineDays = 30;

function changeEmpTimelineMonth(delta) {
  empTimelineMonth += delta;
  if (empTimelineMonth > 12) { empTimelineMonth = 1; empTimelineYear++; }
  if (empTimelineMonth < 1) { empTimelineMonth = 12; empTimelineYear--; }
  loadEmpApartmentStatusTimeline();
}

function setEmpTimelineDays(days) {
  empTimelineDays = days;
  loadEmpApartmentStatusTimeline();
}

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

    const params = new URLSearchParams({
      building: 'all',
      mode: empTimelineMode,
      days: empTimelineDays,
      month: empTimelineMonth,
      year: empTimelineYear
    });
    const data = await apiCall(`/apartments/status-timeline?${params}`);
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
    case 'maintenance': return 'Tổng vệ sinh';
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

  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  const dateHeaderHtml = `
    <div class="timeline-header">
      <div class="timeline-room-head">Căn hộ</div>
      <div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 4px; flex-wrap: nowrap;">
          <button class="tl-mode-btn" onclick="changeEmpTimelineMonth(-1)" style="padding: 2px 6px; font-size: 0.7rem;">◀</button>
          <span style="font-size: 0.78rem; font-weight: 600; color: var(--accent-amber); white-space: nowrap;">Tháng ${empTimelineMonth}/${empTimelineYear}</span>
          <button class="tl-mode-btn" onclick="changeEmpTimelineMonth(1)" style="padding: 2px 6px; font-size: 0.7rem;">▶</button>
          <span style="color: var(--text-muted); font-size: 0.65rem;">|</span>
          <button class="tl-mode-btn${empTimelineDays === 15 ? ' active' : ''}" onclick="setEmpTimelineDays(15)" style="padding: 2px 6px; font-size: 0.68rem;">15 ngày</button>
          <button class="tl-mode-btn${empTimelineDays === 30 ? ' active' : ''}" onclick="setEmpTimelineDays(30)" style="padding: 2px 6px; font-size: 0.68rem;">30 ngày</button>
        </div>
        <div class="timeline-date-row" style="grid-template-columns: repeat(${labels.length}, minmax(14px, 1fr));">
          ${labels.map((label, idx) => {
            const isToday = idx === data.todayIndex ? 'is-today' : '';
            return `<div class="timeline-date-cell ${isToday}">${label}</div>`;
          }).join('')}
        </div>
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
            statusLabel = `Tổng vệ sinh (dự kiến ${room.maintenance_duration} giờ)`;
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
            <div class="timeline-track" style="--bucket-count: ${labels.length}; grid-template-columns: repeat(${labels.length}, minmax(14px, 1fr));">
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
  // Tự động cuộn "Hôm nay" vào chính giữa màn hình
  setTimeout(() => {
    const scrollContainer = container.closest('.timeline-scroll');
    if (scrollContainer) {
      const todayCell = scrollContainer.querySelector('.timeline-date-cell.is-today');
      if (todayCell) {
        const offsetLeft = todayCell.offsetLeft;
        scrollContainer.scrollLeft = offsetLeft - scrollContainer.offsetWidth / 2;
      }
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

      let _sseDebounce = null;
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Hiển thị Toast thông báo cho nhân viên nếu có tin nhắn chi tiết
          if (data.message) {
            const type = (data.action === 'reject' || data.action === 'reject_completed') ? 'warning' : 'success';
            showToast(data.message, type);
          }

          // Debounce: batch rapid SSE events into single reload (500ms)
          if (typeof loadDashboard === 'function') {
            if (_sseDebounce) clearTimeout(_sseDebounce);
            _sseDebounce = setTimeout(loadDashboard, 500);
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

// ===== DEDICATED TECH STAFF FUNCTIONS =====
async function loadEmployeeTechTasks() {
  const section = document.getElementById('techStaffSection');
  const container = document.getElementById('employeeTechTasksList');
  if (!section || !container) return;

  if (!currentUser || !currentUser.techRole) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  try {
    const tasks = await apiCall(`/tech/tasks?staff_id=${currentUser.staffId}`);
    
    if (!tasks || tasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.88rem;">
          🎉 Bạn không có công việc kỹ thuật/bảo trì nào cần xử lý.
        </div>
      `;
      return;
    }

    const priorityLabels = {
      low: 'Thấp', medium: 'Trung bình', high: 'Cao', urgent: '🔥 Khẩn cấp'
    };

    const statusBadges = {
      pending: '<span style="background: rgba(245,158,11,0.15); color: #d97706; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">⏳ Chờ xử lý</span>',
      in_progress: '<span style="background: rgba(59,130,246,0.15); color: #2563eb; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">🔧 Đang sửa</span>',
      completed: '<span style="background: rgba(16,185,129,0.15); color: #059669; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">🟢 Hoàn thành</span>'
    };

    container.innerHTML = tasks.map(t => {
      const issueName = t.custom_issue_name || t.category_name || 'Công việc kỹ thuật';
      return `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span style="font-weight: 800; font-size: 1.05rem; color: var(--accent-purple);">🏢 ${t.apartment_code}</span>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-primary); margin-top: 2px;">
                ${issueName}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                Cấp độ: ${t.difficulty_label || 'Dễ'} • Mức ưu tiên: ${priorityLabels[t.priority] || 'Trung bình'}
              </div>
            </div>
            <div>${statusBadges[t.status] || ''}</div>
          </div>

          ${t.description ? `
            <div style="font-size: 0.82rem; color: var(--text-secondary); background: rgba(0,0,0,0.02); padding: 6px 10px; border-radius: 6px;">
              ${t.description}
            </div>
          ` : ''}

          <!-- Media Files (2 Photos + 1 Video) -->
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            ${t.photo1_url ? `
              <a href="${t.photo1_url}" target="_blank" style="flex: 1; height: 70px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); display: block;">
                <img src="${t.photo1_url}" style="width: 100%; height: 100%; object-fit: cover;">
              </a>
            ` : ''}
            ${t.photo2_url ? `
              <a href="${t.photo2_url}" target="_blank" style="flex: 1; height: 70px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); display: block;">
                <img src="${t.photo2_url}" style="width: 100%; height: 100%; object-fit: cover;">
              </a>
            ` : ''}
            ${t.video_url ? `
              <div style="flex: 1; height: 70px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); background: #000;">
                <video src="${t.video_url}" style="width: 100%; height: 100%; object-fit: cover;" controls></video>
              </div>
            ` : ''}
          </div>

          <!-- Actions -->
          <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 4px;">
            ${t.status === 'pending' ? `
              <button onclick="updateEmployeeTechTaskStatus(${t.id}, 'in_progress')" class="btn" style="padding: 6px 12px; font-weight: 600; font-size: 0.8rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">🔧 Nhận việc & Bắt đầu sửa</button>
            ` : ''}
            ${t.status === 'in_progress' ? `
              <button onclick="updateEmployeeTechTaskStatus(${t.id}, 'completed')" class="btn" style="padding: 6px 12px; font-weight: 600; font-size: 0.8rem; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">🟢 Báo Hoàn thành</button>
            ` : ''}
          </div>

        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load employee tech tasks:', err);
  }
}

async function updateEmployeeTechTaskStatus(taskId, status) {
  try {
    await apiCall(`/tech/tasks/${taskId}/status`, 'PUT', { status });
    showToast('✅ Đã cập nhật trạng thái công việc kỹ thuật!');
    loadEmployeeTechTasks();
  } catch (err) {
    console.error('Update status error:', err);
    showToast('❌ Lỗi cập nhật trạng thái.');
  }
}

// ===== THEME TOGGLE =====
function initTheme() {
  const saved = localStorage.getItem('vistay_theme') || 'dark';
  if (saved === 'light') {
    document.documentElement.classList.add('light-theme');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = '☀️';
  }
}

function toggleTheme() {
  document.documentElement.classList.toggle('light-theme');
  const isLight = document.documentElement.classList.contains('light-theme');
  localStorage.setItem('vistay_theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
}

// ===== PWA =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

