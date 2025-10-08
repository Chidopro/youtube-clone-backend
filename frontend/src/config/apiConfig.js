// API Configuration for different environments
const isDevelopment = import.meta.env.MODE === 'development';

const config = {
  development: {
    API_BASE_URL: 'http://127.0.0.1:5000',
    EMAIL_API_URL: 'http://localhost:3001',
    SUBSCRIPTION_API_URL: 'http://localhost:3002',
    SUPABASE_URL: 'https://sojxbydpcdcdzfdtbypd.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no'
  },
  production: {
    API_BASE_URL: 'https://screenmerch.fly.dev',
    EMAIL_API_URL: 'https://screenmerch.fly.dev',
    SUBSCRIPTION_API_URL: 'https://screenmerch.fly.dev',
    SUPABASE_URL: 'https://sojxbydpcdcdzfdtbypd.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTIwNTUsImV4cCI6MjA2NTQyODA1NX0.BUm9LKbNs-EdJKxwwtoY3IRyokmDtRbS0XP-WBw-5no'
  }
};

const currentConfig = isDevelopment ? config.development : config.production;

// Force override for production to ensure correct backend URL
if (!isDevelopment) {
  currentConfig.API_BASE_URL = 'https://screenmerch.fly.dev';
  currentConfig.EMAIL_API_URL = 'https://screenmerch.fly.dev';
  currentConfig.SUBSCRIPTION_API_URL = 'https://screenmerch.fly.dev';
  console.log('🔧 FORCING PRODUCTION API CONFIG OVERRIDE');
  console.log('🔧 Forced API_BASE_URL:', currentConfig.API_BASE_URL);
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
    SEND_SUBSCRIPTION_EMAIL: `${currentConfig.EMAIL_API_URL}/api/send-subscription-email`,
    VERIFY_SUBSCRIPTION: `${currentConfig.SUBSCRIPTION_API_URL}/api/verify-subscription`,
    USER_SUBSCRIPTION: `${currentConfig.SUBSCRIPTION_API_URL}/api/users`,
    CAPTURE_SCREENSHOT: `${currentConfig.API_BASE_URL}/api/capture-screenshot`,
    CAPTURE_MULTIPLE_SCREENSHOTS: `${currentConfig.API_BASE_URL}/api/capture-multiple-screenshots`,
    VIDEO_INFO: `${currentConfig.API_BASE_URL}/api/video-info`
  }
};

export const getEndpoint = (endpoint, params = {}) => {
  let url = API_CONFIG.ENDPOINTS[endpoint];
  Object.keys(params).forEach(key => {
    url = url.replace(`{${key}}`, params[key]);
  });
  return url;
};

export default API_CONFIG;