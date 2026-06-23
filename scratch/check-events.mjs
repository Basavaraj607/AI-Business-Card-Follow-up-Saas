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
  const envPath = '.env.local'
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found')
    process.exit(1)
  }
  const env = loadEnv(envPath)
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY
  
  if (!url || !key) {
    console.error('Missing URL or ANON_KEY')
    process.exit(1)
  }

  console.log('Connecting to Supabase:', url)
  
  const clientKey = serviceKey || key
  console.log('Using Key type:', serviceKey ? 'SERVICE_ROLE' : 'ANON_KEY')
  
  const supabase = createClient(url, clientKey)

  console.log('\n--- Checking events table structure & rows ---')
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
  
  if (eventsError) {
    console.error('Error fetching events:', eventsError)
  } else {
    console.log(`Successfully fetched ${events?.length || 0} events:`)
    console.log(JSON.stringify(events, null, 2))
  }

  console.log('\n--- Checking profiles ---')
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, role, user_type, tenant_id')
    .limit(10)
  
  if (profilesError) {
    console.error('Error fetching profiles:', profilesError)
  } else {
    console.log('Profiles list:', profiles)
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
