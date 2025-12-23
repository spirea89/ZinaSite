#!/usr/bin/env node

/**
 * Sync script to copy files from public/ to docs/ for GitHub Pages
 * Run this script whenever you make changes to files in public/
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const DOCS_DIR = path.join(__dirname, 'docs');

// Files to sync
const FILES_TO_SYNC = ['index.html', 'admin.html', 'styles.css'];

function syncFiles() {
  console.log('🔄 Syncing public/ to docs/ for GitHub Pages...\n');

  // Ensure docs directory exists
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    console.log('✅ Created docs/ directory');
  }

  let syncedCount = 0;
  let errorCount = 0;

  FILES_TO_SYNC.forEach(file => {
    const sourcePath = path.join(PUBLIC_DIR, file);
    const destPath = path.join(DOCS_DIR, file);

    try {
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✅ Synced: ${file}`);
        syncedCount++;
      } else {
        console.warn(`⚠️  Source file not found: ${file}`);
      }
    } catch (error) {
      console.error(`❌ Error syncing ${file}:`, error.message);
      errorCount++;
    }
  });

  console.log(`\n✨ Sync complete! ${syncedCount} file(s) synced${errorCount > 0 ? `, ${errorCount} error(s)` : ''}`);
}

// Run sync
syncFiles();

