-- ========================================
-- Migration 010: Excel workflow alignment
-- Adds fields identified from Dự trù.xlsx comparison
-- ========================================

-- =====================
-- Gap #2: PICK NGAY / BACKORDER for PO items
-- =====================
ALTER TABLE po_items ADD COLUMN IF NOT EXISTS pick_now_qty INTEGER DEFAULT 0;
ALTER TABLE po_items ADD COLUMN IF NOT EXISTS backorder_qty INTEGER DEFAULT 0;

-- =====================
-- Gap #4: Flight tracking for Import Shipments
-- =====================
ALTER TABLE import_shipments ADD COLUMN IF NOT EXISTS bl_number TEXT;
ALTER TABLE import_shipments ADD COLUMN IF NOT EXISTS flight_number TEXT;
ALTER TABLE import_shipments ADD COLUMN IF NOT EXISTS shipping_date DATE;
ALTER TABLE import_shipments ADD COLUMN IF NOT EXISTS expected_arrival DATE;
ALTER TABLE import_shipments ADD COLUMN IF NOT EXISTS actual_arrival DATE;
ALTER TABLE import_shipments ADD COLUMN IF NOT EXISTS total_packages TEXT;
ALTER TABLE import_shipments ADD COLUMN IF NOT EXISTS gross_weight NUMERIC(10,2);

-- =====================
-- Gap #5: Carrier contact + route specialty
-- =====================
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS route_specialty TEXT;
