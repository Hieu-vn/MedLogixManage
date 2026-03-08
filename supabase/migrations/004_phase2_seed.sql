-- ========================================
-- Phase 2 Seed Data — PO, Import, Warehouse, Price List
-- Detailed with every field populated
-- ========================================

-- =====================
-- A. PRICE LIST (10 entries — 9 current + 1 historical)
-- =====================
INSERT INTO price_list (product_id, supplier_id, unit_price, currency, effective_date, price_ceiling, price_floor, valid_from, valid_to, is_current)
SELECT p.id, s.id, pl.price, 'VND', pl.eff_date::DATE, pl.ceiling, pl.floor, pl.vf::DATE, pl.vt::DATE, pl.current
FROM (VALUES
  ('SP-001', 'Dräger Vietnam', 350000000, 380000000, 320000000, '2026-01-01', '2026-12-31', true, '2026-01-01'),
  ('SP-003', 'B.Braun Vietnam', 45000000, 48000000, 42000000, '2026-01-01', '2026-12-31', true, '2026-01-01'),
  ('SP-005', 'Medtronic Vietnam', 85000000, 90000000, 80000000, '2026-01-01', '2026-12-31', true, '2026-01-01'),
  ('SP-007', 'Công ty TNHH Thiết bị Y tế Việt Nhật', 1800000, 2000000, 1600000, '2026-01-01', '2026-12-31', true, '2026-01-01'),
  ('SP-008', 'Công ty TNHH Thiết bị Y tế Việt Nhật', 1200000, 1400000, 1100000, '2026-01-01', '2026-12-31', true, '2026-01-01'),
  ('SP-014', 'B.Braun Vietnam', 3500000, 3800000, 3200000, '2026-01-01', '2026-12-31', true, '2026-01-01'),
  ('SP-016', 'Công ty CP Dược phẩm Trung Ương 3', 950000, 1050000, 880000, '2026-01-01', '2026-06-30', true, '2026-01-01'),
  ('SP-019', 'Công ty CP Dược phẩm Trung Ương 3', 320000, 380000, 280000, '2026-01-01', '2026-12-31', true, '2026-01-01'),
  ('SP-027', 'Công ty TNHH Thiết bị Y tế Việt Nhật', 480000, 520000, 440000, '2026-01-01', '2026-12-31', true, '2026-01-01'),
  -- Historical price (is_current = false)
  ('SP-001', 'Dräger Vietnam', 340000000, 370000000, 310000000, '2025-01-01', '2025-12-31', false, '2025-01-01')
) AS pl(pcode, sname, price, ceiling, floor, vf, vt, current, eff_date)
JOIN products p ON p.code = pl.pcode
JOIN suppliers s ON s.name = pl.sname;

-- =====================
-- B. PURCHASE ORDERS (3 POs with different statuses)
-- =====================

