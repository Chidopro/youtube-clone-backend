#!/usr/bin/env python3
"""
Setup admin in database via endpoint
"""
import requests

def setup_admin():
    print("🔧 Setting up admin in database...")
    
    try:
        response = requests.post('https://copy5-backend.fly.dev/admin/setup')
        if response.status_code == 200:
            print("✅ Admin setup successful!")
            print("Response:", response.text[:200] + "..." if len(response.text) > 200 else response.text)
        else:
            print(f"❌ Admin setup failed: {response.status_code}")
            print("Response:", response.text)
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    setup_admin()
