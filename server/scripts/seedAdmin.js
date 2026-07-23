/**
 * Idempotently (re)set the seed admin's password to a real bcrypt hash.
 * The seed inserts a known placeholder password; run this to set your own:
 *   node scripts/seedAdmin.js                # uses ChangeMe123!
 *   node scripts/seedAdmin.js "NewPass123!"  # custom
 * Requires POSTGRES_URL in .env.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db/prisma.js';

const password = process.argv[2] || 'ChangeMe123!';
const email = 'admin@asteralabs.com';

const hash = bcrypt.hashSync(password, 12);

const result = await prisma.users.updateMany({
  where: { email },
  data: { password_hash: hash, failed_attempts: 0, locked_until: null },
});

if (result.count === 0) {
  console.error(`No user ${email} found. Did you run \`npx prisma db seed\`?`);
  process.exit(1);
}
console.log(`Admin password set for ${email}: ${password}`);
await prisma.$disconnect();
