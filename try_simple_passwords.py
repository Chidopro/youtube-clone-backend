#!/usr/bin/env python3
"""
Try simple passwords to see if any work
"""
import requests
import json

def try_passwords():
    print("🔐 Trying simple passwords...")
    
    passwords = [
        'admin',
        'password',
        '123456',
        'admin123',
        'VieG369Bbk8!',
        'VieG369Bbk8',
        'test',
        'root'
    ]
    
    session = requests.Session()
    
    for password in passwords:
        print(f"\nTrying: {password}")
        
        try:
            login_data = {
                'email': 'chidopro@proton.me',
                'password': password
            }
            
            response = session.post('https://copy5-backend.fly.dev/admin/login', 
                                  data=login_data)
            
            if response.status_code == 302:
                print(f"✅ SUCCESS with password: {password}")
                return password
            elif response.status_code == 200:
                if "Invalid credentials" not in response.text:
                    print(f"✅ SUCCESS with password: {password}")
                    return password
                else:
                    print(f"❌ Failed: {password}")
            else:
                print(f"❌ Failed: {password} (status: {response.status_code})")
                
        except Exception as e:
            print(f"❌ Error with {password}: {e}")
    
    print("\n❌ No password worked")
    return None

if __name__ == "__main__":
    try_passwords()
