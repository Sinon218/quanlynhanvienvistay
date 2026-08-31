-- ===================================================================
-- MIGRATION: Thêm indexes tối ưu tốc độ query cho các API endpoint chính
-- Chạy file này trong SSMS (SQL Server Management Studio)
-- ===================================================================

USE ungdungquanlynhanvienvistay;
GO

-- Index cho WorkAssignments.assigned_date + status (dùng trong /work/today)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkAssignments_DateStatus' AND object_id = OBJECT_ID('WorkAssignments'))
BEGIN
    CREATE INDEX IX_WorkAssignments_DateStatus 
    ON WorkAssignments(assigned_date, status) 
    INCLUDE (staff_id, apartment_id, task_type, assigned_role, completed_at, proof_image, notes, expected_start_at, expected_end_at, partner_worked, created_at);
    PRINT N'✅ Created IX_WorkAssignments_DateStatus';
END
GO

-- Index cho ApartmentStatusHistory theo recorded_at (dùng trong /apartments/status-timeline)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ApartmentStatusHistory_RecordedAt' AND object_id = OBJECT_ID('ApartmentStatusHistory'))
BEGIN
    CREATE INDEX IX_ApartmentStatusHistory_RecordedAt 
    ON ApartmentStatusHistory(recorded_at, apartment_id) 
    INCLUDE (status);
    PRINT N'✅ Created IX_ApartmentStatusHistory_RecordedAt';
END
GO

-- Index cho Apartments.status (dùng trong /apartments/stats) 
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Apartments_Status' AND object_id = OBJECT_ID('Apartments'))
BEGIN
    CREATE INDEX IX_Apartments_Status ON Apartments(status);
    PRINT N'✅ Created IX_Apartments_Status';
END
GO

-- Index cho Tasks theo assigned_date + status (dùng trong /tasks/today)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Tasks_DateStatus' AND object_id = OBJECT_ID('Tasks'))
BEGIN
    CREATE INDEX IX_Tasks_DateStatus ON Tasks(assigned_date, status) INCLUDE (staff_id, title, tech_level, tech_price);
    PRINT N'✅ Created IX_Tasks_DateStatus';
END
GO

-- Index cho WorkAssignments status (dùng trong stats queries)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkAssignments_Status' AND object_id = OBJECT_ID('WorkAssignments'))
BEGIN
    CREATE INDEX IX_WorkAssignments_Status ON WorkAssignments(status, staff_id, assigned_date);
    PRINT N'✅ Created IX_WorkAssignments_Status';
END
GO

PRINT N'✅ Migration hoàn thành — tất cả indexes đã được tạo!';
GO
