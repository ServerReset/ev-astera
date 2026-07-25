/**
 * Prisma seed (run via `npx prisma db seed`). Seeds 3 offices across distinct timezones — to
 * prove the multi-office timezone fix actually works, not just one — plus a super-admin (homed
 * at the first office, manages all three) and one site-admin + 3 chargers per office.
 *
 * Settings are intentionally NOT seeded — configService.get()/getAll() already fall back to
 * SETTING_DEFAULTS (shared/constants.js) when no row exists, so an empty settings table behaves
 * identically to one pre-populated with defaults, for every office alike.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Single office — Astera Labs HQ (Santa Clara). The multi-office plumbing stays intact (a
// super-admin can still create more offices at runtime); this just seeds the one real site
// rather than fabricated ones. Migration 20260725050000 removes the previously-seeded
// Austin/Bengaluru offices (and their data) from any existing database.
const OFFICES = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Astera Labs — Santa Clara',
    timezone: 'America/Los_Angeles',
    address: '2953 Bunker Hill Ln, Santa Clara, CA',
    site_lat: 37.3541,
    site_lng: -121.9552,
    adminId: '22222222-2222-2222-2222-222222222222',
    adminEmail: 'admin-santaclara@asteralabs.com',
  },
];

const SUPER_ADMIN_ID = '22222222-2222-2222-2222-222222222220';
const SUPER_ADMIN_EMAIL = 'super-admin@asteralabs.com';
const PASSWORD = 'ChangeMe123!';

async function main() {
  const passwordHash = bcrypt.hashSync(PASSWORD, 12);

  for (const office of OFFICES) {
    await prisma.locations.upsert({
      where: { id: office.id },
      create: {
        id: office.id,
        name: office.name,
        timezone: office.timezone,
        address: office.address,
        site_lat: office.site_lat,
        site_lng: office.site_lng,
      },
      update: {},
    });

    await prisma.users.upsert({
      where: { id: office.adminId },
      create: {
        id: office.adminId,
        location_id: office.id,
        email: office.adminEmail,
        password_hash: passwordHash,
        display_name: `${office.name.split('— ')[1]} Site Admin`,
        role: 'site_admin',
      },
      update: {},
    });

    for (let i = 1; i <= 3; i++) {
      const name = `Charger ${i}`;
      const existing = await prisma.chargers.findFirst({ where: { location_id: office.id, name } });
      if (!existing) {
        await prisma.chargers.create({ data: { location_id: office.id, name, position: i } });
      }
    }
  }

  // Super-admin is homed at the first office but, via locationScope's cross-office bypass, can
  // manage any of them.
  await prisma.users.upsert({
    where: { id: SUPER_ADMIN_ID },
    create: {
      id: SUPER_ADMIN_ID,
      location_id: OFFICES[0].id,
      email: SUPER_ADMIN_EMAIL,
      password_hash: passwordHash,
      display_name: 'Super Admin',
      role: 'super_admin',
    },
    update: {},
  });

  console.log('Seed complete:');
  console.log(`  Super admin: ${SUPER_ADMIN_EMAIL} / ${PASSWORD}`);
  for (const office of OFFICES) {
    console.log(`  ${office.name}: ${office.adminEmail} / ${PASSWORD}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
