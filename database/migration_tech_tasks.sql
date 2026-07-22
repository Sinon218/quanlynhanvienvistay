-- ===================================================================
-- MIGRATION: Tạo bảng TechIssueCategories & TechTasks
-- Quản lý công việc kỹ thuật cần sửa (bảo trì)
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- ===== BẢNG: TechIssueCategories (Danh mục lỗi kỹ thuật) =====
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TechIssueCategories')
BEGIN
    CREATE TABLE TechIssueCategories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(200) NOT NULL,
        difficulty_level INT NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 4),
        difficulty_label NVARCHAR(50) NOT NULL DEFAULT N'Dễ',
        is_custom BIT NOT NULL DEFAULT 0,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT N'✅ Tạo bảng TechIssueCategories thành công.';
END
ELSE
    PRINT N'ℹ️ Bảng TechIssueCategories đã tồn tại.';
GO

-- ===== BẢNG: TechTasks (Công việc kỹ thuật cần sửa) =====
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TechTasks')
BEGIN
    CREATE TABLE TechTasks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        apartment_code VARCHAR(20) NOT NULL,
        issue_category_id INT NULL FOREIGN KEY REFERENCES TechIssueCategories(id),
        custom_issue_name NVARCHAR(200) NULL,
        description NVARCHAR(1000) NULL,
        difficulty_level INT NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 4),

        -- Media: 2 ảnh + 1 video (base64 hoặc URL)
        photo1_url NVARCHAR(MAX) NULL,
        photo2_url NVARCHAR(MAX) NULL,
        video_url NVARCHAR(MAX) NULL,

        -- Priority & Status
        priority VARCHAR(20) NOT NULL DEFAULT 'medium'
            CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

        -- Assignment
        assigned_staff_id INT NULL FOREIGN KEY REFERENCES Staff(id),
        created_by_user_id INT NULL FOREIGN KEY REFERENCES Users(id),

        -- AI Diagnosis
        ai_diagnosis_json NVARCHAR(MAX) NULL,

        -- Timestamps
        created_at DATETIME DEFAULT GETDATE(),
        started_at DATETIME NULL,
        completed_at DATETIME NULL
    );

    CREATE INDEX IX_TechTasks_Status ON TechTasks(status);
    CREATE INDEX IX_TechTasks_AssignedStaff ON TechTasks(assigned_staff_id);
    CREATE INDEX IX_TechTasks_ApartmentCode ON TechTasks(apartment_code);
    CREATE INDEX IX_TechTasks_Priority ON TechTasks(priority);

    PRINT N'✅ Tạo bảng TechTasks thành công.';
END
ELSE
    PRINT N'ℹ️ Bảng TechTasks đã tồn tại.';
GO

-- ===== SEED: Danh mục lỗi kỹ thuật 4 cấp độ =====
IF NOT EXISTS (SELECT 1 FROM TechIssueCategories)
BEGIN
    INSERT INTO TechIssueCategories (name, difficulty_level, difficulty_label, is_custom) VALUES
    -- CẤP ĐỘ 1: DỄ (12 mục)
    (N'Sơn tường', 1, N'Dễ', 0),
    (N'Vệ sinh điều hoà', 1, N'Dễ', 0),
    (N'Dán decal', 1, N'Dễ', 0),
    (N'Giặt rèm trắng', 1, N'Dễ', 0),
    (N'Lắp khoá trong', 1, N'Dễ', 0),
    (N'Siết ốc', 1, N'Dễ', 0),
    (N'Thay vòi sen', 1, N'Dễ', 0),
    (N'Thay bóng đèn', 1, N'Dễ', 0),
    (N'Dán chặn cửa', 1, N'Dễ', 0),
    (N'Đặt thuốc gián', 1, N'Dễ', 0),
    (N'Lắp bộ lọc nước', 1, N'Dễ', 0),
    (N'Vệ sinh quạt', 1, N'Dễ', 0),

    -- CẤP ĐỘ 2: TRUNG BÌNH (10 mục)
    (N'Vệ sinh máy giặt cửa đứng', 2, N'Trung bình', 0),
    (N'Silicon', 2, N'Trung bình', 0),
    (N'Sơn trần', 2, N'Trung bình', 0),
    (N'Sơn bả', 2, N'Trung bình', 0),
    (N'Xử lý bản lề cửa', 2, N'Trung bình', 0),
    (N'Vệ sinh sofa và đệm', 2, N'Trung bình', 0),
    (N'Vệ sinh rèm dày', 2, N'Trung bình', 0),
    (N'Sơn chân bàn ghế', 2, N'Trung bình', 0),
    (N'Treo đèn thả bàn ăn và đèn ốp', 2, N'Trung bình', 0),
    (N'Vệ sinh cây nước', 2, N'Trung bình', 0),

    -- CẤP ĐỘ 3: KHÓ (6 mục)
    (N'Vệ sinh máy giặt cửa ngang', 3, N'Khó', 0),
    (N'Thay miệng cửa ban công', 3, N'Khó', 0),
    (N'Thay vòng bi', 3, N'Khó', 0),
    (N'Vệ sinh lưới điều hoà âm trần', 3, N'Khó', 0),
    (N'Xử lý bồn cầu và cống thoát nước', 3, N'Khó', 0),
    (N'Sửa giàn phơi', 3, N'Khó', 0),

    -- CẤP ĐỘ 4: CẦN CHUYÊN MÔN (5 mục)
    (N'Sửa tivi', 4, N'Cần chuyên môn', 0),
    (N'Sửa tủ lạnh', 4, N'Cần chuyên môn', 0),
    (N'Sửa lò vi sóng', 4, N'Cần chuyên môn', 0),
    (N'Sửa điều hoà', 4, N'Cần chuyên môn', 0),
    (N'Sửa rèm chống côn trùng', 4, N'Cần chuyên môn', 0),

    -- KHÁC (tuỳ chỉnh)
    (N'Khác...', 1, N'Dễ', 1);

    PRINT N'✅ Đã seed 34 danh mục lỗi kỹ thuật (4 cấp độ + Khác).';
END
ELSE
    PRINT N'ℹ️ Danh mục lỗi kỹ thuật đã có dữ liệu.';
GO
