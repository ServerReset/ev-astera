/**
 * Office (location) management service: the "list of offices" itself, as opposed to
 * server/src/modules/admin — which manages the operational contents of ONE office (chargers,
 * carpool, settings, users) and is reused by both site-admins and super-admins via
 * locationScope's cross-office bypass.
 */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { geocodeAddress } from '../../utils/geocode.js';
import { invalidateLocationMeta } from '../../utils/locationTz.js';
import { NotFoundError } from '../../utils/errors.js';

function toPublicOffice(row) {
  return { id: row.id, name: row.name, timezone: row.timezone, address: row.address, active: row.active };
}

export const officeService = {
  /** Active offices only — the signup dropdown. No auth required. */
  async listPublic() {
    const rows = await prisma.locations.findMany({
      where: { active: true },
      select: { id: true, name: true, timezone: true },
      orderBy: { name: 'asc' },
    });
    return rows;
  },

  /** Full roster incl. inactive, with counts — the super-admin office switcher/dashboard. */
  async listForAdmin() {
    const rows = await prisma.locations.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, chargers: true } } },
    });
    return rows.map((r) => ({ ...toPublicOffice(r), userCount: r._count.users, chargerCount: r._count.chargers }));
  },

  async create({ name, address, timezone }) {
    let site_lat;
    let site_lng;
    if (address) {
      const geo = await geocodeAddress(address); // throws — nothing written on failure
      site_lat = geo.lat;
      site_lng = geo.lng;
    }
    const data = await prisma.locations.create({
      data: { name, address: address || null, timezone, site_lat, site_lng },
    });
    await emit(EVENTS.LOCATION_CREATED, { locationId: data.id, name: data.name });
    return toPublicOffice(data);
  },

  async setActive(officeId, active) {
    let data;
    try {
      data = await prisma.locations.update({ where: { id: officeId }, data: { active } });
    } catch {
      throw new NotFoundError('Office not found');
    }
    invalidateLocationMeta(officeId);
    await emit(active ? EVENTS.LOCATION_REACTIVATED : EVENTS.LOCATION_DEACTIVATED, { locationId: officeId });
    return toPublicOffice(data);
  },
};
