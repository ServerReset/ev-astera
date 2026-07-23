/** Generate a bcrypt hash for a password. Usage: node scripts/genHash.js "MyPassword123!" */
import bcrypt from 'bcryptjs';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/genHash.js "<password>"');
  process.exit(1);
}
console.log(bcrypt.hashSync(pw, 12));
