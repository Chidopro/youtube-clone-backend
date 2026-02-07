// Mobile Authentication Debug Utility
export const mobileAuthDebug = {
  // Check if device is mobile
  isMobile: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // Check if device is iOS
  isIOS: () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  // Check if device is Android
  isAndroid: () => {
    return /Android/.test(navigator.userAgent);
  },

  // Log authentication state
  logAuthState: () => {
    const userAuthenticated = localStorage.getItem('user_authenticated');
    const googleAuthenticated = localStorage.getItem('isAuthenticated');
    const userEmail = localStorage.getItem('user_email');
    const pendingMerchData = localStorage.getItem('pending_merch_data');
    const isLoggedIn = (userAuthenticated === 'true') || (googleAuthenticated === 'true');
    
    // Debug logs removed for production
  },

  // Clear authentication state (for testing)
  clearAuthState: () => {
    localStorage.removeItem('user_authenticated');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    localStorage.removeItem('user_email');
    localStorage.removeItem('pending_merch_data');
    console.log('🧹 Auth state cleared for testing');
  },

  // Test authentication flow
  testAuthFlow: async () => {
    console.log('🧪 Testing authentication flow...');
    mobileAuthDebug.logAuthState();
    // Google OAuth must use window.location.href (full-page redirect), not fetch(), to avoid CORS.
    // Do not fetch /api/auth/google/login — the server returns 302 to accounts.google.com.
    console.log('Google OAuth: use window.location.href to /api/auth/google/login (no fetch).');

    // Test email/password API endpoint
    try {
      const response = await fetch('https://screenmerch.fly.dev/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'testpassword'
        })
      });
      
      console.log('Email/Password API Test Response:', response.status);
      const data = await response.json();
      console.log('Email/Password API Test Data:', data);
    } catch (error) {
      console.error('Email/Password API Test Error:', error);
    }
  }
};

// Auto-log on mobile devices - DISABLED TO PREVENT CORS ERRORS
// if (mobileAuthDebug.isMobile()) {
//   console.log('📱 Mobile device detected');
//   mobileAuthDebug.logAuthState();
// }
