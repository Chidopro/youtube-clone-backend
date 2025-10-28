#!/usr/bin/env python3
"""
Check the actual schema of the orders table to see what columns exist.
"""

import os
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://sojxbydpcdcdzfdtbypd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvanhieWRwY2RjZHpmZHRieXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTg1MjA1NSwiZXhwIjoyMDY1NDI4MDU1fQ.lF-SglNH91xhXlTU1Inl8OSX2DeW19P12P-pFZAlRIA"

def check_orders_schema():
    """Check the orders table schema"""
    
    print("🔍 Checking orders table schema")
    print("=" * 50)
    
    try:
        # Initialize Supabase client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Connected to Supabase")
        
        # Get one order record to see the schema
        result = supabase.table('orders').select('*').limit(1).execute()
        
        if result.data:
            order = result.data[0]
            print(f"📊 Orders table columns:")
            for key, value in order.items():
                print(f"   - {key}: {type(value).__name__} = {value}")
        else:
            print("❌ No orders found")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    check_orders_schema()
