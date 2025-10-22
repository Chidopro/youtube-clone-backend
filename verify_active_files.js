#!/usr/bin/env node

/**
 * ScreenMerch Active Files Verifier
 * Run this script to verify which files are actually being used
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ScreenMerch Active Files Verifier\n');

// Check backend files
console.log('📁 BACKEND FILES (Fly.io):');
const backendFiles = [
    'backend/app.py',
    'backend/fly.toml', 
    'backend/requirements.txt'
];

backendFiles.forEach(file => {
    const exists = fs.existsSync(file);
    const status = exists ? '✅ ACTIVE' : '❌ MISSING';
    console.log(`  ${status} ${file}`);
});

// Check frontend files
console.log('\n📁 FRONTEND FILES (Netlify):');
const frontendFiles = [
    'frontend/src/App.jsx',
    'frontend/src/main.jsx',
    'frontend/src/Components/Navbar/Navbar.jsx',
    'frontend/package.json',
    'frontend/vite.config.js',
    'frontend/netlify.toml'
];

frontendFiles.forEach(file => {
    const exists = fs.existsSync(file);
    const status = exists ? '✅ ACTIVE' : '❌ MISSING';
    console.log(`  ${status} ${file}`);
});

// Check for inactive duplicates
console.log('\n⚠️  INACTIVE DUPLICATES (DO NOT EDIT):');
const inactiveFiles = [
    'src/App.jsx',
    'src/main.jsx', 
    'src/Components/Navbar/Navbar.jsx',
    'app.py',
    'package.json',
    'vite.config.js',
    'netlify.toml',
    'fly.toml'
];

inactiveFiles.forEach(file => {
    const exists = fs.existsSync(file);
    const status = exists ? '⚠️  INACTIVE' : '✅ NOT FOUND';
    console.log(`  ${status} ${file}`);
});

// Check build outputs
console.log('\n🏗️  BUILD OUTPUTS:');
const buildDirs = [
    'frontend/dist',
    'dist'
];

buildDirs.forEach(dir => {
    const exists = fs.existsSync(dir);
    const status = exists ? '✅ BUILT' : '❌ NOT BUILT';
    console.log(`  ${status} ${dir}/`);
});

console.log('\n📋 SUMMARY:');
console.log('  • Backend: Edit files in backend/ directory');
console.log('  • Frontend: Edit files in frontend/src/ directory');
console.log('  • Deploy backend: cd backend && fly deploy');
console.log('  • Deploy frontend: cd frontend && npm run build');
console.log('\n🎯 Always verify you\'re editing the correct file!');
