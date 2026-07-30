-- ===================================================================
-- MIGRATION: Thêm căn hộ mới & cập nhật room_type
-- Ngày: 2026-07-28
-- ===================================================================
USE ungdungquanlynhanvienvistay;
GO

-- ===== 1. THÊM CĂN HỘ MỚI =====
-- Các căn mới chưa có trong DB
DECLARE @NewApts TABLE (
    code VARCHAR(20) PRIMARY KEY, building NVARCHAR(10) NOT NULL,
    password NVARCHAR(50) NOT NULL, is_samsung BIT NOT NULL,
    room_type NVARCHAR(20) NOT NULL, default_cleaning_rate DECIMAL(10,0)
);

-- S1-2505: 1 ngủ, VAT (is_samsung=1)
INSERT INTO @NewApts VALUES ('S1-2505', 'S1', '123456', 1, N'1 ngủ', 30000);
-- S1-1208A: 2 ngủ, không VAT
INSERT INTO @NewApts VALUES ('S1-1208A', 'S1', '123456', 0, N'2 ngủ', 60000);
-- S2-11A08: 2 ngủ, không VAT
INSERT INTO @NewApts VALUES ('S2-11A08', 'S2', '123456', 0, N'2 ngủ', 60000);
-- S2-11A12: 1 ngủ, không VAT
INSERT INTO @NewApts VALUES ('S2-11A12', 'S2', '123456', 0, N'1 ngủ', 30000);
-- S2-1209: 2 ngủ, không VAT
INSERT INTO @NewApts VALUES ('S2-1209', 'S2', '123456', 0, N'2 ngủ', 60000);
-- S2-15A11: 2 ngủ, không VAT
INSERT INTO @NewApts VALUES ('S2-15A11', 'S2', '123456', 0, N'2 ngủ', 60000);
-- S2-3612: 1 ngủ, không VAT
INSERT INTO @NewApts VALUES ('S2-3612', 'S2', '123456', 0, N'1 ngủ', 30000);
-- S3-3808A: 2 ngủ, không VAT
INSERT INTO @NewApts VALUES ('S3-3808A', 'S3', '123456', 0, N'2 ngủ', 60000);

MERGE Apartments AS target
USING @NewApts AS source
ON target.code = source.code
WHEN NOT MATCHED THEN
    INSERT (code, building, password, is_samsung, room_type, default_cleaning_rate, status)
    VALUES (source.code, source.building, source.password, source.is_samsung, source.room_type, source.default_cleaning_rate, 'available');
GO

PRINT N'✅ Đã thêm 7 căn hộ mới.';
GO
