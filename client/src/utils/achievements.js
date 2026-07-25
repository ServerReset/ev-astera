/**
 * Client-only visual treatment for achievement tiers. The tier VALUES and the badge catalog
 * itself are shared (shared/achievements.js) — this file only maps a tier to Tailwind classes
 * and a confetti palette, which are UI concerns the shared layer stays free of.
 *
 * NOTE: this app does NOT use Tailwind's `dark:` variant (theme is driven by data-theme on
 * <html>, see tailwind.config.js's header). So every class here must read acceptably under BOTH
 * themes on its own — hence single metallic values (amber/slate/yellow) chosen to sit legibly on
 * both a near-white and near-black chip, layered over token-based surface gradients that adapt.
 * The metallic hues are deliberate tier identity, not theme surface color (which stays tokenized).
 */
export { ACHIEVEMENTS, ACHIEVEMENTS_BY_KEY, ACHIEVEMENT_TIERS } from '@shared/achievements.js';

export const TIER_META = {
  bronze: {
    label: 'Bronze',
    badge: 'bg-amber-500/15 text-amber-500',
    card: 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-surface to-surface',
    ring: 'ring-amber-500/40',
    confetti: ['#d98c4a', '#f5c542', '#ffe0a3', '#ffffff'],
  },
  silver: {
    label: 'Silver',
    badge: 'bg-slate-400/20 text-slate-400',
    card: 'border-slate-400/30 bg-gradient-to-br from-slate-400/10 via-surface to-surface',
    ring: 'ring-slate-400/40',
    confetti: ['#c7cdd6', '#e8edf3', '#9aa4b2', '#ffffff'],
  },
  gold: {
    label: 'Gold',
    badge: 'bg-yellow-400/20 text-yellow-500',
    card: 'border-yellow-400/40 bg-gradient-to-br from-yellow-400/15 via-surface to-surface',
    ring: 'ring-yellow-400/50',
    confetti: ['#f5c542', '#ffd700', '#fff2b3', '#ff8a3d', '#ffffff'],
  },
};
