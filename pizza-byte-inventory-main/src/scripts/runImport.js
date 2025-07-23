// This script builds and runs the importInventory.ts script
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure the scripts directory exists
const scriptDir = path.resolve(__dirname);
console.log(`Script directory: ${scriptDir}`);

// Build the TypeScript file first
console.log('Building TypeScript files...');
try {
  execSync('npx tsc src/scripts/importInventory.ts --esModuleInterop --resolveJsonModule --target es2020 --module commonjs --outDir dist/scripts', 
    { stdio: 'inherit' });
  console.log('TypeScript compilation successful');
} catch (error) {
  console.error('Error compiling TypeScript:', error);
  process.exit(1);
}

// Run the compiled JavaScript file
console.log('Running import script...');
try {
  execSync('node dist/scripts/importInventory.js', { stdio: 'inherit' });
  console.log('Import completed successfully');
} catch (error) {
  console.error('Error running import script:', error);
  process.exit(1);
} 