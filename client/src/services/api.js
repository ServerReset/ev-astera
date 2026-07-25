/**
 * Axios API client.
 * - Base URL from env (dev proxy → /api).
 * - Access token held in memory (never localStorage) and attached as Bearer.
 * - `withCredentials` so the httpOnly refresh cookie rides along.
 * - A 401 triggers a single refresh attempt; concurrent 401s share one refresh promise
 *   and are replayed once it resolves. A failed refresh clears auth and rejects.
 * The response envelope from the server is `{ data, meta? }`; interceptors unwrap `.data`
 * so callers receive the payload directly (with `_meta` attached when present).
 */
import axios from 'axios';
import { ENV } from '@/utils/constants.js';

let accessToken = null;
let onAuthCleared = null;

/** Set/clear the in-memory access token (called by the auth store). */
export function setAccessToken(token) {
  accessToken = token || null;
}
export function getAccessToken() {
  return accessToken;
}
/** Register a callback invoked when refresh fails and the session must end. */
export function setAuthClearedHandler(fn) {
  onAuthCleared = fn;
}

export const api = axios.create({
  baseURL: ENV.apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ── Refresh coordination ─────────────────────────────────────────────────────
let refreshPromise = null;

/** Ask the server for a fresh access token using the refresh cookie. */
async function doRefresh() {
  const res = await axios.post(
    `${ENV.apiBaseUrl}/auth/refresh`,
    {},
    { withCredentials: true }
  );
  const token = res.data?.data?.accessToken;
  if (!token) throw new Error('No token from refresh');
  setAccessToken(token);
  return token;
}

api.interceptors.response.use(
  (response) => {
    // Unwrap the envelope: return payload, attach meta if present.
    const body = response.data;
    if (body && typeof body === 'object' && 'data' in body) {
      const payload = body.data;
      if (body.meta && payload && typeof payload === 'object') {
        try {
          Object.defineProperty(payload, '_meta', { value: body.meta, enumerable: false });
        } catch {
          /* frozen payloads: ignore */
        }
      }
      return payload;
    }
    return body;
  },
  async (error) => {
    const { response, config } = error;
    if (!response) return Promise.reject(normalizeError(error));

    // Attempt one transparent refresh on 401 (except for the auth endpoints themselves).
    const isAuthCall = config?.url?.includes('/auth/');
    if (response.status === 401 && !config?._retried && !isAuthCall) {
      config._retried = true;
      try {
        refreshPromise = refreshPromise || doRefresh();
        const token = await refreshPromise;
        refreshPromise = null;
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      } catch (refreshErr) {
        refreshPromise = null;
        setAccessToken(null);
        if (onAuthCleared) onAuthCleared();
        return Promise.reject(normalizeError(refreshErr));
      }
    }
    return Promise.reject(normalizeError(error));
  }
);

const HTTP_FALLBACK_MESSAGES = {
  400: 'That request was not valid. Please check what you entered and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: "That couldn't be found — it may have been removed.",
  409: 'That conflicts with something that already happened — refresh and try again.',
  422: "That couldn't be completed — please review and try again.",
  429: 'Too many requests. Please slow down and try again shortly.',
};

const NORMALIZED = Symbol('normalized');

/**
 * Shape server/network errors into a consistent object: { code, message, details, status }.
 * Idempotent: the response interceptor above already normalizes every rejection before it
 * reaches a caller, but nearly every call site also does `catch (err) { normalizeError(err) }`
 * defensively — re-running the raw-axios-error logic on an already-normalized object has no
 * `.response` to find, so it used to fall through to the generic NETWORK_ERROR message and
 * silently swallow the real one. Marked with a symbol (not just "has code+message", which a
 * legitimate raw error could coincidentally also have) so a second call is a true no-op.
 */
export function normalizeError(error) {
  if (error?.[NORMALIZED]) return error;

  const resp = error?.response;
  let result;
  if (resp?.data?.error) {
    const e = resp.data.error;
    result = { code: e.code, message: e.message, details: e.details || null, status: resp.status };
  } else if (resp) {
    const fallback =
      HTTP_FALLBACK_MESSAGES[resp.status] ||
      (resp.status >= 500
        ? 'The server ran into a problem on its end. Please try again in a moment.'
        : `Request failed (${resp.status}).`);
    result = { code: 'HTTP_ERROR', message: fallback, status: resp.status };
  } else if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
    result = {
      code: 'TIMEOUT',
      message: 'The server took too long to respond. Check your connection and try again.',
      status: 0,
      details: { debug: error?.code || error?.message },
    };
  } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    result = { code: 'OFFLINE', message: "You're offline — reconnect and try again.", status: 0 };
  } else {
    result = {
      code: 'NETWORK_ERROR',
      message: "Couldn't reach the server. Check your connection and try again.",
      status: 0,
      // No `response` reached the client at all — genuine network/CORS/DNS failure, not a
      // server-authored error. Keep the raw axios code/message here so a CORS rejection or
      // DNS failure is distinguishable from "request never sent" in dev tools.
      details: { debug: error?.code || error?.message },
    };
  }
  Object.defineProperty(result, NORMALIZED, { value: true, enumerable: false });
  return result;
}
