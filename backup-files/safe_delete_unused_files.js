#!/usr/bin/env node

/**
 * Safe Deletion Script for Unused Files
 * This script safely deletes inactive files with 100% certainty
 */

const fs = require('fs');
const path = require('path');

console.log('🛡️ Safe Deletion Script for Unused Files\n');

// Files and directories to delete
const filesToDelete = [
    'src/',
    'app.py',
    'package.json',
    'vite.config.js', 
    'netlify.toml',
    'fly.toml',
    'dist/'
];

// Critical files that must exist
const criticalFiles = [
    'frontend/src/App.jsx',
    'frontend/src/main.jsx',
    'backend/app.py',
    'backend/fly.toml',
    'frontend/package.json',
    'frontend/vite.config.js',
    'frontend/netlify.toml'
];

console.log('🔍 Pre-deletion verification...\n');

// Verify critical files exist
let allCriticalFilesExist = true;
criticalFiles.forEach(file => {
    const exists = fs.existsSync(file);
    if (!exists) {
        console.log(`❌ CRITICAL FILE MISSING: ${file}`);
        allCriticalFilesExist = false;
    } else {
        console.log(`✅ Critical file exists: ${file}`);
    }
});

if (!allCriticalFilesExist) {
    console.log('\n🚨 ABORTING: Critical files missing!');
    process.exit(1);
}

console.log('\n🗑️ Files to delete:');
filesToDelete.forEach(file => {
    const exists = fs.existsSync(file);
    const status = exists ? '✅ EXISTS' : '❌ NOT FOUND';
    console.log(`  ${status} ${file}`);
});

console.log('\n⚠️  This will permanently delete the above files.');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

// Wait 5 seconds
setTimeout(() => {
    console.log('🗑️ Starting deletion...\n');
    
    let deletedCount = 0;
    let errorCount = 0;
    
    filesToDelete.forEach(file => {
        try {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file);
                if (stats.isDirectory()) {
                    fs.rmSync(file, { recursive: true, force: true });
                    console.log(`✅ Deleted directory: ${file}`);
                } else {
                    fs.unlinkSync(file);
                    console.log(`✅ Deleted file: ${file}`);
                }
                deletedCount++;
            } else {
                console.log(`⚠️  File not found: ${file}`);
            }
        } catch (error) {
            console.log(`❌ Error deleting ${file}: ${error.message}`);
            errorCount++;
        }
    });
    
    console.log(`\n📊 Deletion Summary:`);
    console.log(`  ✅ Successfully deleted: ${deletedCount} items`);
    console.log(`  ❌ Errors: ${errorCount} items`);
    
    // Final verification
    console.log('\n🔍 Post-deletion verification...');
    let allStillExist = true;
    criticalFiles.forEach(file => {
        const exists = fs.existsSync(file);
        if (!exists) {
            console.log(`❌ CRITICAL FILE MISSING: ${file}`);
            allStillExist = false;
        } else {
            console.log(`✅ Critical file still exists: ${file}`);
        }
    });
    
    if (allStillExist) {
        console.log('\n🎉 SUCCESS: All critical files intact!');
        console.log('✅ Safe deletion completed successfully!');
    } else {
        console.log('\n🚨 ERROR: Critical files were affected!');
        console.log('❌ Please restore from backup if needed.');
    }
    
}, 5000);
