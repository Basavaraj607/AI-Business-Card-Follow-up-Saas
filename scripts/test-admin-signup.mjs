import fs from 'fs'
import path from 'path'
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

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found')
    process.exit(1)
  }
  const env = loadEnv(envPath)
  const url = env.VITE_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
  
  if (!url) {
    console.error('Missing VITE_SUPABASE_URL')
    process.exit(1)
  }
  
  // Since supabase_admin_setup.sql uses SUPABASE_SERVICE_ROLE_KEY or similar, let's look for any service role key in Deno or local env
  let finalKey = serviceRoleKey
  if (!finalKey) {
    // If not found in .env.local, let's look inside other config files or ask Deno env.
    // Let's print out what env keys are loaded for inspection
    console.log('Available Env keys:', Object.keys(env))
    // We can see if there is a service role key in .env.local
    finalKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || ''
  }
  
  if (!finalKey) {
    console.error('No service role key found. Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local to run this test.')
    process.exit(1)
  }

  console.log('Initializing admin client...')
  const adminClient = createClient(url, finalKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const testEmail = `admincreated_${Date.now()}@example.com`
  const testPassword = 'Password123!'

  console.log(`Creating user via auth.admin API: ${testEmail}`)

  const { data, error } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      first_name: 'AdminCreated',
      last_name: 'User',
      full_name: 'AdminCreated User',
      phone: '+1999999999',
      company_name: 'AdminCreated Company'
    }
  })

  if (error) {
    console.error('Admin user creation failed:', error)
  } else {
    console.log('User created successfully via admin client!', data)
    
    // Check if profile and tenant were created by trigger
    console.log('\nChecking if database trigger successfully created tenant and profile...')
    
    const { data: tenant } = await adminClient
      .from('tenants')
      .eq('owner_id', data.user.id)
      .maybeSingle()
      
    const { data: profile } = await adminClient
      .from('profiles')
      .eq('id', data.user.id)
      .maybeSingle()
      
    console.log('Database Tenant lookup:', tenant)
    console.log('Database Profile lookup:', profile)
    
    if (tenant && profile) {
      console.log('\n🎉 SUCCESS: The handle_new_user trigger ran successfully and provisioned all database records!')
      
      // Clean up test user
      console.log('\nCleaning up test user...')
      await adminClient.auth.admin.deleteUser(data.user.id)
      console.log('Test user deleted.')
    } else {
      console.error('\n❌ FAILURE: Database records were not provisioned by the trigger.')
    }
  }
}

main().catch(err => console.error(err))
