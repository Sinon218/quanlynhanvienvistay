// ===================================================================
// Tech Tasks Routes — Quản lý Công việc Kỹ thuật Bảo trì
// ===================================================================
const express = require('express');
const { sql, getPool } = require('../db');
const { authenticate, requireManagerOrAdmin } = require('../middleware/auth');
const { sendEventToAll } = require('../sse');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ===== Upload config for tech tasks (2 photos + 1 video) =====
const techUploadDir = path.join(__dirname, '..', '..', 'ảnh dọn phòng của nhân viên', 'tech');
if (!fs.existsSync(techUploadDir)) {
  fs.mkdirSync(techUploadDir, { recursive: true });
}

const techStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, techUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'tech-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const techUpload = multer({
  storage: techStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for videos
  fileFilter: (req, file, cb) => {
    const imageTypes = /jpeg|jpg|png|webp|gif|heic|heif/;
    const videoTypes = /mp4|mov|avi|webm|mkv|3gp/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const isImage = file.mimetype && file.mimetype.startsWith('image/');
    const isVideo = file.mimetype && file.mimetype.startsWith('video/');
    
    if (isImage || imageTypes.test(ext) || isVideo || videoTypes.test(ext)) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận ảnh (jpg, png, webp) hoặc video (mp4, mov, avi, webm)!'));
  }
});

