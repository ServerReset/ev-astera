/**
 * All API calls, grouped by domain. Every function returns the unwrapped payload
 * (the interceptor already stripped the `{ data }` envelope). Location-scoped paths use
 * the single configured location id; if the app ever goes multi-site, swap `loc()`.
 */
import { api } from './api.js';
import { ENV } from '@/utils/constants.js';

const loc = () => ENV.locationId;
const L = (path) => `/locations/${loc()}${path}`;

// ── Auth (root-scoped) ─────────────────────────────────────────────────────────
export const authApi = {
  signupStatus: () => api.get('/auth/signup-status'),
  register: (body) => api.post('/auth/register', body),
  login: (body) => api.post('/auth/login', body),
  refresh: () => api.post('/auth/refresh', {}),
  logout: () => api.post('/auth/logout', {}),
};

// ── Users (root-scoped) ─────────────────────────────────────────────────────────
export const userApi = {
  me: () => api.get('/users/me'),
  updateMe: (patch) => api.patch('/users/me', patch),
  changePassword: (body) => api.patch('/users/me/password', body),
  stats: () => api.get('/users/me/stats'),
  history: (page = 1) => api.get('/users/me/history', { params: { page } }),
  completeOnboarding: () => api.post('/users/me/onboarding/complete'),
  resetOnboarding: () => api.post('/users/me/onboarding/reset'),
};

// ── Chargers ─────────────────────────────────────────────────────────────────
export const chargerApi = {
  list: () => api.get(L('/chargers')),
  get: (chargerId) => api.get(L(`/chargers/${chargerId}`)),
};

// ── Sessions ─────────────────────────────────────────────────────────────────
export const sessionApi = {
  active: () => api.get(L('/sessions/active')),
  start: (body) => api.post(L('/sessions'), body),
  updateEta: (sessionId, durationMinutes) => api.patch(L(`/sessions/${sessionId}/eta`), { durationMinutes }),
  end: (sessionId, checklist) => api.post(L(`/sessions/${sessionId}/end`), checklist),
};

// ── Queue ──────────────────────────────────────────────────────────────────────
export const queueApi = {
  list: () => api.get(L('/queue')),
  mine: () => api.get(L('/queue/me')),
  join: (chargerId = null) => api.post(L('/queue'), { chargerId }),
  claim: (queueEntryId) => api.post(L('/queue/claim'), { queueEntryId }),
  leave: (queueEntryId) => api.post(L('/queue/leave'), { queueEntryId }),
};

// ── Messages (nudge / emergency) ────────────────────────────────────────────────
export const messageApi = {
  nudge: (body) => api.post(L('/messages/nudge'), body),
  reactToNudge: (body) => api.post(L('/messages/nudge/react'), body),
  emergencies: () => api.get(L('/messages/emergencies')),
  requestEmergency: (body) => api.post(L('/messages/emergency'), body),
  respondEmergency: (body) => api.post(L('/messages/emergency/respond'), body),
};

