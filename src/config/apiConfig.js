// API Configuration for different environments
const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

// Default to production URLs, override in development
const config = {
  development: {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000',
    EMAIL_API_URL: import.meta.env.VITE_EMAIL_API_URL || 'http://localhost:3001',
    SUBSCRIPTION_API_URL: import.meta.env.VITE_SUBSCRIPTION_API_URL || 'http://localhost:3002',
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  production: {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://api.screenmerch.com',
    EMAIL_API_URL: import.meta.env.VITE_EMAIL_API_URL || 'https://api.screenmerch.com',
    SUBSCRIPTION_API_URL: import.meta.env.VITE_SUBSCRIPTION_API_URL || 'https://api.screenmerch.com',
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
};

// Get current environment config
const currentConfig = isDevelopment ? config.development : config.production;

// Export API endpoints
export const API_CONFIG = {
  BASE_URL: currentConfig.API_BASE_URL,
  EMAIL_API_URL: currentConfig.EMAIL_API_URL,
  SUBSCRIPTION_API_URL: currentConfig.SUBSCRIPTION_API_URL,
  SUPABASE_URL: currentConfig.SUPABASE_URL,
  SUPABASE_ANON_KEY: currentConfig.SUPABASE_ANON_KEY,
  
  // API Endpoints
  ENDPOINTS: {
    CREATE_PRODUCT: `${currentConfig.API_BASE_URL}/api/create-product`,
    SEND_SUBSCRIPTION_EMAIL: `${currentConfig.EMAIL_API_URL}/api/send-subscription-email`,
    VERIFY_SUBSCRIPTION: `${currentConfig.SUBSCRIPTION_API_URL}/api/verify-subscription`,
    USER_SUBSCRIPTION: `${currentConfig.SUBSCRIPTION_API_URL}/api/users`,
    CAPTURE_SCREENSHOT: `${currentConfig.API_BASE_URL}/api/capture-screenshot`,
    CAPTURE_MULTIPLE_SCREENSHOTS: `${currentConfig.API_BASE_URL}/api/capture-multiple-screenshots`,
    VIDEO_INFO: `${currentConfig.API_BASE_URL}/api/video-info`
  }
};

// Helper function to get full endpoint URL
export const getEndpoint = (endpoint, params = {}) => {
  let url = API_CONFIG.ENDPOINTS[endpoint];
  
  // Replace parameters in URL
  Object.keys(params).forEach(key => {
    url = url.replace(`{${key}}`, params[key]);
  });
  
  return url;
};

export default API_CONFIG; 