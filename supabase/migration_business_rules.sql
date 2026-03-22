-- ============================================================
-- MedLogixManage — Phase 4 Migration: Enhanced Business Rules
-- Run this SQL in Supabase SQL Editor AFTER migration_delivery.sql
-- ============================================================

-- 1. Add 'purpose' column to sales_forecasts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_forecasts' AND column_name='purpose') THEN
        ALTER TABLE sales_forecasts ADD COLUMN purpose TEXT CHECK (purpose IN ('ban_moi','muon_demo','tang'));
    END IF;
END $$;

-- 2. Enhanced Audit Trail: add IP, OS, hover details columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='ip_address') THEN
        ALTER TABLE audit_logs ADD COLUMN ip_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='user_agent') THEN
        ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='detail_json') THEN
        ALTER TABLE audit_logs ADD COLUMN detail_json JSONB;
    END IF;
END $$;

-- 3. Carrier info: phone column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carriers' AND column_name='phone') THEN
        ALTER TABLE carriers ADD COLUMN phone TEXT;
    END IF;
END $$;

-- 4. Index for purpose queries
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_purpose ON sales_forecasts(purpose);

-- ============================================================
-- Verify
-- ============================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name='sales_forecasts';
-- SELECT column_name FROM information_schema.columns WHERE table_name='audit_logs';
