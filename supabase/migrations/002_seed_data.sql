-- ========================================
-- MedLogixManage — Seed Data
-- Mock data for development & testing
-- ========================================

-- ========================================
-- A. PRODUCTS (~30 items)
-- ========================================
INSERT INTO products (code, name, manufacturer, packaging, unit, category, storage_condition, medical_device_class, safety_stock_qty) VALUES
('SP-001', 'Máy thở Savina 300 Classic', 'Dräger', '1 máy/thùng', 'Cái', 'Thiết bị hô hấp', 'normal', 'C', 5),
('SP-002', 'Monitor theo dõi Infinity Delta', 'Dräger', '1 bộ/thùng', 'Bộ', 'Thiết bị giám sát', 'normal', 'B', 3),
('SP-003', 'Bơm tiêm điện Perfusor Space', 'B.Braun', '1 máy/hộp', 'Cái', 'Thiết bị truyền dịch', 'normal', 'B', 10),
('SP-004', 'Máy siêu âm ACUSON Juniper', 'Siemens', '1 hệ thống/kiện', 'Bộ', 'Thiết bị chẩn đoán', 'normal', 'C', 2),
('SP-005', 'Dao mổ điện Force FX', 'Medtronic', '1 máy/thùng', 'Cái', 'Thiết bị phẫu thuật', 'normal', 'C', 3),
('SP-006', 'Kẹp phẫu thuật KPT-001', 'Aesculap', '10 cái/hộp', 'Hộp', 'Dụng cụ phẫu thuật', 'normal', 'A', 20),
('SP-007', 'Kim mổ KM-003', 'Ethicon', '50 cái/hộp', 'Hộp', 'Vật tư tiêu hao', 'normal', 'A', 50),
('SP-008', 'Chỉ phẫu thuật Vicryl 2-0', 'Ethicon', '36 sợi/hộp', 'Hộp', 'Vật tư tiêu hao', 'normal', 'A', 100),
('SP-009', 'Ống nội khí quản ET Tube 7.5', 'Teleflex', '10 ống/hộp', 'Hộp', 'Vật tư tiêu hao', 'normal', 'B', 30),
('SP-010', 'Mask oxy cao áp', 'Intersurgical', '50 cái/thùng', 'Thùng', 'Vật tư tiêu hao', 'normal', 'A', 20),
('SP-011', 'Gel siêu âm Aquasonic 100', 'Parker Labs', '12 chai/thùng', 'Thùng', 'Vật tư tiêu hao', 'normal', 'A', 15),
('SP-012', 'Giấy điện tim ECG Z-fold', 'Nihon Kohden', '10 cuộn/hộp', 'Hộp', 'Vật tư tiêu hao', 'normal', 'A', 30),
('SP-013', 'Dây đo SpO2 Nellcor', 'Medtronic', '1 sợi/hộp', 'Cái', 'Phụ kiện', 'normal', 'B', 10),
('SP-014', 'Bộ dây truyền dịch IV', 'B.Braun', '100 bộ/thùng', 'Thùng', 'Vật tư tiêu hao', 'normal', 'A', 40),
('SP-015', 'Catheter tĩnh mạch trung tâm', 'Arrow', '10 bộ/hộp', 'Hộp', 'Vật tư tiêu hao', 'normal', 'C', 15),
('SP-016', 'Vắc-xin Cúm mùa 4 chủng', 'Sanofi', '10 liều/hộp', 'Hộp', 'Dược phẩm', 'cool', 'A', 50),
('SP-017', 'Insulin Lantus 100IU/ml', 'Sanofi', '5 bút/hộp', 'Hộp', 'Dược phẩm', 'cool', 'A', 100),
('SP-018', 'Thuốc gây mê Propofol 1%', 'Fresenius Kabi', '5 ống/hộp', 'Hộp', 'Dược phẩm', 'cool', 'A', 60),
('SP-019', 'Kháng sinh Meropenem 1g', 'AstraZeneca', '10 lọ/hộp', 'Hộp', 'Dược phẩm', 'normal', 'A', 80),
('SP-020', 'Thuốc cản quang Omnipaque 350', 'GE Healthcare', '10 lọ/hộp', 'Hộp', 'Dược phẩm', 'normal', 'A', 30),
('SP-021', 'Máy X-quang di động', 'Shimadzu', '1 máy/kiện', 'Cái', 'Thiết bị chẩn đoán', 'normal', 'C', 1),
('SP-022', 'Đèn mổ LED Trumpf', 'Trumpf Medical', '1 bộ/kiện', 'Bộ', 'Thiết bị phẫu thuật', 'normal', 'B', 2),
('SP-023', 'Giường ICU điện đa năng', 'Hill-Rom', '1 giường/kiện', 'Cái', 'Nội thất y tế', 'normal', 'B', 3),
('SP-024', 'Xe đẩy cấp cứu 5 ngăn', 'Zhangjiagang', '1 xe/kiện', 'Cái', 'Nội thất y tế', 'normal', 'A', 5),
('SP-025', 'Máy lọc máu Fresenius 5008S', 'Fresenius', '1 máy/kiện', 'Cái', 'Thiết bị điều trị', 'normal', 'C', 2),
('SP-026', 'Bộ kit xét nghiệm nhanh COVID-19', 'Abbott', '25 test/hộp', 'Hộp', 'Xét nghiệm', 'cool', 'B', 100),
('SP-027', 'Găng tay phẫu thuật vô trùng size 7', 'Ansell', '50 đôi/hộp', 'Hộp', 'Vật tư tiêu hao', 'normal', 'A', 200),
('SP-028', 'Khẩu trang N95 3M 1860', '3M', '20 cái/hộp', 'Hộp', 'Vật tư tiêu hao', 'normal', 'A', 150),
('SP-029', 'Dung dịch sát khuẩn Betadine 10%', 'Mundipharma', '12 chai/thùng', 'Thùng', 'Dược phẩm', 'normal', 'A', 25),
('SP-030', 'Máy phá rung tim HeartStart', 'Philips', '1 máy/thùng', 'Cái', 'Thiết bị cấp cứu', 'normal', 'C', 3);

