/**
 * Achievement catalog — the single source of truth for every unlockable badge, shared by BOTH
 * server and client (framework-free, no imports — same rule as constants.js). Adding a badge =
 * one entry here. The server's achievement listeners read `metric`/`target`/`window` to decide
 * when to grant it; the client reads `label`/`description`/`icon`/`tier` to render it.
 *
 * `metric` tells the server HOW to evaluate the unlock:
 *   - count metrics ('sessions', 'trips', 'co2_kg', 'nudges', 'queue_claims', 'reliability'):
 *     unlock when the user's current value ≥ `target`. These also power the locked-state
 *     progress bar (current / target).
 *   - event metrics ('early_bird', 'night_owl', 'perfect_finish', 'peacemaker', 'match'):
 *     unlock the moment a single qualifying event happens; no meaningful progress bar.
 *
 * `icon` is a lucide-react icon NAME (string), resolved to a component on the client — the shared
 * layer stays free of any React/lucide import.
 */

export const ACHIEVEMENT_TIERS = Object.freeze({
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
});

export const ACHIEVEMENTS = Object.freeze([
  // ── Charging ──────────────────────────────────────────────────────────────
  { key: 'first_charge', label: 'First Spark', description: 'Start your very first charging session.', icon: 'Zap', tier: 'bronze', metric: 'sessions', target: 1 },
  { key: 'power_user', label: 'Power User', description: 'Complete 10 charging sessions.', icon: 'Flame', tier: 'silver', metric: 'sessions', target: 10 },
  { key: 'early_bird', label: 'Early Bird', description: 'Start a session before 8 AM.', icon: 'Sunrise', tier: 'silver', metric: 'early_bird', target: 1 },
  { key: 'night_owl', label: 'Night Owl', description: 'Start a session after 8 PM.', icon: 'Moon', tier: 'silver', metric: 'night_owl', target: 1 },
  { key: 'perfect_finish', label: 'Perfect Finish', description: 'End a session right on time — no overtime.', icon: 'Rocket', tier: 'bronze', metric: 'perfect_finish', target: 1 },
  { key: 'reliable_pro', label: 'Gold Standard', description: 'Reach a reliability score of 130+.', icon: 'ShieldCheck', tier: 'gold', metric: 'reliability', target: 130 },

  // ── Queue ─────────────────────────────────────────────────────────────────
  { key: 'queue_zen', label: 'Queue Zen', description: 'Claim your turn from the queue 5 times.', icon: 'ListChecks', tier: 'silver', metric: 'queue_claims', target: 5 },

  // ── Carpool ───────────────────────────────────────────────────────────────
  { key: 'carpool_starter_kit', label: 'Carpool Rookie', description: 'Take your first carpool trip.', icon: 'Car', tier: 'bronze', metric: 'trips', target: 1 },
  { key: 'carpool_regular', label: 'Rideshare Regular', description: 'Take 10 carpool trips.', icon: 'Users', tier: 'silver', metric: 'trips', target: 10 },
  { key: 'green_thumb', label: 'Green Thumb', description: 'Save 100 kg of CO₂ by carpooling.', icon: 'Sprout', tier: 'gold', metric: 'co2_kg', target: 100 },
  { key: 'great_match', label: "It's a Match", description: 'Get matched with a carpool.', icon: 'Heart', tier: 'bronze', metric: 'match', target: 1 },

  // ── Social ────────────────────────────────────────────────────────────────
  { key: 'first_nudge', label: 'Gentle Nudge', description: 'Send your first nudge.', icon: 'Bell', tier: 'bronze', metric: 'nudges', target: 1 },
  { key: 'nudge_ninja', label: 'Nudge Ninja', description: 'Send 10 nudges.', icon: 'MessageCircle', tier: 'silver', metric: 'nudges', target: 10 },
  { key: 'peacemaker', label: 'Peacemaker', description: 'Get a positive reaction to a nudge you sent.', icon: 'Handshake', tier: 'bronze', metric: 'peacemaker', target: 1 },
]);

export const ACHIEVEMENTS_BY_KEY = Object.freeze(
  ACHIEVEMENTS.reduce((acc, a) => {
    acc[a.key] = a;
    return acc;
  }, {})
);

/** Count metrics drive a progress bar in the locked state; event metrics are all-or-nothing. */
export const COUNT_METRICS = Object.freeze(['sessions', 'trips', 'co2_kg', 'nudges', 'queue_claims', 'reliability']);

export function isCountMetric(metric) {
  return COUNT_METRICS.includes(metric);
}
