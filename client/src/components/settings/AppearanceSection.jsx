import { Monitor, Sun, Moon, Check } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { useThemeStore } from '@/stores/themeStore.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { cn } from '@/utils/cn.js';

/**
 * The swatch previews below DEPICT specific fixed themes (light / dark), so per the module brief
 * they intentionally use fixed hex — they are illustrations of a palette, not themed chrome.
 */
const LIGHT = { bg: '#f6f7f9', surface: '#ffffff', bar: '#e6e8ec', brand: '#3c79bc', text: '#1b1d21' };
const DARK = { bg: '#0e1013', surface: '#1a1d22', bar: '#2a2e35', brand: '#5b9bd8', text: '#e8eaed' };

const OPTIONS = [
  { key: 'device', label: 'System', icon: Monitor, desc: 'Match your OS' },
  { key: 'light', label: 'Light', icon: Sun, desc: 'Always light' },
  { key: 'dark', label: 'Dark', icon: Moon, desc: 'Always dark' },
];

/** A tiny fake "app window" rendered in the given fixed palette. */
function Preview({ palette, split }) {
  if (split) {
    return (
      <div className="relative flex h-16 overflow-hidden rounded-xl ring-1 ring-black/10">
        <div className="w-1/2"><MiniWindow palette={LIGHT} /></div>
        <div className="w-1/2"><MiniWindow palette={DARK} /></div>
      </div>
    );
  }
  return (
    <div className="h-16 overflow-hidden rounded-xl ring-1 ring-black/10">
      <MiniWindow palette={palette} />
    </div>
  );
}

function MiniWindow({ palette }) {
  return (
    <div className="flex h-full flex-col gap-1 p-2" style={{ background: palette.bg }}>
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full" style={{ background: palette.brand }} />
        <span className="h-1.5 w-8 rounded-full" style={{ background: palette.bar }} />
      </div>
      <div className="flex-1 rounded-md p-1.5" style={{ background: palette.surface }}>
        <span className="block h-1.5 w-3/4 rounded-full" style={{ background: palette.text, opacity: 0.85 }} />
        <span className="mt-1 block h-1.5 w-1/2 rounded-full" style={{ background: palette.bar }} />
      </div>
    </div>
  );
}

export function AppearanceSection() {
  const pref = useThemeStore((s) => s.pref);
  const setPref = useThemeStore((s) => s.setPref);
  const ripple = useRipple();

  return (
    <Card>
      <CardHeader title="Theme" subtitle="Pick how the app looks, or follow your device." icon={Sun} />
      <div role="radiogroup" aria-label="Theme" className="stagger grid gap-3 sm:grid-cols-3">
        {OPTIONS.map(({ key, label, icon: Icon, desc }) => {
          const active = pref === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPref(key)}
              onPointerDown={ripple}
              className={cn(
                'card-solid press ripple relative flex flex-col gap-2.5 rounded-2xl border p-3 text-left transition-all duration-medium ease-emphasized',
                active
                  ? 'border-brand ring-2 ring-brand/40 shadow-elevation-2'
                  : 'border-border hover:border-brand/40 hover:shadow-elevation-1'
              )}
            >
              <Preview palette={key === 'dark' ? DARK : LIGHT} split={key === 'device'} />
              <div className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-muted" />
                <span className="font-medium text-content">{label}</span>
                {active && (
                  <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-brand text-white animate-pop-in">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <span className="text-xs text-muted">{desc}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
