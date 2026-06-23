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
  const key = env.VITE_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    console.error('Missing URL or ANON_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const adminEmail = `test_admin_${Date.now()}@example.com`
  const adminPassword = 'Password123!'

  console.log(`\n1. Signing up test admin: ${adminEmail}`)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: adminEmail,
    password: adminPassword,
    options: {
      data: {
        first_name: 'Test',
        last_name: 'Admin',
        full_name: 'Test Admin',
        phone: '+1777777777',
        company_name: 'Test Admin Company'
      }
    }
  })

  if (signUpError) {
    console.error('Sign up failed:', signUpError)
    process.exit(1)
  }

  const adminUser = signUpData.user
  console.log('Sign up successful! Admin ID:', adminUser.id)

  // Sleep 1 second for database trigger to complete
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('\n2. Logging in as the test admin...')
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  })

  if (signInError) {
    console.error('Sign in failed:', signInError)
    process.exit(1)
  }

  console.log('\n3. Fetching admin profile...')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', adminUser.id)
    .maybeSingle()

  if (profileError) {
    console.error('Profile fetch failed:', profileError)
    process.exit(1)
  }

  console.log('Profile retrieved (role = owner):', profile)
  const tenantId = profile?.tenant_id

  console.log('\n4. Creating a pending event created by a hypothetical member in this tenant...')
  // Let's create a member user
  const memberId = crypto.randomUUID()
  // Insert a mock profile for member in the same tenant to satisfy foreign key
  console.log('Inserting a mock member profile...')
  const { error: memberProfileError } = await supabase
    .from('profiles')
    .insert({
      id: memberId,
      tenant_id: tenantId,
      email: 'member@example.com',
      full_name: 'Workspace Member',
      role: 'member'
    })

  if (memberProfileError) {
    console.warn('Could not insert member profile (might violate RLS/constraints):', memberProfileError)
  }

  // Insert event as the member
  const eventId = crypto.randomUUID()
  const eventPayload = {
    id: eventId,
    tenant_id: tenantId,
    title: 'Member Requested Event',
    description: 'A test event requested by member',
    location: 'Conference Room 2',
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 3600000).toISOString(),
    status: 'pending',
    created_by: adminUser.id // use adminUser.id to be safe since we are logged in as admin, or use memberId if RLS allows admin to insert for others
  }

  console.log('Inserting event...')
  const { error: eventInsertError } = await supabase
    .from('events')
    .insert(eventPayload)

  if (eventInsertError) {
    console.error('Event insertion failed:', eventInsertError)
    process.exit(1)
  }
  console.log('Event inserted successfully!')

  console.log('\n5. Executing the admin query with profile join...')
  const { data: events, error: queryError } = await supabase
    .from('events')
    .select('*, profiles:created_by(full_name, email)')
    .eq('tenant_id', tenantId)

  if (queryError) {
    console.error('❌ Admin query failed:', queryError)
  } else {
    console.log('🎉 Admin query succeeded! Results:')
    console.log(JSON.stringify(events, null, 2))
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
