// ===================================================================
// HỆ THỐNG QUẢN LÝ PHÂN CÔNG NHÂN VIÊN - app.js
// ===================================================================

// ===== PHASE 1: DATA MODEL (Issue #1) =====
const DEFAULT_STAFF = [
  { id: 1, name: 'Liên',   defaultName: 'Liên',   type: 'full-time', roomRole: 1, techRole: 0 },
  { id: 2, name: 'Thiên',  defaultName: 'Thiên',  type: 'full-time', roomRole: 2, techRole: 1 },
  { id: 3, name: 'Thương', defaultName: 'Thương', type: 'full-time', roomRole: 1, techRole: 0 },
  { id: 4, name: 'Vân',    defaultName: 'Vân',    type: 'full-time', roomRole: 2, techRole: 0 },
  { id: 5, name: 'Diệu',  defaultName: 'Diệu',  type: 'full-time', roomRole: 2, techRole: 0 },
  { id: 6, name: 'Hoàn',   defaultName: 'Hoàn',   type: 'full-time', roomRole: 1, techRole: 0 },
  { id: 7, name: 'Nhân viên Part-time 1', defaultName: 'Nhân viên Part-time 1', type: 'part-time', roomRole: 2, techRole: 0 },
  { id: 8, name: 'Nhân viên Part-time 2', defaultName: 'Nhân viên Part-time 2', type: 'part-time', roomRole: 0, techRole: 0 },
];

// ===== ROOM DATABASE (150 Rooms) =====
const ROOM_TYPES = ['Standard', 'Superior', 'Deluxe', 'Suite', 'VIP'];
const ROOM_STATUSES = ['available', 'occupied', 'cleaning', 'maintenance'];
const ROOM_STATUS_LABELS = {
  available: 'Trống',
  occupied: 'Có khách',
  cleaning: 'Đang dọn',
  maintenance: 'Bảo trì',
};
const ROOM_STATUS_ICONS = {
  available: '🟢',
  occupied: '🔴',
  cleaning: '🧹',
  maintenance: '🔧',
};

function generateRooms() {
  const rooms = [];
  let id = 1;
  const floors = 10;
  const roomsPerFloor = 15;

  // Distribution of room types per floor
  // Floors 1-3: mostly Standard/Superior
  // Floors 4-6: mix of Superior/Deluxe
  // Floors 7-8: Deluxe/Suite
  // Floors 9-10: Suite/VIP
  const floorTypeWeights = {
    1:  ['Standard','Standard','Standard','Standard','Standard','Standard','Standard','Standard','Standard','Superior','Superior','Superior','Superior','Superior','Superior'],
    2:  ['Standard','Standard','Standard','Standard','Standard','Standard','Standard','Superior','Superior','Superior','Superior','Superior','Superior','Superior','Deluxe'],
    3:  ['Standard','Standard','Standard','Standard','Standard','Superior','Superior','Superior','Superior','Superior','Superior','Deluxe','Deluxe','Deluxe','Deluxe'],
    4:  ['Standard','Standard','Standard','Superior','Superior','Superior','Superior','Superior','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Suite'],
    5:  ['Superior','Superior','Superior','Superior','Superior','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Suite','Suite','Suite'],
    6:  ['Superior','Superior','Superior','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Suite','Suite','Suite','Suite','Suite'],
    7:  ['Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Suite','Suite','Suite','Suite','Suite','Suite','VIP'],
    8:  ['Deluxe','Deluxe','Deluxe','Deluxe','Deluxe','Suite','Suite','Suite','Suite','Suite','Suite','Suite','VIP','VIP','VIP'],
    9:  ['Deluxe','Deluxe','Suite','Suite','Suite','Suite','Suite','Suite','Suite','VIP','VIP','VIP','VIP','VIP','VIP'],
    10: ['Suite','Suite','Suite','Suite','Suite','VIP','VIP','VIP','VIP','VIP','VIP','VIP','VIP','VIP','VIP'],
  };

  for (let floor = 1; floor <= floors; floor++) {
    for (let r = 1; r <= roomsPerFloor; r++) {
      const roomNumber = floor * 100 + r;
      const roomType = floorTypeWeights[floor][r - 1];

      rooms.push({
        id: id++,
        number: String(roomNumber),
        floor: floor,
        type: roomType,
        status: 'available', // Default: all available
      });
    }
  }

  return rooms;
}

const DEFAULT_ROOMS = generateRooms();

// ===== STATE =====
let staffList = [];
let selectedStaffId = null;
let roomList = [];
let roomFilters = {
  floor: 'all',
  type: 'all',
  status: 'all',
  search: '',
};