// ===== AI Fault Detection Engine =====
// Dataset-based pattern matching for tech issue classification
const AI_FAULT_DATASET = {
  keywords: {
    'điều hoà': { categoryPattern: 'điều hoà', defaultLevel: 1, suggestions: ['Vệ sinh điều hoà', 'Vệ sinh lưới điều hoà âm trần', 'Sửa điều hoà'] },
    'điều hòa': { categoryPattern: 'điều hoà', defaultLevel: 1, suggestions: ['Vệ sinh điều hoà', 'Vệ sinh lưới điều hoà âm trần', 'Sửa điều hoà'] },
    'máy lạnh': { categoryPattern: 'điều hoà', defaultLevel: 1, suggestions: ['Vệ sinh điều hoà', 'Sửa điều hoà'] },
    'tivi': { categoryPattern: 'tivi', defaultLevel: 4, suggestions: ['Sửa tivi'] },
    'tv': { categoryPattern: 'tivi', defaultLevel: 4, suggestions: ['Sửa tivi'] },
    'tủ lạnh': { categoryPattern: 'tủ lạnh', defaultLevel: 4, suggestions: ['Sửa tủ lạnh'] },
    'lò vi sóng': { categoryPattern: 'lò vi sóng', defaultLevel: 4, suggestions: ['Sửa lò vi sóng'] },
    'microwave': { categoryPattern: 'lò vi sóng', defaultLevel: 4, suggestions: ['Sửa lò vi sóng'] },
    'máy giặt': { categoryPattern: 'máy giặt', defaultLevel: 2, suggestions: ['Vệ sinh máy giặt cửa đứng', 'Vệ sinh máy giặt cửa ngang'] },
    'giặt cửa đứng': { categoryPattern: 'máy giặt cửa đứng', defaultLevel: 2, suggestions: ['Vệ sinh máy giặt cửa đứng'] },
    'giặt cửa ngang': { categoryPattern: 'máy giặt cửa ngang', defaultLevel: 3, suggestions: ['Vệ sinh máy giặt cửa ngang'] },
    'vòi sen': { categoryPattern: 'vòi sen', defaultLevel: 1, suggestions: ['Thay vòi sen'] },
    'bóng đèn': { categoryPattern: 'bóng đèn', defaultLevel: 1, suggestions: ['Thay bóng đèn'] },
    'đèn': { categoryPattern: 'đèn', defaultLevel: 1, suggestions: ['Thay bóng đèn', 'Treo đèn thả bàn ăn và đèn ốp'] },
    'ốc': { categoryPattern: 'ốc', defaultLevel: 1, suggestions: ['Siết ốc'] },
    'khoá': { categoryPattern: 'khoá', defaultLevel: 1, suggestions: ['Lắp khoá trong'] },
    'khóa': { categoryPattern: 'khoá', defaultLevel: 1, suggestions: ['Lắp khoá trong'] },
    'sơn': { categoryPattern: 'sơn', defaultLevel: 1, suggestions: ['Sơn tường', 'Sơn trần', 'Sơn bả', 'Sơn chân bàn ghế'] },
    'sơn tường': { categoryPattern: 'sơn tường', defaultLevel: 1, suggestions: ['Sơn tường'] },
    'sơn trần': { categoryPattern: 'sơn trần', defaultLevel: 2, suggestions: ['Sơn trần'] },
    'decal': { categoryPattern: 'decal', defaultLevel: 1, suggestions: ['Dán decal'] },
    'rèm': { categoryPattern: 'rèm', defaultLevel: 1, suggestions: ['Giặt rèm trắng', 'Vệ sinh rèm dày', 'Sửa rèm chống côn trùng'] },
    'rèm trắng': { categoryPattern: 'rèm trắng', defaultLevel: 1, suggestions: ['Giặt rèm trắng'] },
    'rèm dày': { categoryPattern: 'rèm dày', defaultLevel: 2, suggestions: ['Vệ sinh rèm dày'] },
    'côn trùng': { categoryPattern: 'côn trùng', defaultLevel: 4, suggestions: ['Sửa rèm chống côn trùng'] },
    'gián': { categoryPattern: 'gián', defaultLevel: 1, suggestions: ['Đặt thuốc gián'] },
    'bản lề': { categoryPattern: 'bản lề', defaultLevel: 2, suggestions: ['Xử lý bản lề cửa'] },
    'sofa': { categoryPattern: 'sofa', defaultLevel: 2, suggestions: ['Vệ sinh sofa và đệm'] },
    'đệm': { categoryPattern: 'đệm', defaultLevel: 2, suggestions: ['Vệ sinh sofa và đệm'] },
    'bồn cầu': { categoryPattern: 'bồn cầu', defaultLevel: 3, suggestions: ['Xử lý bồn cầu và cống thoát nước'] },
    'cống': { categoryPattern: 'cống', defaultLevel: 3, suggestions: ['Xử lý bồn cầu và cống thoát nước'] },
    'thoát nước': { categoryPattern: 'thoát nước', defaultLevel: 3, suggestions: ['Xử lý bồn cầu và cống thoát nước'] },
    'giàn phơi': { categoryPattern: 'giàn phơi', defaultLevel: 3, suggestions: ['Sửa giàn phơi'] },
    'ban công': { categoryPattern: 'ban công', defaultLevel: 3, suggestions: ['Thay miệng cửa ban công'] },
    'vòng bi': { categoryPattern: 'vòng bi', defaultLevel: 3, suggestions: ['Thay vòng bi'] },
    'quạt': { categoryPattern: 'quạt', defaultLevel: 1, suggestions: ['Vệ sinh quạt'] },
    'lọc nước': { categoryPattern: 'lọc nước', defaultLevel: 1, suggestions: ['Lắp bộ lọc nước'] },
    'chặn cửa': { categoryPattern: 'chặn cửa', defaultLevel: 1, suggestions: ['Dán chặn cửa'] },
    'silicon': { categoryPattern: 'silicon', defaultLevel: 2, suggestions: ['Silicon'] },
    'cây nước': { categoryPattern: 'cây nước', defaultLevel: 2, suggestions: ['Vệ sinh cây nước'] },
    'bàn ghế': { categoryPattern: 'bàn ghế', defaultLevel: 2, suggestions: ['Sơn chân bàn ghế'] },
    'âm trần': { categoryPattern: 'âm trần', defaultLevel: 3, suggestions: ['Vệ sinh lưới điều hoà âm trần'] },
    'rò rỉ': { categoryPattern: 'rò rỉ', defaultLevel: 3, suggestions: ['Xử lý bồn cầu và cống thoát nước'] },
    'nước chảy': { categoryPattern: 'nước chảy', defaultLevel: 3, suggestions: ['Xử lý bồn cầu và cống thoát nước'] },
  },
  levelLabels: {
    1: 'Dễ',
    2: 'Trung bình',
    3: 'Khó',
    4: 'Cần chuyên môn'
  }
};

