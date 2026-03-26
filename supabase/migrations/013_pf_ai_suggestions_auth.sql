-- ========================================
-- 013: Purchase Forecast AI Suggestions & Role Bugfix
-- ========================================

-- 1. Thêm cột lưu trữ Đề xuất AI (system_suggested_qty)
ALTER TABLE public.purchase_forecast_items
ADD COLUMN IF NOT EXISTS system_suggested_qty INTEGER DEFAULT 0;

-- =============================================
-- 2. Sửa Lỗi RLS cho QL Sales (Theo Questionnaire File)
-- Yêu cầu: QL Sales có quyền gộp phiếu và lên Dự trù mua hàng
-- =============================================

-- Sửa quyền truy cập Purchase Forecasts: Thêm 'sales_manager'
DROP POLICY IF EXISTS "pf_select" ON purchase_forecasts;
CREATE POLICY "pf_select" ON purchase_forecasts FOR SELECT USING (
  public.get_my_role() IN ('sales_manager', 'logistics_manager', 'director', 'admin')
);

DROP POLICY IF EXISTS "pf_modify" ON purchase_forecasts;
CREATE POLICY "pf_modify" ON purchase_forecasts FOR ALL USING (
  -- BUG CŨ: Chỉ cho logistics_manager. NAY THÊM sales_manager.
  public.get_my_role() IN ('sales_manager', 'logistics_manager', 'admin')
);

-- Sửa quyền truy cập Purchase Forecast Items
DROP POLICY IF EXISTS "pfi_select" ON purchase_forecast_items;
CREATE POLICY "pfi_select" ON purchase_forecast_items FOR SELECT USING (
  public.get_my_role() IN ('sales_manager', 'logistics_manager', 'director', 'admin')
);

DROP POLICY IF EXISTS "pfi_modify" ON purchase_forecast_items;
CREATE POLICY "pfi_modify" ON purchase_forecast_items FOR ALL USING (
  public.get_my_role() IN ('sales_manager', 'logistics_manager', 'admin')
);
