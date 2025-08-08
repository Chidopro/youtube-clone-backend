import { createClient } from '@supabase/supabase-js';
import { API_CONFIG } from './config/apiConfig';

const supabaseUrl = API_CONFIG.SUPABASE_URL;
const supabaseAnonKey = API_CONFIG.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    redirectTo: window.location.origin
  }
});

// Make Supabase available for debugging
if (typeof window !== 'undefined') {
  window.supabase = supabase;
  window.__SUPABASE__ = supabase;
}

console.log('VITE ENV:', import.meta.env);