const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   - VITE_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nPlease check your .env file and try again.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSqlFile(filename) {
    try {
        console.log(`📄 Reading SQL file: ${filename}`);
        const sqlContent = fs.readFileSync(path.join(__dirname, filename), 'utf8');
        
        console.log(`🚀 Executing SQL from ${filename}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
        
        if (error) {
            console.error(`❌ Error executing ${filename}:`, error);
            return false;
        }
        
        console.log(`✅ Successfully executed ${filename}`);
        return true;
    } catch (error) {
        console.error(`❌ Error reading or executing ${filename}:`, error);
        return false;
    }
}

async function setupDatabase() {
    console.log('🔧 Setting up database...\n');
    
    // Run database setup
    const dbSuccess = await runSqlFile('database_setup.sql');
    if (!dbSuccess) {
        console.error('❌ Database setup failed');
        process.exit(1);
    }
    
    // Run storage setup
    const storageSuccess = await runSqlFile('storage_setup.sql');
    if (!storageSuccess) {
        console.error('❌ Storage setup failed');
        process.exit(1);
    }
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to Storage');
    console.log('3. Create the following buckets:');
    console.log('   - videos2 (public, 100MB limit, video/*)');
    console.log('   - thumbnails (public, 10MB limit, image/*)');
    console.log('   - profile-images (public, 5MB limit, image/*)');
    console.log('4. Test the upload functionality');
}

// Check if we can connect to Supabase
async function testConnection() {
    try {
        console.log('🔍 Testing Supabase connection...');
        const { data, error } = await supabase.from('users').select('count').limit(1);
        
        if (error) {
            console.error('❌ Connection test failed:', error.message);
            return false;
        }
        
        console.log('✅ Connection successful');
        return true;
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 YouTube Clone Database Setup\n');
    
    const connected = await testConnection();
    if (!connected) {
        console.error('❌ Cannot connect to Supabase. Please check your credentials.');
        process.exit(1);
    }
    
    await setupDatabase();
}

main().catch(console.error); 