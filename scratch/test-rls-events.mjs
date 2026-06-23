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

async function getClientForUser(email, password) {
  const client = createClient(url, key, {
    auth: { persistSession: false }
  })
  
  // Try signing in
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) {
    // Try signing up
    console.log(`User ${email} sign in failed, trying sign up...`)
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: email.split('@')[0],
          last_name: 'Test',
          company_name: 'Test Tenant'
        }
      }
    })
    if (signUpError) {
      throw new Error(`Sign up failed for ${email}: ${signUpError.message}`)
    }
    console.log(`User ${email} signed up successfully.`)
    return client
  }
  console.log(`User ${email} signed in successfully.`)
  return client
}

async function main() {
  // 1. Register/Log in User A (owner)
  const clientA = await getClientForUser('user-a@test.com', 'password123')
  const { data: { user: userA } } = await clientA.auth.getUser()
  const { data: profileA } = await clientA.from('profiles').select('*').eq('id', userA.id).single()
  console.log('User A tenant ID:', profileA.tenant_id, 'role:', profileA.role)

  // 2. Register/Log in User B (member)
  const clientB = await getClientForUser('user-b@test.com', 'password123')
  const { data: { user: userB } } = await clientB.auth.getUser()
  
  // Set User B's tenant_id to be same as User A's tenant_id and role = 'member'
  console.log('Updating User B tenant to match User A, and setting role to member...')
  const { error: updateError } = await clientB
    .from('profiles')
    .update({ 
      tenant_id: profileA.tenant_id,
      role: 'member'
    })
    .eq('id', userB.id)
  
  if (updateError) {
    console.error('Failed to update User B profile:', updateError)
  }
  
  const { data: profileB } = await clientB.from('profiles').select('*').eq('id', userB.id).single()
  console.log('User B profile updated. tenant:', profileB.tenant_id, 'role:', profileB.role)

  // 3. User A submits a pending event
  console.log('User A creating a pending event...')
  const eventId = crypto.randomUUID()
  const { data: eventData, error: createError } = await clientA
    .from('events')
    .insert({
      id: eventId,
      tenant_id: profileA.tenant_id,
      title: 'User A Mock Event',
      location: 'San Francisco',
      start_time: new Date(Date.now() + 86400000).toISOString(),
      end_time: new Date(Date.now() + 172800000).toISOString(),
      status: 'pending',
      created_by: userA.id
    })
    .select()

  if (createError) {
    console.error('Failed to create event:', createError)
    process.exit(1)
  }
  console.log('Event created successfully. ID:', eventId)

  // 4. User B queries events. User B should NOT see the pending event.
  console.log('User B querying events (expecting 0 results since status is pending and B is member)...')
  const { data: bEventsPending, error: bQueryError } = await clientB
    .from('events')
    .select('*')
  
  if (bQueryError) {
    console.error('User B query failed:', bQueryError)
  } else {
    console.log(`User B fetched ${bEventsPending.length} events:`, bEventsPending.map(e => ({ title: e.title, status: e.status })))
  }

  // 5. User A (tenant owner/admin) approves the event
  console.log('User A (admin) approving the event...')
  const { error: approveError } = await clientA
    .from('events')
    .update({ status: 'approved' })
    .eq('id', eventId)

  if (approveError) {
    console.error('Failed to approve event:', approveError)
    process.exit(1)
  }
  console.log('Event approved.')

  // 6. User B queries events. User B SHOULD see the approved event.
  console.log('User B querying events (expecting User A\'s approved event)...')
  const { data: bEventsApproved, error: bQueryError2 } = await clientB
    .from('events')
    .select('*')
  
  if (bQueryError2) {
    console.error('User B query failed:', bQueryError2)
  } else {
    console.log(`User B fetched ${bEventsApproved.length} events:`, bEventsApproved.map(e => ({ title: e.title, status: e.status })))
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
