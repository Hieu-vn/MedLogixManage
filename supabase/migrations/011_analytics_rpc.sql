-- ============================================================
-- MedLogixManage — Phase 6: Analytics & Dashboard RPCs
-- ============================================================

-- Hàm 1: Lịch sử tiêu thụ theo Sản phẩm (dùng cho ConsumptionHistoryPanel)
CREATE OR REPLACE FUNCTION get_product_consumption(p_product_id UUID, p_hospital_id UUID DEFAULT NULL)
RETURNS TABLE (
    month DATE,
    hospital_name TEXT,
    qty_delivered BIGINT,
    qty_confirmed BIGINT,
    notes TEXT
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('month', d.actual_date)::DATE as month,
        h.name::TEXT as hospital_name,
        SUM(CASE WHEN d.status IN ('delivered', 'confirmed') THEN di.quantity ELSE 0 END)::BIGINT as qty_delivered,
        SUM(CASE WHEN d.status = 'confirmed' THEN di.quantity ELSE 0 END)::BIGINT as qty_confirmed,
        MAX(d.delivery_notes)::TEXT as notes
    FROM deliveries d
    JOIN delivery_items di ON d.id = di.delivery_id
    LEFT JOIN hospitals h ON d.hospital_id = h.id
    WHERE di.product_id = p_product_id
      AND d.actual_date IS NOT NULL
      AND (p_hospital_id IS NULL OR d.hospital_id = p_hospital_id)
      AND d.status IN ('delivered', 'confirmed')
    GROUP BY date_trunc('month', d.actual_date), h.name
    ORDER BY month ASC;
END;
$$ LANGUAGE plpgsql;

-- Hàm 2: Xu hướng lượng tiêu thụ toàn hệ thống 6 tháng (dùng cho Dashboard)
CREATE OR REPLACE FUNCTION get_dashboard_trend()
RETURNS TABLE (
    month DATE,
    qty BIGINT
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('month', d.actual_date)::DATE as month,
        SUM(di.quantity)::BIGINT as qty
    FROM deliveries d
    JOIN delivery_items di ON d.id = di.delivery_id
    WHERE d.actual_date IS NOT NULL
      AND d.actual_date >= (CURRENT_DATE - INTERVAL '6 months')
      AND d.status IN ('delivered', 'confirmed')
    GROUP BY date_trunc('month', d.actual_date)
    ORDER BY month ASC;
END;
$$ LANGUAGE plpgsql;
