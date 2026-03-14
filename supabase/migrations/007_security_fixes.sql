-- ========================================
-- 007: Security & Data Integrity Fixes
-- Fixes: A1-A4, A15, A17, NFR-S.2
-- ========================================

-- =============================================
-- A1: CHẶN USER TỰ ĐỔI ROLE
-- Trigger trên profiles ngăn thay đổi role
-- trừ khi người thực hiện là admin
-- =============================================
CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Nếu role thay đổi, kiểm tra người thực hiện có phải admin
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF public.get_my_role() != 'admin' THEN
      RAISE EXCEPTION 'Không có quyền thay đổi role. Chỉ admin mới được phép.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_role_change ON profiles;
CREATE TRIGGER check_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_change();

-- =============================================
-- A2: TÁCH FOR ALL → INSERT / UPDATE / DELETE riêng
-- Tránh conflict giữa SELECT (public) + ALL (admin)
-- =============================================

-- === products ===
DROP POLICY IF EXISTS "products_modify" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "products_update" ON products FOR UPDATE
  USING (public.get_my_role() = 'admin');
CREATE POLICY "products_delete" ON products FOR DELETE
  USING (public.get_my_role() = 'admin');

-- === hospitals ===
DROP POLICY IF EXISTS "hospitals_modify" ON hospitals;
CREATE POLICY "hospitals_insert" ON hospitals FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "hospitals_update" ON hospitals FOR UPDATE
  USING (public.get_my_role() = 'admin');
CREATE POLICY "hospitals_delete" ON hospitals FOR DELETE
  USING (public.get_my_role() = 'admin');

-- === suppliers ===
DROP POLICY IF EXISTS "suppliers_modify" ON suppliers;
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
  USING (public.get_my_role() = 'admin');
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE
  USING (public.get_my_role() = 'admin');

-- === carriers ===
DROP POLICY IF EXISTS "carriers_modify" ON carriers;
CREATE POLICY "carriers_insert" ON carriers FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "carriers_update" ON carriers FOR UPDATE
  USING (public.get_my_role() = 'admin');
CREATE POLICY "carriers_delete" ON carriers FOR DELETE
  USING (public.get_my_role() = 'admin');

-- === inventory_lots ===
DROP POLICY IF EXISTS "inv_modify" ON inventory_lots;
CREATE POLICY "inv_insert" ON inventory_lots FOR INSERT
  WITH CHECK (public.get_my_role() IN ('warehouse_keeper', 'logistics_manager', 'admin'));
CREATE POLICY "inv_update" ON inventory_lots FOR UPDATE
  USING (public.get_my_role() IN ('warehouse_keeper', 'logistics_manager', 'admin'));
CREATE POLICY "inv_delete" ON inventory_lots FOR DELETE
  USING (public.get_my_role() IN ('warehouse_keeper', 'logistics_manager', 'admin'));

-- === price_list ===
DROP POLICY IF EXISTS "pl_modify" ON price_list;
CREATE POLICY "pl_insert" ON price_list FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "pl_update" ON price_list FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "pl_delete" ON price_list FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

-- === po_items ===
DROP POLICY IF EXISTS "poi_modify" ON po_items;
CREATE POLICY "poi_insert" ON po_items FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "poi_update" ON po_items FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "poi_delete" ON po_items FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

-- === po_documents ===
DROP POLICY IF EXISTS "pod_modify" ON po_documents;
CREATE POLICY "pod_insert" ON po_documents FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "pod_update" ON po_documents FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "pod_delete" ON po_documents FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

-- === po_document_items ===
DROP POLICY IF EXISTS "podi_modify" ON po_document_items;
CREATE POLICY "podi_insert" ON po_document_items FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "podi_update" ON po_document_items FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "podi_delete" ON po_document_items FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

-- === verification_results ===
DROP POLICY IF EXISTS "vr_modify" ON verification_results;
CREATE POLICY "vr_insert" ON verification_results FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'warehouse_keeper', 'admin'));
CREATE POLICY "vr_update" ON verification_results FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'warehouse_keeper', 'admin'));
CREATE POLICY "vr_delete" ON verification_results FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'warehouse_keeper', 'admin'));

-- === purchase_orders (special: director can only UPDATE for approval) ===
DROP POLICY IF EXISTS "po_modify" ON purchase_orders;
CREATE POLICY "po_insert" ON purchase_orders FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "po_delete" ON purchase_orders FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
-- po_director_approve already exists for director UPDATE

-- === import_shipments ===
DROP POLICY IF EXISTS "is_modify" ON import_shipments;
CREATE POLICY "is_insert" ON import_shipments FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "is_update" ON import_shipments FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "is_delete" ON import_shipments FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

-- === import_documents ===
DROP POLICY IF EXISTS "id_modify" ON import_documents;
CREATE POLICY "id_insert" ON import_documents FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "id_update" ON import_documents FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "id_delete" ON import_documents FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

-- === warehouse_receipts ===
DROP POLICY IF EXISTS "wr_modify" ON warehouse_receipts;
CREATE POLICY "wr_insert" ON warehouse_receipts FOR INSERT
  WITH CHECK (public.get_my_role() IN ('warehouse_keeper', 'logistics_manager', 'admin'));
