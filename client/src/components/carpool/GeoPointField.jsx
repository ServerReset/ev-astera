import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/common/Input.jsx';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';

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
  // Set when we programmatically fill the field from a picked suggestion, so the debounce effect
  // (keyed on v.label) skips the one search cycle that selection would otherwise trigger — which
  // used to re-fetch and re-open the dropdown the user just dismissed.
  const skipNextSearchRef = useRef(false);
  // Drive the glass hook off the SAME condition that mounts the <ul> below (not just `open`
  // alone) — the debounce effect can clear suggestions/loading without touching `open` (e.g.
  // backspacing below MIN_QUERY_LENGTH), which used to desync the two: the <ul> would unmount
  // while `open` stayed true, so the hook's effect (deps=[active]) never re-ran to tear down
  // the old glass instance, and never reinitialized it on the next reopen either.
  const dropdownVisible = open && (loading || suggestions.length > 0);
  const glassRef = useLiquidGlass(dropdownVisible, { scale: -35, chroma: 2, blur: 8, border: 0.1 });

  useEffect(() => {
    const query = v.label.trim();
    clearTimeout(debounceRef.current);

    // A selection just filled the field — consume the flag and don't search/reopen for it.
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      setSuggestions([]);
      setLoading(false);
      return;
    }

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
    skipNextSearchRef.current = true; // suppress the search the label change would otherwise fire
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
      {dropdownVisible && (
        <ul ref={glassRef} className="lg-panel absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-border shadow-elevation-3 animate-scale-in [animation-fill-mode:backwards]">
          {loading && suggestions.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-faint">
              <MapPin className="h-3.5 w-3.5 animate-pulse" />
              Searching…
            </li>
          )}
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-content transition-colors hover:bg-surface-2"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-faint" />
                <span className="truncate">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
