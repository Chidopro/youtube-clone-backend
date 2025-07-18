// Fix User Role Script
// Run this in your browser console to update your user role

import { supabase } from './supabaseClient.js';

async function fixUserRole() {
    console.log('🔧 Fixing user role...');
    
    try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (!user) {
            console.log('❌ No authenticated user found');
            return;
        }
        
        console.log('✅ User found:', user.email);
        
        // Update user role to 'creator'
        const { data, error } = await supabase
            .from('users')
            .update({ role: 'creator' })
            .eq('id', user.id)
            .select();
        
        if (error) {
            console.error('❌ Error updating role:', error);
            return;
        }
        
        console.log('✅ Role updated successfully!');
        console.log('✅ Updated user data:', data);
        
        // Refresh the page to apply changes
        console.log('🔄 Refreshing page...');
        window.location.reload();
        
    } catch (error) {
        console.error('❌ Script failed:', error);
    }
}

// Run the fix
fixUserRole(); 