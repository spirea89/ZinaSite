#!/usr/bin/env node

/**
 * Sync script to copy files from public/ to docs/ for GitHub Pages
 * Run this script whenever you make changes to files in public/
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const DOCS_DIR = path.join(__dirname, 'docs');

// Files to sync (matching what rsync would sync)
const FILES_TO_SYNC = ['index.html', 'admin.html', 'styles.css'];

function syncFiles() {
  console.log('🔄 Syncing public/ to docs/ for GitHub Pages...\n');

  // Ensure docs directory exists
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    console.log('✅ Created docs/ directory');
  }

  // Get all files in public directory
  const publicFiles = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name);

  // Remove files from docs that don't exist in public (like rsync --delete)
  const docsFiles = fs.readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name);

  docsFiles.forEach(file => {
    if (!publicFiles.includes(file)) {
      const filePath = path.join(DOCS_DIR, file);
      fs.unlinkSync(filePath);
      console.log(`🗑️  Removed: ${file} (not in public/)`);
    }
  });

  let syncedCount = 0;
  let errorCount = 0;

  // Sync all files from public to docs
  publicFiles.forEach(file => {
    const sourcePath = path.join(PUBLIC_DIR, file);
    const destPath = path.join(DOCS_DIR, file);

    try {
      // Read and write to ensure consistent line endings
      const content = fs.readFileSync(sourcePath, 'utf8');
      fs.writeFileSync(destPath, content, 'utf8');
      console.log(`✅ Synced: ${file}`);
      syncedCount++;
    } catch (error) {
      console.error(`❌ Error syncing ${file}:`, error.message);
      errorCount++;
    }
  });

  console.log(`\n✨ Sync complete! ${syncedCount} file(s) synced${errorCount > 0 ? `, ${errorCount} error(s)` : ''}`);
}

// Run sync
syncFiles();

