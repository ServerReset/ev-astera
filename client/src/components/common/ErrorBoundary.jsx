import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Top-level error boundary — the only class component in the app (per contract). */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In production this is where a logging service hook would go.
    // eslint-disable-next-line no-console
    console.error('UI crash:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-bg px-6 text-center">
          <div className="max-w-md">
            <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
            <h1 className="mt-4 text-lg font-semibold text-content">This page hit a snag</h1>
            <p className="mt-2 text-sm text-muted">
              An unexpected error occurred. Reloading usually fixes it.
            </p>
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
