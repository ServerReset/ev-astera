/*
 * Service worker (injectManifest strategy).
 *  - Workbox precaches the built app shell via self.__WB_MANIFEST.
 *  - `push` shows notifications delivered by the server's Web Push (VAPID) payloads.
 *  - `notificationclick` focuses an existing client or opens the actionUrl.
 * The payload shape matches what providers/notifications/push.channel.js sends:
 *   { title, body, icon, badge, tag, data: { url, ...metadata } }
 * i.e. the deep-link and any extra metadata are nested under `data`, not top-level.
 */
import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'EV Hub', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'EV Hub';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.svg',
    badge: '/icons/badge-72.svg',
    tag: data.tag || data.type || 'ev-hub',
    // Server nests the deep-link + metadata under `data` (push.channel.js: `data: { url, ...metadata }`).
    // Read `data.data.url` for the target; keep top-level `actionUrl` as a fallback for any
    // legacy/hand-crafted payload. notificationclick reads back `event.notification.data.actionUrl`.
    data: { actionUrl: data.data?.url || data.actionUrl || '/', ...(data.data || data.metadata || {}) },
    vibrate: data.priority === 'urgent' ? [200, 100, 200] : undefined,
    requireInteraction: data.priority === 'urgent',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.actionUrl || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return undefined;
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
