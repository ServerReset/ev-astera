/** Server-only constants + a re-export of the shared ones for convenience. */
export * from '../../../shared/constants.js';

// Generic preset nudge escalation copy (system-generated first nudge).
export const SYSTEM_OVERTIME_NUDGE = 'Your charging session has passed its ETA. Please wrap up when you can. 🙏';

// Bad-word filter (very small placeholder list; message content is plain-text only).
export const BANNED_WORDS = ['badword1', 'badword2'];
