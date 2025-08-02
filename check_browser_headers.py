#!/usr/bin/env python3
"""
Check browser headers and security policies
"""
import requests

def check_headers():
    product_id = "67282a3b-09c4-4974-9675-b2fa5c947f9b"
    url = f"https://backend-hidden-firefly-7865.fly.dev/product/{product_id}"
    
    print(f"🔍 Checking headers for: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"📊 Status Code: {response.status_code}")
        
        print(f"\n📋 Response Headers:")
        for header, value in response.headers.items():
            print(f"   {header}: {value}")
            
        # Check for security headers that might block content
        security_headers = [
            'Content-Security-Policy',
            'X-Frame-Options', 
            'X-Content-Type-Options',
            'Referrer-Policy',
            'Permissions-Policy'
        ]
        
        print(f"\n🔒 Security Headers Analysis:")
        for header in security_headers:
            value = response.headers.get(header, 'Not Set')
            print(f"   {header}: {value}")
            
        # Check content type
        content_type = response.headers.get('Content-Type', 'Not Set')
        print(f"\n📄 Content-Type: {content_type}")
        
        # Check if content is actually there
        content_length = len(response.text)
        print(f"📏 Content Length: {content_length} characters")
        
        if content_length < 1000:
            print("⚠️ Content seems very short - might be an error page")
        else:
            print("✅ Content length looks normal")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_headers() 