-- Helper: get user IDs
DO $$
DECLARE
  v_logistics UUID;
  v_director UUID;
  v_thukho UUID;
  v_drager UUID;
  v_bbraun UUID;
  v_vietnhat UUID;
  v_po1 UUID;
  v_po2 UUID;
  v_po3 UUID;
  v_nk1 UUID;
  v_nk2 UUID;
  v_pnk1 UUID;
  v_pnk2 UUID;
  v_doc_inv UUID;
  v_doc_pl UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO v_logistics FROM profiles WHERE email = 'logistics@medlogix.com';
  SELECT id INTO v_director FROM profiles WHERE email = 'giamdoc@medlogix.com';
  SELECT id INTO v_thukho FROM profiles WHERE email = 'thukho@medlogix.com';
  
  -- Get supplier IDs
  SELECT id INTO v_drager FROM suppliers WHERE name = 'Dräger Vietnam';
  SELECT id INTO v_bbraun FROM suppliers WHERE name = 'B.Braun Vietnam';
  SELECT id INTO v_vietnhat FROM suppliers WHERE name = 'Công ty TNHH Thiết bị Y tế Việt Nhật';

  -- ===== PO-2026-0001: DRAFT (Dräger, nhập khẩu) =====
  INSERT INTO purchase_orders (
    code, supplier_id, is_domestic, purchase_forecast_id,
    total_amount, vat_pct, vat_amount, shipping_cost, grand_total,
    payment_terms, expected_delivery, actual_delivery,
    status, rejection_reason, director_notes,
    created_by, approved_by, approved_at, sent_at, notes
  ) VALUES (
    'PO-2026-0001', v_drager, false, NULL,
    1055000000, 8, 84400000, 15000000, 1154400000,
    'LC 90 ngày', '2026-04-15', NULL,
    'draft', NULL, NULL,
    v_logistics, NULL, NULL, NULL, 'PO mới tạo, thiết bị hô hấp + giám sát'
  ) RETURNING id INTO v_po1;

  -- PO-0001 items
  INSERT INTO po_items (po_id, product_id, lot_number, expiry_date, quantity, unit_price, price_list_price, price_deviation_pct, line_total, notes)
  SELECT v_po1, p.id, i.lot, i.exp::DATE, i.qty, i.uprice, i.pl_price, i.dev, i.total, i.note
  FROM (VALUES
    ('SP-001', 'LOT-DRG-2026-01', '2031-06-30', 2, 355000000, 350000000, 1.43, 710000000, 'Máy thở Savina 300'),
    ('SP-002', 'LOT-DRG-2026-02', '2031-12-31', 1, 260000000, NULL, 0, 260000000, 'Monitor Infinity Delta'),
    ('SP-005', 'LOT-MDT-2026-01', '2031-03-15', 1, 85000000, 85000000, 0, 85000000, 'Dao mổ điện Force FX')
  ) AS i(pcode, lot, exp, qty, uprice, pl_price, dev, total, note)
  JOIN products p ON p.code = i.pcode;

  -- ===== PO-2026-0002: PENDING (B.Braun, nhập khẩu, chờ GĐ duyệt) =====
  INSERT INTO purchase_orders (
    code, supplier_id, is_domestic, purchase_forecast_id,
    total_amount, vat_pct, vat_amount, shipping_cost, grand_total,
    payment_terms, expected_delivery, actual_delivery,
    status, rejection_reason, director_notes,
    created_by, approved_by, approved_at, sent_at, notes
  ) VALUES (
    'PO-2026-0002', v_bbraun, false, NULL,
    138500000, 8, 11080000, 5000000, 154580000,
    'TT 60 ngày', '2026-03-25', NULL,
    'pending', NULL, NULL,
    v_logistics, NULL, NULL, NULL, 'Chờ Giám đốc duyệt — bơm tiêm + dây truyền dịch'
  ) RETURNING id INTO v_po2;

  -- PO-0002 items (SP-014 has +32.9% deviation!)
  INSERT INTO po_items (po_id, product_id, lot_number, expiry_date, quantity, unit_price, price_list_price, price_deviation_pct, line_total, notes)
  SELECT v_po2, p.id, i.lot, i.exp::DATE, i.qty, i.uprice, i.pl_price, i.dev, i.total, i.note
  FROM (VALUES
    ('SP-003', 'LOT-BBR-2026-01', '2031-09-30', 2, 46000000, 45000000, 2.22, 92000000, 'Bơm tiêm Perfusor Space'),
    ('SP-014', 'LOT-BBR-2026-02', '2031-06-30', 10, 4650000, 3500000, 32.86, 46500000, '⚠️ Biến động giá >10% — giá mới từ NCC')
  ) AS i(pcode, lot, exp, qty, uprice, pl_price, dev, total, note)
  JOIN products p ON p.code = i.pcode;

  -- ===== PO-2026-0003: SENT (Việt Nhật, nội địa, đã duyệt + gửi) =====
  INSERT INTO purchase_orders (
    code, supplier_id, is_domestic, purchase_forecast_id,
    total_amount, vat_pct, vat_amount, shipping_cost, grand_total,
    payment_terms, expected_delivery, actual_delivery,
    status, rejection_reason, director_notes,
    created_by, approved_by, approved_at, sent_at, notes
  ) VALUES (
    'PO-2026-0003', v_vietnhat, true, NULL,
    24600000, 8, 1968000, 2000000, 28568000,
    'COD', '2026-03-20', NULL,
    'sent', NULL, 'Đã duyệt, giá hợp lý',
    v_logistics, v_director, '2026-03-01 10:00:00+07', '2026-03-02 08:30:00+07', 'Đã gửi email cho NCC Việt Nhật'
  ) RETURNING id INTO v_po3;

  -- PO-0003 items
  INSERT INTO po_items (po_id, product_id, lot_number, expiry_date, quantity, unit_price, price_list_price, price_deviation_pct, line_total, notes)
  SELECT v_po3, p.id, i.lot, i.exp::DATE, i.qty, i.uprice, i.pl_price, i.dev, i.total, i.note
  FROM (VALUES
    ('SP-007', 'LOT-VN-2026-01', '2028-12-31', 5, 1850000, 1800000, 2.78, 9250000, 'Kim mổ KM-003'),
    ('SP-008', 'LOT-VN-2026-02', '2028-06-30', 8, 1200000, 1200000, 0, 9600000, 'Chỉ Vicryl 2-0'),
    ('SP-027', 'LOT-VN-2026-03', '2028-03-31', 5, 500000, 480000, 4.17, 2500000, 'Găng tay PT vô trùng'),
    ('SP-019', 'LOT-VN-2026-04', '2028-09-30', 10, 325000, 320000, 1.56, 3250000, 'Meropenem 1g')
  ) AS i(pcode, lot, exp, qty, uprice, pl_price, dev, total, note)
  JOIN products p ON p.code = i.pcode;

  -- =====================
  -- C. PO DOCUMENTS & CROSS-VERIFICATION (for PO-0003)
  -- =====================

  -- Invoice
  INSERT INTO po_documents (po_id, doc_type, doc_number, doc_date, entered_by)
  VALUES (v_po3, 'invoice', 'INV-VN-2026-0042', '2026-03-05', v_logistics)
  RETURNING id INTO v_doc_inv;

  -- Invoice items (SP-019: PO=10, Invoice=8 → mismatch!)
  INSERT INTO po_document_items (document_id, product_code, product_name, unit, quantity, lot_number, expiry_date, unit_price)
  VALUES
    (v_doc_inv, 'SP-007', 'Kim mổ KM-003', 'Hộp', 5, 'LOT-VN-2026-01', '2028-12-31', 1850000),
    (v_doc_inv, 'SP-008', 'Chỉ phẫu thuật Vicryl 2-0', 'Hộp', 8, 'LOT-VN-2026-02', '2028-06-30', 1200000),
    (v_doc_inv, 'SP-027', 'Găng tay phẫu thuật vô trùng size 7', 'Hộp', 5, 'LOT-VN-2026-03', '2028-03-31', 500000),
    (v_doc_inv, 'SP-019', 'Kháng sinh Meropenem 1g', 'Hộp', 8, 'LOT-VN-2026-04', '2028-09-30', 325000);

  -- Packing List
  INSERT INTO po_documents (po_id, doc_type, doc_number, doc_date, entered_by)
  VALUES (v_po3, 'packing_list', 'PL-VN-2026-0042', '2026-03-05', v_logistics)
  RETURNING id INTO v_doc_pl;

  -- Packing List items (same as PO — matched)
  INSERT INTO po_document_items (document_id, product_code, product_name, unit, quantity, lot_number, expiry_date, unit_price)
  VALUES
    (v_doc_pl, 'SP-007', 'Kim mổ KM-003', 'Hộp', 5, 'LOT-VN-2026-01', '2028-12-31', 1850000),
    (v_doc_pl, 'SP-008', 'Chỉ phẫu thuật Vicryl 2-0', 'Hộp', 8, 'LOT-VN-2026-02', '2028-06-30', 1200000),
    (v_doc_pl, 'SP-027', 'Găng tay phẫu thuật vô trùng size 7', 'Hộp', 5, 'LOT-VN-2026-03', '2028-03-31', 500000),
    (v_doc_pl, 'SP-019', 'Kháng sinh Meropenem 1g', 'Hộp', 10, 'LOT-VN-2026-04', '2028-09-30', 325000);

  -- Verification Results
  INSERT INTO verification_results (po_id, doc_type, verified_by, verified_at, status, mismatches, notes)
  VALUES
    (v_po3, 'invoice', v_logistics, '2026-03-06 14:30:00+07', 'confirmed_with_note',
     '[{"field":"quantity","product":"SP-019","source_value":10,"target_value":8,"note":"NCC giao thiếu 2 hộp"}]'::jsonb,
     'NCC giao thiếu 2 hộp SP-019 (Meropenem), sẽ giao bổ sung đợt sau'),
    (v_po3, 'packing_list', v_logistics, '2026-03-06 14:35:00+07', 'matched',
     '[]'::jsonb, NULL);

  -- =====================
  -- D. IMPORT SHIPMENTS (2 shipments)
  -- =====================

  -- NK-2026-0001: IN_TRANSIT (linked to PO-0001 Dräger)
  INSERT INTO import_shipments (
    code, po_id, customs_declaration_no, declaration_date, port,
    hs_code, device_class, registration_number,
    fob_price, freight, insurance, cif_price,
    exchange_rate, cif_vnd, import_tax_pct, import_tax,
    vat_pct, vat_amount, storage_fee, customs_fee, other_fees,
    total_cost, unit_cost,
    status, created_by, notes
  ) VALUES (
    'NK-2026-0001', v_po1, '302468/NKD/HQ', '2026-03-10', 'Hải Phòng',
    '9018.19.00', 'C', 'TBYT-2024-001',
    38500.00, 2100.00, 410.00, 41010.00,
    25350, 1039603500, 0, 0,
    8, 83168280, 5500000, 3200000, 8000000,
    1139471780, 284867945,
    'in_transit', v_logistics, 'Tàu dự kiến cập cảng Hải Phòng 20/03/2026'
  ) RETURNING id INTO v_nk1;

  -- NK-2026-0002: CLEARED (linked to PO-0002 B.Braun)
  INSERT INTO import_shipments (
    code, po_id, customs_declaration_no, declaration_date, port,
    hs_code, device_class, registration_number,
    fob_price, freight, insurance, cif_price,
    exchange_rate, cif_vnd, import_tax_pct, import_tax,
    vat_pct, vat_amount, storage_fee, customs_fee, other_fees,
    total_cost, unit_cost,
    status, created_by, notes
  ) VALUES (
    'NK-2026-0002', v_po2, '302469/NKD/HQ', '2026-03-12', 'Đà Nẵng',
    '9018.31.00', 'B', 'TBYT-2024-002',
    5200.00, 800.00, 120.00, 6120.00,
    25350, 155142000, 0, 0,
    8, 12411360, 2800000, 1800000, 3500000,
    175653360, 87826680,
    'cleared', v_logistics, 'Đã thông quan, đang vận chuyển về kho'
  ) RETURNING id INTO v_nk2;

  -- =====================
  -- E. IMPORT DOCUMENTS (8 types × 2 shipments = 16 rows)
  -- =====================
  
  -- NK-0001 documents
  INSERT INTO import_documents (shipment_id, doc_type, is_required, is_checked, cross_check_status) VALUES
    (v_nk1, 'commercial_invoice', true, true, 'matched'),
    (v_nk1, 'packing_list', true, true, 'matched'),
    (v_nk1, 'bill_of_lading', true, true, 'pending'),
    (v_nk1, 'certificate_of_origin', false, true, 'pending'),
    (v_nk1, 'free_sale_cert', false, true, 'pending'),
    (v_nk1, 'iso_13485', false, false, 'pending'),
    (v_nk1, 'registration_cert', false, true, 'pending'),
    (v_nk1, 'import_license', false, false, 'pending');

  -- NK-0002 documents
  INSERT INTO import_documents (shipment_id, doc_type, is_required, is_checked, cross_check_status) VALUES
    (v_nk2, 'commercial_invoice', true, true, 'matched'),
    (v_nk2, 'packing_list', true, true, 'matched'),
    (v_nk2, 'bill_of_lading', true, true, 'matched'),
    (v_nk2, 'certificate_of_origin', false, false, 'pending'),
    (v_nk2, 'free_sale_cert', false, false, 'pending'),
    (v_nk2, 'iso_13485', false, false, 'pending'),
    (v_nk2, 'registration_cert', false, true, 'pending'),
    (v_nk2, 'import_license', false, false, 'pending');

  -- =====================
  -- F. WAREHOUSE RECEIPTS (2 receipts)
  -- =====================

  -- PNK-2026-0001: COMPLETED (from PO-0003 nội địa)
  INSERT INTO warehouse_receipts (
    code, import_shipment_id, po_id, receipt_date, received_by,
    cross_verify_status, cross_verify_detail,
    status, notes, created_by
  ) VALUES (
    'PNK-2026-0001', NULL, v_po3, '2026-03-08', v_thukho,
    'confirmed', '[{"product":"SP-019","field":"quantity","po_value":10,"actual_value":8,"note":"NCC giao thiếu 2 hộp, sẽ bổ sung"}]'::jsonb,
    'completed', 'Đã kiểm đếm và nhập kho. SP-019 thiếu 2 hộp.', v_thukho
  ) RETURNING id INTO v_pnk1;

  -- PNK-0001 receipt items
  INSERT INTO receipt_items (
    receipt_id, product_id, lot_number, expiry_date, registration_number, unit,
    po_quantity, actual_quantity, discrepancy,
    unit_cost, line_total, storage_location, storage_condition,
    is_quarantine, quarantine_reason, cross_check_status, cross_check_fields
  )
  SELECT v_pnk1, p.id, i.lot, i.exp::DATE, i.reg, i.unt,
    i.po_qty, i.act_qty, i.disc,
    i.ucost, i.ltotal, i.loc, i.cond,
    i.quar, i.qreason, i.ccs, i.ccf::jsonb
  FROM (VALUES
    ('SP-007', 'LOT-VN-2026-01', '2028-12-31', 'TBYT-A-001', 'Hộp', 5, 5, 0, 1850000, 9250000, 'A1-T2-O3', 'normal', false, NULL, 'matched', '{}'),
    ('SP-008', 'LOT-VN-2026-02', '2028-06-30', 'TBYT-A-002', 'Hộp', 8, 8, 0, 1200000, 9600000, 'A1-T2-O4', 'normal', false, NULL, 'matched', '{}'),
    ('SP-019', 'LOT-VN-2026-04', '2028-09-30', 'TBYT-A-003', 'Hộp', 10, 8, -2, 325000, 2600000, 'B2-T1-O1', 'normal', false, NULL, 'mismatched', '{"quantity":{"po":10,"actual":8}}')
  ) AS i(pcode, lot, exp, reg, unt, po_qty, act_qty, disc, ucost, ltotal, loc, cond, quar, qreason, ccs, ccf)
  JOIN products p ON p.code = i.pcode;

  -- PNK-2026-0002: INSPECTING (from NK-0002 nhập khẩu)
  INSERT INTO warehouse_receipts (
    code, import_shipment_id, po_id, receipt_date, received_by,
    cross_verify_status, cross_verify_detail,
    status, notes, created_by
  ) VALUES (
    'PNK-2026-0002', v_nk2, v_po2, '2026-03-14', v_thukho,
    'pending', '[]'::jsonb,
    'inspecting', 'Đang kiểm tra chất lượng bơm tiêm và dây truyền', v_thukho
  ) RETURNING id INTO v_pnk2;

  -- PNK-0002 receipt items (SP-014 quarantined!)
  INSERT INTO receipt_items (
    receipt_id, product_id, lot_number, expiry_date, registration_number, unit,
    po_quantity, actual_quantity, discrepancy,
    unit_cost, line_total, storage_location, storage_condition,
    is_quarantine, quarantine_reason, cross_check_status, cross_check_fields
  )
  SELECT v_pnk2, p.id, i.lot, i.exp::DATE, i.reg, i.unt,
    i.po_qty, i.act_qty, i.disc,
    i.ucost, i.ltotal, i.loc, i.cond,
    i.quar, i.qreason, i.ccs, i.ccf::jsonb
  FROM (VALUES
    ('SP-003', 'LOT-BBR-2026-01', '2031-09-30', 'TBYT-B-001', 'Cái', 2, 2, 0, 46000000, 92000000, 'C1-T1-O1', 'normal', false, NULL, 'pending', '{}'),
    ('SP-014', 'LOT-BBR-2026-02', '2031-06-30', 'TBYT-A-004', 'Thùng', 10, 10, 0, 4650000, 46500000, 'A2-T3-O2', 'normal', true, 'Kiểm tra bao bì — 1 thùng bị rách góc ngoài, cần xác nhận chất lượng bên trong', 'pending', '{}')
  ) AS i(pcode, lot, exp, reg, unt, po_qty, act_qty, disc, ucost, ltotal, loc, cond, quar, qreason, ccs, ccf)
  JOIN products p ON p.code = i.pcode;

  -- Update inventory_lots for PNK-0001 completed items (add new lots)
  INSERT INTO inventory_lots (product_id, lot_number, expiry_date, quantity, unit_cost, storage_location, storage_condition, status)
  SELECT p.id, i.lot, i.exp::DATE, i.qty, i.cost, i.loc, i.cond, 'available'
  FROM (VALUES
    ('SP-007', 'LOT-VN-2026-01', '2028-12-31', 5, 1850000, 'A1-T2-O3', 'normal'),
    ('SP-008', 'LOT-VN-2026-02', '2028-06-30', 8, 1200000, 'A1-T2-O4', 'normal'),
    ('SP-019', 'LOT-VN-2026-04', '2028-09-30', 8, 325000, 'B2-T1-O1', 'normal')
  ) AS i(pcode, lot, exp, qty, cost, loc, cond)
  JOIN products p ON p.code = i.pcode
  ON CONFLICT (product_id, lot_number) DO UPDATE SET quantity = inventory_lots.quantity + EXCLUDED.quantity;