// ===== LOCALSTORAGE =====
const STORAGE_KEY = 'staffAssignments';
const ROOMS_STORAGE_KEY = 'roomDatabase';

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(staffList));
}

function saveRoomsToStorage() {
  localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(roomList));
}

function loadFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      staffList = JSON.parse(saved);
      staffList = staffList.map((s, i) => ({
        ...DEFAULT_STAFF[i],
        ...s,
      }));
    } catch {
      staffList = JSON.parse(JSON.stringify(DEFAULT_STAFF));
    }
  } else {
    staffList = JSON.parse(JSON.stringify(DEFAULT_STAFF));
  }

  // Load rooms
  const savedRooms = localStorage.getItem(ROOMS_STORAGE_KEY);
  if (savedRooms) {
    try {
      roomList = JSON.parse(savedRooms);
    } catch {
      roomList = JSON.parse(JSON.stringify(DEFAULT_ROOMS));
    }
  } else {
    roomList = JSON.parse(JSON.stringify(DEFAULT_ROOMS));
  }
}

// ===== PHASE 3: AUTO-ROLE MAPPER (Issue #5) =====

/**
 * Hàm 1: Nếu Kỹ thuật == 1 → Tự động set Buồng phòng = 2
 * Hàm 2: Nếu Buồng phòng == 1 → Tự động set Kỹ thuật = 0
 */
function setRoomRole(staffId, value) {
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) return;

  staff.roomRole = value;

  // Hàm 2: Buồng phòng Chính → Kỹ thuật = 0
  if (value === 1) {
    staff.techRole = 0;
  }

  saveToStorage();
}

function setTechRole(staffId, value) {
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) return;

  staff.techRole = value;

  // Hàm 1: Kỹ thuật Chính → Buồng phòng = 2 (Phụ)
  if (value === 1) {
    staff.roomRole = 2;
  }

  saveToStorage();
}

// ===== Issue #6: PART-TIME NAME MANAGEMENT =====

function updatePartTimeName(staffId, newName) {
  const staff = staffList.find(s => s.id === staffId);
  if (!staff || staff.type !== 'part-time') return;

  staff.name = newName.trim() || staff.defaultName;
  saveToStorage();
}

function resetPartTimeNames() {
  staffList.forEach(s => {
    if (s.type === 'part-time') {
      s.name = s.defaultName;
    }
  });
  saveToStorage();
}

// ===== HELPERS =====

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

