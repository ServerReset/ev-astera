/**
 * Office module: root-scoped. Manages the list of offices itself — creating/deactivating —
 * as opposed to the admin module, which manages one office's operational contents and is
 * reused by super-admins via locationScope's cross-office bypass. See docs/CONTRACTS.md.
 */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/respond.js';
import { ROLES } from '../../../../shared/constants.js';
import { createOfficeSchema } from '../../../../shared/validation.js';
import { officeService } from './office.service.js';

export default defineModule({
  name: 'office',
  scope: 'root',
  basePath: '/offices',
  routes(router) {
    // Public — the signup dropdown needs this before the user has any credentials at all.
    router.get('/', asyncHandler(async (_req, res) => ok(res, await officeService.listPublic())));

    router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

    router.get('/admin', asyncHandler(async (_req, res) => ok(res, await officeService.listForAdmin())));

    router.post(
      '/',
      validate(createOfficeSchema),
      asyncHandler(async (req, res) => created(res, await officeService.create(req.body)))
    );

    router.post(
      '/:officeId/deactivate',
      asyncHandler(async (req, res) => ok(res, await officeService.setActive(req.params.officeId, false)))
    );

    router.post(
      '/:officeId/reactivate',
      asyncHandler(async (req, res) => ok(res, await officeService.setActive(req.params.officeId, true)))
    );
  },
});
