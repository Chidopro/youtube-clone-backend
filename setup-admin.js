#!/usr/bin/env node

/**
 * Admin Setup Script
 * 
 * This script helps you set up the first admin user for your ScreenMerch application.
 * Run this script after setting up the database with database_admin_setup.sql
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing required environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAdmin() {
  console.log('🔧 ScreenMerch Admin Setup');
  console.log('========================\n');

  try {
    // Get user email from command line argument
    const adminEmail = process.argv[2];
    
    if (!adminEmail) {
      console.error('❌ Error: Please provide an admin email address');
      console.error('Usage: node setup-admin.js <admin-email@example.com>');
      process.exit(1);
    }

    console.log(`📧 Setting up admin privileges for: ${adminEmail}\n`);

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', adminEmail)
      .single();

    if (userError || !user) {
      console.error('❌ Error: User not found');
      console.error('Please ensure the user has signed up and has a record in the users table');
      console.error('The user should sign in at least once to create their profile');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.display_name || user.email}`);

    // Check if user is already admin
    if (user.is_admin) {
      console.log('ℹ️  User is already an admin');
      return;
    }

    // Update user to admin
    const { error: updateError } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error updating user:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Successfully granted admin privileges!');
    console.log('\n🎉 Admin setup complete!');
    console.log(`The user ${adminEmail} can now access the admin portal at:`);
    console.log('http://localhost:5174/admin');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupAdmin(); 