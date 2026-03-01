const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/generateOverseerHash.js <password>');
  process.exit(1);
}

bcrypt.hash(password, 10).then(hash => {
  console.log('Paste this into your .env as OVERSEER_PASSWORD_HASH:');
  console.log(hash);
});
