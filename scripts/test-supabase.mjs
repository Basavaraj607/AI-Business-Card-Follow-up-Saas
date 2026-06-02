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
    console.error('.env.local not found in script cwd; please run from project root where .env.local exists')
    process.exit(1)
  }
  const env = loadEnv(envPath)
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
    process.exit(1)
  }

  console.log('Supabase URL:', url)
  const supabase = createClient(url, key)

  console.log('\n--- Testing INSERT into `contacts` table ---')
  try {
    const payload = { full_name: 'Script Test', tenant_id: crypto.randomUUID(), created_by: crypto.randomUUID() }
    const { data, error } = await supabase.from('contacts').insert(payload).select()
    console.log('INSERT result:', { data, error })
  } catch (e) {
    console.error('INSERT threw:', e)
  }

  console.log('\n--- Testing Storage upload to `card-images` bucket (small text file) ---')
  try {
    const filePath = 'test-script/test.txt'
    const content = 'hello from test script ' + new Date().toISOString()
    // convert to Uint8Array
    const buf = new TextEncoder().encode(content)
    const { data, error } = await supabase.storage.from('card-images').upload(filePath, buf, { upsert: false })
    console.log('STORAGE.upload result:', { data, error })
  } catch (e) {
    console.error('STORAGE.upload threw:', e)
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
