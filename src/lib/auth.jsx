import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export const ROLES = {
    SALES: 'sales',
    SALES_MANAGER: 'sales_manager',
    LOGISTICS_MANAGER: 'logistics_manager',
    WAREHOUSE_KEEPER: 'warehouse_keeper',
    DIRECTOR: 'director',
    ADMIN: 'admin',
}

export const ROLE_LABELS = {
    [ROLES.SALES]: 'Sales',
    [ROLES.SALES_MANAGER]: 'QL Sales',
    [ROLES.LOGISTICS_MANAGER]: 'QL Logistics',
    [ROLES.WAREHOUSE_KEEPER]: 'Thủ kho',
    [ROLES.DIRECTOR]: 'Giám đốc',
    [ROLES.ADMIN]: 'Admin',
}

export const ROLE_COLORS = {
    [ROLES.SALES]: '#6C5CE7',
    [ROLES.SALES_MANAGER]: '#0984E3',
    [ROLES.LOGISTICS_MANAGER]: '#00B894',
    [ROLES.WAREHOUSE_KEEPER]: '#E17055',
    [ROLES.DIRECTOR]: '#FDCB6E',
    [ROLES.ADMIN]: '#D63031',
}

// Module access matrix
export const MODULE_ACCESS = {
    dashboard: [ROLES.SALES, ROLES.SALES_MANAGER, ROLES.LOGISTICS_MANAGER, ROLES.WAREHOUSE_KEEPER, ROLES.DIRECTOR, ROLES.ADMIN],
    sales_forecast: [ROLES.SALES, ROLES.SALES_MANAGER, ROLES.LOGISTICS_MANAGER, ROLES.DIRECTOR, ROLES.ADMIN],
    purchase_forecast: [ROLES.SALES_MANAGER, ROLES.LOGISTICS_MANAGER, ROLES.DIRECTOR, ROLES.ADMIN],
    purchase_order: [ROLES.LOGISTICS_MANAGER, ROLES.DIRECTOR, ROLES.ADMIN],
    import_shipment: [ROLES.LOGISTICS_MANAGER, ROLES.DIRECTOR, ROLES.ADMIN],
    warehouse: [ROLES.LOGISTICS_MANAGER, ROLES.WAREHOUSE_KEEPER, ROLES.DIRECTOR, ROLES.ADMIN],
    inventory: [ROLES.LOGISTICS_MANAGER, ROLES.WAREHOUSE_KEEPER, ROLES.DIRECTOR, ROLES.ADMIN],
    stock_export: [ROLES.LOGISTICS_MANAGER, ROLES.WAREHOUSE_KEEPER, ROLES.DIRECTOR, ROLES.ADMIN],
    stock_transfer: [ROLES.LOGISTICS_MANAGER, ROLES.WAREHOUSE_KEEPER, ROLES.DIRECTOR, ROLES.ADMIN],
    delivery: [ROLES.LOGISTICS_MANAGER, ROLES.WAREHOUSE_KEEPER, ROLES.DIRECTOR, ROLES.ADMIN],
    master_data: [ROLES.SALES, ROLES.SALES_MANAGER, ROLES.LOGISTICS_MANAGER, ROLES.WAREHOUSE_KEEPER, ROLES.DIRECTOR, ROLES.ADMIN],
    audit_trail: [ROLES.DIRECTOR, ROLES.ADMIN],
}

// Cache key for profile in sessionStorage
const PROFILE_CACHE_KEY = 'medlogix-profile-cache'

function getCachedProfile() {
    try {
        const cached = sessionStorage.getItem(PROFILE_CACHE_KEY)
        if (!cached) return null
        const { data, timestamp } = JSON.parse(cached)
        // Cache valid for 5 minutes
        if (Date.now() - timestamp > 5 * 60 * 1000) {
            sessionStorage.removeItem(PROFILE_CACHE_KEY)
            return null
        }
        return data
    } catch {
        return null
    }
}

function setCachedProfile(data) {
    try {
        if (data) {
            sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
        } else {
            sessionStorage.removeItem(PROFILE_CACHE_KEY)
        }
    } catch { /* sessionStorage may be unavailable */ }
}

export function AuthProvider({ children }) {
    // Initialize profile from cache for instant display on page reload/navigation
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(() => getCachedProfile())
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true

        // Get initial session — with lock:false this should resolve quickly
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!isMounted) return
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setProfile(null)
                setCachedProfile(null)
                setLoading(false)
            }
        }).catch((err) => {
            if (!isMounted) return
            console.error('[Auth] getSession error:', err)
            // If we have a cached profile, keep using it instead of logging out
            if (!getCachedProfile()) {
                setProfile(null)
                setCachedProfile(null)
            }
            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (!isMounted) return
                setUser(session?.user ?? null)
                if (session?.user) {
                    await fetchProfile(session.user.id)
                } else {
                    setProfile(null)
                    setCachedProfile(null)
                    setLoading(false)
                }
            }
        )

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    async function fetchProfile(userId, retryCount = 0) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) throw error
            setProfile(data)
            setCachedProfile(data)
        } catch (error) {
            console.error(`[Auth] Error fetching profile (attempt ${retryCount + 1}):`, error)
            // Retry up to 2 times with delay
            if (retryCount < 2) {
                await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)))
                return fetchProfile(userId, retryCount + 1)
            }
            // After retries, fall back to cache or null
            const cached = getCachedProfile()
            if (cached) {
                console.log('[Auth] Using cached profile after fetch failure')
                setProfile(cached)
            } else {
                setProfile(null)
            }
        } finally {
            setLoading(false)
        }
    }

    async function signIn(email, password) {
        setLoading(true)
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        if (error) {
            setLoading(false)
            throw error
        }
        // Do NOT setLoading(false) here. onAuthStateChange will handle it after fetching profile.
        return data
    }

    async function signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        setProfile(null)
        setCachedProfile(null)
    }

    function hasAccess(module) {
        if (!profile) return false
        const allowedRoles = MODULE_ACCESS[module] || []
        return allowedRoles.includes(profile.role)
    }

    function isRole(...roles) {
        if (!profile) return false
        return roles.includes(profile.role)
    }

    const value = {
        user,
        profile,
        loading,
        signIn,
        signOut,
        hasAccess,
        isRole,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
