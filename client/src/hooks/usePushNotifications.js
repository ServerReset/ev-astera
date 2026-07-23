/**
 * usePushNotifications — manages the Web Push subscription lifecycle:
 *   - reports current permission + subscription state
 *   - `enable()` requests permission, subscribes via the service worker's PushManager
 *     with the server VAPID public key, and registers the subscription with the API
 *   - `disable()` unsubscribes locally and tells the server to drop the endpoint
 * Degrades gracefully where Push isn't supported (e.g. iOS Safari not installed to home).
 */
import { useCallback, useEffect, useState } from 'react';
import { notificationApi } from '@/services/endpoints.js';
import { ENV } from '@/utils/constants.js';
import { toast } from '@/stores/toastStore.js';

const supported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
  }, []);

  const enable = useCallback(async () => {
    if (!supported) {
      toast.warning('Push notifications are not supported on this device.');
      return false;
    }
    if (!ENV.vapidPublicKey) {
      toast.error('Push is not configured (missing VAPID key).');
      return false;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        toast.warning('Notifications were not allowed.');
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(ENV.vapidPublicKey),
        });
      }
      const json = sub.toJSON();
      await notificationApi.subscribePush({ endpoint: json.endpoint, keys: json.keys });
      setSubscribed(true);
      toast.success('Push notifications enabled.');
      return true;
    } catch (err) {
      console.error('push enable failed', err);
      if (err?.name === 'AbortError') {
        toast.error(
          "Couldn't reach the push service — your network or browser may be blocking it. Try a different network, or check with IT if this is a work computer."
        );
      } else if (err?.name === 'NotAllowedError') {
        toast.error('Notifications are blocked for this site. Allow them in your browser settings and try again.');
      } else {
        toast.error(`Could not enable push notifications.${err?.message ? ` (${err.message})` : ''}`);
      }
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await notificationApi.unsubscribePush(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.info('Push notifications disabled.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { supported, permission, subscribed, busy, enable, disable };
}
