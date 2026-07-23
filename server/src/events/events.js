/** The complete event vocabulary. Frozen so typos become runtime errors, not silent no-ops. */
export const EVENTS = Object.freeze({
  // Users
  USER_REGISTERED: 'user.registered',
  USER_UPDATED: 'user.updated',

  // Sessions
  SESSION_STARTED: 'session.started',
  SESSION_UPDATED: 'session.updated',
  SESSION_ENDED: 'session.ended',
  SESSION_FORCE_ENDED: 'session.force_ended',
  SESSION_OVERTIME: 'session.overtime',
  SESSION_OVERTIME_ESCALATED: 'session.overtime.escalated',
  SESSION_ENDING_SOON: 'session.ending_soon',

  // Queue
  QUEUE_JOINED: 'queue.joined',
  QUEUE_LEFT: 'queue.left',
  QUEUE_ADVANCED: 'queue.advanced',
  QUEUE_CLAIMED: 'queue.claimed',
  QUEUE_SKIPPED: 'queue.skipped',

  // Reservations
  RESERVATION_CREATED: 'reservation.created',
  RESERVATION_CANCELLED: 'reservation.cancelled',
  RESERVATION_STARTING: 'reservation.starting',
  RESERVATION_WARN_WALKUP: 'reservation.warn_walkup',

  // Chargers
  CHARGER_ONLINE: 'charger.online',
  CHARGER_OFFLINE: 'charger.offline',

  // Messaging
  NUDGE_SENT: 'message.nudge_sent',
  EMERGENCY_REQUESTED: 'message.emergency_requested',
  EMERGENCY_RESPONDED: 'message.emergency_responded',

  // Announcements
  ANNOUNCEMENT_CREATED: 'announcement.created',

  // Carpool
  CARPOOL_RIDE_POSTED: 'carpool.ride_posted',
  CARPOOL_RIDE_UPDATED: 'carpool.ride_updated',
  CARPOOL_RIDE_CANCELLED: 'carpool.ride_cancelled',
  CARPOOL_BOOKING_REQUESTED: 'carpool.booking_requested',
  CARPOOL_BOOKING_CONFIRMED: 'carpool.booking_confirmed',
  CARPOOL_BOOKING_DECLINED: 'carpool.booking_declined',
  CARPOOL_BOOKING_CANCELLED: 'carpool.booking_cancelled',
  CARPOOL_TRIP_COMPLETED: 'carpool.trip_completed',
  CARPOOL_MATCH_FOUND: 'carpool.match_found',
  CARPOOL_SCHEDULE_CREATED: 'carpool.schedule_created',
  CARPOOL_SCHEDULE_CANCELLED: 'carpool.schedule_cancelled',
  CARPOOL_CREDITS_AWARDED: 'carpool.credits_awarded',
  CARPOOL_PRIORITY_GRANTED: 'carpool.priority_granted',
});