-- ========================================
-- B. HOSPITALS (20 from Excel validation)
-- ========================================
INSERT INTO hospitals (name, province, contact_person, phone) VALUES
('BV Bắc Quảng Bình', 'Quảng Bình', 'BS. Nguyễn Văn An', '0232-3xxx-xxx'),
('BV C Đà Nẵng', 'Đà Nẵng', 'BS. Trần Thị Bình', '0236-3xxx-xxx'),
('BV CTCH Nghệ An', 'Nghệ An', 'BS. Phạm Văn Cường', '0238-3xxx-xxx'),
('BV CuBa-Đồng Hới', 'Quảng Bình', 'BS. Lê Thị Dung', '0232-3xxx-xxx'),
('BV Đà Nẵng', 'Đà Nẵng', 'BS. Hoàng Minh Đức', '0236-3862-xxx'),
('BV E Đà Nẵng', 'Đà Nẵng', 'BS. Ngô Thị Hương', '0236-3xxx-xxx'),
('BV Hữu Nghị Nghệ An', 'Nghệ An', 'BS. Đặng Văn Giang', '0238-3xxx-xxx'),
('BV Sản Nhi Nghệ An', 'Nghệ An', 'BS. Vũ Thị Hà', '0238-3xxx-xxx'),
('BV Ung Bướu Nghệ An', 'Nghệ An', 'BS. Bùi Minh Khoa', '0238-3xxx-xxx'),
('BVĐK Cửa Đông', 'Nghệ An', 'BS. Mai Văn Lâm', '0238-3xxx-xxx'),
('BVĐK Minh An', 'Nghệ An', 'BS. Trịnh Thị Mai', '0238-3xxx-xxx'),
('BVĐK Minh Thành', 'Nghệ An', 'BS. Phan Hữu Nam', '0238-3xxx-xxx'),
('BVĐK Quang Khởi', 'Nghệ An', 'BS. Lý Thanh Oai', '0238-3xxx-xxx'),
('BVĐK Quảng Trị', 'Quảng Trị', 'BS. Chu Văn Phong', '0233-3xxx-xxx'),
('BVTW Huế', 'Thừa Thiên Huế', 'BS. Nguyễn Anh Quân', '0234-3822-xxx'),
('TTHHTM Nghệ An', 'Nghệ An', 'BS. Đỗ Thị Rằm', '0238-3xxx-xxx'),
('TTKSBT Nghệ An', 'Nghệ An', 'BS. Hồ Sỹ Tùng', '0238-3xxx-xxx'),
('TTYT Anh Sơn', 'Nghệ An', 'BS. Lê Văn Ưng', '0238-3xxx-xxx'),
('TTYT Nam Đàn', 'Nghệ An', 'BS. Nguyễn Văn Vinh', '0238-3xxx-xxx'),
('TTYT Quỳ Châu', 'Nghệ An', 'BS. Trần Hữu Xuyên', '0238-3xxx-xxx');

