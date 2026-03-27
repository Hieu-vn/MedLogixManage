-- ========================================
-- MedLogixManage — XÓA TOÀN BỘ DỮ LIỆU
-- Chạy trên Supabase SQL Editor
-- Giữ lại: schema, RLS policies, user accounts
-- An toàn: skip bảng chưa tồn tại
-- ========================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  -- Danh sách bảng cần xóa (thứ tự: child → parent)
  FOREACH tbl IN ARRAY ARRAY[
    'audit_trail',
    'delivery_items', 'deliveries',
    'warehouse_receipt_items', 'warehouse_receipts',
    'stock_export_items', 'stock_exports',
    'stock_transfer_items', 'stock_transfers', 'stock_transfer_request_items', 'stock_transfer_requests',
    'import_shipment_documents', 'import_shipment_items', 'import_shipments',
    'purchase_order_items', 'purchase_orders',
    'purchase_forecast_items', 'purchase_forecasts',
    'sales_forecast_items', 'sales_forecasts',
    'inventory_lots', 'inventory_snapshots',
    'price_lists',
    'carriers',
    'suppliers',
    'hospitals',
    'products'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('TRUNCATE TABLE public.%I CASCADE', tbl);
      RAISE NOTICE 'Truncated: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (not found): %', tbl;
    END IF;
  END LOOP;

  -- Xóa tên cá nhân, thay bằng tên vai trò
  UPDATE profiles SET full_name = CASE role
    WHEN 'admin' THEN 'Admin'
    WHEN 'director' THEN 'Giám đốc'
    WHEN 'sales_manager' THEN 'QL Sales'
    WHEN 'logistics_manager' THEN 'QL Logistics'
    WHEN 'warehouse_keeper' THEN 'Thủ kho'
    WHEN 'sales' THEN 'Sales'
    ELSE role
  END;
  RAISE NOTICE 'Cleared full_name in profiles';
END $$;

SELECT 'Đã xóa toàn bộ dữ liệu thành công!' AS result;
