#!/usr/bin/env node

/**
 * Setup script to install the git pre-commit hook for auto-syncing
 * Run this once: node setup-sync-hook.js
 */

const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '.git', 'hooks');
const PRE_COMMIT_HOOK = path.join(HOOKS_DIR, 'pre-commit');
const HOOK_CONTENT = `#!/bin/sh
# Git pre-commit hook to sync public/ to docs/ before committing

echo "🔄 Auto-syncing public/ to docs/ for GitHub Pages..."
node sync-docs.js

# Stage the synced files
git add docs/

exit 0
`;

try {
  // Ensure .git/hooks directory exists
  if (!fs.existsSync(HOOKS_DIR)) {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    console.log('✅ Created .git/hooks directory');
  }

  // Write the hook
  fs.writeFileSync(PRE_COMMIT_HOOK, HOOK_CONTENT, 'utf8');
  
  // Make it executable (Unix-like systems)
  if (process.platform !== 'win32') {
    fs.chmodSync(PRE_COMMIT_HOOK, '755');
  }

  console.log('✅ Git pre-commit hook installed successfully!');
  console.log('📝 The hook will automatically sync public/ to docs/ before each commit.');
  console.log('\n💡 You can also manually sync by running: npm run sync-docs');
} catch (error) {
  console.error('❌ Error setting up git hook:', error.message);
  process.exit(1);
}

