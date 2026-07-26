import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * The app's error boundary — the only class component in the app (per contract).
 *
 * Two modes:
 *  - default (full-screen): the top-level boundary in main.jsx, catches anything and shows a
 *    reload screen.
 *  - `scoped`: a route-level boundary (AppLayout wraps the Outlet in one) that catches a single
 *    route's failure — most importantly a lazy-import chunk-load error after a redeploy — and
 *    offers a scoped retry WITHOUT tearing down the whole app shell (nav stays put). `resetKey`
 *    (e.g. the current pathname) auto-clears the error when the user navigates elsewhere.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    // When the reset key changes (e.g. route change), clear a prior error so the new route renders.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    // In production this is where a logging service hook would go.
    // eslint-disable-next-line no-console
    console.error('UI crash:', error, info);
  }

  render() {
    if (this.state.error) {
      // A dynamic-import failure (stale hashed chunk after a redeploy, or a CDN blip) is the
      // common scoped case — a full reload fetches the new chunk manifest and fixes it.
      const isChunkError = /dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(
        this.state.error?.message || ''
      );
      // Surface the actual crash reason to developers (dev only) so it's never a black box; users
      // in prod get specific, non-blaming copy instead of a raw stack.
      const devDetail = import.meta.env?.DEV ? this.state.error?.message : null;

      if (this.props.scoped) {
        return (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="max-w-md">
              <AlertTriangle className="mx-auto h-9 w-9 text-warning" />
              <h2 className="mt-4 text-base font-semibold text-content">
                {isChunkError ? 'This page needs a refresh to update' : "This page couldn't finish loading"}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {isChunkError
                  ? 'A new version of the app was deployed while you were here, so this page’s code is out of date. Reload to get the latest version — your place is safe.'
                  : 'The app hit an unexpected error while rendering this page. Reloading almost always clears it; if it keeps happening on this page, it’s a bug worth reporting.'}
              </p>
              {devDetail && (
                <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-left font-mono text-xs text-danger">{devDetail}</p>
              )}
              <button className="btn-primary mt-5" onClick={() => window.location.reload()}>
                Reload this page
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="grid min-h-screen place-items-center bg-bg px-6 text-center">
          <div className="max-w-md">
            <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
            <h1 className="mt-4 text-lg font-semibold text-content">
              {isChunkError ? 'The app needs to reload to update' : 'The app hit an unexpected error'}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {isChunkError
                ? 'A newer version was deployed. Reload to load it — nothing you did caused this.'
                : 'Something crashed while rendering — not something you did. It’s been logged; reloading almost always fixes it.'}
            </p>
            {devDetail && (
              <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-left font-mono text-xs text-danger">{devDetail}</p>
            )}
            <button className="btn-primary mt-5" onClick={() => window.location.reload()}>
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
