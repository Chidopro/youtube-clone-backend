// Test script to verify mobile email authentication
// Run this in browser console on mobile or desktop

console.log('🧪 Testing Mobile Email Authentication...');

// Test the authentication endpoint directly
async function testEmailAuth() {
  const testEmail = 'test@example.com';
  const testPassword = 'testpassword123';
  
  console.log('📧 Testing with email:', testEmail);
  
  try {
    const response = await fetch('https://screenmerch.fly.dev/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response ok:', response.ok);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS! Authentication working:', data);
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ FAILED! Error response:', errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
    return false;
  }
}

// Test CORS preflight
async function testCORSPreflight() {
  console.log('🔍 Testing CORS preflight...');
  
  try {
    const response = await fetch('https://screenmerch.fly.dev/api/auth/login', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
        'Origin': window.location.origin
      }
    });
    
    console.log('📊 OPTIONS status:', response.status);
    console.log('📊 OPTIONS headers:', Object.fromEntries(response.headers.entries()));
    
    return response.status === 200;
  } catch (error) {
    console.log('❌ OPTIONS ERROR:', error.message);
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 Starting authentication tests...');
  
  // Test 1: CORS preflight
  const corsWorks = await testCORSPreflight();
  console.log('🔍 CORS preflight:', corsWorks ? '✅ PASS' : '❌ FAIL');
  
  // Test 2: Authentication endpoint
  const authWorks = await testEmailAuth();
  console.log('🔐 Authentication:', authWorks ? '✅ PASS' : '❌ FAIL');
  
  // Summary
  console.log('📋 TEST SUMMARY:');
  console.log('  CORS Preflight:', corsWorks ? '✅ PASS' : '❌ FAIL');
  console.log('  Authentication:', authWorks ? '✅ PASS' : '❌ FAIL');
  
  if (corsWorks && authWorks) {
    console.log('🎉 ALL TESTS PASSED! Mobile email auth should work.');
  } else {
    console.log('⚠️  SOME TESTS FAILED. Check the errors above.');
  }
}

// Run the tests
runTests();
