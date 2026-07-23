/**
 * Notification channel interface (documentation-only).
 * Each channel MUST implement:
 *   name: string
 *   async send(userId, payload) → boolean         (payload = {title, body, type, priority?, actionUrl?, metadata?})
 *   async sendBulk(userIds, payload) → void
 *   async isEnabled(userId) → boolean             (user prefs + channel availability)
 *
 * Adding a channel = create a file implementing this + add it to index.js's `channels` array.
 */
export const CHANNEL_METHODS = ['send', 'sendBulk', 'isEnabled'];
