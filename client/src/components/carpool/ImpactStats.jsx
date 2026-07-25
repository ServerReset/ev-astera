import { Route, MapPin, Sprout, TreePine, Car, UserRound } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp.js';
import { cn } from '@/utils/cn.js';

/** A single count-up stat tile. */
function StatTile({ icon: Icon, label, value, decimals = 0, suffix, tone = 'brand', delay = 0 }) {
  const display = useCountUp(value || 0, { decimals });
  const toneClass = {
    brand: 'bg-brand/12 text-brand-strong',
    success: 'bg-success/15 text-success',
    info: 'bg-info/15 text-info',
    warning: 'bg-warning/15 text-warning',
  }[tone];

  return (
    <div
      className="card card-interactive hover-sheen flex flex-col gap-2 rounded-xl-increased p-4 animate-slide-up [animation-fill-mode:backwards]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={cn('grid h-10 w-10 place-items-center rounded-2xl', toneClass)}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-1 text-3xl font-black tabular-nums text-content">
        {display}
        {suffix && <span className="ml-1 text-lg font-bold text-muted">{suffix}</span>}
      </p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

/**
 * The personal carpool-impact stat grid. Consumes carpoolApi.myImpact() output:
 * { trips, asDriver, asRider, miles, co2Kg, credits, treesEquivalentPerMonth }.
 */
export function ImpactStats({ impact }) {
  const i = impact || {};
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile icon={Route} label="Trips" value={i.trips} tone="brand" delay={0} />
      <StatTile icon={Car} label="As driver" value={i.asDriver} tone="info" delay={60} />
      <StatTile icon={UserRound} label="As rider" value={i.asRider} tone="info" delay={120} />
      <StatTile icon={MapPin} label="Miles shared" value={i.miles} tone="brand" delay={180} />
      <StatTile icon={Sprout} label="Credits" value={i.credits} tone="success" delay={240} />
      <StatTile icon={TreePine} label="Trees / mo" value={i.treesEquivalentPerMonth} decimals={1} tone="success" delay={300} />
    </div>
  );
}
