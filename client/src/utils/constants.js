/**
 * Re-export the framework-free shared constants (single source of truth with the server)
 * and add UI-only constants (labels, colors, icon mappings) on top.
 */
export * from '@shared/constants.js';

import {
  CHARGER_STATUS,
  SESSION_STATUS,
  QUEUE_STATUS,
  RIDE_STATUS,
  BOOKING_STATUS,
  NOTIFICATION_TYPES,
  CARPOOL_DIRECTION,
} from '@shared/constants.js';

/** Environment (read once). */
export const ENV = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  locationId: import.meta.env.VITE_DEFAULT_LOCATION_ID,
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
};

/** Charger status → UI treatment. */
export const CHARGER_STATUS_META = {
  [CHARGER_STATUS.AVAILABLE]: { label: 'Available', tone: 'success', dot: 'bg-success' },
  [CHARGER_STATUS.IN_USE]: { label: 'In use', tone: 'info', dot: 'bg-info' },
  [CHARGER_STATUS.OVERTIME]: { label: 'Overtime', tone: 'warning', dot: 'bg-warning' },
  [CHARGER_STATUS.OFFLINE]: { label: 'Offline', tone: 'faint', dot: 'bg-faint' },
};

export const SESSION_STATUS_LABEL = {
  [SESSION_STATUS.ACTIVE]: 'Active',
  [SESSION_STATUS.OVERTIME]: 'Overtime',
  [SESSION_STATUS.COMPLETED]: 'Completed',
  [SESSION_STATUS.FORCE_ENDED]: 'Ended by admin',
};

export const QUEUE_STATUS_LABEL = {
  [QUEUE_STATUS.WAITING]: 'Waiting',
  [QUEUE_STATUS.NOTIFIED]: "It's your turn",
  [QUEUE_STATUS.CLAIMED]: 'Claimed',
  [QUEUE_STATUS.FULFILLED]: 'Fulfilled',
  [QUEUE_STATUS.SKIPPED]: 'Skipped',
  [QUEUE_STATUS.CANCELLED]: 'Cancelled',
};

export const RIDE_STATUS_META = {
  [RIDE_STATUS.OPEN]: { label: 'Open', tone: 'success' },
  [RIDE_STATUS.FULL]: { label: 'Full', tone: 'warning' },
  [RIDE_STATUS.IN_PROGRESS]: { label: 'In progress', tone: 'info' },
  [RIDE_STATUS.COMPLETED]: { label: 'Completed', tone: 'faint' },
  [RIDE_STATUS.CANCELLED]: { label: 'Cancelled', tone: 'danger' },
};

export const BOOKING_STATUS_LABEL = {
  [BOOKING_STATUS.REQUESTED]: 'Requested',
  [BOOKING_STATUS.CONFIRMED]: 'Confirmed',
  [BOOKING_STATUS.DECLINED]: 'Declined',
  [BOOKING_STATUS.CANCELLED]: 'Cancelled',
  [BOOKING_STATUS.COMPLETED]: 'Completed',
};

export const DIRECTION_LABEL = {
  [CARPOOL_DIRECTION.TO_SITE]: 'To work',
  [CARPOOL_DIRECTION.FROM_SITE]: 'From work',
};

/** Notification type → lucide icon name + tone (consumed by the NotificationItem). */
export const NOTIFICATION_META = {
  [NOTIFICATION_TYPES.QUEUE_TURN]: { icon: 'BellRing', tone: 'brand' },
  [NOTIFICATION_TYPES.QUEUE_SKIPPED]: { icon: 'SkipForward', tone: 'warning' },
  [NOTIFICATION_TYPES.SESSION_OVERTIME]: { icon: 'Clock', tone: 'warning' },
  [NOTIFICATION_TYPES.SESSION_ENDING]: { icon: 'Clock', tone: 'info' },
  [NOTIFICATION_TYPES.NUDGE]: { icon: 'Hand', tone: 'info' },
  [NOTIFICATION_TYPES.NUDGE_REACTION]: { icon: 'ThumbsUp', tone: 'info' },
  [NOTIFICATION_TYPES.EMERGENCY]: { icon: 'Siren', tone: 'danger' },
  [NOTIFICATION_TYPES.ANNOUNCEMENT]: { icon: 'Megaphone', tone: 'brand' },
  [NOTIFICATION_TYPES.ADMIN_ALERT]: { icon: 'ShieldAlert', tone: 'danger' },
  [NOTIFICATION_TYPES.CARPOOL_BOOKING]: { icon: 'Car', tone: 'brand' },
  [NOTIFICATION_TYPES.CARPOOL_MATCH]: { icon: 'Search', tone: 'info' },
  [NOTIFICATION_TYPES.CARPOOL_REMINDER]: { icon: 'AlarmClock', tone: 'warning' },
  [NOTIFICATION_TYPES.CARPOOL_CREDITS]: { icon: 'Sprout', tone: 'success' },
  [NOTIFICATION_TYPES.SYSTEM]: { icon: 'Info', tone: 'muted' },
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
