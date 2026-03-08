/**
 * MedLogixManage — Setup Script
 * Creates demo users in Supabase Auth + runs schema
 * 
 * Usage: node scripts/setup.js
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sijcabmxlvnlhgvhvdhz.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_KEY) {
    console.log('='.repeat(60))
    console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY not set!')
    console.log('')
    console.log('This script needs the SERVICE_ROLE key (not the anon key).')
    console.log('Find it in: Supabase Dashboard → Settings → API → service_role')
    console.log('')
    console.log('Run with:')
    console.log('  $env:SUPABASE_SERVICE_ROLE_KEY="your-key"; node scripts/setup.js')
    console.log('='.repeat(60))
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
})

const DEMO_USERS = [
    { email: 'admin@medlogix.com', full_name: 'System Admin', role: 'admin' },
    { email: 'giamdoc@medlogix.com', full_name: 'Nguyễn Văn Giám Đốc', role: 'director' },
    { email: 'qlsales@medlogix.com', full_name: 'Trần Thị QL Sales', role: 'sales_manager' },
    { email: 'logistics@medlogix.com', full_name: 'Phạm Văn Logistics', role: 'logistics_manager' },
    { email: 'thukho@medlogix.com', full_name: 'Lê Thị Thủ Kho', role: 'warehouse_keeper' },
    { email: 'sales1@medlogix.com', full_name: 'Nguyễn Thái', role: 'sales' },
    { email: 'sales2@medlogix.com', full_name: 'Trần Phương', role: 'sales' },
    { email: 'sales3@medlogix.com', full_name: 'Hoàng Minh', role: 'sales' },
    { email: 'sales4@medlogix.com', full_name: 'Cao Đức', role: 'sales' },
]

async function main() {
    console.log('🚀 MedLogixManage — Setup Script')
    console.log('='.repeat(60))

    for (const user of DEMO_USERS) {
        process.stdout.write(`Creating ${user.email} (${user.role})... `)

        // Check if user already exists
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const exists = existingUsers?.users?.find(u => u.email === user.email)

        if (exists) {
            console.log('✅ already exists')
            continue
        }

        const { data, error } = await supabase.auth.admin.createUser({
            email: user.email,
            password: 'demo123',
            email_confirm: true,
            user_metadata: {
                full_name: user.full_name,
                role: user.role
            }
        })

        if (error) {
            console.log(`❌ ${error.message}`)
        } else {
            console.log('✅ created')
        }
    }

    console.log('')
    console.log('='.repeat(60))
    console.log('✅ Done! All demo accounts use password: demo123')
    console.log('='.repeat(60))
}

main().catch(console.error)