END $$;

-- =====================
-- G. MOCK CONSUMPTION HISTORY (72 records: 3 SP × 2 BV × 12 months)
-- =====================
CREATE TABLE IF NOT EXISTS mock_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  hospital_id UUID REFERENCES hospitals(id),
  month DATE NOT NULL,
  qty_delivered INTEGER DEFAULT 0,
  qty_confirmed INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mock_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mc_select" ON mock_consumption FOR SELECT USING (true);
CREATE POLICY "mc_modify" ON mock_consumption FOR ALL USING (public.get_my_role() = 'admin');

INSERT INTO mock_consumption (product_id, hospital_id, month, qty_delivered, qty_confirmed, notes)
SELECT p.id, h.id, m.month::DATE, m.delivered, m.confirmed, m.note
FROM (VALUES
  -- SP-007 × BV Đà Nẵng (12 months)
  ('SP-007', 'BV Đà Nẵng', '2025-03-01', 8, 8, NULL),
  ('SP-007', 'BV Đà Nẵng', '2025-04-01', 12, 12, NULL),
  ('SP-007', 'BV Đà Nẵng', '2025-05-01', 6, 6, NULL),
  ('SP-007', 'BV Đà Nẵng', '2025-06-01', 15, 15, NULL),
  ('SP-007', 'BV Đà Nẵng', '2025-07-01', 10, 10, NULL),
  ('SP-007', 'BV Đà Nẵng', '2025-08-01', 22, 22, 'Đợt mua bổ sung'),
  ('SP-007', 'BV Đà Nẵng', '2025-09-01', 14, 14, NULL),
  ('SP-007', 'BV Đà Nẵng', '2025-10-01', 9, 9, NULL),
  ('SP-007', 'BV Đà Nẵng', '2025-11-01', 11, 11, NULL),
  ('SP-007', 'BV Đà Nẵng', '2025-12-01', 18, 18, 'Cuối năm tăng nhu cầu'),
  ('SP-007', 'BV Đà Nẵng', '2026-01-01', 7, 7, NULL),
  ('SP-007', 'BV Đà Nẵng', '2026-02-01', 13, 13, NULL),
  -- SP-007 × BVTW Huế (12 months)
  ('SP-007', 'BVTW Huế', '2025-03-01', 5, 5, NULL),
  ('SP-007', 'BVTW Huế', '2025-04-01', 8, 8, NULL),
  ('SP-007', 'BVTW Huế', '2025-05-01', 4, 4, NULL),
  ('SP-007', 'BVTW Huế', '2025-06-01', 10, 10, NULL),
  ('SP-007', 'BVTW Huế', '2025-07-01', 7, 7, NULL),
  ('SP-007', 'BVTW Huế', '2025-08-01', 16, 16, NULL),
  ('SP-007', 'BVTW Huế', '2025-09-01', 9, 9, NULL),
  ('SP-007', 'BVTW Huế', '2025-10-01', 6, 6, NULL),
  ('SP-007', 'BVTW Huế', '2025-11-01', 8, 8, NULL),
  ('SP-007', 'BVTW Huế', '2025-12-01', 12, 12, NULL),
  ('SP-007', 'BVTW Huế', '2026-01-01', 5, 5, NULL),
  ('SP-007', 'BVTW Huế', '2026-02-01', 9, 9, NULL),
  -- SP-019 × BV Đà Nẵng (12 months)
  ('SP-019', 'BV Đà Nẵng', '2025-03-01', 20, 20, NULL),
  ('SP-019', 'BV Đà Nẵng', '2025-04-01', 25, 25, NULL),
  ('SP-019', 'BV Đà Nẵng', '2025-05-01', 18, 18, NULL),
  ('SP-019', 'BV Đà Nẵng', '2025-06-01', 30, 30, 'Đợt dịch tăng nhu cầu'),
  ('SP-019', 'BV Đà Nẵng', '2025-07-01', 22, 22, NULL),
  ('SP-019', 'BV Đà Nẵng', '2025-08-01', 28, 28, NULL),
  ('SP-019', 'BV Đà Nẵng', '2025-09-01', 15, 15, NULL),
  ('SP-019', 'BV Đà Nẵng', '2025-10-01', 20, 20, NULL),
  ('SP-019', 'BV Đà Nẵng', '2025-11-01', 24, 24, NULL),
  ('SP-019', 'BV Đà Nẵng', '2025-12-01', 35, 35, 'Cuối năm cao điểm'),
  ('SP-019', 'BV Đà Nẵng', '2026-01-01', 12, 12, NULL),
  ('SP-019', 'BV Đà Nẵng', '2026-02-01', 18, 18, NULL),
  -- SP-019 × BVTW Huế (12 months)
  ('SP-019', 'BVTW Huế', '2025-03-01', 15, 15, NULL),
  ('SP-019', 'BVTW Huế', '2025-04-01', 20, 20, NULL),
  ('SP-019', 'BVTW Huế', '2025-05-01', 12, 12, NULL),
  ('SP-019', 'BVTW Huế', '2025-06-01', 22, 22, NULL),
  ('SP-019', 'BVTW Huế', '2025-07-01', 18, 18, NULL),
  ('SP-019', 'BVTW Huế', '2025-08-01', 25, 25, NULL),
  ('SP-019', 'BVTW Huế', '2025-09-01', 10, 10, NULL),
  ('SP-019', 'BVTW Huế', '2025-10-01', 16, 16, NULL),
  ('SP-019', 'BVTW Huế', '2025-11-01', 19, 19, NULL),
  ('SP-019', 'BVTW Huế', '2025-12-01', 28, 28, NULL),
  ('SP-019', 'BVTW Huế', '2026-01-01', 8, 8, NULL),
  ('SP-019', 'BVTW Huế', '2026-02-01', 14, 14, NULL),
  -- SP-008 × BV Đà Nẵng (12 months)
  ('SP-008', 'BV Đà Nẵng', '2025-03-01', 30, 30, NULL),
  ('SP-008', 'BV Đà Nẵng', '2025-04-01', 35, 35, NULL),
  ('SP-008', 'BV Đà Nẵng', '2025-05-01', 25, 25, NULL),
  ('SP-008', 'BV Đà Nẵng', '2025-06-01', 40, 40, NULL),
  ('SP-008', 'BV Đà Nẵng', '2025-07-01', 32, 32, NULL),
  ('SP-008', 'BV Đà Nẵng', '2025-08-01', 45, 45, 'Ca phẫu thuật tăng'),
  ('SP-008', 'BV Đà Nẵng', '2025-09-01', 28, 28, NULL),
  ('SP-008', 'BV Đà Nẵng', '2025-10-01', 33, 33, NULL),
  ('SP-008', 'BV Đà Nẵng', '2025-11-01', 38, 38, NULL),
  ('SP-008', 'BV Đà Nẵng', '2025-12-01', 50, 50, 'Cuối năm đợt lớn'),
  ('SP-008', 'BV Đà Nẵng', '2026-01-01', 20, 20, NULL),
  ('SP-008', 'BV Đà Nẵng', '2026-02-01', 28, 28, NULL),
  -- SP-008 × BVTW Huế (12 months)
  ('SP-008', 'BVTW Huế', '2025-03-01', 22, 22, NULL),
  ('SP-008', 'BVTW Huế', '2025-04-01', 28, 28, NULL),
  ('SP-008', 'BVTW Huế', '2025-05-01', 18, 18, NULL),
  ('SP-008', 'BVTW Huế', '2025-06-01', 32, 32, NULL),
  ('SP-008', 'BVTW Huế', '2025-07-01', 25, 25, NULL),
  ('SP-008', 'BVTW Huế', '2025-08-01', 38, 38, NULL),
  ('SP-008', 'BVTW Huế', '2025-09-01', 20, 20, NULL),
  ('SP-008', 'BVTW Huế', '2025-10-01', 26, 26, NULL),
  ('SP-008', 'BVTW Huế', '2025-11-01', 30, 30, NULL),
  ('SP-008', 'BVTW Huế', '2025-12-01', 42, 42, NULL),
  ('SP-008', 'BVTW Huế', '2026-01-01', 15, 15, NULL),
  ('SP-008', 'BVTW Huế', '2026-02-01', 22, 22, NULL)
) AS m(pcode, hname, month, delivered, confirmed, note)
JOIN products p ON p.code = m.pcode
JOIN hospitals h ON h.name = m.hname;
