#!/usr/bin/env node

/**
 * Debug Authentication State
 * Run this in browser console to check auth state
 */

console.log('🔍 Debugging Authentication State...\n');

// Check localStorage
console.log('📦 localStorage contents:');
console.log('  isAuthenticated:', localStorage.getItem('isAuthenticated'));
console.log('  user:', localStorage.getItem('user'));
console.log('  user_authenticated:', localStorage.getItem('user_authenticated'));
console.log('  customer_authenticated:', localStorage.getItem('customer_authenticated'));

// Parse user data if it exists
const userData = localStorage.getItem('user');
if (userData) {
    try {
        const user = JSON.parse(userData);
        console.log('\n👤 Parsed user data:');
        console.log('  ID:', user.id);
        console.log('  Email:', user.email);
        console.log('  Display Name:', user.display_name);
        console.log('  Picture:', user.picture);
        console.log('  Role:', user.role);
        console.log('  YouTube Channel:', user.youtube_channel);
    } catch (error) {
        console.log('❌ Error parsing user data:', error);
    }
}

// Check current URL
console.log('\n🌐 Current URL:', window.location.href);

// Check for OAuth success parameters
const urlParams = new URLSearchParams(window.location.search);
console.log('  login parameter:', urlParams.get('login'));
console.log('  user parameter:', urlParams.get('user'));

console.log('\n✅ Debug complete!');