// ── Notifications (root-scoped) ────────────────────────────────────────────────
export const notificationApi = {
  list: (page = 1) => api.get('/notifications', { params: { page } }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.post(`/notifications/${id}/read`, {}),
  markAllRead: () => api.post('/notifications/read-all', {}),
  subscribePush: (subscription) => api.post('/notifications/push/subscribe', subscription),
  unsubscribePush: (endpoint) => api.post('/notifications/push/unsubscribe', { endpoint }),
};

// ── Carpool ──────────────────────────────────────────────────────────────────
export const carpoolApi = {
  getConfig: () => api.get(L('/carpool/config')),
  listRides: (params) => api.get(L('/carpool/rides'), { params }),
  myRides: () => api.get(L('/carpool/rides/mine')),
  getRide: (rideId) => api.get(L(`/carpool/rides/${rideId}`)),
  postRide: (body) => api.post(L('/carpool/rides'), body),
  updateRide: (rideId, patch) => api.patch(L(`/carpool/rides/${rideId}`), patch),
  cancelRide: (rideId) => api.delete(L(`/carpool/rides/${rideId}`)),
  bookRide: (rideId, body) => api.post(L(`/carpool/rides/${rideId}/book`), body),
  completeRide: (rideId, body) => api.post(L(`/carpool/rides/${rideId}/complete`), body || {}),

  confirmBooking: (bookingId) => api.post(L(`/carpool/bookings/${bookingId}/confirm`), {}),
  declineBooking: (bookingId) => api.post(L(`/carpool/bookings/${bookingId}/decline`), {}),
  cancelBooking: (bookingId) => api.post(L(`/carpool/bookings/${bookingId}/cancel`), {}),

  listRequests: () => api.get(L('/carpool/requests')),
  postRequest: (body) => api.post(L('/carpool/requests'), body),
  cancelRequest: (requestId) => api.delete(L(`/carpool/requests/${requestId}`)),

  listSchedules: () => api.get(L('/carpool/schedules')),
  createSchedule: (body) => api.post(L('/carpool/schedules'), body),
  updateSchedule: (scheduleId, patch) => api.patch(L(`/carpool/schedules/${scheduleId}`), patch),
  deleteSchedule: (scheduleId) => api.delete(L(`/carpool/schedules/${scheduleId}`)),

  listGroups: () => api.get(L('/carpool/groups')),
  createGroup: (body) => api.post(L('/carpool/groups'), body),
  joinGroup: (groupId) => api.post(L(`/carpool/groups/${groupId}/join`), {}),
  leaveGroup: (groupId) => api.post(L(`/carpool/groups/${groupId}/leave`), {}),

  matches: () => api.get(L('/carpool/matches')),
  leaderboard: (params) => api.get(L('/carpool/leaderboard'), { params }),
  leaderboardTotals: (params) => api.get(L('/carpool/leaderboard/totals'), { params }),
  myImpact: () => api.get(L('/carpool/impact/me')),
};

// ── Reliability ──────────────────────────────────────────────────────────────────
export const reliabilityApi = {
  me: () => api.get(L('/reliability/me')),
  leaderboard: (limit) => api.get(L('/reliability/leaderboard'), { params: { limit } }),
};

// ── Admin (location-scoped, admin-gated) ────────────────────────────────────────
export const adminApi = {
  overview: () => api.get(L('/admin/overview')),
  createCharger: (body) => api.post(L('/admin/chargers'), body),
  deleteCharger: (chargerId) => api.delete(L(`/admin/chargers/${chargerId}`)),
  setChargerOffline: (chargerId, reason) => api.post(L(`/admin/chargers/${chargerId}/offline`), { reason }),
  setChargerOnline: (chargerId) => api.post(L(`/admin/chargers/${chargerId}/online`), {}),
  renameCharger: (chargerId, name) => api.patch(L(`/admin/chargers/${chargerId}`), { name }),
  forceEndSession: (sessionId) => api.post(L(`/admin/sessions/${sessionId}/force-end`), {}),
  getSettings: () => api.get(L('/admin/settings')),
  updateSettings: (patch) => api.patch(L('/admin/settings'), patch),
  listAnnouncements: () => api.get(L('/admin/announcements')),
  createAnnouncement: (body) => api.post(L('/admin/announcements'), body),
  deleteAnnouncement: (id) => api.delete(L(`/admin/announcements/${id}`)),
  listUsers: (page = 1, search = '') => api.get(L('/admin/users'), { params: { page, search } }),
  updateUser: (userId, patch) => api.patch(L(`/admin/users/${userId}`), patch),
  createUser: (body) => api.post(L('/admin/users'), body),
  resetUserPassword: (userId) => api.post(L(`/admin/users/${userId}/reset-password`), {}),
  audit: (page = 1) => api.get(L('/admin/audit'), { params: { page } }),
  listCarpoolRides: () => api.get(L('/admin/carpool/rides')),
  cancelCarpoolRide: (rideId) => api.delete(L(`/admin/carpool/rides/${rideId}`)),
  listCarpoolRequests: () => api.get(L('/admin/carpool/requests')),
  cancelCarpoolRequest: (requestId) => api.delete(L(`/admin/carpool/requests/${requestId}`)),
  listCarpoolSchedules: () => api.get(L('/admin/carpool/schedules')),
  deleteCarpoolSchedule: (scheduleId) => api.delete(L(`/admin/carpool/schedules/${scheduleId}`)),
  listCarpoolGroups: () => api.get(L('/admin/carpool/groups')),
  deleteCarpoolGroup: (groupId) => api.delete(L(`/admin/carpool/groups/${groupId}`)),
};
