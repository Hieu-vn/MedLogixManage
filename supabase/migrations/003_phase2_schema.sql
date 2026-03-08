-- ========================================
-- Phase 2: M3 + M4 + M5 + Cross-Verification
-- ========================================

-- =====================
-- Enhance Price List
-- =====================
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS price_ceiling NUMERIC(15,2);
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS price_floor NUMERIC(15,2);
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT CURRENT_DATE;
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS valid_to DATE;
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true;

-- =====================
-- Module 3: Purchase Orders
-- =====================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  is_domestic BOOLEAN DEFAULT true,
  purchase_forecast_id UUID REFERENCES purchase_forecasts(id),
  total_amount NUMERIC(15,2) DEFAULT 0,
  vat_pct NUMERIC(5,2) DEFAULT 8,
  vat_amount NUMERIC(15,2) DEFAULT 0,
  shipping_cost NUMERIC(15,2) DEFAULT 0,
  grand_total NUMERIC(15,2) DEFAULT 0,
  payment_terms TEXT,
  expected_delivery DATE,
  actual_delivery DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft','pending','approved','rejected','sent','confirmed','delivering','received','cancelled'
  )),
  rejection_reason TEXT,
  director_notes TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  lot_number TEXT,
  expiry_date DATE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(15,2) NOT NULL,
  price_list_price NUMERIC(15,2),
  price_deviation_pct NUMERIC(5,2) DEFAULT 0,
  line_total NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- PO Documents (Cross-verification data)
-- =====================
CREATE TABLE IF NOT EXISTS po_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('invoice','packing_list','bill_of_lading')),
  doc_number TEXT,
  doc_date DATE,
  file_url TEXT,
  entered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS po_document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES po_documents(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_name TEXT,
  unit TEXT,
  quantity INTEGER,
  lot_number TEXT,
  expiry_date DATE,
  unit_price NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','matched','mismatched','confirmed_with_note')),
  mismatches JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- Module 4: Import Shipments
-- =====================
CREATE TABLE IF NOT EXISTS import_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  po_id UUID REFERENCES purchase_orders(id),
  customs_declaration_no TEXT,
  declaration_date DATE,
  port TEXT,
  hs_code TEXT,
  device_class TEXT CHECK (device_class IN ('A','B','C','D')),
  registration_number TEXT,
  fob_price NUMERIC(15,2) DEFAULT 0,
  freight NUMERIC(15,2) DEFAULT 0,
  insurance NUMERIC(15,2) DEFAULT 0,
  cif_price NUMERIC(15,2) DEFAULT 0,
  exchange_rate NUMERIC(15,2) DEFAULT 25000,
  cif_vnd NUMERIC(15,2) DEFAULT 0,
  import_tax_pct NUMERIC(5,2) DEFAULT 0,
  import_tax NUMERIC(15,2) DEFAULT 0,
  vat_pct NUMERIC(5,2) DEFAULT 8,
  vat_amount NUMERIC(15,2) DEFAULT 0,
  storage_fee NUMERIC(15,2) DEFAULT 0,
  customs_fee NUMERIC(15,2) DEFAULT 0,
  other_fees NUMERIC(15,2) DEFAULT 0,
  total_cost NUMERIC(15,2) DEFAULT 0,
  unit_cost NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'in_transit' CHECK (status IN (
    'in_transit','arrived','declaring','cleared','transporting','completed'
  )),
  created_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES import_shipments(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'commercial_invoice','packing_list','bill_of_lading',
    'certificate_of_origin','free_sale_cert','iso_13485',
    'registration_cert','import_license'
  )),
  is_required BOOLEAN DEFAULT false,
  is_checked BOOLEAN DEFAULT false,
  file_url TEXT,
  uploaded_at TIMESTAMPTZ,
  cross_check_status TEXT DEFAULT 'pending' CHECK (cross_check_status IN ('pending','matched','mismatched','confirmed')),
  cross_check_detail JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- Module 5: Warehouse Receipts
