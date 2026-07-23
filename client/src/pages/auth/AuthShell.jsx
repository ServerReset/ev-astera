import { Zap, Car, Leaf } from 'lucide-react';
import { AsteraMark } from '@/components/common/AsteraMark.jsx';

// The three real product pillars — used as the hero's content so the marketing panel is
// grounded in what the app actually does, not filler. lucide-react stays the single icon source.
const PILLARS = [
  { icon: Zap, title: 'Fair charging queue', body: 'Claim your turn and get pinged the moment a charger frees up.' },
  { icon: Car, title: 'Carpool matching', body: 'Share the commute — match with drivers and riders heading your way.' },
  { icon: Leaf, title: 'Track your impact', body: 'See the CO₂ you save every time you charge smart or ride together.' },
];

/**
 * Adaptive layout shared by all auth screens. Below lg it's a single centered column (the form,
 * with the brand mark above it). At lg+ it becomes a two-pane split: a branded hero panel that
 * states what the app does, beside the form pane. Auth routes render outside AppLayout, so the
 * full window width is ours to use.
 *
 * Liquid glass is deliberately NOT applied to the form card: refraction belongs at a surface's
 * rim and would smear input text, and the skill scopes glass to floating app chrome, not content
 * forms. The hero's ambient brand wash is plain gradients/tokens — no backdrop-filter cost.
 */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-2">
      {/* Hero pane — lg+ only. Ambient brand aurora + the product pillars. */}
      <aside className="relative hidden overflow-hidden bg-bg-elevated lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Ambient brand wash: two soft radial glows, tokenized so it adapts light/dark. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60rem 40rem at 15% 10%, rgb(var(--c-brand) / 0.22), transparent 60%),' +
              'radial-gradient(50rem 40rem at 90% 90%, rgb(var(--c-brand-strong) / 0.16), transparent 55%)',
          }}
        />
        {/* Restrained "charge bars" motif — a column of animated brand ticks, decorative only. */}
        <div aria-hidden="true" className="pointer-events-none absolute right-10 top-1/2 hidden -translate-y-1/2 flex-col gap-2 xl:flex">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="block h-1.5 rounded-full bg-brand/40 animate-slide-up [animation-fill-mode:backwards]"
              style={{ width: `${2 + i * 1.4}rem`, animationDelay: `${i * 70}ms` }}
            />
          ))}
        </div>

        <div className="relative flex items-center gap-3">
          <div className="rounded-2xl bg-surface p-2.5 shadow-elevation-1">
            <AsteraMark size={32} />
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-content">EV Hub</p>
            <p className="text-label-sm text-faint">Astera Labs</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-headline-md font-bold text-content">
            Workplace charging & carpool, sorted.
          </h2>
          <ul className="mt-8 space-y-6">
            {PILLARS.map(({ icon: Icon, title: t, body }, i) => (
              <li
                key={t}
                className="flex items-start gap-4 animate-slide-up [animation-fill-mode:backwards]"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand-strong">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-content">{t}</p>
                  <p className="mt-0.5 text-sm text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-label-sm text-faint">Charging guidelines by Taylor Frostholm.</p>
      </aside>

      {/* Form pane — full width below lg, right half at lg+. */}
      <div className="grid min-h-screen place-items-center px-4 py-8 lg:min-h-0">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-6 flex flex-col items-center text-center">
            {/* Brand mark shows above the form on compact; the hero carries it at lg+. */}
            <div className="rounded-2xl bg-surface-2 p-3 shadow-glow lg:hidden">
              <AsteraMark size={40} />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-content lg:mt-0">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <div className="card p-6">{children}</div>
          {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
