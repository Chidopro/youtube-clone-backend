#!/usr/bin/env python3
"""
Verify deployment status and CORS configuration
"""
import requests
import json

def check_backend_status():
    """Check if Fly.io backend is running"""
    print("🔍 Checking Fly.io Backend Status")
    print("=" * 40)
    
    backend_url = "https://screenmerch.fly.dev"
    
    try:
        # Try a simple GET request
        response = requests.get(f"{backend_url}/", timeout=10)
        print(f"✅ Backend is running: {response.status_code}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend not responding: {e}")
        return False

def check_frontend_status():
    """Check if Netlify frontend is accessible"""
    print("\n🌐 Checking Netlify Frontend Status")
    print("=" * 40)
    
    frontend_urls = [
        "https://screenmerch.com",
        "https://eloquent-crumble-37c09e.netlify.app"
    ]
    
    for url in frontend_urls:
        try:
            response = requests.get(url, timeout=10)
            print(f"✅ Frontend accessible: {url} ({response.status_code})")
        except requests.exceptions.RequestException as e:
            print(f"❌ Frontend not accessible: {url} - {e}")

def check_cors_config():
    """Check CORS configuration in the code"""
    print("\n🔧 Checking CORS Configuration")
    print("=" * 40)
    
    try:
        with open('app.py', 'r') as f:
            content = f.read()
            
        # Check for Netlify domains in CORS config
        if 'eloquent-crumble-37c09e.netlify.app' in content:
            print("✅ Netlify preview URL configured in CORS")
        else:
            print("❌ Netlify preview URL not found in CORS config")
            
        if '*.netlify.app' in content:
            print("✅ Wildcard Netlify domains configured")
        else:
            print("❌ Wildcard Netlify domains not configured")
            
        if 'screenmerch.com' in content:
            print("✅ Production domain configured")
        else:
            print("❌ Production domain not configured")
            
    except FileNotFoundError:
        print("❌ app.py not found")

def create_cors_test_html():
    """Create a simple HTML test for CORS"""
    html_content = """
<!DOCTYPE html>
<html>
<head>
    <title>CORS Test - Netlify to Fly.io</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .test-result { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .success { background-color: #d4edda; color: #155724; }
        .error { background-color: #f8d7da; color: #721c24; }
        .info { background-color: #d1ecf1; color: #0c5460; }
    </style>
</head>
<body>
    <h1>CORS Test: Netlify Frontend → Fly.io Backend</h1>
    <div id="results"></div>
    
    <script>
        const backendUrl = 'https://screenmerch.fly.dev';
        const resultsDiv = document.getElementById('results');
        
        function addResult(message, type = 'info') {
            const div = document.createElement('div');
            div.className = `test-result ${type}`;
            div.textContent = message;
            resultsDiv.appendChild(div);
        }
        
        async function testCORS() {
            addResult('🧪 Testing CORS configuration...', 'info');
            
            try {
                // Test basic connectivity
                const response = await fetch(`${backendUrl}/api/health`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    addResult('✅ Backend is responding', 'success');
                    
                    // Check CORS headers
                    const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
                    const corsCredentials = response.headers.get('Access-Control-Allow-Credentials');
                    
                    addResult(`CORS Origin: ${corsOrigin || 'Not set'}`, 'info');
                    addResult(`CORS Credentials: ${corsCredentials || 'Not set'}`, 'info');
                    
                    if (corsOrigin === window.location.origin || corsOrigin === '*') {
                        addResult('✅ CORS is working correctly', 'success');
                    } else {
                        addResult('❌ CORS origin mismatch', 'error');
                    }
                } else {
                    addResult(`❌ Backend error: ${response.status}`, 'error');
                }
            } catch (error) {
                addResult(`❌ CORS test failed: ${error.message}`, 'error');
            }
        }
        
        // Run test when page loads
        testCORS();
    </script>
</body>
</html>
"""
    
    with open('cors_test.html', 'w') as f:
        f.write(html_content)
    
    print("✅ Created cors_test.html - Open this file in your browser to test CORS")

if __name__ == "__main__":
    check_backend_status()
    check_frontend_status()
    check_cors_config()
    create_cors_test_html()
    
    print("\n📋 Deployment Summary:")
    print("   • Frontend: Netlify (screenmerch.com)")
    print("   • Backend: Fly.io (screenmerch.fly.dev)")
    print("   • CORS configured for Netlify ↔ Fly.io communication")
    print("\n🔧 Next Steps:")
    print("   1. Deploy the updated CORS configuration to Fly.io")
    print("   2. Test the CORS configuration using cors_test.html")
    print("   3. Verify frontend can communicate with backend")
