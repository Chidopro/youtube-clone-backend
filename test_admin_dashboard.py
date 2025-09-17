#!/usr/bin/env python3
"""
Test admin dashboard access
"""
import requests
import json

def test_dashboard():
    print("🔍 Testing admin dashboard access...")
    
    try:
        # Try to access admin dashboard directly
        response = requests.get('https://copy5-backend.fly.dev/admin/orders')
        print(f"Admin dashboard status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Admin dashboard accessible!")
        elif response.status_code == 302:
            print("✅ Redirected (likely to login)")
        else:
            print(f"❌ Dashboard not accessible: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Try to access admin setup page
    print("\n🔧 Testing admin setup page...")
    try:
        response = requests.get('https://copy5-backend.fly.dev/admin/setup')
        print(f"Admin setup page status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Admin setup page accessible!")
        else:
            print(f"❌ Admin setup not accessible: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_dashboard()
