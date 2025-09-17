#!/usr/bin/env python3
"""
Debug password exactly
"""
import requests
import json

def debug_password():
    print("🔍 Debugging password exactly...")
    
    # Test with exact password from admin setup
    passwords_to_try = [
        'VieG369Bbk8!',
        'VieG369Bbk8',
        'admin123',
        'VieG369Bbk8! ',
        ' VieG369Bbk8!',
        'VieG369Bbk8!\\n',
        'VieG369Bbk8!\\r'
    ]
    
    for i, password in enumerate(passwords_to_try, 1):
        print(f"\n{i}️⃣ Trying password: '{password}' (length: {len(password)})")
        
        login_data = {
            'email': 'chidopro@proton.me',
            'password': password
        }
        
        try:
            response = requests.post('https://copy5-backend.fly.dev/api/auth/login', 
                                   json=login_data)
            
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                print(f"   ✅ SUCCESS! Password: '{password}'")
                return password
            else:
                print(f"   ❌ Failed: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print("\n❌ No password worked. There might be a database issue.")
    return None

if __name__ == "__main__":
    debug_password()
