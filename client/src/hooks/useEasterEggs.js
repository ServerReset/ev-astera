import { useEffect } from 'react';
import { burstConfetti } from '@/utils/confetti.js';
import { toast } from '@/stores/toastStore.js';

/**
 * A small collection of hidden delights, mounted once by AppLayout. All are opt-in (a deliberate
 * sequence or console poke) so they never interfere with normal use, and each is guarded so it
 * can't spam. Nothing here touches app state or the network — pure client-side fun.
 *
 *  • Konami code (↑↑↓↓←→←→ B A) → a big confetti burst + a toast, and toggles a repeatable
 *    "party" confetti for a few seconds.
 *  • Typing "glass" anywhere (not in an input) → a quick shimmer toast nod to the design.
 *  • A one-time console greeting with ASCII art + a hiring-style wink, tuned to the time of day.
 *  • window.astera.party() / .confetti() exposed for the curious who open devtools.
 */
export function useEasterEggs() {
  useEffect(() => {
    // ── Console greeting (once per load) ──────────────────────────────────────
    const hr = new Date().getHours();
    const partOfDay = hr < 5 ? 'burning the midnight oil' : hr < 12 ? 'good morning' : hr < 18 ? 'good afternoon' : 'good evening';
    try {
      // eslint-disable-next-line no-console
      console.log(
        '%c⚡ EV Hub %c— ' + partOfDay + '!',
        'font-size:20px;font-weight:800;color:#5a96d6',
        'font-size:13px;color:#9aa4b2'
      );
      // eslint-disable-next-line no-console
      console.log(
        "%cPoking around? Try the Konami code, or run %castera.party()%c. Built by Team Go Bananas 🍌",
        'color:#9aa4b2', 'color:#5a96d6;font-family:monospace', 'color:#9aa4b2'
      );
    } catch { /* console unavailable */ }

    // ── Party mode: repeated multi-origin confetti for ~4s ────────────────────
    let partyTimer = null;
    const party = () => {
      clearInterval(partyTimer);
      let n = 0;
      const fire = () => {
        burstConfetti({ x: window.innerWidth * (0.2 + Math.random() * 0.6), y: window.innerHeight * (0.15 + Math.random() * 0.3) });
        if (++n >= 6) clearInterval(partyTimer);
      };
      fire();
      partyTimer = setInterval(fire, 550);
    };

    // Expose a tiny devtools toy.
    try {
      window.astera = Object.assign(window.astera || {}, {
        party,
        confetti: (opts) => burstConfetti(opts),
      });
    } catch { /* window frozen */ }

    // ── Key-sequence detection (Konami + "glass") ─────────────────────────────
    const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIdx = 0;
    let typed = '';
    let typedTimer = null;

    const isTyping = () => {
      const el = document.activeElement;
      const tag = el?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable;
    };

    const onKey = (e) => {
      // Konami — case-insensitive on the b/a keys.
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === KONAMI[konamiIdx]) {
        konamiIdx += 1;
        if (konamiIdx === KONAMI.length) {
          konamiIdx = 0;
          party();
          toast.success('🎉 Konami unlocked — party mode!', { duration: 3500 });
        }
      } else {
        konamiIdx = key === KONAMI[0] ? 1 : 0;
      }

      // "glass" typed outside any field.
      if (!isTyping() && /^[a-z]$/.test(key)) {
        typed = (typed + key).slice(-5);
        clearTimeout(typedTimer);
        typedTimer = setTimeout(() => { typed = ''; }, 1500);
        if (typed === 'glass') {
          typed = '';
          toast.info('🔮 You found the glass. Enjoy the shine.', { duration: 3000 });
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(partyTimer);
      clearTimeout(typedTimer);
      try { if (window.astera) { delete window.astera.party; delete window.astera.confetti; } } catch { /* ignore */ }
    };
  }, []);
}
