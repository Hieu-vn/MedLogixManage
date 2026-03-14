import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Reusable Supabase query hooks with automatic caching via React Query.
 * These replace repeated useEffect + useState patterns across pages.
 */

// ========================
// Master Data Hooks
// ========================

/** Cached active products list */
export function useProducts(options = {}) {
    return useQuery({
        queryKey: ['products', 'active'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('id, code, name, unit, category, storage_condition, safety_stock_qty, is_active')
                .eq('is_active', true)
                .order('code')
            if (error) throw error
            return data || []
        },
        staleTime: 60 * 1000, // Products rarely change, cache 1 min
        ...options,
    })
}

/** Cached active hospitals list */
export function useHospitals(options = {}) {
    return useQuery({
        queryKey: ['hospitals', 'active'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('hospitals')
                .select('id, name, code, is_active')
                .eq('is_active', true)
                .order('name')
            if (error) throw error
            return data || []
        },
        staleTime: 60 * 1000,
        ...options,
    })
}

/** Cached active suppliers list */
export function useSuppliers(options = {}) {
    return useQuery({
        queryKey: ['suppliers', 'active'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('suppliers')
                .select('id, name, code, is_domestic, payment_terms, is_active')
                .eq('is_active', true)
                .order('name')
            if (error) throw error
            return data || []
        },
        staleTime: 60 * 1000,
        ...options,
    })
}

// ========================
// Sales Forecast Hooks
// ========================

/** Fetch sales forecasts with optional status filter */
export function useSalesForecasts(statusFilter, options = {}) {
    return useQuery({
        queryKey: ['sales_forecasts', statusFilter],
        queryFn: async () => {
            let query = supabase
                .from('sales_forecasts')
                .select(`
                    *,
                    creator:created_by(full_name),
                    approver:approved_by(full_name),
                    sales_forecast_items(
                        id, product_id, hospital_id, quantity, needed_date, notes,
                        product:product_id(id, code, name, unit),
                        hospital:hospital_id(id, name)
                    )
                `)
                .order('created_at', { ascending: false })

            if (statusFilter && statusFilter !== 'all') {
                query = query.eq('status', statusFilter)
            }

            const { data, error } = await query
            if (error) throw error
            return data || []
        },
        staleTime: 10 * 1000, // 10s freshness for forecast list
        ...options,
    })
}

// ========================
// Dashboard Hooks
// ========================

/** All dashboard data in one query */
export function useDashboardData(options = {}) {
    return useQuery({
        queryKey: ['dashboard'],
        queryFn: async () => {
            const [
                { data: salesForecasts },
                { data: purchaseForecasts },
                { data: products },
                { data: inventoryLots },
                { count: hospitalCount },
                { count: supplierCount },
                { data: recentSF },
                { data: purchaseOrders },
                { data: importShipments },
                { data: warehouseReceipts },
            ] = await Promise.all([
                supabase.from('sales_forecasts').select('id, status'),
                supabase.from('purchase_forecasts').select('id, status'),
                supabase.from('products').select('id, name, code, storage_condition, safety_stock_qty, is_active, category'),
                supabase.from('inventory_lots').select('product_id, quantity, expiry_date, status, storage_condition, unit_cost'),
                supabase.from('hospitals').select('id', { count: 'exact', head: true }).eq('is_active', true),
                supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('is_active', true),
                supabase.from('sales_forecasts')
                    .select('id, code, title, status, request_date, created_by(full_name)')
                    .order('created_at', { ascending: false }).limit(6),
                supabase.from('purchase_orders').select('id, status, code, expected_delivery'),
                supabase.from('import_shipments').select('id, status'),
                supabase.from('warehouse_receipts').select('id, status'),
            ])

            return {
                salesForecasts: salesForecasts || [],
                purchaseForecasts: purchaseForecasts || [],
                products: products || [],
                inventoryLots: inventoryLots || [],
                hospitalCount: hospitalCount || 0,
                supplierCount: supplierCount || 0,
                recentSF: recentSF || [],
                purchaseOrders: purchaseOrders || [],
                importShipments: importShipments || [],
                warehouseReceipts: warehouseReceipts || [],
            }
        },
        staleTime: 15 * 1000, // Dashboard: 15s freshness
        ...options,
    })
}

// ========================
// Inventory Hooks
// ========================

/** Active inventory lots */
export function useInventoryLots(options = {}) {
    return useQuery({
        queryKey: ['inventory_lots'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_lots')
                .select('*')
                .eq('status', 'available')
            if (error) throw error
            return data || []
        },
        ...options,
    })
}
