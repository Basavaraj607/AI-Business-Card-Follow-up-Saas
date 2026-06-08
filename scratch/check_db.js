// scratch/check_db.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
let supabaseUrl = '';
let supabaseAnonKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().startsWith('#') || !line.includes('=')) continue;
    const [key, ...valueParts] = line.split('=');
    const val = valueParts.join('=').trim();
    if (key.trim() === 'VITE_SUPABASE_URL') {
      supabaseUrl = val;
    } else if (key.trim() === 'VITE_SUPABASE_ANON_KEY') {
      supabaseAnonKey = val;
    }
  }
} catch (e) {
  console.error('Could not read .env.local:', e.message);
  process.exit(1);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables in .env.local');
  process.exit(1);
}

console.log('Connecting to:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*');
    
    if (error) {
      console.error('Database Error:', error);
    } else {
      console.log('Platform settings records:', data);
    }
  } catch (err) {
    console.error('Execution failed:', err);
  }
}

run();
