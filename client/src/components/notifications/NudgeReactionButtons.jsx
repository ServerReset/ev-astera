import { useState } from 'react';
import { messageApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { cn } from '@/utils/cn.js';

// The reaction pack — each maps to a nudgeReactSchema enum value (shared/validation.js) and a
// notification template (shared/constants.js's nudge_reaction_* entries). Emoji carry the meaning
// so a reply says something real ("on my way" / "almost done") instead of a bare up/down.
const REACTIONS = [
  { value: 'up', emoji: '👍', label: 'Got it' },
  { value: 'pray', emoji: '🙏', label: 'Almost done' },
  { value: 'run', emoji: '🏃', label: 'On my way' },
  { value: 'eyes', emoji: '👀', label: 'Seen it' },
  { value: 'down', emoji: '👎', label: 'Not yet' },
];

/** Emoji reaction row for a nudge, shown to the recipient. Optimistic; overwrites on re-react. */
export function NudgeReactionButtons({ messageId, initialReaction }) {
  const [reaction, setReaction] = useState(initialReaction || null);
  const [busy, setBusy] = useState(false);

  const react = async (e, value) => {
    e.stopPropagation();
    if (busy || !messageId) return;
    const previous = reaction;
    setBusy(true);
    setReaction(value);
    try {
      await messageApi.reactToNudge({ messageId, reaction: value });
    } catch (err) {
      setReaction(previous);
      toast.error(normalizeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {REACTIONS.map((r) => {
        const active = reaction === r.value;
        return (
          <button
            key={r.value}
            type="button"
            aria-label={r.label}
            aria-pressed={active}
            title={r.label}
            disabled={busy}
            onClick={(e) => react(e, r.value)}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-full text-base leading-none',
              'transition-transform duration-spring ease-spring active:scale-90',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/80',
              active ? 'scale-110 bg-brand/15 ring-1 ring-brand/40' : 'grayscale hover:grayscale-0 hover:bg-surface-2'
            )}
          >
            <span aria-hidden="true">{r.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
