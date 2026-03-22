-- ========================================
-- Phase 3: Stock Export Module (Xuất kho)
-- ========================================

-- Stock Export header (Phiếu xuất kho)
CREATE TABLE IF NOT EXISTS stock_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  hospital_id UUID REFERENCES hospitals(id),
  export_date DATE DEFAULT CURRENT_DATE,
  requested_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft','pending','approved','completed','rejected'
  )),
  rejection_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stock Export items (Chi tiết xuất kho)
CREATE TABLE IF NOT EXISTS stock_export_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id UUID REFERENCES stock_exports(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  inventory_lot_id UUID REFERENCES inventory_lots(id),
  lot_number TEXT NOT NULL,
  expiry_date DATE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit TEXT,
  storage_condition TEXT DEFAULT 'normal' CHECK (storage_condition IN ('normal','cool','cold')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE stock_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_export_items ENABLE ROW LEVEL SECURITY;

-- Stock exports: warehouse_keeper + logistics + admin can see
CREATE POLICY "se_select" ON stock_exports FOR SELECT USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','director','admin')
);
CREATE POLICY "se_insert" ON stock_exports FOR INSERT WITH CHECK (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);
CREATE POLICY "se_update" ON stock_exports FOR UPDATE USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);
CREATE POLICY "se_delete" ON stock_exports FOR DELETE USING (
  public.get_my_role() IN ('logistics_manager','admin')
);

CREATE POLICY "sei_select" ON stock_export_items FOR SELECT USING (true);
CREATE POLICY "sei_insert" ON stock_export_items FOR INSERT WITH CHECK (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);
CREATE POLICY "sei_update" ON stock_export_items FOR UPDATE USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);
CREATE POLICY "sei_delete" ON stock_export_items FOR DELETE USING (
  public.get_my_role() IN ('logistics_manager','admin')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_se_status ON stock_exports(status);
CREATE INDEX IF NOT EXISTS idx_se_hospital ON stock_exports(hospital_id);
CREATE INDEX IF NOT EXISTS idx_sei_export ON stock_export_items(export_id);
CREATE INDEX IF NOT EXISTS idx_sei_product ON stock_export_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sei_lot ON stock_export_items(inventory_lot_id);
