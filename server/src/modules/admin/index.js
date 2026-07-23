/**
 * Admin module: location-scoped, admin-only operational controls + config.
 * Every route sits behind authenticate (from the location-scope mount) + authorize('admin').
 */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/respond.js';
import { ROLES } from '../../../../shared/constants.js';
import {
  announcementSchema,
  updateSettingsSchema,
  setOfflineSchema,
  adminUpdateUserSchema,
  adminCreateUserSchema,
} from '../../../../shared/validation.js';
import { adminService } from './admin.service.js';

export default defineModule({
  name: 'admin',
  basePath: '/admin',
  routes(router) {
    // Location scope + authenticate are applied by the mount; add the admin gate here.
    router.use(authorize(ROLES.ADMIN));

    router.get('/overview', asyncHandler(async (req, res) => ok(res, await adminService.overview(req.locationId))));

    // Chargers
    router.post(
      '/chargers/:chargerId/offline',
      validate(setOfflineSchema),
      asyncHandler(async (req, res) => ok(res, await adminService.setChargerOffline(req.locationId, req.params.chargerId, req.body.reason)))
    );
    router.post(
      '/chargers/:chargerId/online',
      asyncHandler(async (req, res) => ok(res, await adminService.setChargerOnline(req.locationId, req.params.chargerId)))
    );
    router.patch(
      '/chargers/:chargerId',
      asyncHandler(async (req, res) => ok(res, await adminService.renameCharger(req.locationId, req.params.chargerId, req.body?.name)))
    );

    // Sessions
    router.post(
      '/sessions/:sessionId/force-end',
      asyncHandler(async (req, res) => ok(res, await adminService.forceEndSession(req.locationId, req.params.sessionId, req.user.userId)))
    );

    // Settings
    router.get('/settings', asyncHandler(async (req, res) => ok(res, await adminService.getSettings(req.locationId))));
    router.patch(
      '/settings',
      validate(updateSettingsSchema),
      asyncHandler(async (req, res) => ok(res, await adminService.updateSettings(req.locationId, req.body, req.user.userId)))
    );

    // Announcements
    router.get('/announcements', asyncHandler(async (req, res) => ok(res, await adminService.listAnnouncements(req.locationId))));
    router.post(
      '/announcements',
      validate(announcementSchema),
      asyncHandler(async (req, res) => created(res, await adminService.createAnnouncement(req.locationId, req.user.userId, req.body)))
    );
    router.delete(
      '/announcements/:announcementId',
      asyncHandler(async (req, res) => ok(res, await adminService.deleteAnnouncement(req.locationId, req.params.announcementId)))
    );

    // Users
    router.get(
      '/users',
      asyncHandler(async (req, res) => {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        ok(res, await adminService.listUsers(req.locationId, page, (req.query.search || '').toString()));
      })
    );
    router.patch(
      '/users/:userId',
      validate(adminUpdateUserSchema),
      asyncHandler(async (req, res) => ok(res, await adminService.updateUser(req.locationId, req.params.userId, req.body)))
    );
    router.post(
      '/users',
      validate(adminCreateUserSchema),
      asyncHandler(async (req, res) => created(res, await adminService.createUser(req.locationId, req.body)))
    );

    // Audit feed
    router.get(
      '/audit',
      asyncHandler(async (req, res) => {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        ok(res, await adminService.auditFeed(req.locationId, page));
      })
    );
  },
});
