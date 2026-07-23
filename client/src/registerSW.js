/**
 * Service worker registration. vite-plugin-pwa (injectManifest) compiles src/sw.js to the
 * built `sw.js`; in dev it's served from /dev-sw.js. We register manually (injectRegister:
 * null) so registration failures never block the app.
 */
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const swUrl = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js';
    const type = import.meta.env.DEV ? 'module' : 'classic';
    navigator.serviceWorker.register(swUrl, { type, scope: '/' }).catch(() => {
      /* SW registration is best-effort; the app works without it. */
    });
  });
}
