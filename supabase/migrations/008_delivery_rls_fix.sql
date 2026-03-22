-- ========================================
-- 008: Delivery RLS Fix + Sales Forecast INSERT Fix
-- Fixes: P6 (over-permissive delivery RLS), P7 (sf INSERT)
-- ========================================

-- =============================================
-- P6: DELIVERY TABLES — Replace over-permissive RLS
-- Old policy: "Enable all for authenticated users" (any user = full CRUD)
-- New: role-based matching MODULE_ACCESS in auth.jsx
-- =============================================

-- === deliveries ===
DROP POLICY IF EXISTS "Enable all for authenticated users" ON deliveries;

CREATE POLICY "deliveries_select" ON deliveries FOR SELECT USING (
  public.get_my_role() IN ('logistics_manager', 'warehouse_keeper', 'director', 'admin')
);
CREATE POLICY "deliveries_insert" ON deliveries FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'warehouse_keeper', 'admin'));
CREATE POLICY "deliveries_update" ON deliveries FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'warehouse_keeper', 'admin'));
CREATE POLICY "deliveries_delete" ON deliveries FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

-- === delivery_items ===
DROP POLICY IF EXISTS "Enable all for authenticated users" ON delivery_items;

CREATE POLICY "delivery_items_select" ON delivery_items FOR SELECT USING (
  public.get_my_role() IN ('logistics_manager', 'warehouse_keeper', 'director', 'admin')
);
CREATE POLICY "delivery_items_insert" ON delivery_items FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'warehouse_keeper', 'admin'));
CREATE POLICY "delivery_items_update" ON delivery_items FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'warehouse_keeper', 'admin'));
CREATE POLICY "delivery_items_delete" ON delivery_items FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

-- === carrier_ratings ===
DROP POLICY IF EXISTS "Enable all for authenticated users" ON carrier_ratings;

CREATE POLICY "carrier_ratings_select" ON carrier_ratings FOR SELECT USING (
  public.get_my_role() IN ('logistics_manager', 'warehouse_keeper', 'director', 'admin')
);
-- Only logistics_manager and admin can rate carriers
CREATE POLICY "carrier_ratings_insert" ON carrier_ratings FOR INSERT
  WITH CHECK (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "carrier_ratings_update" ON carrier_ratings FOR UPDATE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));
CREATE POLICY "carrier_ratings_delete" ON carrier_ratings FOR DELETE
  USING (public.get_my_role() IN ('logistics_manager', 'admin'));

-- =============================================
-- P7: SALES FORECASTS INSERT — restrict to proper roles
-- Old: sf_insert WITH CHECK (true) — any user can insert
-- New: only sales, sales_manager, admin can insert
-- =============================================
DROP POLICY IF EXISTS "sf_insert" ON sales_forecasts;
CREATE POLICY "sf_insert" ON sales_forecasts FOR INSERT
  WITH CHECK (public.get_my_role() IN ('sales', 'sales_manager', 'admin'));

-- Also add UPDATE policy for sales_forecasts (sales can only update own drafts)
DROP POLICY IF EXISTS "sf_update" ON sales_forecasts;
CREATE POLICY "sf_update" ON sales_forecasts FOR UPDATE USING (
  CASE
    WHEN public.get_my_role() = 'sales' THEN created_by = auth.uid() AND status = 'draft'
    WHEN public.get_my_role() IN ('sales_manager', 'logistics_manager', 'director', 'admin') THEN true
    ELSE false
  END
);