function analyzeDescription(description) {
  if (!description || typeof description !== 'string') {
    return { matched: false, suggestions: [], confidence: 0 };
  }

  const text = description.toLowerCase().trim();
  const results = [];
  const seenSuggestions = new Set();

  // Sort keywords by length (longest first) for more specific matching
  const sortedKeywords = Object.keys(AI_FAULT_DATASET.keywords).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeywords) {
    if (text.includes(keyword.toLowerCase())) {
      const data = AI_FAULT_DATASET.keywords[keyword];
      for (const suggestion of data.suggestions) {
        if (!seenSuggestions.has(suggestion)) {
          seenSuggestions.add(suggestion);
          results.push({
            issueName: suggestion,
            difficultyLevel: data.defaultLevel,
            difficultyLabel: AI_FAULT_DATASET.levelLabels[data.defaultLevel],
            matchedKeyword: keyword,
            confidence: keyword.length >= 4 ? 0.85 : 0.6
          });
        }
      }
    }
  }

  // Sort by confidence DESC then by difficulty level ASC
  results.sort((a, b) => b.confidence - a.confidence || a.difficultyLevel - b.difficultyLevel);

  return {
    matched: results.length > 0,
    suggestions: results.slice(0, 5), // top 5
    confidence: results.length > 0 ? results[0].confidence : 0,
    analyzedText: text,
    recommendation: results.length > 0
      ? `Gợi ý: "${results[0].issueName}" (Cấp độ ${results[0].difficultyLevel} - ${results[0].difficultyLabel})`
      : 'Không tìm thấy lỗi phù hợp trong cơ sở dữ liệu. Vui lòng chọn thủ công hoặc chọn "Khác...".'
  };
}

// ============================================================
// GET /api/tech/categories — Lấy danh sách danh mục lỗi từ DB
// ============================================================
router.get('/categories', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT id, name, difficulty_level, difficulty_label, is_custom
        FROM TechIssueCategories
        WHERE is_active = 1
        ORDER BY difficulty_level ASC, name ASC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get tech categories error:', err);
    res.status(500).json({ error: 'Lỗi server khi tải danh mục lỗi.' });
  }
});