-- =====================
CREATE TABLE IF NOT EXISTS warehouse_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  import_shipment_id UUID REFERENCES import_shipments(id),
  po_id UUID REFERENCES purchase_orders(id),
  receipt_date DATE DEFAULT CURRENT_DATE,
  received_by UUID REFERENCES profiles(id),
  cross_verify_status TEXT DEFAULT 'pending' CHECK (cross_verify_status IN ('pending','matched','mismatched','confirmed')),
  cross_verify_detail JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','inspecting','verified','completed','quarantine')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES warehouse_receipts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  lot_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  registration_number TEXT,
  unit TEXT,
  po_quantity INTEGER DEFAULT 0,
  actual_quantity INTEGER DEFAULT 0,
  discrepancy INTEGER DEFAULT 0,
  unit_cost NUMERIC(15,2) DEFAULT 0,
  line_total NUMERIC(15,2) DEFAULT 0,
  storage_location TEXT,
  storage_condition TEXT DEFAULT 'normal' CHECK (storage_condition IN ('normal','cool','cold')),
  is_quarantine BOOLEAN DEFAULT false,
  quarantine_reason TEXT,
  cross_check_status TEXT DEFAULT 'pending',
  cross_check_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- RLS Policies
-- =====================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

-- PO: logistics + director + admin can see, logistics + admin modify
CREATE POLICY "po_select" ON purchase_orders FOR SELECT USING (
  public.get_my_role() IN ('logistics_manager','director','admin')
);
CREATE POLICY "po_modify" ON purchase_orders FOR ALL USING (
  public.get_my_role() IN ('logistics_manager','admin')
);
-- Director can update PO (for approval)
CREATE POLICY "po_director_approve" ON purchase_orders FOR UPDATE USING (
  public.get_my_role() = 'director'
);

CREATE POLICY "poi_select" ON po_items FOR SELECT USING (true);
CREATE POLICY "poi_modify" ON po_items FOR ALL USING (
  public.get_my_role() IN ('logistics_manager','admin')
);

CREATE POLICY "pod_select" ON po_documents FOR SELECT USING (true);
CREATE POLICY "pod_modify" ON po_documents FOR ALL USING (
  public.get_my_role() IN ('logistics_manager','admin')
);

CREATE POLICY "podi_select" ON po_document_items FOR SELECT USING (true);
CREATE POLICY "podi_modify" ON po_document_items FOR ALL USING (
  public.get_my_role() IN ('logistics_manager','admin')
);

CREATE POLICY "vr_select" ON verification_results FOR SELECT USING (true);
CREATE POLICY "vr_modify" ON verification_results FOR ALL USING (
  public.get_my_role() IN ('logistics_manager','warehouse_keeper','admin')
);

-- Import: logistics + admin
CREATE POLICY "is_select" ON import_shipments FOR SELECT USING (
  public.get_my_role() IN ('logistics_manager','director','admin')
);
CREATE POLICY "is_modify" ON import_shipments FOR ALL USING (
  public.get_my_role() IN ('logistics_manager','admin')
);

CREATE POLICY "id_select" ON import_documents FOR SELECT USING (true);
CREATE POLICY "id_modify" ON import_documents FOR ALL USING (
  public.get_my_role() IN ('logistics_manager','admin')
);

-- Warehouse: warehouse_keeper + logistics + admin
CREATE POLICY "wr_select" ON warehouse_receipts FOR SELECT USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','director','admin')
);
CREATE POLICY "wr_modify" ON warehouse_receipts FOR ALL USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);

CREATE POLICY "ri_select" ON receipt_items FOR SELECT USING (true);
CREATE POLICY "ri_modify" ON receipt_items FOR ALL USING (
  public.get_my_role() IN ('warehouse_keeper','logistics_manager','admin')
);

-- =====================
-- Indexes
-- =====================
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_poi_po ON po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_poi_product ON po_items(product_id);
CREATE INDEX IF NOT EXISTS idx_is_po ON import_shipments(po_id);
CREATE INDEX IF NOT EXISTS idx_is_status ON import_shipments(status);
CREATE INDEX IF NOT EXISTS idx_wr_shipment ON warehouse_receipts(import_shipment_id);
CREATE INDEX IF NOT EXISTS idx_wr_status ON warehouse_receipts(status);
CREATE INDEX IF NOT EXISTS idx_ri_receipt ON receipt_items(receipt_id);
