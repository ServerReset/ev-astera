import { Leaf, Car, Route, Coins, TreePine, Users } from 'lucide-react';
import { Card } from '@/components/common/Card.jsx';
import { useCountUp } from '@/hooks/useCountUp.js';

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

/** A single stat tile. `count` (+ optional decimals/suffix) animates the value on mount. */
function Stat({ icon: Icon, label, value, count, decimals = 0, suffix = '', sub, tone = 'brand' }) {
  const toneClass = {
    brand: 'bg-brand/15 text-brand-strong',
    success: 'bg-success/15 text-success',
    info: 'bg-info/15 text-info',
    warning: 'bg-warning/15 text-warning',
  }[tone];
  return (
    <Card className="flex items-center gap-3">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${toneClass}`}>
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat icon={Leaf} label="CO₂ saved" count={impact.co2Kg} decimals={1} suffix=" kg" tone="success" />
      <Stat icon={Route} label="Miles shared" count={impact.miles} tone="info" />
      <Stat icon={Car} label="Trips" count={impact.trips} sub={`${impact.asDriver} driving · ${impact.asRider} riding`} />
      <Stat icon={Coins} label="Credits" count={impact.credits} tone="warning" />
      <Stat icon={TreePine} label="≈ Trees / month" count={impact.treesEquivalentPerMonth} tone="success" />
      <Stat icon={Users} label="As a rider" count={impact.asRider} />
    </div>
  );
}
