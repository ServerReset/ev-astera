import { Leaf, Car, Route, Coins, TreePine, Users } from 'lucide-react';
import { Card } from '@/components/common/Card.jsx';

/** A single stat tile. */
function Stat({ icon: Icon, label, value, sub, tone = 'brand' }) {
  const toneClass = {
    brand: 'bg-brand/15 text-brand',
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
        <p className="text-xl font-bold text-content tabular-nums">{value}</p>
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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Stat icon={Leaf} label="CO₂ saved" value={`${impact.co2Kg} kg`} tone="success" />
      <Stat icon={Route} label="Miles shared" value={impact.miles} tone="info" />
      <Stat icon={Car} label="Trips" value={impact.trips} sub={`${impact.asDriver} driving · ${impact.asRider} riding`} />
      <Stat icon={Coins} label="Credits" value={impact.credits} tone="warning" />
      <Stat icon={TreePine} label="≈ Trees / month" value={impact.treesEquivalentPerMonth} tone="success" />
      <Stat icon={Users} label="As a rider" value={impact.asRider} />
    </div>
  );
}
