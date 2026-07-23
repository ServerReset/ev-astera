import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ErrorBoundary } from '@/components/common/ErrorBoundary.jsx';
import { registerServiceWorker } from './registerSW.js';
import '@/stores/themeStore.js'; // side effect: applies + live-follows the theme preference
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);

// Register the PWA service worker (push + offline shell). Non-blocking.
registerServiceWorker();
