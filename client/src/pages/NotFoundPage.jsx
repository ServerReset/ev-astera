import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-6 text-center">
      <div className="max-w-sm">
        <Compass className="mx-auto h-12 w-12 text-brand-strong" />
        <h1 className="mt-4 text-2xl font-bold text-content">Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page you're looking for doesn't exist or has moved.</p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
