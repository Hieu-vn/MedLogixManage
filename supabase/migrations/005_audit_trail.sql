-- ========================================
-- Phase 3: Audit Trail — table + triggers
-- ========================================

-- Audit Logs table
DROP TABLE IF EXISTS audit_logs CASCADE;
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    user_id UUID REFERENCES profiles(id),
    user_email TEXT,
    user_role TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admin and director can view audit logs
CREATE POLICY "audit_select" ON audit_logs FOR SELECT USING (
    public.get_my_role() IN ('admin', 'director')
);

-- System can insert (via trigger)
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (true);

-- ========================================
-- Trigger function: logs changes for any table
-- ========================================
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_old JSONB;
    v_new JSONB;
    v_changed TEXT[];
    v_user_id UUID;
    v_email TEXT;
    v_role TEXT;
    v_key TEXT;
BEGIN
    -- Get current user info
    BEGIN
        SELECT id, email, role INTO v_user_id, v_email, v_role
        FROM profiles WHERE id = auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
        v_email := NULL;
        v_role := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW);
        INSERT INTO audit_logs (table_name, record_id, action, new_values, user_id, user_email, user_role)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', v_new, v_user_id, v_email, v_role);
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        -- Detect changed fields
        v_changed := ARRAY[]::TEXT[];
        FOR v_key IN SELECT jsonb_object_keys(v_new)
        LOOP
            IF v_old->v_key IS DISTINCT FROM v_new->v_key THEN
                v_changed := array_append(v_changed, v_key);
            END IF;
        END LOOP;
        -- Skip if nothing changed (e.g. updated_at only)
        IF array_length(v_changed, 1) IS NULL OR
           (array_length(v_changed, 1) = 1 AND v_changed[1] = 'updated_at') THEN
            RETURN NEW;
        END IF;
        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, changed_fields, user_id, user_email, user_role)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', v_old, v_new, v_changed, v_user_id, v_email, v_role);
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        INSERT INTO audit_logs (table_name, record_id, action, old_values, user_id, user_email, user_role)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', v_old, v_user_id, v_email, v_role);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- Attach triggers to key tables
-- ========================================
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_hospitals AFTER INSERT OR UPDATE OR DELETE ON hospitals
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_suppliers AFTER INSERT OR UPDATE OR DELETE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_po_items AFTER INSERT OR UPDATE OR DELETE ON po_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_import_shipments AFTER INSERT OR UPDATE OR DELETE ON import_shipments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_warehouse_receipts AFTER INSERT OR UPDATE OR DELETE ON warehouse_receipts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_inventory_lots AFTER INSERT OR UPDATE OR DELETE ON inventory_lots
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_price_list AFTER INSERT OR UPDATE OR DELETE ON price_list
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_sales_forecasts AFTER INSERT OR UPDATE OR DELETE ON sales_forecasts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_purchase_forecasts AFTER INSERT OR UPDATE OR DELETE ON purchase_forecasts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
