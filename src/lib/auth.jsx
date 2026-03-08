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
    delivery: [ROLES.LOGISTICS_MANAGER, ROLES.WAREHOUSE_KEEPER, ROLES.DIRECTOR, ROLES.ADMIN],
    master_data: [ROLES.ADMIN],
    audit_trail: [ROLES.DIRECTOR, ROLES.ADMIN],
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setLoading(false)
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setUser(session?.user ?? null)
                if (session?.user) {
                    await fetchProfile(session.user.id)
                } else {
                    setProfile(null)
                    setLoading(false)
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    async function fetchProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) throw error
            setProfile(data)
        } catch (error) {
            console.error('Error fetching profile:', error)
            setProfile(null)
        } finally {
            setLoading(false)
        }
    }

    async function signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        if (error) throw error
        return data
    }

    async function signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        setProfile(null)
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
