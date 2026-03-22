-- ============================================================
-- MedLogixManage — Phase 1+2 Migration: Delivery & Carrier Scoring
-- Run this SQL in Supabase SQL Editor
-- ============================================================

-- 1. Deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    warehouse_receipt_id UUID REFERENCES warehouse_receipts(id),
    hospital_id UUID REFERENCES hospitals(id),
    carrier_id UUID REFERENCES carriers(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','dispatched','delivering','delivered','confirmed')),
    expected_date DATE,
    actual_date DATE,
    delivery_notes TEXT,
    proof_file_url TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Delivery items
CREATE TABLE IF NOT EXISTS delivery_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    lot_number TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    expiry_date DATE,
    storage_condition TEXT DEFAULT 'normal'
);

-- 3. Carrier ratings (5-criteria scoring)
CREATE TABLE IF NOT EXISTS carrier_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    carrier_id UUID REFERENCES carriers(id),
    responsive BOOLEAN DEFAULT false,
    on_time BOOLEAN DEFAULT false,
    no_cancellation BOOLEAN DEFAULT false,
    intact_goods BOOLEAN DEFAULT false,
    no_extra_fees BOOLEAN DEFAULT false,
    score NUMERIC(3,2) DEFAULT 0,
    notes TEXT,
    rated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Add avg_score and has_cold_chain to carriers (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carriers' AND column_name='avg_score') THEN
        ALTER TABLE carriers ADD COLUMN avg_score NUMERIC(3,2) DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carriers' AND column_name='has_cold_chain') THEN
        ALTER TABLE carriers ADD COLUMN has_cold_chain BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 5. RLS Policies for deliveries
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON deliveries
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON delivery_items
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE carrier_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON carrier_ratings
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_hospital ON deliveries(hospital_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_carrier ON deliveries(carrier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_carrier_ratings_carrier ON carrier_ratings(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_ratings_delivery ON carrier_ratings(delivery_id);

-- ============================================================
-- Verify: Run these to check tables were created
-- ============================================================
-- SELECT * FROM deliveries LIMIT 1;
-- SELECT * FROM delivery_items LIMIT 1;
-- SELECT * FROM carrier_ratings LIMIT 1;