// ============================================================
// POST /api/tech/categories — Thêm lỗi mới (khi chọn "Khác...")
// ============================================================
router.post('/categories', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const { name, difficulty_level } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tên lỗi kỹ thuật.' });
    }

    const level = parseInt(difficulty_level) || 1;
    const levelLabels = { 1: 'Dễ', 2: 'Trung bình', 3: 'Khó', 4: 'Cần chuyên môn' };

    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name.trim())
      .input('level', sql.Int, level)
      .input('label', sql.NVarChar, levelLabels[level] || 'Dễ')
      .query(`
        INSERT INTO TechIssueCategories (name, difficulty_level, difficulty_label, is_custom)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.difficulty_level, INSERTED.difficulty_label
        VALUES (@name, @level, @label, 1)
      `);

    res.json({ message: 'Đã thêm danh mục lỗi mới.', category: result.recordset[0] });
  } catch (err) {
    console.error('Create tech category error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ============================================================
// GET /api/tech/tasks — Lấy danh sách công việc kỹ thuật
// ============================================================
router.get('/tasks', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const { status, staff_id } = req.query;

    let query = `
      SELECT t.*, 
        c.name AS category_name, c.difficulty_label,
        s.name AS assigned_staff_name,
        u.username AS created_by_username
      FROM TechTasks t
      LEFT JOIN TechIssueCategories c ON t.issue_category_id = c.id
      LEFT JOIN Staff s ON t.assigned_staff_id = s.id
      LEFT JOIN Users u ON t.created_by_user_id = u.id
      WHERE 1=1
    `;
    const request = pool.request();

    if (status) {
      query += ' AND t.status = @status';
      request.input('status', sql.VarChar, status);
    }

    if (staff_id) {
      query += ' AND t.assigned_staff_id = @staffId';
      request.input('staffId', sql.Int, parseInt(staff_id));
    }

    // If user is employee (not admin/manager), only show their assigned tasks
    if (req.user.role === 'employee' && req.user.staffId) {
      query += ' AND t.assigned_staff_id = @myStaffId';
      request.input('myStaffId', sql.Int, req.user.staffId);
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get tech tasks error:', err);
    res.status(500).json({ error: 'Lỗi server khi tải công việc kỹ thuật.' });
  }
});

// ============================================================
// POST /api/tech/tasks — Tạo công việc kỹ thuật mới
// Supports multipart form: photo1, photo2, video
// ============================================================
const techFields = techUpload.fields([
  { name: 'photo1', maxCount: 1 },
  { name: 'photo2', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

router.post('/tasks', authenticate, requireManagerOrAdmin, (req, res) => {
  techFields(req, res, async (uploadErr) => {
    if (uploadErr) {
      console.error('Tech upload error:', uploadErr);
      return res.status(400).json({ error: uploadErr.message || 'Lỗi tải file.' });
    }

    try {
      const { apartment_code, issue_category_id, custom_issue_name, description, 
              priority, assigned_staff_id, difficulty_level,
              photo1_base64, photo2_base64, video_base64 } = req.body;

      if (!apartment_code) {
        return res.status(400).json({ error: 'Vui lòng chọn căn hộ.' });
      }

      // Get file URLs or base64
      let photo1_url = null, photo2_url = null, video_url = null;
      
      if (req.files) {
        if (req.files.photo1 && req.files.photo1[0]) {
          photo1_url = '/uploads/tech/' + req.files.photo1[0].filename;
        }
        if (req.files.photo2 && req.files.photo2[0]) {
          photo2_url = '/uploads/tech/' + req.files.photo2[0].filename;
        }
        if (req.files.video && req.files.video[0]) {
          video_url = '/uploads/tech/' + req.files.video[0].filename;
        }
      }

      // Fallback to base64 if no file upload
      if (!photo1_url && photo1_base64) photo1_url = photo1_base64;
      if (!photo2_url && photo2_base64) photo2_url = photo2_base64;
      if (!video_url && video_base64) video_url = video_base64;

      const level = parseInt(difficulty_level) || 1;
      const pool = await getPool();

      const result = await pool.request()
        .input('apartmentCode', sql.VarChar, apartment_code)
        .input('issueCategoryId', sql.Int, issue_category_id ? parseInt(issue_category_id) : null)
        .input('customIssueName', sql.NVarChar, custom_issue_name || null)
        .input('description', sql.NVarChar, (description || '').trim())
        .input('difficultyLevel', sql.Int, level)
        .input('photo1', sql.NVarChar(sql.MAX), photo1_url)
        .input('photo2', sql.NVarChar(sql.MAX), photo2_url)
        .input('video', sql.NVarChar(sql.MAX), video_url)
        .input('priority', sql.VarChar, priority || 'medium')
        .input('assignedStaffId', sql.Int, assigned_staff_id ? parseInt(assigned_staff_id) : null)
        .input('createdByUserId', sql.Int, req.user.id)
        .query(`
          INSERT INTO TechTasks 
            (apartment_code, issue_category_id, custom_issue_name, description, difficulty_level,
             photo1_url, photo2_url, video_url, priority, status, assigned_staff_id, created_by_user_id)
          OUTPUT INSERTED.id
          VALUES 
            (@apartmentCode, @issueCategoryId, @customIssueName, @description, @difficultyLevel,
             @photo1, @photo2, @video, @priority, 'pending', @assignedStaffId, @createdByUserId)
        `);

      sendEventToAll({ type: 'TECH_TASK_UPDATE', action: 'create', taskId: result.recordset[0].id });
      res.json({ message: 'Tạo công việc kỹ thuật thành công.', id: result.recordset[0].id });
    } catch (err) {
      console.error('Create tech task error:', err);
      res.status(500).json({ error: 'Lỗi server khi tạo công việc.' });
    }
  });
});

// ============================================================
// PUT /api/tech/tasks/:id/status — Cập nhật trạng thái
// ============================================================
router.put('/tasks/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
    }

    const pool = await getPool();
    
    // Check if employee is assigned to this task
    if (req.user.role === 'employee') {
      const check = await pool.request()
        .input('id', sql.Int, parseInt(id))
        .input('staffId', sql.Int, req.user.staffId)
        .query('SELECT id FROM TechTasks WHERE id = @id AND assigned_staff_id = @staffId');
      
      if (check.recordset.length === 0) {
        return res.status(403).json({ error: 'Bạn không có quyền cập nhật công việc này.' });
      }
    }

    let extraFields = '';
    if (status === 'in_progress') extraFields = ', started_at = GETDATE()';
    if (status === 'completed') extraFields = ', completed_at = GETDATE()';

    await pool.request()
      .input('id', sql.Int, parseInt(id))
      .input('status', sql.VarChar, status)
      .query(`UPDATE TechTasks SET status = @status ${extraFields} WHERE id = @id`);

    sendEventToAll({ type: 'TECH_TASK_UPDATE', action: 'status_change', taskId: parseInt(id), status });
    res.json({ message: 'Cập nhật trạng thái thành công.' });
  } catch (err) {
    console.error('Update tech task status error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ============================================================
// DELETE /api/tech/tasks/:id — Xoá công việc kỹ thuật
// ============================================================
router.delete('/tasks/:id', authenticate, requireManagerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query('DELETE FROM TechTasks WHERE id = @id');

    sendEventToAll({ type: 'TECH_TASK_UPDATE', action: 'delete', taskId: parseInt(id) });
    res.json({ message: 'Đã xoá công việc kỹ thuật.' });
  } catch (err) {
    console.error('Delete tech task error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ============================================================
// POST /api/tech/ai-detect — AI Backend chẩn đoán lỗi
// ============================================================
router.post('/ai-detect', authenticate, async (req, res) => {
  try {
    const { description } = req.body;
    
    if (!description || !description.trim()) {
      return res.status(400).json({ 
        error: 'Vui lòng nhập mô tả lỗi để AI phân tích.',
        matched: false,
        suggestions: []
      });
    }

    const analysis = analyzeDescription(description);

    // If AI found matches, also try to find matching category IDs from DB
    if (analysis.matched) {
      const pool = await getPool();
      for (const suggestion of analysis.suggestions) {
        const dbResult = await pool.request()
          .input('name', sql.NVarChar, suggestion.issueName)
          .query('SELECT id FROM TechIssueCategories WHERE name = @name AND is_active = 1');
        
        if (dbResult.recordset.length > 0) {
          suggestion.categoryId = dbResult.recordset[0].id;
        }
      }
    }

    res.json({
      matched: analysis.matched,
      suggestions: analysis.suggestions,
      confidence: analysis.confidence,
      recommendation: analysis.recommendation,
      analyzedText: analysis.analyzedText
    });
  } catch (err) {
    console.error('AI detect error:', err);
    res.status(500).json({ error: 'Lỗi server khi phân tích AI.' });
  }
});

// ============================================================
// GET /api/tech/stats — Thống kê công việc kỹ thuật
// ============================================================
router.get('/stats', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
      FROM TechTasks
    `);
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Tech stats error:', err);
    res.status(500).json({ error: 'Lỗi server.' });
  }
});

// ============================================================
// POST /api/tech/auto-suggest — AI tự gợi ý lỗi & mô tả khi nhập phòng + chọn NV
// ============================================================
router.post('/auto-suggest', authenticate, async (req, res) => {
  try {
    const { apartment_code, staff_id, description } = req.body;

    if (!apartment_code) {
      return res.status(400).json({ error: 'Vui lòng nhập mã căn hộ.' });
    }

    const pool = await getPool();

    // 1. Lấy thông tin căn hộ
    const aptResult = await pool.request()
      .input('code', sql.VarChar, apartment_code)
      .query('SELECT id, code, building, room_type, status FROM Apartments WHERE code = @code');

    if (aptResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy căn hộ.' });
    }
    const apartment = aptResult.recordset[0];

    // 2. Lấy thông tin kỹ thuật viên (nếu có)
    let technician = null;
    if (staff_id) {
      const techResult = await pool.request()
        .input('staffId', sql.Int, parseInt(staff_id))
        .query('SELECT id, name, tech_role, tech_level FROM Staff WHERE id = @staffId');
      if (techResult.recordset.length > 0) {
        technician = techResult.recordset[0];
      }
    }

    // 3. Lấy lịch sử lỗi kỹ thuật của căn hộ này (gần nhất)
    const historyResult = await pool.request()
      .input('apartmentCode', sql.VarChar, apartment_code)
      .query(`
        SELECT TOP 5 
          c.name AS category_name, c.difficulty_level, c.difficulty_label,
          t.description, t.created_at
        FROM TechTasks t
        LEFT JOIN TechIssueCategories c ON t.issue_category_id = c.id
        WHERE t.apartment_code = @apartmentCode AND t.status = 'completed'
        ORDER BY t.created_at DESC
      `);
    const history = historyResult.recordset;

    // 4. Lấy tất cả danh mục active
    const categoriesResult = await pool.request()
      .query(`
        SELECT id, name, difficulty_level, difficulty_label 
        FROM TechIssueCategories 
        WHERE is_active = 1 AND is_custom = 0
        ORDER BY difficulty_level ASC, name ASC
      `);
    const allCategories = categoriesResult.recordset;

    // 5. Phân tích và gợi ý dựa trên nhiều yếu tố
    const suggestions = [];
    const text = (description || '').toLowerCase().trim();

    // 5a. Nếu có mô tả, phân tích keyword
    if (text) {
      const sortedKeywords = Object.keys(AI_FAULT_DATASET.keywords).sort((a, b) => b.length - a.length);
      for (const keyword of sortedKeywords) {
        if (text.includes(keyword.toLowerCase())) {
          const data = AI_FAULT_DATASET.keywords[keyword];
          for (const suggestion of data.suggestions) {
            const cat = allCategories.find(c => c.name === suggestion);
            if (cat && !suggestions.find(s => s.categoryId === cat.id)) {
              suggestions.push({
                categoryId: cat.id,
                categoryName: cat.name,
                difficultyLevel: cat.difficulty_level,
                difficultyLabel: cat.difficulty_label,
                confidence: keyword.length >= 4 ? 0.85 : 0.6,
                source: 'keyword_match'
              });
            }
          }
        }
      }
    }

    // 5b. Nếu có lịch sử căn hộ, gợi ý các lỗi thường gặp
    if (history.length > 0) {
      const historyCounts = {};
      for (const h of history) {
        if (h.category_name) {
          if (!historyCounts[h.category_name]) {
            historyCounts[h.category_name] = { count: 0, category: h };
          }
          historyCounts[h.category_name].count++;
        }
      }
      const sortedHistory = Object.values(historyCounts).sort((a, b) => b.count - a.count);
      for (const h of sortedHistory.slice(0, 3)) {
        const cat = allCategories.find(c => c.name === h.category.category_name);
        if (cat && !suggestions.find(s => s.categoryId === cat.id)) {
          suggestions.push({
            categoryId: cat.id,
            categoryName: cat.name,
            difficultyLevel: cat.difficulty_level,
            difficultyLabel: cat.difficulty_label,
            confidence: 0.5 + (h.count * 0.1),
            source: 'apartment_history',
            historyCount: h.count
          });
        }
      }
    }

    // 5c. Gợi ý mặc định theo loại phòng nếu chưa có gợi ý
    if (suggestions.length === 0) {
      const roomTypeDefaults = {
        '1 ngủ': [
          { name: 'Vệ sinh điều hoà', level: 1 },
          { name: 'Thay bóng đèn', level: 1 },
          { name: 'Vệ sinh quạt', level: 1 }
        ],
        '2 ngủ': [
          { name: 'Vệ sinh điều hoà', level: 1 },
          { name: 'Vệ sinh máy giặt cửa đứng', level: 2 },
          { name: 'Xử lý bản lề cửa', level: 2 }
        ],
        '3 ngủ': [
          { name: 'Vệ sinh điều hoà', level: 1 },
          { name: 'Vệ sinh máy giặt cửa ngang', level: 3 },
          { name: 'Xử lý bồn cầu và cống thoát nước', level: 3 }
        ],
        '4 ngủ': [
          { name: 'Vệ sinh lưới điều hoà âm trần', level: 3 },
          { name: 'Sửa giàn phơi', level: 3 },
          { name: 'Vệ sinh máy giặt cửa ngang', level: 3 }
        ]
      };
      const defaults = roomTypeDefaults[apartment.room_type] || roomTypeDefaults['2 ngủ'];
      for (const d of defaults) {
        const cat = allCategories.find(c => c.name === d.name);
        if (cat) {
          suggestions.push({
            categoryId: cat.id,
            categoryName: cat.name,
            difficultyLevel: cat.difficulty_level,
            difficultyLabel: cat.difficulty_label,
            confidence: 0.4,
            source: 'room_type_default'
          });
        }
      }
    }

    // 6. Sắp xếp theo confidence giảm dần
    suggestions.sort((a, b) => b.confidence - a.confidence || a.difficultyLevel - b.difficultyLevel);

    // 7. Tạo mô tả tự động cho gợi ý đầu tiên
    let autoDescription = '';
    let autoCategory = null;
    if (suggestions.length > 0) {
      const top = suggestions[0];
      autoCategory = top;
      const roomInfo = `${apartment.code} (${apartment.room_type}, ${apartment.building})`;
      const techInfo = technician ? ` - Kỹ thuật viên: ${technician.name}` : '';
      autoDescription = `Căn ${roomInfo}${techInfo}\n\nViệc cần làm: ${top.categoryName}\nĐộ khó: Level ${top.difficultyLevel} - ${top.difficultyLabel}`;
      
      if (top.source === 'apartment_history') {
        autoDescription += `\n(Lỗi này đã xảy ra ${top.historyCount} lần tại căn hộ này)`;
      }
    }

    res.json({
      apartment: {
        code: apartment.code,
        building: apartment.building,
        room_type: apartment.room_type,
        status: apartment.status
      },
      technician: technician ? {
        id: technician.id,
        name: technician.name,
        tech_role: technician.tech_role,
        tech_level: technician.tech_level
      } : null,
      suggestions: suggestions.slice(0, 5),
      autoCategory: autoCategory,
      autoDescription: autoDescription,
      historyCount: history.length
    });
  } catch (err) {
    console.error('Auto-suggest error:', err);
    res.status(500).json({ error: 'Lỗi server khi gợi ý tự động.' });
  }
});

module.exports = router;
