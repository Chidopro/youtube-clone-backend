#!/usr/bin/env python3
"""
Simple test to check backend connectivity
"""

import requests

def test_backend():
    try:
        print("Testing backend connectivity...")
        response = requests.get("https://backend-hidden-firefly-7865.fly.dev/api/ping", timeout=5)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_backend() 