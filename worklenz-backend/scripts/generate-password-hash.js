#!/usr/bin/env node
/**
 * Generate bcrypt hash for admin password preseed
 * Usage: node generate-password-hash.js [password]
 * If no password provided, uses default "Password123!"
 */

const bcrypt = require('bcrypt');
const password = process.argv[2] || 'Password123!';
const saltRounds = 10;

bcrypt.hash(password, saltRounds)
  .then(hash => {
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}`);
    console.log('\nUse this hash in ADMIN_PASSWORD_HASH environment variable');
  })
  .catch(err => {
    console.error('Error generating hash:', err);
    process.exit(1);
  });

