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

  const adminEmail = `admin_${Date.now()}@example.com`
  const adminPassword = 'Password123!'
  const memberEmail = `member_${Date.now()}@example.com`
  const memberPassword = 'Password123!'

  console.log(`\n1. Signing up Admin: ${adminEmail}`)
  const { data: adminSignUp, error: adminSignUpError } = await supabase.auth.signUp({
    email: adminEmail,
    password: adminPassword,
    options: { data: { full_name: 'Workspace Owner', company_name: 'Shared Workspace' } }
  })
  if (adminSignUpError) throw adminSignUpError
  const adminId = adminSignUp.user.id

  // Wait for trigger
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('\n2. Logging in as Admin to retrieve tenant_id...')
  const { data: adminSignIn } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  })
  const { data: adminProfile } = await supabase.from('profiles').select('tenant_id').eq('id', adminId).maybeSingle()
  const tenantId = adminProfile.tenant_id
  console.log('Tenant ID:', tenantId)

  console.log(`\n3. Signing up Member: ${memberEmail}`)
  const { data: memberSignUp, error: memberSignUpError } = await supabase.auth.signUp({
    email: memberEmail,
    password: memberPassword,
    options: { data: { full_name: 'Workspace Member', company_name: 'Temporary' } }
  })
  if (memberSignUpError) throw memberSignUpError
  const memberId = memberSignUp.user.id

  // Wait for trigger
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('\n4. Logging in as Member to update tenant_id to the shared workspace...')
  const { data: memberSignIn } = await supabase.auth.signInWithPassword({
    email: memberEmail,
    password: memberPassword
  })

  // Update member profile tenant_id to admin's tenant_id
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ tenant_id: tenantId, role: 'member' })
    .eq('id', memberId)

  if (updateError) {
    console.error('Failed to update member tenant_id:', updateError)
    process.exit(1)
  }
  console.log('Member profile successfully moved to the shared tenant!')

  console.log('\n5. Member inserts a pending event...')
  const eventId = crypto.randomUUID()
  const { error: eventInsertError } = await supabase
    .from('events')
    .insert({
      id: eventId,
      tenant_id: tenantId,
      title: 'Member Requested Event',
      location: 'Main Hall',
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600000).toISOString(),
      status: 'pending',
      created_by: memberId
    })

  if (eventInsertError) {
    console.error('Member event insertion failed:', eventInsertError)
    process.exit(1)
  }
  console.log('Member event inserted successfully!')

  console.log('\n6. Logging back in as Admin to run the query...')
  const { error: adminReLoginError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  })
  if (adminReLoginError) throw adminReLoginError

  console.log('\n7. Executing the admin query with profile join...')
  const { data: events, error: queryError } = await supabase
    .from('events')
    .select('*, profiles:created_by(full_name, email)')
    .eq('tenant_id', tenantId)

  if (queryError) {
    console.error('❌ Admin query failed:', queryError)
  } else {
    console.log('🎉 Admin query response:')
    console.log(JSON.stringify(events, null, 2))
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
