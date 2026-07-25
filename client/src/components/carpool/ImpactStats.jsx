import { Leaf, Car, Route, Coins, TreePine, Users } from 'lucide-react';
import { Card } from '@/components/common/Card.jsx';
import { useCountUp } from '@/hooks/useCountUp.js';
import { burstConfetti } from '@/utils/confetti.js';

// Eco-toned confetti for the hidden delight on the CO₂ hero.
const ECO_COLORS = ['#4fb477', '#7bd88f', '#a7e8bd', '#3c9d63', '#d6f5e0'];

/** A number that counts up from 0 on mount, with optional prefix/suffix (e.g. " kg"). */
function AnimatedNumber({ value, decimals = 0, suffix = '' }) {
  const n = useCountUp(value, { decimals });
  return (
    <span className="tabular-nums">
      {n.toLocaleString(undefined, { maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

// Stagger tiles in beneath the hero with the shared emphasized-decelerate entrance.
const stagger = (i) => ({ animationDelay: `${i * 60}ms` });

/** A single stat tile. `count` (+ optional decimals/suffix) animates the value on mount. */
function Stat({ icon: Icon, label, value, count, decimals = 0, suffix = '', sub, tone = 'brand', index = 0 }) {
  const toneClass = {
    brand: 'bg-brand/15 text-brand-strong',
    success: 'bg-success/15 text-success',
    info: 'bg-info/15 text-info',
    warning: 'bg-warning/15 text-warning',
  }[tone];
  return (
    <Card
      className="group flex items-center gap-3 animate-slide-up [animation-fill-mode:backwards] transition-all duration-medium ease-emphasized hover:-translate-y-0.5 hover:shadow-elevation-2"
      style={stagger(index)}
    >
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${toneClass} transition-transform duration-medium ease-spring group-hover:scale-110 group-hover:-rotate-6`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold text-content tabular-nums">
          {count != null ? <AnimatedNumber value={count} decimals={decimals} suffix={suffix} /> : value}
        </p>
        <p className="text-xs text-muted">{label}</p>
        {sub && <p className="text-xs text-faint">{sub}</p>}
      </div>
    </Card>
  );
}

/**
 * The viewer's carpool impact (Feature 4). `impact` is the payload from carpoolApi.myImpact:
 * { trips, asDriver, asRider, miles, co2Kg, credits, treesEquivalentPerMonth }.
 */
export function ImpactStats({ impact }) {
  if (!impact) return null;
  return (
    <div className="space-y-3">
      {/* Signature moment: the CO₂ hero — green glass, sheen band, gradient count-up number. */}
      <Card className="lg-hero glass-drift relative overflow-hidden animate-scale-in [animation-fill-mode:backwards]">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-success/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-brand/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-4">
          <button
            type="button"
            aria-label="Celebrate your carbon savings"
            title="Every seat counts 🌱"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              burstConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, colors: ECO_COLORS, count: 70 });
            }}
            className="press hover-sheen grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-success/15 text-success shadow-elevation-1 outline-none transition-transform duration-medium ease-spring hover:scale-105 focus-visible:ring-2 focus-visible:ring-success/60"
          >
            <Leaf className="h-8 w-8 animate-float" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-success">CO₂ saved together</p>
            <p className="text-4xl font-extrabold leading-tight text-gradient-brand tabular-nums sm:text-5xl">
              <AnimatedNumber value={impact.co2Kg} decimals={1} suffix=" kg" />
            </p>
            <p className="mt-0.5 text-sm text-muted">Every shared seat keeps a little more carbon out of the air.</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={Route} label="Miles shared" count={impact.miles} tone="info" index={0} />
        <Stat icon={Car} label="Trips" count={impact.trips} sub={`${impact.asDriver} driving · ${impact.asRider} riding`} index={1} />
        <Stat icon={Coins} label="Credits" count={impact.credits} tone="warning" index={2} />
        <Stat icon={TreePine} label="≈ Trees / month" count={impact.treesEquivalentPerMonth} tone="success" index={3} />
        <Stat icon={Users} label="As a rider" count={impact.asRider} index={4} />
        <Stat icon={Car} label="As a driver" count={impact.asDriver} tone="brand" index={5} />
      </div>
    </div>
  );
}
