-- ========================================
-- Phase: Stock Transfer Module (Điều chuyển kho)
-- ========================================

-- Transfer Requests (Yêu cầu điều chuyển)
CREATE TABLE IF NOT EXISTS stock_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  from_warehouse TEXT NOT NULL DEFAULT 'KHO_CHINH',
  to_warehouse TEXT NOT NULL,
  request_date DATE DEFAULT CURRENT_DATE,
  requested_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending','approved','rejected','completed','cancelled'
  )),
  rejection_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transfer Request Items
CREATE TABLE IF NOT EXISTS stock_transfer_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES stock_transfer_requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  inventory_lot_id UUID REFERENCES inventory_lots(id),
  lot_number TEXT NOT NULL,
  expiry_date DATE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stock Transfers (Phiếu điều chuyển — execution of approved requests)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  request_id UUID REFERENCES stock_transfer_requests(id),
  from_warehouse TEXT NOT NULL DEFAULT 'KHO_CHINH',
  to_warehouse TEXT NOT NULL,
  transfer_date DATE DEFAULT CURRENT_DATE,
  transferred_by UUID REFERENCES profiles(id),
  received_by UUID REFERENCES profiles(id),
  received_at TIMESTAMPTZ,
  status TEXT DEFAULT 'transferring' CHECK (status IN (
    'transferring','partial','completed','cancelled'
  )),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stock Transfer Items
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  inventory_lot_id UUID REFERENCES inventory_lots(id),
  lot_number TEXT NOT NULL,
  expiry_date DATE,
  requested_qty INTEGER DEFAULT 0,
  transferred_qty INTEGER NOT NULL CHECK (transferred_qty > 0),
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE stock_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Transfer Requests: warehouse_keeper + logistics + director + admin
CREATE POLICY "str_select" ON stock_transfer_requests FOR SELECT USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','director','admin')
);
CREATE POLICY "str_insert" ON stock_transfer_requests FOR INSERT WITH CHECK (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);
CREATE POLICY "str_update" ON stock_transfer_requests FOR UPDATE USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','director','admin')
);
CREATE POLICY "str_delete" ON stock_transfer_requests FOR DELETE USING (
  public.get_my_role() IN ('logistics_manager','admin')
);

CREATE POLICY "stri_select" ON stock_transfer_request_items FOR SELECT USING (true);
CREATE POLICY "stri_modify" ON stock_transfer_request_items FOR ALL USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);

-- Transfers: same access as requests
CREATE POLICY "st_select" ON stock_transfers FOR SELECT USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','director','admin')
);
CREATE POLICY "st_insert" ON stock_transfers FOR INSERT WITH CHECK (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);
CREATE POLICY "st_update" ON stock_transfers FOR UPDATE USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);
CREATE POLICY "st_delete" ON stock_transfers FOR DELETE USING (
  public.get_my_role() IN ('logistics_manager','admin')
);

CREATE POLICY "sti_select" ON stock_transfer_items FOR SELECT USING (true);
CREATE POLICY "sti_modify" ON stock_transfer_items FOR ALL USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_str_status ON stock_transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_str_from ON stock_transfer_requests(from_warehouse);
CREATE INDEX IF NOT EXISTS idx_str_to ON stock_transfer_requests(to_warehouse);
CREATE INDEX IF NOT EXISTS idx_stri_request ON stock_transfer_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_st_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_st_request ON stock_transfers(request_id);
CREATE INDEX IF NOT EXISTS idx_sti_transfer ON stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_sti_product ON stock_transfer_items(product_id);
