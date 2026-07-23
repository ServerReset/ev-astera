import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { messageApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { cn } from '@/utils/cn.js';

/** Thumbs up/down for a nudge, shown to the recipient. Optimistic, overwrites on re-react. */
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
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Thumbs up"
        disabled={busy}
        onClick={(e) => react(e, 'up')}
        className={cn('grid h-7 w-7 place-items-center rounded-lg transition-colors', reaction === 'up' ? 'bg-brand/15 text-brand-strong' : 'text-faint hover:bg-surface-2')}
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Thumbs down"
        disabled={busy}
        onClick={(e) => react(e, 'down')}
        className={cn('grid h-7 w-7 place-items-center rounded-lg transition-colors', reaction === 'down' ? 'bg-brand/15 text-brand-strong' : 'text-faint hover:bg-surface-2')}
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}
