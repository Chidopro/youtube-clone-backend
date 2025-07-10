const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL ERROR from supabase.js: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined. Please check the .env file in the project root.");
  process.exit(1);
}

// Regular client for normal operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for administrative operations (user deletion, etc.)
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

if (!supabaseAdmin) {
  console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY not found. Admin operations (like user deletion) will not be available.");
}

module.exports = { supabase, supabaseAdmin }; 