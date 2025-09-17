#!/usr/bin/env python3
"""
Test admin form submission
"""
import requests
import json

def test_admin_form():
    print("🔐 Testing admin form submission...")
    
    # First get the login page to get any CSRF tokens or session cookies
    session = requests.Session()
    
    try:
        # Get the login page
        response = session.get('https://copy5-backend.fly.dev/admin/login')
        print(f"Login page status: {response.status_code}")
        
        # Now submit the form
        login_data = {
            'email': 'chidopro@proton.me',
            'password': 'VieG369Bbk8!'
        }
        
        response = session.post('https://copy5-backend.fly.dev/admin/login', 
                              data=login_data)
        
        print(f"Form submission status: {response.status_code}")
        print(f"Response URL: {response.url}")
        
        if response.status_code == 302:
            print("✅ Redirect detected - likely successful login!")
            print(f"Redirect location: {response.headers.get('Location', 'Not specified')}")
        elif response.status_code == 200:
            # Check if we're on the admin dashboard or still on login page
            if "admin" in response.text.lower() and "login" not in response.text.lower():
                print("✅ Successfully logged in - on admin dashboard!")
            else:
                print("❌ Still on login page - login failed")
                # Look for error messages
                if "error" in response.text.lower():
                    print("Error message found in response")
        else:
            print(f"❌ Unexpected status: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_admin_form()
