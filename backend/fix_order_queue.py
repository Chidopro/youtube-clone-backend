#!/usr/bin/env python3
"""
Quick script to fix an order that missed the webhook
Marks order as 'paid' and adds it to processing queue
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file")
    sys.exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

def fix_order(order_id):
    """Fix an order by marking it as paid and adding to processing queue"""
    print(f"🔧 Fixing order: {order_id}")
    
    try:
        # Check if order exists
        order_result = supabase.table('orders').select('*').eq('order_id', order_id).execute()
        if not order_result.data:
            print(f"❌ Order {order_id} not found in database")
            return False
        
        order = order_result.data[0]
        print(f"✅ Found order: {order_id}")
        print(f"   Current status: {order.get('status', 'unknown')}")
        
        # Update order status to 'paid' if it's still 'pending'
        if order.get('status') == 'pending':
            supabase.table('orders').update({'status': 'paid'}).eq('order_id', order_id).execute()
            print(f"✅ Updated order status to 'paid'")
        else:
            print(f"ℹ️  Order status is already: {order.get('status')}")
        
        # Check if processing queue entry exists
        queue_check = supabase.table('order_processing_queue').select('id').eq('order_id', order_id).execute()
        if not queue_check.data:
            # Create queue entry
            queue_entry = {
                'order_id': order_id,
                'status': 'pending',
                'priority': 0
            }
            supabase.table('order_processing_queue').insert(queue_entry).execute()
            print(f"✅ Created processing queue entry")
            return True
        else:
            print(f"ℹ️  Processing queue entry already exists")
            return True
            
    except Exception as e:
        print(f"❌ Error fixing order: {str(e)}")
        return False

if __name__ == "__main__":
    # Order ID from the logs
    order_id = "44be5aba-a922-4ba0-9fca-f85d5f2ebfad"
    
    if len(sys.argv) > 1:
        order_id = sys.argv[1]
    
    print(f"🚀 Fixing order queue for: {order_id}\n")
    success = fix_order(order_id)
    
    if success:
        print(f"\n✅ Order {order_id} has been fixed!")
        print("   - Status updated to 'paid'")
        print("   - Added to processing queue")
        print("\n🔄 Refresh the admin portal to see the order")
    else:
        print(f"\n❌ Failed to fix order {order_id}")
        sys.exit(1)

