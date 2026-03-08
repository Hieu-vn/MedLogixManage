-- ========================================
-- MedLogixManage — Initial Database Schema
-- PostgreSQL (Supabase)
-- ========================================

-- 1. Profiles (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sales', 'sales_manager', 'logistics_manager', 'warehouse_keeper', 'director', 'admin')),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'sales')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Products (Master Data)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  packaging TEXT,
  unit TEXT NOT NULL,
  category TEXT,
  storage_condition TEXT DEFAULT 'normal' CHECK (storage_condition IN ('normal', 'cool', 'cold')),
  medical_device_class TEXT CHECK (medical_device_class IN ('A', 'B', 'C', 'D')),
  registration_number TEXT,
  safety_stock_qty INTEGER DEFAULT 0,
  min_shelf_life_months INTEGER DEFAULT 8,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Hospitals
CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  address TEXT,
  contact_person TEXT,
  phone TEXT,
  province TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_code TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  contact_person TEXT,
  country TEXT DEFAULT 'Vietnam',
  is_domestic BOOLEAN DEFAULT true,
  payment_terms TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Carriers
CREATE TABLE IF NOT EXISTS carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  vehicle_type TEXT,
  has_cold_chain BOOLEAN DEFAULT false,
  avg_score NUMERIC(3,2) DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Sales Forecasts (Module 1 - header)
CREATE TABLE IF NOT EXISTS sales_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  sales_person UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'transferred')),
  rejection_reason TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  request_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Sales Forecast Items
CREATE TABLE IF NOT EXISTS sales_forecast_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id UUID REFERENCES sales_forecasts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  hospital_id UUID REFERENCES hospitals(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  needed_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Purchase Forecasts (Module 2 - header)
CREATE TABLE IF NOT EXISTS purchase_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  consolidation_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'po_created')),
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Purchase Forecast Items
CREATE TABLE IF NOT EXISTS purchase_forecast_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id UUID REFERENCES purchase_forecasts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  supplier_id UUID REFERENCES suppliers(id),
  total_requested INTEGER NOT NULL,
  current_stock INTEGER DEFAULT 0,
  available_stock INTEGER DEFAULT 0,
  incoming_qty INTEGER DEFAULT 0,
  qty_to_purchase INTEGER DEFAULT 0,
  suggested_extra INTEGER DEFAULT 0,
  approved_qty INTEGER,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'low')),
  earliest_needed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Inventory Lots (for stock tracking)
CREATE TABLE IF NOT EXISTS inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  lot_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_qty INTEGER DEFAULT 0,
  unit_cost NUMERIC(15,2),
  storage_location TEXT,
  storage_condition TEXT CHECK (storage_condition IN ('normal', 'cool', 'cold')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'quarantine', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, lot_number)
);

-- 11. Price List
CREATE TABLE IF NOT EXISTS price_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  supplier_id UUID REFERENCES suppliers(id),
  unit_price NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'VND',
  effective_date DATE DEFAULT CURRENT_DATE,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- Row Level Security (RLS)
-- ========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_forecast_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_forecast_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: everyone can read all profiles, only update own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());

-- Master Data: everyone can read, only admin can modify
CREATE POLICY "products_select" ON products FOR SELECT USING (true);
CREATE POLICY "products_modify" ON products FOR ALL USING (public.get_my_role() = 'admin');

CREATE POLICY "hospitals_select" ON hospitals FOR SELECT USING (true);
CREATE POLICY "hospitals_modify" ON hospitals FOR ALL USING (public.get_my_role() = 'admin');

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (true);
CREATE POLICY "suppliers_modify" ON suppliers FOR ALL USING (public.get_my_role() = 'admin');

CREATE POLICY "carriers_select" ON carriers FOR SELECT USING (true);
CREATE POLICY "carriers_modify" ON carriers FOR ALL USING (public.get_my_role() = 'admin');

-- Sales Forecasts: sales sees own, managers see all
CREATE POLICY "sf_select" ON sales_forecasts FOR SELECT USING (
  created_by = auth.uid() OR
  public.get_my_role() IN ('sales_manager', 'logistics_manager', 'director', 'admin')
);
CREATE POLICY "sf_insert" ON sales_forecasts FOR INSERT WITH CHECK (
  public.get_my_role() IN ('sales', 'admin')
);
CREATE POLICY "sf_update" ON sales_forecasts FOR UPDATE USING (
  created_by = auth.uid() OR
  public.get_my_role() IN ('sales_manager', 'admin')
);

-- Sales Forecast Items: follow parent
CREATE POLICY "sfi_select" ON sales_forecast_items FOR SELECT USING (true);
CREATE POLICY "sfi_insert" ON sales_forecast_items FOR INSERT WITH CHECK (
  public.get_my_role() IN ('sales', 'admin')
);
CREATE POLICY "sfi_update" ON sales_forecast_items FOR UPDATE USING (
  public.get_my_role() IN ('sales', 'admin')
);
CREATE POLICY "sfi_delete" ON sales_forecast_items FOR DELETE USING (
  public.get_my_role() IN ('sales', 'admin')
);

-- Purchase Forecasts: logistics_manager + admin
CREATE POLICY "pf_select" ON purchase_forecasts FOR SELECT USING (
  public.get_my_role() IN ('sales_manager', 'logistics_manager', 'director', 'admin')
);
CREATE POLICY "pf_modify" ON purchase_forecasts FOR ALL USING (
  public.get_my_role() IN ('logistics_manager', 'admin')
);

CREATE POLICY "pfi_select" ON purchase_forecast_items FOR SELECT USING (
  public.get_my_role() IN ('sales_manager', 'logistics_manager', 'director', 'admin')
);
CREATE POLICY "pfi_modify" ON purchase_forecast_items FOR ALL USING (
  public.get_my_role() IN ('logistics_manager', 'admin')
);

-- Inventory: everyone reads, warehouse_keeper + logistics modifies
CREATE POLICY "inv_select" ON inventory_lots FOR SELECT USING (true);
CREATE POLICY "inv_modify" ON inventory_lots FOR ALL USING (
  public.get_my_role() IN ('warehouse_keeper', 'logistics_manager', 'admin')
);

-- Price List: everyone reads, logistics manages
CREATE POLICY "pl_select" ON price_list FOR SELECT USING (true);
CREATE POLICY "pl_modify" ON price_list FOR ALL USING (
  public.get_my_role() IN ('logistics_manager', 'admin')
);

-- Audit Logs: only admin reads, system writes
CREATE POLICY "al_select" ON audit_logs FOR SELECT USING (
  public.get_my_role() = 'admin'
);
CREATE POLICY "al_insert" ON audit_logs FOR INSERT WITH CHECK (true);

-- ========================================
-- Indexes for performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_sf_status ON sales_forecasts(status);
CREATE INDEX IF NOT EXISTS idx_sf_created_by ON sales_forecasts(created_by);
CREATE INDEX IF NOT EXISTS idx_sfi_forecast ON sales_forecast_items(forecast_id);
CREATE INDEX IF NOT EXISTS idx_sfi_product ON sales_forecast_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_product ON inventory_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_expiry ON inventory_lots(expiry_date);
