import { createClient } from '@supabase/supabase-js';
import { API_CONFIG } from './config/apiConfig';

const supabaseUrl = API_CONFIG.SUPABASE_URL;
const supabaseAnonKey = API_CONFIG.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    redirectTo: window.location.origin
  }
});

console.log('VITE ENV:', import.meta.env);