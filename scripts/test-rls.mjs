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

  const email = `test_member_${Date.now()}@example.com`
  const password = 'Password123!'

  console.log(`\n1. Signing up test member: ${email}`)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: 'Test',
        last_name: 'Member',
        full_name: 'Test Member',
        phone: '+1888888888',
        company_name: 'Test Tenant Company'
      }
    }
  })

  if (signUpError) {
    console.error('Sign up failed:', signUpError)
    process.exit(1)
  }

  const user = signUpData.user
  console.log('Sign up successful! User ID:', user.id)

  // Sleep 1 second for database trigger to complete
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('\n2. Logging in as the test member...')
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (signInError) {
    console.error('Sign in failed:', signInError)
    process.exit(1)
  }

  // Get tenant ID from profile
  console.log('\n3. Fetching user profile to verify tenant association...')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Profile fetch failed:', profileError)
    process.exit(1)
  }

  console.log('Profile retrieved:', profile)
  const tenantId = profile?.tenant_id

  if (!tenantId) {
    console.error('Tenant ID is null/missing in profile. The trigger might have failed!')
    process.exit(1)
  }

  console.log('\n4. Attempting to INSERT a pending event as user...')
  const eventId = crypto.randomUUID()
  const eventPayload = {
    id: eventId,
    tenant_id: tenantId,
    title: 'Test Pending Event',
    description: 'This is a test event description',
    location: 'Office Room A',
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 3600000).toISOString(),
    status: 'pending',
    created_by: user.id
  }

  const { data: insertedEvent, error: insertError } = await supabase
    .from('events')
    .insert(eventPayload)
    .select()

  if (insertError) {
    console.error('❌ INSERT failed:', insertError)
  } else {
    console.log('🎉 INSERT successful! Inserted data:', insertedEvent)
  }

  console.log('\n5. Attempting to SELECT the pending event as user...')
  const { data: selectedEvents, error: selectError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)

  if (selectError) {
    console.error('❌ SELECT failed:', selectError)
  } else {
    console.log('🎉 SELECT results:', selectedEvents)
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
