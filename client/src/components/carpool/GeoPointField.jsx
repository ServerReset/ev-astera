import { useState } from 'react';
import { MapPin, LocateFixed } from 'lucide-react';
import { Input } from '@/components/common/Input.jsx';
import { toast } from '@/stores/toastStore.js';
import { cn } from '@/utils/cn.js';

/**
 * A location picker for carpool origins/pickups. We don't ship a maps SDK; instead the user
 * names the place and we capture coordinates via the browser Geolocation API (or manual
 * lat/lng entry). Produces a value matching geoPointSchema: { label, lat, lng }.
 *
 * `value` = { label, lat, lng } | null. `onChange(next)` receives the merged object.
 */
export function GeoPointField({ label = 'Location', value, onChange, error }) {
  const v = value || { label: '', lat: null, lng: null };
  const [locating, setLocating] = useState(false);

  const patch = (p) => onChange?.({ ...v, ...p });

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.warning('Geolocation is not available on this device.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        patch({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
        setLocating(false);
        toast.success('Location captured.');
      },
      () => {
        setLocating(false);
        toast.error('Could not get your location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const hasCoords = v.lat != null && v.lng != null;

  return (
    <div>
      <span className="label">{label}</span>
      <Input
        placeholder="Name this place (e.g. Home, Downtown transit)"
        value={v.label}
        onChange={(e) => patch({ label: e.target.value })}
        error={error}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors',
            hasCoords ? 'text-success' : 'text-muted hover:text-content'
          )}
        >
          {locating ? <LocateFixed className="h-3.5 w-3.5 animate-pulse" /> : <MapPin className="h-3.5 w-3.5" />}
          {hasCoords ? 'Location set' : 'Use my location'}
        </button>
        <div className="flex flex-1 gap-2">
          <Input
            type="number"
            step="0.000001"
            placeholder="Lat"
            value={v.lat ?? ''}
            onChange={(e) => patch({ lat: e.target.value === '' ? null : Number(e.target.value) })}
            className="flex-1"
          />
          <Input
            type="number"
            step="0.000001"
            placeholder="Lng"
            value={v.lng ?? ''}
            onChange={(e) => patch({ lng: e.target.value === '' ? null : Number(e.target.value) })}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