-- ========================================
-- C. SUPPLIERS (5)
-- ========================================
INSERT INTO suppliers (name, tax_code, country, is_domestic, contact_person, phone, email, payment_terms) VALUES
('Dräger Vietnam', '0123456789', 'Germany', false, 'Mr. Hans Mueller', '+84-28-xxx', 'order@drager.vn', 'LC 90 ngày'),
('B.Braun Vietnam', '0234567890', 'Germany', false, 'Ms. Nguyễn Thị Lan', '028-3xxx-xxx', 'sales@bbraun.vn', 'TT 60 ngày'),
('Medtronic Vietnam', '0345678901', 'USA', false, 'Mr. John Smith', '+84-28-xxx', 'order@medtronic.vn', 'LC 60 ngày'),
('Công ty TNHH Thiết bị Y tế Việt Nhật', '0456789012', 'Vietnam', true, 'Ông Trần Hùng', '024-3xxx-xxx', 'info@vietnhat-med.vn', 'COD'),
('Công ty CP Dược phẩm Trung Ương 3', '0567890123', 'Vietnam', true, 'Bà Lê Ngọc', '0236-3xxx-xxx', 'sales@duoctw3.vn', 'TT 30 ngày');

-- ========================================
-- D. CARRIERS (4)
-- ========================================
INSERT INTO carriers (name, phone, vehicle_type, has_cold_chain) VALUES
('Vận tải Nội bộ MLM', '0902-xxx-xxx', 'Xe tải 5T', true),
('Nhất Tín Logistics', '1900-636-688', 'Xe tải 3.5T', false),
('Viettel Post Express', '1900-8095', 'Xe tải đông lạnh', true),
('Giao Hàng Nhanh MedExpress', '1900-xxx', 'Xe tải lạnh 2T', true);

-- ========================================
-- E. INVENTORY LOTS (sample)
-- ========================================
-- (Using product IDs from above — will use subqueries)
INSERT INTO inventory_lots (product_id, lot_number, expiry_date, quantity, unit_cost, storage_condition, status)
SELECT p.id, lot.lot_no, lot.exp::DATE, lot.qty, lot.cost, lot.cond, 'available'
FROM (VALUES
  ('SP-001', 'LOT-DRG-2024-01', '2029-06-30', 3, 350000000, 'normal'),
  ('SP-001', 'LOT-DRG-2024-02', '2029-12-31', 2, 355000000, 'normal'),
  ('SP-003', 'LOT-BBR-2025-01', '2030-03-15', 8, 45000000, 'normal'),
  ('SP-006', 'LOT-AES-2025-01', '2026-09-30', 15, 2500000, 'normal'),
  ('SP-006', 'LOT-AES-2025-02', '2027-03-31', 10, 2600000, 'normal'),
  ('SP-007', 'LOT-ETH-2025-01', '2026-06-15', 40, 1800000, 'normal'),
  ('SP-008', 'LOT-ETH-2025-03', '2027-01-31', 80, 1200000, 'normal'),
  ('SP-009', 'LOT-TEL-2025-01', '2026-11-30', 25, 850000, 'normal'),
  ('SP-014', 'LOT-BBR-2025-02', '2027-06-30', 35, 3500000, 'normal'),
  ('SP-016', 'LOT-SAN-2025-01', '2026-08-31', 30, 950000, 'cool'),
  ('SP-017', 'LOT-SAN-2025-02', '2026-07-15', 60, 1800000, 'cool'),
  ('SP-018', 'LOT-FRK-2025-01', '2026-10-30', 45, 650000, 'cool'),
  ('SP-019', 'LOT-AZN-2025-01', '2027-04-30', 70, 320000, 'normal'),
  ('SP-027', 'LOT-ANS-2025-01', '2027-12-31', 150, 480000, 'normal'),
  ('SP-028', 'LOT-3M-2025-01', '2028-06-30', 120, 350000, 'normal'),
  ('SP-030', 'LOT-PHI-2024-01', '2029-03-31', 2, 180000000, 'normal')
) AS lot(code, lot_no, exp, qty, cost, cond)
JOIN products p ON p.code = lot.code;
