import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(envPath) {
  const text = fs.readFileSync(envPath, 'utf8')
  const lines = text.split(/\r?\n/)
  const env = {}
  for (const l of lines) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

const env = loadEnv('.env.local')
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

async function main() {
  const client = createClient(url, key, {
    auth: { persistSession: false }
  })
  
  // Sign in as a test user to get authenticated session
  const { data: { session }, error: authError } = await client.auth.signInWithPassword({
    email: 'user-a@test.com',
    password: 'password123'
  })
  
  if (authError) {
    console.error('Auth failed:', authError)
    process.exit(1)
  }
  
  console.log('Signed in. Querying pg_policies for events table...')
  
  // We can query pg_policies since it's a public system catalog
  const { data, error } = await client.rpc('inspect_rls_policies', {})
  if (error) {
    console.log('Direct RPC inspect_rls_policies failed (expected if function not created). Trying direct sql fetch via general queries if any, or custom function...')
    
    // Let's create an RPC function or execute raw SQL via another way if possible.
    // Wait, can we run raw select via supabase.rpc? Only if there's an RPC function that allows executing SQL.
    // Let's check if we can query from a public schema view or check pg_policies directly.
    const { data: pgData, error: pgError } = await client
      .from('pg_policies') // Wait, pg_policies is not exposed as a PostgREST table by default unless mapped.
      .select('*')
    
    if (pgError) {
      console.log('Could not select from pg_policies via PostgREST directly (default behavior). Error:', pgError.message)
    } else {
      console.log('Policies from pg_policies:', pgData)
    }
  } else {
    console.log('RPC inspect_rls_policies returned:', data)
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
