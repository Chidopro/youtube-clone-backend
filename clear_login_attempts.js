// Clear Login Attempts Script
// Run this in your browser console to reset the login attempt counter

console.log('🧹 Clearing login attempt counter...');

// Clear the login attempts counter
localStorage.removeItem('loginAttempts');

// Also clear any other related flags
localStorage.removeItem('processedSessions');
localStorage.removeItem('pendingSubscriptionSession');

console.log('✅ Login attempt counter cleared!');
console.log('✅ You can now test the subscription process again');

// Verify the cleanup
console.log('🔍 Current localStorage state:');
console.log('  - loginAttempts:', localStorage.getItem('loginAttempts'));
console.log('  - processedSessions:', localStorage.getItem('processedSessions'));
console.log('  - pendingSubscriptionSession:', localStorage.getItem('pendingSubscriptionSession'));
console.log('  - user_authenticated:', localStorage.getItem('user_authenticated'));
console.log('  - user_email:', localStorage.getItem('user_email'));
