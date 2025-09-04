from supabase import create_client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))

try:
    print("🔧 Fixing database schema...")
    
    # Try to add the missing column using RPC
    try:
        result = supabase.rpc('exec_sql', {
            'sql': """
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS preferred_payment_method TEXT DEFAULT 'stripe';
            """
        }).execute()
        print("✅ Column added successfully using RPC!")
    except Exception as e:
        print(f"⚠️ RPC method failed: {e}")
        
        # Alternative: Check if column exists
        try:
            result = supabase.table('users').select('*').limit(1).execute()
            if result.data:
                user = result.data[0]
                if 'preferred_payment_method' in user:
                    print("✅ Column already exists!")
                else:
                    print("❌ Column still missing - manual fix needed")
            else:
                print("ℹ️ No users found in table")
        except Exception as e2:
            print(f"❌ Users table error: {e2}")
            
except Exception as e:
    print(f"❌ Schema fix failed: {e}")

print("🔧 Schema fix attempt completed!")
