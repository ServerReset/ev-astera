import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/common/Input.jsx';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 350;

/**
 * A location field for carpool origins/pickups. The user names the place or types an
 * address; Nominatim (OpenStreetMap's free geocoder) suggests matches as they type.
 * Produces a value matching geoPointSchema: { label }. No coordinates are captured.
 *
 * `value` = { label } | null. `onChange(next)` receives the merged object.
 */
export function GeoPointField({ label = 'Location', value, onChange, error }) {
  const v = value || { label: '' };
  const patch = (p) => onChange?.({ ...v, ...p });

  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const query = v.label.trim();
    clearTimeout(debounceRef.current);

    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        if (requestId !== requestIdRef.current) return; // stale response, ignore
        setSuggestions(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        if (requestId === requestIdRef.current) setSuggestions([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.label]);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const pick = (s) => {
    patch({ label: s.display_name });
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <span className="label">{label}</span>
      <Input
        placeholder="Street address or place name (e.g. Home, Downtown transit)"
        value={v.label}
        onChange={(e) => patch({ label: e.target.value })}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        error={error}
        autoComplete="off"
      />
      {open && (loading || suggestions.length > 0) && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-elevation-3">
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-faint">Searching…</li>
          )}
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="block w-full truncate px-3 py-2 text-left text-sm text-content hover:bg-surface-2"
              >
                {s.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
