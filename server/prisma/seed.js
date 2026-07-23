/**
 * Prisma seed (run via `npx prisma db seed`). Reproduces the fixed-UUID single-site fixture
 * the old db/seed.sql created: one location, one admin user (placeholder password — run
 * `npm run seed:admin` after this to set a real one), and 3 chargers.
 *
 * Settings are intentionally NOT seeded here — configService.get()/getAll() already fall
 * back to SETTING_DEFAULTS (shared/constants.js) when no row exists, so an empty settings
 * table behaves identically to one pre-populated with defaults.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const LOCATION_ID = '11111111-1111-1111-1111-111111111111';
const ADMIN_ID = '22222222-2222-2222-2222-222222222222';

async function main() {
  await prisma.locations.upsert({
    where: { id: LOCATION_ID },
    create: {
      id: LOCATION_ID,
      name: 'Astera Labs HQ',
      timezone: 'America/Los_Angeles',
      address: '2953 Bunker Hill Ln, Santa Clara, CA',
      site_lat: 37.3541,
      site_lng: -121.9552,
    },
    update: {},
  });

  await prisma.users.upsert({
    where: { id: ADMIN_ID },
    create: {
      id: ADMIN_ID,
      location_id: LOCATION_ID,
      email: 'admin@asteralabs.com',
      password_hash: bcrypt.hashSync('ChangeMe123!', 12),
      display_name: 'Site Admin',
      role: 'admin',
    },
    update: {},
  });

  const chargers = [
    { name: 'Charger 1', position: 1 },
    { name: 'Charger 2', position: 2 },
    { name: 'Charger 3', position: 3 },
  ];
  for (const c of chargers) {
    const existing = await prisma.chargers.findFirst({ where: { location_id: LOCATION_ID, name: c.name } });
    if (!existing) {
      await prisma.chargers.create({ data: { location_id: LOCATION_ID, name: c.name, position: c.position } });
    }
  }

  console.log('Seed complete:', { location: LOCATION_ID, admin: 'admin@asteralabs.com / ChangeMe123!' });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
