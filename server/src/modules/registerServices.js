/**
 * Registers every module's service object into the shared services registry.
 * Kept separate from registry.js so service wiring is explicit and cycle-free:
 * services are imported here (not in the manifest) and attached by name.
 */
import { registerService } from '../services/index.js';

import { authService } from './auth/auth.service.js';
import { userService } from './user/user.service.js';
import { chargerService } from './charger/charger.service.js';
import { sessionService } from './session/session.service.js';
import { queueService } from './queue/queue.service.js';
import { notificationService } from './notification/notification.service.js';
import { messageService } from './message/message.service.js';
import { carpoolService } from './carpool/carpool.service.js';
import { reliabilityService } from './reliability/reliability.service.js';
import { adminService } from './admin/admin.service.js';

export function registerAllServices() {
  registerService('auth', authService);
  registerService('user', userService);
  registerService('charger', chargerService);
  registerService('session', sessionService);
  registerService('queue', queueService);
  registerService('notification', notificationService);
  registerService('message', messageService);
  registerService('carpool', carpoolService);
  registerService('reliability', reliabilityService);
  registerService('admin', adminService);
}
