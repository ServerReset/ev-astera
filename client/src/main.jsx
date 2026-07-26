import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ErrorBoundary } from '@/components/common/ErrorBoundary.jsx';
import { registerServiceWorker } from './registerSW.js';
import '@/stores/themeStore.js'; // side effect: applies + live-follows the theme preference
import './index.css';

// Reuse a single React root across HMR. Vite re-executes this entry module on hot updates; calling
// createRoot() again on the same #root node throws the dev-only "createRoot() on a container that
// has already been passed to createRoot()" warning. Caching the root on the container makes repeat
// executions call root.render() instead. (In production there is no HMR, so this just runs once.)
const container = document.getElementById('root');
const root = container._reactRoot ?? (container._reactRoot = createRoot(container));

root.render(
  <StrictMode>
    <ErrorBoundary>
      {/* Opt into React Router v7 behavior now — silences the two v7 future-flag console warnings
          (startTransition state updates + relative splat-route resolution) and eases the eventual
          upgrade. Behavior-compatible with how the app already routes. */}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);

// Register the PWA service worker (push + offline shell). Non-blocking.
registerServiceWorker();
