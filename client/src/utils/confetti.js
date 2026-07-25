/**
 * Hand-rolled canvas confetti — no dependency (the project ships no animation library, same
 * constraint that produced utils/liquidGlass.js). One burst: spawns colored shards from a point,
 * animates them with gravity + drag + spin on a full-screen overlay canvas, then removes itself.
 *
 * Deliberately tiny and self-cleaning: creates its own fixed, pointer-events-none <canvas>, runs
 * a single requestAnimationFrame loop until every shard falls off-screen, then tears the canvas
 * down. Honors prefers-reduced-motion by skipping entirely (no motion, no canvas).
 *
 * Usage: burstConfetti({ x, y, colors }) — x/y default to top-center. Colors default to a warm
 * celebratory set; pass a tier palette to theme it.
 */

const DEFAULT_COLORS = ['#f5c542', '#ff8a3d', '#4fb477', '#3c79bc', '#c26fd6', '#ffffff'];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function burstConfetti({ x, y, colors = DEFAULT_COLORS, count = 90 } = {}) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;

  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9999',
  });
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const originX = x ?? W / 2;
  const originY = y ?? H * 0.28;

  // Fan the shards upward-and-out; each gets its own velocity, spin, size, shape and drag.
  const parts = Array.from({ length: count }, (_, i) => {
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI * 0.95);
    const speed = 6 + Math.random() * 9;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 6,
      color: colors[i % colors.length],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      round: Math.random() < 0.35,
      life: 0,
    };
  });

  const GRAVITY = 0.28;
  const DRAG = 0.99;
  const MAX_FRAMES = 220; // hard stop (~3.6s) so a long-running loop can't spin forever
  let frame = 0;
  let raf = 0;
  let done = false;

  const cleanup = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    clearTimeout(backstop);
    canvas.remove();
  };

  // Wall-clock backstop: requestAnimationFrame is fully PAUSED while the tab is hidden, so the
  // rAF loop alone would never reach its stop condition (or remove the canvas) until the tab is
  // shown again. This timer fires regardless of visibility, guaranteeing teardown.
  const backstop = setTimeout(cleanup, 6000);

  const tick = () => {
    if (done) return;
    frame += 1;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) {
      p.vx *= DRAG;
      p.vy = p.vy * DRAG + GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life += 1;
      if (p.y < H + 20) alive += 1;

      const fade = Math.max(0, 1 - Math.max(0, frame - 140) / 80);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
      ctx.restore();
    }

    if (alive > 0 && frame < MAX_FRAMES) {
      raf = requestAnimationFrame(tick);
    } else {
      cleanup();
    }
  };

  raf = requestAnimationFrame(tick);
}
