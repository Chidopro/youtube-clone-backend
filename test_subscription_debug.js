// Subscription Debug Script
// Run this in the browser console to test the subscription flow

console.log('🔍 Starting Subscription Debug Test...');

// Test 1: Check localStorage for pending session
const pendingSession = localStorage.getItem('pendingSubscriptionSession');
console.log('📦 Pending session in localStorage:', pendingSession);

// Test 2: Check URL parameters
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');
console.log('🔗 Session ID from URL:', sessionId);

// Test 3: Check authentication
async function testAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        console.log('🔐 Auth test:', { 
            user: !!user, 
            error, 
            userEmail: user?.email,
            userId: user?.id 
        });
        return { user, error };
    } catch (err) {
        console.error('❌ Auth test failed:', err);
        return { user: null, error: err };
    }
}

// Test 4: Test backend verification endpoint
async function testBackendVerification(sessionId) {
    if (!sessionId) {
        console.log('⚠️ No session ID to test');
        return;
    }
    
    try {
        console.log('🌐 Testing backend verification...');
        const response = await fetch(`https://copy5-backend.fly.dev/api/verify-subscription/${sessionId}`);
        const data = await response.json();
        console.log('📡 Backend response:', data);
        return data;
    } catch (err) {
        console.error('❌ Backend test failed:', err);
        return null;
    }
}

// Test 5: Test subscription service
async function testSubscriptionService() {
    try {
        console.log('🔧 Testing subscription service...');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.log('⚠️ No authenticated user for subscription test');
            return;
        }
        
        // Test getting current subscription
        const { data: subscription, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();
            
        console.log('📊 Current subscription:', subscription);
        console.log('❌ Subscription error:', error);
        
        return subscription;
    } catch (err) {
        console.error('❌ Subscription service test failed:', err);
        return null;
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Running all subscription tests...');
    
    // Test auth first
    const authResult = await testAuth();
    
    // Test backend if we have a session ID
    const sessionToTest = sessionId || pendingSession;
    if (sessionToTest) {
        await testBackendVerification(sessionToTest);
    }
    
    // Test subscription service
    await testSubscriptionService();
    
    console.log('✅ All tests completed!');
}

// Auto-run tests
runAllTests();

// Export functions for manual testing
window.subscriptionDebug = {
    testAuth,
    testBackendVerification,
    testSubscriptionService,
    runAllTests
};
