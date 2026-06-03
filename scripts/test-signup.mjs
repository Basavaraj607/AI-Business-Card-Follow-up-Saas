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
    console.error('Missing env vars')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const testEmail = `testuser_${Date.now()}@example.com`
  const testPassword = 'Password123!'

  console.log(`Attempting to sign up test user: ${testEmail}`)

  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          first_name: 'Test',
          last_name: 'User',
          full_name: 'Test User',
          phone: '+1234567890',
          company_name: 'Test Company'
        }
      }
    })

    if (error) {
      console.error('Signup returned error:', error)
    } else {
      console.log('Signup succeeded!', data)
    }
  } catch (err) {
    console.error('Signup threw exception:', err)
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