function getInitials(name) {
  const words = name.split(' ').filter(Boolean);
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
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

// ===== RENDERING =====

function renderStaffCard(staff, roleType) {
  const roleValue = roleType === 'room' ? staff.roomRole : staff.techRole;
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

function renderDashboard() {
  // Update date
  document.getElementById('currentDate').textContent = formatDate();

  // Render Room section
  const roomGrid = document.getElementById('roomGrid');
  roomGrid.innerHTML = staffList.map(s => renderStaffCard(s, 'room')).join('');

  // Render Tech section
  const techGrid = document.getElementById('techGrid');
  techGrid.innerHTML = staffList.map(s => renderStaffCard(s, 'tech')).join('');
}

// ===== ASSIGNMENT MODAL (Issue #4) =====

function openAssignModal(staffId) {
  selectedStaffId = staffId;
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) return;

  const modal = document.getElementById('assignModal');
  const avatarClass = staff.type === 'full-time' ? 'fulltime' : 'parttime';
  const initials = getInitials(staff.name);

  // Update preview
  document.getElementById('modalAvatar').className = `staff-avatar ${avatarClass}`;
  document.getElementById('modalAvatar').textContent = initials;
  document.getElementById('modalName').textContent = staff.name;
  document.getElementById('modalType').textContent = staff.type;

  // Set current values
  const roomRadio = document.querySelector(`input[name="roomRole"][value="${staff.roomRole}"]`);
  const techRadio = document.querySelector(`input[name="techRole"][value="${staff.techRole}"]`);
  if (roomRadio) roomRadio.checked = true;
  if (techRadio) techRadio.checked = true;

  // Reset auto-notes
  updateAutoNotes();

  // Show modal
  modal.classList.add('active');
}

function closeAssignModal() {
  const modal = document.getElementById('assignModal');
  modal.classList.remove('active');
  selectedStaffId = null;
}

function saveAssignment() {
  if (selectedStaffId === null) return;

  const roomValue = parseInt(document.querySelector('input[name="roomRole"]:checked').value);
  const techValue = parseInt(document.querySelector('input[name="techRole"]:checked').value);

  // Apply with auto-role logic
  // We need to determine which one the user explicitly set
  // Apply tech first, then room (room overrides tech if both set to special values)
  const staff = staffList.find(s => s.id === selectedStaffId);
  
  // Direct set both values first
  staff.roomRole = roomValue;
  staff.techRole = techValue;

  // Then apply constraints
  if (techValue === 1) {
    staff.roomRole = 2; // Kỹ thuật chính → Buồng phòng phụ
  }
  if (roomValue === 1) {
    staff.techRole = 0; // Buồng phòng chính → Kỹ thuật = 0
  }

  saveToStorage();
  renderDashboard();
  closeAssignModal();
  showToast(`Đã cập nhật phân công cho ${staff.name}`);
}

function updateAutoNotes() {
  const roomChecked = document.querySelector('input[name="roomRole"]:checked');
  const techChecked = document.querySelector('input[name="techRole"]:checked');
  
  const roomNote = document.getElementById('roomAutoNote');
  const techNote = document.getElementById('techAutoNote');

  // Reset
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

// ===== RENAME MODAL (Issue #6) =====

function openRenameModal(staffId) {
  selectedStaffId = staffId;
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) return;

  const modal = document.getElementById('renameModal');
  const input = document.getElementById('renameInput');
  const label = document.getElementById('renameLabel');

  label.textContent = `Đổi tên cho: ${staff.defaultName}`;
  input.value = staff.name === staff.defaultName ? '' : staff.name;
  input.placeholder = staff.defaultName;

  modal.classList.add('active');
  setTimeout(() => input.focus(), 300);
}

function closeRenameModal() {
  document.getElementById('renameModal').classList.remove('active');
  selectedStaffId = null;
}

function saveRename() {
  if (selectedStaffId === null) return;

  const input = document.getElementById('renameInput');
  const newName = input.value.trim();
  const staff = staffList.find(s => s.id === selectedStaffId);

  updatePartTimeName(selectedStaffId, newName);
  renderDashboard();
  closeRenameModal();
  showToast(`Đã đổi tên thành "${staff.name}"`, 'info');
}

function resetAllPartTimeNames() {
  resetPartTimeNames();
  renderDashboard();
  showToast('Đã reset tên tất cả nhân viên Part-time', 'warning');
}

// ===== ROOM LIST RENDERING =====

function getFilteredRooms() {
  return roomList.filter(room => {
    if (roomFilters.floor !== 'all' && room.floor !== parseInt(roomFilters.floor)) return false;
    if (roomFilters.type !== 'all' && room.type !== roomFilters.type) return false;
    if (roomFilters.status !== 'all' && room.status !== roomFilters.status) return false;
    if (roomFilters.search) {
      const q = roomFilters.search.toLowerCase();
      if (!room.number.includes(q) && !room.type.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function getRoomTypeClass(type) {
  switch (type) {
    case 'Standard': return 'type-standard';
    case 'Superior': return 'type-superior';
    case 'Deluxe': return 'type-deluxe';
    case 'Suite': return 'type-suite';
    case 'VIP': return 'type-vip';
    default: return '';
  }
}

function getRoomStatusClass(status) {
  switch (status) {
    case 'available': return 'status-available';
    case 'occupied': return 'status-occupied';
    case 'cleaning': return 'status-cleaning';
    case 'maintenance': return 'status-maintenance';
    default: return '';
  }
}

function renderRoomCard(room) {
  const statusClass = getRoomStatusClass(room.status);
  const typeClass = getRoomTypeClass(room.type);
  const statusLabel = ROOM_STATUS_LABELS[room.status];
  const statusIcon = ROOM_STATUS_ICONS[room.status];

  return `
    <div class="room-card ${statusClass} ${typeClass}" onclick="openRoomStatusModal(${room.id})" title="Phòng ${room.number} - ${room.type}">
      <div class="room-number">${room.number}</div>
      <div class="room-type-label">${room.type}</div>
      <div class="room-status-badge ${statusClass}">
        <span>${statusIcon}</span>
        <span>${statusLabel}</span>
      </div>
    </div>
  `;
}

function renderRoomStats() {
  const stats = {
    total: roomList.length,
    available: roomList.filter(r => r.status === 'available').length,
    occupied: roomList.filter(r => r.status === 'occupied').length,
    cleaning: roomList.filter(r => r.status === 'cleaning').length,
    maintenance: roomList.filter(r => r.status === 'maintenance').length,
  };

  const container = document.getElementById('roomStats');
  container.innerHTML = `
    <div class="stat-item stat-total">
      <span class="stat-num">${stats.total}</span>
      <span class="stat-label">Tổng phòng</span>
    </div>
    <div class="stat-item stat-available">
      <span class="stat-num">${stats.available}</span>
      <span class="stat-label">🟢 Trống</span>
    </div>
    <div class="stat-item stat-occupied">
      <span class="stat-num">${stats.occupied}</span>
      <span class="stat-label">🔴 Có khách</span>
    </div>
    <div class="stat-item stat-cleaning">
      <span class="stat-num">${stats.cleaning}</span>
      <span class="stat-label">🧹 Đang dọn</span>
    </div>
    <div class="stat-item stat-maintenance">
      <span class="stat-num">${stats.maintenance}</span>
      <span class="stat-label">🔧 Bảo trì</span>
    </div>
  `;
}

function renderFloorTabs() {
  const container = document.getElementById('floorTabs');
  let html = `<button class="floor-tab ${roomFilters.floor === 'all' ? 'active' : ''}" onclick="setFloorFilter('all')">Tất cả</button>`;
  for (let f = 1; f <= 10; f++) {
    html += `<button class="floor-tab ${roomFilters.floor === String(f) ? 'active' : ''}" onclick="setFloorFilter('${f}')">Tầng ${f}</button>`;
  }
  container.innerHTML = html;
}

function renderRoomList() {
  renderRoomStats();
  renderFloorTabs();

  const filtered = getFilteredRooms();
  const grid = document.getElementById('roomListGrid');
  const countEl = document.getElementById('filteredRoomCount');

  countEl.textContent = `Hiển thị ${filtered.length} / ${roomList.length} phòng`;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="room-empty">Không tìm thấy phòng nào phù hợp bộ lọc.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(r => renderRoomCard(r)).join('');
}

// ===== ROOM FILTERS =====

function setFloorFilter(value) {
  roomFilters.floor = value;
  renderRoomList();
}

function setRoomTypeFilter(value) {
  roomFilters.type = value;
  renderRoomList();
}

function setRoomStatusFilter(value) {
  roomFilters.status = value;
  renderRoomList();
}

function onRoomSearch(value) {
  roomFilters.search = value;
  renderRoomList();
}

// ===== ROOM STATUS MODAL =====

let selectedRoomId = null;

function openRoomStatusModal(roomId) {
  selectedRoomId = roomId;
  const room = roomList.find(r => r.id === roomId);
  if (!room) return;

  const modal = document.getElementById('roomStatusModal');
  document.getElementById('roomModalNumber').textContent = `Phòng ${room.number}`;
  document.getElementById('roomModalType').textContent = room.type;
  document.getElementById('roomModalFloor').textContent = `Tầng ${room.floor}`;

  // Set current status radio
  const radio = document.querySelector(`input[name="roomStatus"][value="${room.status}"]`);
  if (radio) radio.checked = true;

  modal.classList.add('active');
}

function closeRoomStatusModal() {
  document.getElementById('roomStatusModal').classList.remove('active');
  selectedRoomId = null;
}

function saveRoomStatus() {
  if (selectedRoomId === null) return;

  const newStatus = document.querySelector('input[name="roomStatus"]:checked').value;
  const room = roomList.find(r => r.id === selectedRoomId);
  if (!room) return;

  room.status = newStatus;
  saveRoomsToStorage();
  renderRoomList();
  closeRoomStatusModal();
  showToast(`Phòng ${room.number} → ${ROOM_STATUS_LABELS[newStatus]}`, 'info');
}

// ===== EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  renderDashboard();
  renderRoomList();

  // Close modals on overlay click
  document.getElementById('assignModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAssignModal();
  });

  document.getElementById('renameModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeRenameModal();
  });

  document.getElementById('roomStatusModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeRoomStatusModal();
  });

  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAssignModal();
      closeRenameModal();
      closeRoomStatusModal();
    }
  });

  // Radio change listeners for auto-notes
  document.querySelectorAll('input[name="roomRole"], input[name="techRole"]').forEach(radio => {
    radio.addEventListener('change', updateAutoNotes);
  });

  // Rename input Enter key
  document.getElementById('renameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveRename();
  });

  // Room search input
  document.getElementById('roomSearchInput').addEventListener('input', (e) => {
    onRoomSearch(e.target.value);
  });

  // Room filter selects
  document.getElementById('roomTypeFilter').addEventListener('change', (e) => {
    setRoomTypeFilter(e.target.value);
  });

  document.getElementById('roomStatusFilter').addEventListener('change', (e) => {
    setRoomStatusFilter(e.target.value);
  });
});
