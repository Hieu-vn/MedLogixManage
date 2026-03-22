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
        staleTime: 5 * 60 * 1000, // Products rarely change, cache 5 min
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
        staleTime: 5 * 60 * 1000, // Hospitals rarely change, cache 5 min
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
        staleTime: 5 * 60 * 1000, // Suppliers rarely change, cache 5 min
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
        staleTime: 60 * 1000, // Dashboard: 60s freshness
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

// ========================
// Purchase Forecast Hooks
// ========================

/** All purchase forecasts with items */
export function usePurchaseForecasts(options = {}) {
    return useQuery({
        queryKey: ['purchase_forecasts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('purchase_forecasts')
                .select(`
                    *,
                    creator:created_by(full_name),
                    approver:approved_by(full_name),
                    purchase_forecast_items(
                        id, total_requested, current_stock, qty_to_purchase, approved_qty,
                        priority, earliest_needed_date, notes,
                        product:product_id(id, code, name, unit, storage_condition),
                        supplier:supplier_id(id, name)
                    )
                `)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data || []
        },
        staleTime: 15 * 1000,
        ...options,
    })
}

// ========================
// Purchase Order Hooks
// ========================

/** All purchase orders with items + relations */
export function usePurchaseOrders(options = {}) {
    return useQuery({
        queryKey: ['purchase_orders'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select(`
                    *, supplier:suppliers(name),
                    created_by_profile:profiles!purchase_orders_created_by_fkey(full_name),
                    approved_by_profile:profiles!purchase_orders_approved_by_fkey(full_name),
                    po_items(*, product:products(code, name, unit))
                `)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data || []
        },
        staleTime: 15 * 1000,
        ...options,
    })
}

/** PO master data: suppliers, products, active price list */
export function usePOMasterData(options = {}) {
    return useQuery({
        queryKey: ['po_master_data'],
        queryFn: async () => {
            const [suppRes, prodRes, plRes] = await Promise.all([
                supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
                supabase.from('products').select('*').eq('is_active', true).order('code'),
                supabase.from('price_list').select('*, product:products(code, name), supplier:suppliers(name)').eq('is_current', true),
            ])
            return {
                suppliers: suppRes.data || [],
                products: prodRes.data || [],
                priceList: plRes.data || [],
            }
        },
        staleTime: 5 * 60 * 1000, // Master data: cache 5 min
        ...options,
    })
}

// ========================
// Import Shipment Hooks
// ========================

/** All import shipments with docs + PO refs */
export function useImportShipments(options = {}) {
    return useQuery({
        queryKey: ['import_shipments'],
        queryFn: async () => {
            const [shRes, poRes] = await Promise.all([
                supabase.from('import_shipments').select(`
                    *, po:purchase_orders(code, supplier:suppliers(name)),
                    import_documents(*)
                `).order('created_at', { ascending: false }),
                supabase.from('purchase_orders').select('id, code, supplier:suppliers(name)')
                    .in('status', ['sent', 'confirmed']),
            ])
            return {
                shipments: shRes.data || [],
                availablePOs: poRes.data || [],
            }
        },
        staleTime: 15 * 1000,
        ...options,
    })
}

// ========================
// Warehouse Receipt Hooks
// ========================

/** All warehouse receipts with items + source refs */
export function useWarehouseReceipts(options = {}) {
    return useQuery({
        queryKey: ['warehouse_receipts'],
        queryFn: async () => {
            const [rcRes, shRes, poRes] = await Promise.all([
                supabase.from('warehouse_receipts').select(`
                    *, import_shipment:import_shipments(code, po:purchase_orders(code, supplier:suppliers(name))),
                    po_direct:purchase_orders(code, supplier:suppliers(name)),
                    received_by_profile:profiles!warehouse_receipts_received_by_fkey(full_name),
                    receipt_items(*, product:products(code, name, unit, storage_condition))
                `).order('created_at', { ascending: false }),
                supabase.from('import_shipments').select('id, code, po_id, po:purchase_orders(code, supplier:suppliers(name))')
                    .eq('status', 'completed'),
                supabase.from('purchase_orders').select('id, code, is_domestic, supplier:suppliers(name), po_items(*, product:products(code, name, unit))')
                    .in('status', ['sent', 'confirmed', 'delivering', 'received']),
            ])
            return {
                receipts: rcRes.data || [],
                completedShipments: shRes.data || [],
                availablePOs: poRes.data || [],
            }
        },
        staleTime: 15 * 1000,
        ...options,
    })
}

// ========================
// Delivery Hooks
// ========================

/** All deliveries with items, hospital, carrier, rating */
export function useDeliveries(options = {}) {
    return useQuery({
        queryKey: ['deliveries'],
        queryFn: async () => {
            const [dlRes, rcRes, hospRes, carrRes] = await Promise.all([
                supabase.from('deliveries').select(`
                    *,
                    hospital:hospitals(id, name),
                    carrier:carriers(id, name, has_cold_chain, phone, avg_score),
                    warehouse_receipt:warehouse_receipts(id, code),
                    created_by_profile:profiles!deliveries_created_by_fkey(full_name),
                    delivery_items(*, product:products(id, code, name, unit, storage_condition)),
                    carrier_rating:carrier_ratings(*)
                `).order('created_at', { ascending: false }),
                supabase.from('warehouse_receipts').select(`
                    id, code,
                    po_direct:purchase_orders(code, supplier:suppliers(name)),
                    import_shipment:import_shipments(code, po:purchase_orders(code, supplier:suppliers(name)))
                `).eq('status', 'completed'),
                supabase.from('hospitals').select('id, name').eq('is_active', true).order('name'),
                supabase.from('carriers').select('*').eq('is_active', true).order('name'),
            ])

            // Flatten carrier_rating from array to single object
            const deliveries = (dlRes.data || []).map(d => ({
                ...d,
                carrier_rating: d.carrier_rating?.[0] || null,
            }))

            return {
                deliveries,
                completedReceipts: rcRes.data || [],
                hospitals: hospRes.data || [],
                carriers: carrRes.data || [],
            }
        },
        staleTime: 15 * 1000,
        ...options,
    })
}

/** Cached carriers list with avg_score */
export function useCarriers(options = {}) {
    return useQuery({
        queryKey: ['carriers', 'active'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('carriers')
                .select('*')
                .eq('is_active', true)
                .order('name')
            if (error) throw error
            return data || []
        },
        staleTime: 5 * 60 * 1000,
        ...options,
    })
}