CREATE POLICY "wr_update" ON warehouse_receipts FOR UPDATE
  USING (public.get_my_role() IN ('warehouse_keeper', 'logistics_manager', 'admin'));
CREATE POLICY "wr_delete" ON warehouse_receipts FOR DELETE
  USING (public.get_my_role() IN ('warehouse_keeper', 'logistics_manager', 'admin'));

-- === receipt_items ===
DROP POLICY IF EXISTS "ri_modify" ON receipt_items;
CREATE POLICY "ri_insert" ON receipt_items FOR INSERT
  WITH CHECK (public.get_my_role() IN ('warehouse_keeper', 'logistics_manager', 'admin'));
CREATE POLICY "ri_update" ON receipt_items FOR UPDATE
  USING (public.get_my_role() IN ('warehouse_keeper', 'logistics_manager', 'admin'));
CREATE POLICY "ri_delete" ON receipt_items FOR DELETE
  USING (public.get_my_role() IN ('warehouse_keeper', 'logistics_manager', 'admin'));

-- === purchase_forecast + items (same treatment) ===
DROP POLICY IF EXISTS "pf_modify" ON purchase_forecasts;
CREATE POLICY "pf_insert" ON purchase_forecasts FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "pf_update" ON purchase_forecasts FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "pf_delete" ON purchase_forecasts FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

DROP POLICY IF EXISTS "pfi_modify" ON purchase_forecast_items;
CREATE POLICY "pfi_insert" ON purchase_forecast_items FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "pfi_update" ON purchase_forecast_items FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "pfi_delete" ON purchase_forecast_items FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

-- =============================================
-- A3: THÊM DELETE POLICY CHO sales_forecasts
-- Sales chỉ xóa được phiếu draft của mình
-- =============================================
CREATE POLICY "sf_delete" ON sales_forecasts FOR DELETE USING (
  (created_by = auth.uid() AND status = 'draft')
  OR public.get_my_role() = 'admin'
);

-- =============================================
-- A4: CHUẨN HÓA AUDIT_LOGS RLS
-- Xóa policy cũ trùng lặp, chỉ giữ 005
-- =============================================
DROP POLICY IF EXISTS "al_select" ON audit_logs;
DROP POLICY IF EXISTS "al_insert" ON audit_logs;
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;

-- Admin + Director xem logs
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (
  public.get_my_role() IN ('admin', 'director')
);

-- Chỉ system (SECURITY DEFINER trigger) insert — 
-- audit_trigger_func() đã là SECURITY DEFINER nên bypass RLS
-- Nhưng để an toàn cho edge cases:
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (true);

-- Không ai được UPDATE/DELETE audit logs (immutable)
-- Không tạo policy → mặc định bị chặn bởi RLS

-- =============================================
-- NFR-S.2: SALES CHỈ THẤY PHIẾU MÌNH
-- Sửa sf_select: role 'sales' chỉ thấy own
-- =============================================
DROP POLICY IF EXISTS "sf_select" ON sales_forecasts;
CREATE POLICY "sf_select" ON sales_forecasts FOR SELECT USING (
  CASE
    WHEN public.get_my_role() = 'sales' THEN created_by = auth.uid()
    WHEN public.get_my_role() IN ('sales_manager', 'logistics_manager', 'director', 'admin') THEN true
    ELSE false
  END
);

-- =============================================
-- A15: PO STATUS TRANSITION VALIDATION
-- Chỉ cho phép chuyển trạng thái hợp lệ
-- =============================================
CREATE OR REPLACE FUNCTION validate_po_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "draft": ["pending", "cancelled"],
    "pending": ["approved", "rejected", "cancelled"],
    "approved": ["sent", "cancelled"],
    "rejected": ["draft"],
    "sent": ["confirmed", "cancelled"],
    "confirmed": ["delivering", "cancelled"],
    "delivering": ["received"],
    "received": [],
    "cancelled": []
  }';
  allowed_next JSONB;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  allowed_next := valid_transitions -> OLD.status;
  
  IF allowed_next IS NULL OR NOT (allowed_next ? NEW.status) THEN
    RAISE EXCEPTION 'Không thể chuyển PO từ "%" sang "%". Chuyển đổi không hợp lệ.', OLD.status, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_po_status ON purchase_orders;
CREATE TRIGGER check_po_status
  BEFORE UPDATE OF status ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION validate_po_status_transition();

-- =============================================
-- A17: UNIQUE CONSTRAINT CHO PRICE_LIST
-- Chỉ 1 giá current cho mỗi cặp (product, supplier)
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_list_unique_current
  ON price_list (product_id, supplier_id)
  WHERE is_current = true;

-- =============================================
-- Additional indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_inv_lots_status ON inventory_lots(status);
CREATE INDEX IF NOT EXISTS idx_inv_lots_product_status ON inventory_lots(product_id, status);
CREATE INDEX IF NOT EXISTS idx_sf_created_by ON sales_forecasts(created_by);
CREATE INDEX IF NOT EXISTS idx_sf_status ON sales_forecasts(status);
