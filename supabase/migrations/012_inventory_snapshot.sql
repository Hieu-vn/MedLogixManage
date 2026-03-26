-- ========================================
-- 012: Phase 7 - Inventory Snapshots for Trend Analysis
-- ========================================

-- 1. Create inventory_snapshots table
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  total_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Only admins, directors, logistics can view (No Sales)
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_snap_select" ON inventory_snapshots FOR SELECT USING (
  public.get_my_role() IN ('admin', 'director', 'logistics_manager')
);

-- 2. RPC to take snapshot
CREATE OR REPLACE FUNCTION public.take_inventory_snapshot()
RETURNS VOID AS $$
DECLARE
  v_total_value NUMERIC(15,2) := 0;
  v_total_items INTEGER := 0;
BEGIN
  -- Tính tổng tồn kho hiện tại (chỉ lấy hàng available, số lượng > 0)
  SELECT 
    COALESCE(SUM(quantity * unit_cost), 0),
    COALESCE(SUM(quantity), 0)
  INTO 
    v_total_value, 
    v_total_items
  FROM public.inventory_lots
  WHERE status = 'available' AND quantity > 0;

  -- Upsert vào snapshots
  INSERT INTO public.inventory_snapshots (snapshot_date, total_value, total_items)
  VALUES (CURRENT_DATE, v_total_value, v_total_items)
  ON CONFLICT (snapshot_date) 
  DO UPDATE SET 
    total_value = EXCLUDED.total_value,
    total_items = EXCLUDED.total_items;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC to get trend data (Last 30 days)
CREATE OR REPLACE FUNCTION public.get_inventory_trend()
RETURNS TABLE (
  snapshot_date DATE,
  total_value NUMERIC(15,2),
  total_items INTEGER
) AS $$
BEGIN
  -- BẢO MẬT P0: Chặn role Sales gọi hàm này (trả về rỗng)
  IF public.get_my_role() IN ('sales') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    s.snapshot_date,
    s.total_value,
    s.total_items
  FROM public.inventory_snapshots s
  ORDER BY s.snapshot_date ASC
  LIMIT 30;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- MOCK DATA: Chèn dữ liệu giả lập tự động trong 10 ngày qua
-- để biểu đồ AreaChart có thể hiển thị đường cong ngay lập tức!
-- ========================================
DO $$
DECLARE
  i INTEGER;
  base_value NUMERIC(15,2);
  var_value NUMERIC(15,2);
  v_items INTEGER;
BEGIN
  -- Lấy giá trị tồn kho thực tế hiện tại làm mốc
  SELECT COALESCE(SUM(quantity * unit_cost), 500000000), COALESCE(SUM(quantity), 1500)
  INTO base_value, v_items
  FROM public.inventory_lots
  WHERE status = 'available' AND quantity > 0;
  
  -- Tạo loop lùi về 10 ngày trước
  FOR i IN REVERSE 10..1 LOOP
    -- Random dao động +- 10%
    var_value := base_value * (1 + (random() * 0.2 - 0.1));
    
    INSERT INTO public.inventory_snapshots (snapshot_date, total_value, total_items)
    VALUES (CURRENT_DATE - i, var_value, v_items + (random() * 100 - 50)::INT)
    ON CONFLICT (snapshot_date) DO NOTHING;
  END LOOP;
  
  -- Luôn ưu tiên chụp ngay giá trị THỰC TẾ của ngày hôm nay vào cuối cùng
  PERFORM public.take_inventory_snapshot();
END;
$$;
