import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://sijcabmxlvnlhgvhvdhz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpamNhYm14bHZubGhndmh2ZGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MzIxOTQsImV4cCI6MjA4ODUwODE5NH0.bXgsVNUnR9ncSp-mVXY_WRxlyeep1hnP2v0d11q5O3U',
  { auth: { persistSession: false } }
)

async function test() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'sales1@medlogix.com',
    password: 'demo123'
  })
  
  if (authErr) {
    console.error('Login failed:', authErr.message)
    return
  }
  
  console.log('Logged in UID:', authData.user.id)
  
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()
    
  if (profErr) {
    console.error('Fetch profile failed:', profErr.message, profErr.details, profErr.hint)
  } else {
    console.log('Profile fetched successfully:', profile)
  }
}

test()
