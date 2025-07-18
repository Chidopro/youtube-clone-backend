// Authentication Test Script
// Add this to your browser console to test authentication

import { supabase } from './supabaseClient.js';

async function testAuth() {
    console.log('🔍 Testing Authentication...');
    
    try {
        // Test 1: Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('✅ User:', user);
        console.log('❌ User Error:', userError);
        
        if (user) {
            // Test 2: Check if user exists in database
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();
            
            console.log('✅ Profile:', profile);
            console.log('❌ Profile Error:', profileError);
            
            // Test 3: Check user permissions
            console.log('✅ User ID:', user.id);
            console.log('✅ User Email:', user.email);
            console.log('✅ User Metadata:', user.user_metadata);
        } else {
            console.log('❌ No authenticated user found');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testAuth(); 