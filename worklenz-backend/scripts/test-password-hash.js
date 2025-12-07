#!/usr/bin/env node
/**
 * Test if a password hash works with Node.js bcrypt
 * Usage: node test-password-hash.js <hash> <password>
 */

const bcrypt = require('bcrypt');
const hash = process.argv[2];
const password = process.argv[3] || 'Password123!';

if (!hash) {
  console.error('Usage: node test-password-hash.js <hash> [password]');
  process.exit(1);
}

bcrypt.compare(password, hash)
  .then(result => {
    if (result) {
      console.log('✅ Password hash is VALID - login should work!');
    } else {
      console.log('❌ Password hash is INVALID - login will fail!');
      console.log(`Hash: ${hash}`);
      console.log(`Password tested: ${password}`);
    }
  })
  .catch(err => {
    console.error('Error testing hash:', err);
    process.exit(1);
  });

