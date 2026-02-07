// API Configuration for different environments - single source for backend URL and Supabase
const isDevelopment = import.meta.env.MODE === 'development';
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const BACKEND_URL_FALLBACK = 'https://screenmerch.fly.dev';
const SUPABASE_URL_FALLBACK = 'https://sojxbydpcdcdzfdtbypd.supabase.co';
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no';

const config = {
  development: {
    API_BASE_URL: (env.VITE_BACKEND_URL || env.VITE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, ''),
    EMAIL_API_URL: 'http://localhost:3001',
    SUBSCRIPTION_API_URL: 'http://localhost:3002',
    SUPABASE_URL: (env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK).replace(/\/$/, ''),
    SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK
  },
  production: {
    API_BASE_URL: (env.VITE_BACKEND_URL || env.VITE_API_BASE_URL || BACKEND_URL_FALLBACK).replace(/\/$/, ''),
    EMAIL_API_URL: (env.VITE_BACKEND_URL || env.VITE_API_BASE_URL || BACKEND_URL_FALLBACK).replace(/\/$/, ''),
    SUBSCRIPTION_API_URL: (env.VITE_BACKEND_URL || env.VITE_API_BASE_URL || BACKEND_URL_FALLBACK).replace(/\/$/, ''),
    SUPABASE_URL: (env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK).replace(/\/$/, ''),
    SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK
  }
};

let currentConfig = isDevelopment ? config.development : config.production;

// In production, force HTTPS for backend URL to avoid Mixed Content (HTTPS page loading HTTP images)
// Frontend: Netlify (screenmerch.com), Backend: Fly.io (screenmerch.fly.dev)
if (!isDevelopment) {
  if (currentConfig.API_BASE_URL && currentConfig.API_BASE_URL.startsWith('http://')) {
    currentConfig = { ...currentConfig, API_BASE_URL: currentConfig.API_BASE_URL.replace(/^http:\/\//i, 'https://') };
    currentConfig.EMAIL_API_URL = currentConfig.API_BASE_URL;
    currentConfig.SUBSCRIPTION_API_URL = currentConfig.API_BASE_URL;
  }
  console.log('🔧 USING PRODUCTION API BASE URL:', currentConfig.API_BASE_URL);
  console.log('🔧 Backend URL:', currentConfig.API_BASE_URL);
}

export const API_CONFIG = {
  BASE_URL: currentConfig.API_BASE_URL,
  EMAIL_API_URL: currentConfig.EMAIL_API_URL,
  SUBSCRIPTION_API_URL: currentConfig.SUBSCRIPTION_API_URL,
  SUPABASE_URL: currentConfig.SUPABASE_URL,
  SUPABASE_ANON_KEY: currentConfig.SUPABASE_ANON_KEY,

  ENDPOINTS: {
    CREATE_PRODUCT: `${currentConfig.API_BASE_URL}/api/create-product`,
    CALCULATE_SHIPPING: `${currentConfig.API_BASE_URL}/api/calculate-shipping`,
    PLACE_ORDER: `${currentConfig.API_BASE_URL}/api/place-order`,
    CREATE_CHECKOUT_SESSION: `${currentConfig.API_BASE_URL}/api/create-checkout-session`,
    SEND_SUBSCRIPTION_EMAIL: `${currentConfig.EMAIL_API_URL}/api/send-subscription-email`,
    VERIFY_SUBSCRIPTION: `${currentConfig.SUBSCRIPTION_API_URL}/api/verify-subscription`,
    USER_SUBSCRIPTION: `${currentConfig.SUBSCRIPTION_API_URL}/api/users`,
    CAPTURE_SCREENSHOT: `${currentConfig.API_BASE_URL}/api/capture-screenshot`,
    CAPTURE_PRINT_QUALITY: `${currentConfig.API_BASE_URL}/api/capture-print-quality`,
    CAPTURE_MULTIPLE_SCREENSHOTS: `${currentConfig.API_BASE_URL}/api/capture-multiple-screenshots`,
    VIDEO_INFO: `${currentConfig.API_BASE_URL}/api/video-info`
  }
};

/** Single source for backend base URL - use this instead of hardcoding screenmerch.fly.dev */
export function getBackendUrl() {
  return API_CONFIG.BASE_URL;
}

export const getEndpoint = (endpoint, params = {}) => {
  let url = API_CONFIG.ENDPOINTS[endpoint];
  Object.keys(params).forEach(key => {
    url = url.replace(`{${key}}`, params[key]);
  });
  return url;
};

export default API_CONFIG;