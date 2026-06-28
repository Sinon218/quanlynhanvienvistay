-- ===================================================================
-- SEED DATA: ungdungquanlynhanvienvistay
-- ===================================================================

USE ungdungquanlynhanvienvistay;
GO

-- ===== NHÂN VIÊN (8 người) =====
INSERT INTO Staff (name, default_name, type, room_role, tech_role, base_salary, per_room_rate) VALUES
(N'Liên',   N'Liên',   'full-time', 1, 0, NULL, NULL),
(N'Thiên',  N'Thiên',  'full-time', 2, 1, NULL, NULL),
(N'Thương', N'Thương', 'full-time', 1, 0, NULL, NULL),
(N'Vân',    N'Vân',    'full-time', 2, 0, NULL, NULL),
(N'Diệu',  N'Diệu',  'full-time', 2, 0, NULL, NULL),
(N'Hoàn',   N'Hoàn',   'full-time', 1, 0, NULL, NULL),
(N'Nhân viên Part-time 1', N'Nhân viên Part-time 1', 'part-time', 2, 0, NULL, NULL),
(N'Nhân viên Part-time 2', N'Nhân viên Part-time 2', 'part-time', 0, 0, NULL, NULL);
GO

-- ===== TÀI KHOẢN ĐĂNG NHẬP =====
-- Mật khẩu sẽ được hash bằng bcrypt khi chạy seed script từ Node.js
-- Dưới đây là dữ liệu tham khảo, seed thực tế chạy từ server/seed.js

-- Admin: vistay / 12345678
-- Nhân viên: tên không dấu / 12345678
-- lien, thien, thuong, van, dieu, hoan, parttime1, parttime2

-- ===== CĂN HỘ - TÒA S1 (14 căn) =====
INSERT INTO Apartments (code, building, password, is_samsung) VALUES
('S1-0505',  'S1', '000555',      1),
('S1-0508',  'S1', '585868',      1),
('S1-0905',  'S1', '730399',      1),
('S1-1105',  'S1', '220704',      0),
('S1-1605',  'S1', '166.666',     0),
('S1-1705',  'S1', '356835',      0),
('S1-1905',  'S1', '199.999',     1),
('S1-2105',  'S1', '222111',      0),
('S1-2305',  'S1', '160.524',     0),
('S1-2405',  'S1', '122.537',     1),
('S1-2405A', 'S1', '456789',      1),
('S1-2505A', 'S1', '000555',      1),
('S1-2705',  'S1', '222777',      1),
('S1-3105',  'S1', '333555',      1);
GO

-- ===== CĂN HỘ - TÒA S2 (26 căn) =====
INSERT INTO Apartments (code, building, password, is_samsung) VALUES
('S2-0610',  'S2', '760.200',     1),
('S2-0715',  'S2', '686868',      0),
('S2-1110',  'S2', '101010',      1),
('S2-1111',  'S2', '838688',      1),
('S2-11A11', 'S2', '111168',      0),
('S2-1220',  'S2', '111222',      0),
('S2-1511A', 'S2', '688688',      1),
('S2-1512',  'S2', '111222',      1),
('S2-1712',  'S2', '320.500',     1),
('S2-1901',  'S2', '009966',      0),
('S2-2106',  'S2', '222111',      0),
('S2-2211A', 'S2', '668868',      1),
('S2-2411',  'S2', '135246#',     1),
('S2-2512',  'S2', '225588',      1),
('S2-2916',  'S2', '929268',      1),
('S2-3210',  'S2', '333222',      1),
('S2-3301',  'S2', '333111',      0),
('S2-3316',  'S2', '333366',      1),
('S2-3411A', 'S2', '201099',      0),
('S2-3420',  'S2', '202002',      0),
('S2-3517',  'S2', '353568',      1),
('S2-3608',  'S2', '363636',      0),
('S2-3810',  'S2', '383838',      1),
('S2-3812',  'S2', '101615',      1),
('S2-3816',  'S2', '383883',      1),
('S2-3908',  'S2', '999888',      0);
GO

-- ===== CĂN HỘ - TÒA S3 (17 căn) =====
INSERT INTO Apartments (code, building, password, is_samsung) VALUES
('S3-0908',  'S3', '999888',      0),
('S3-15A12', 'S3', '111555',      1),
('S3-1701',  'S3', '240302',      0),
('S3-1616',  'S3', '382838',      0),
('S3-1811',  'S3', '333666',      1),
('S3-1901',  'S3', '111119',      0),
('S3-2012',  'S3', '111222',      1),
('S3-2412',  'S3', '333666',      1),
('S3-2909',  'S3', '000999',      0),
('S3-3015',  'S3', '305305',      1),
('S3-3409',  'S3', '399999',      0),
('S3-3411',  'S3', '123468',      1),
('S3-3511',  'S3', '351168',      1),
('S3-3512',  'S3', '333.222',     1),
('S3-3612',  'S3', '363663',      1),
('S3-3906',  'S3', '336699',      0),
('S3-3918',  'S3', '838386',      0);
GO

-- ===== CĂN HỘ - TÒA B (1 căn) =====
INSERT INTO Apartments (code, building, password, is_samsung) VALUES
('B2102',    'B',  '456456*',     0);
GO

-- ===== CĂN HỘ - TÒA R6A (2 căn) =====
INSERT INTO Apartments (code, building, password, is_samsung) VALUES
('R6A-0505', 'R6A', '111.000.222.33',  0),
('R6A-2806', 'R6A', '2222.333.333',    0);
GO

PRINT N'✅ Seed data inserted: 8 staff + 60 apartments';
GO
