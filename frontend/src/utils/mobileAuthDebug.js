// Mobile Authentication Debug Utility
export const mobileAuthDebug = {
  // Check if device is mobile
  isMobile: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // Log authentication state
  logAuthState: () => {
    const isAuthenticated = localStorage.getItem('user_authenticated');
    const userEmail = localStorage.getItem('user_email');
    const pendingMerchData = localStorage.getItem('pending_merch_data');
    
    console.log('🔍 Mobile Auth Debug Info:');
    console.log('  - Is Mobile:', mobileAuthDebug.isMobile());
    console.log('  - Is Authenticated:', isAuthenticated);
    console.log('  - User Email:', userEmail);
    console.log('  - Pending Merch Data:', pendingMerchData ? 'Yes' : 'No');
    console.log('  - User Agent:', navigator.userAgent);
  },

  // Clear authentication state (for testing)
  clearAuthState: () => {
    localStorage.removeItem('user_authenticated');
    localStorage.removeItem('user_email');
    localStorage.removeItem('pending_merch_data');
    console.log('🧹 Auth state cleared for testing');
  },

  // Test authentication flow
  testAuthFlow: async () => {
    console.log('🧪 Testing authentication flow...');
    mobileAuthDebug.logAuthState();
    
    // Test API endpoint
    try {
      const response = await fetch(`${window.location.origin}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'testpassword'
        })
      });
      
      console.log('API Test Response:', response.status);
      const data = await response.json();
      console.log('API Test Data:', data);
    } catch (error) {
      console.error('API Test Error:', error);
    }
  }
};

// Auto-log on mobile devices
if (mobileAuthDebug.isMobile()) {
  console.log('📱 Mobile device detected');
  mobileAuthDebug.logAuthState();
}
