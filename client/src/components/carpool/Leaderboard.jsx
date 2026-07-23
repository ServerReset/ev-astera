import { Trophy, Medal } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/States.jsx';
import { cn } from '@/utils/cn.js';

const RANK_TONE = ['text-warning', 'text-muted', 'text-[#cd7f32]']; // gold, silver, bronze

/**
 * CO₂-savings leaderboard (Feature 4). `rows` from carpoolApi.leaderboard:
 * [{ userId, name, trips, co2Kg, credits }], already sorted desc by co2Kg.
 * `highlightUserId` bolds the viewer's row.
 */
export function Leaderboard({ rows = [], highlightUserId, window, onWindowChange }) {
  return (
    <Card>
      <CardHeader
        title="Leaderboard"
        subtitle="Most CO₂ saved by carpooling"
        icon={Trophy}
        action={
          <select
            value={window}
            onChange={(e) => onWindowChange?.(e.target.value)}
            className="input h-8 w-auto py-0 text-sm"
          >
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </select>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title="No trips logged yet" description="Complete a carpool to get on the board." />
      ) : (
        <ol className="space-y-1">
          {rows.map((r, i) => {
            const mine = r.userId === highlightUserId;
            return (
              <li
                key={r.userId}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
                  mine ? 'bg-brand/10 ring-1 ring-brand/40' : i % 2 ? 'bg-bg-elevated' : ''
                )}
              >
                <span className="w-6 shrink-0 text-center font-semibold">
                  {i < 3 ? <Medal className={cn('mx-auto h-4 w-4', RANK_TONE[i])} /> : <span className="text-faint">{i + 1}</span>}
                </span>
                <span className="min-w-0 flex-1 truncate text-content">
                  {r.name}
                  {mine && <span className="ml-1 text-xs text-brand">(you)</span>}
                </span>
                <span className="text-xs text-muted">{r.trips} trips</span>
                <span className="w-20 text-right font-semibold text-success tabular-nums">{r.co2Kg} kg</span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
