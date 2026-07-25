/**
 * Message service: nudges (rider → active charger user) and emergency requests
 * (need-the-charger-now escalations). Rate limits and cooldowns come from config.
 */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { configService } from '../../services/config.service.js';
import { AuthorizationError, BusinessRuleError, NotFoundError } from '../../utils/errors.js';
import { SESSION_STATUS, SETTING_KEYS } from '../../../../shared/constants.js';
import { addMinutes, addHours, now, diffMinutes } from '../../utils/timeUtils.js';

// Postgres advisory locks take a bigint key; Postgres's own hashtext() collapses an arbitrary
// string into one deterministically. Session-scoped ('nudge:' + sessionId) and user-scoped
// ('emergency:' + userId) locks below serialize each resource's check-then-act window (rate
// limit / cooldown read, then the create) across concurrent requests — two tabs, a client
// retry, or a fast double-tap can no longer both pass the same check before either write lands.
async function withAdvisoryLock(key, fn) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', key);
    return fn(tx);
  });
}

export const messageService = {
  /** Admin-editable content lists a client needs before rendering the nudge/emergency UI. */
  async getConfig(locationId) {
    const nudgePresets = await configService.get(SETTING_KEYS.NUDGE_PRESETS, locationId);
    const emergencyReasons = await configService.get(SETTING_KEYS.EMERGENCY_REASONS, locationId);
    return { nudgePresets, emergencyReasons };
  },

  /**
   * Send a nudge to the person occupying a charger. Rate-limited per (sender, session) and
   * capped per session. The recipient is derived from the live session — never trusted from input.
   */
  async nudge(locationId, senderId, { chargerId, sessionId, message }) {
    const session = await prisma.sessions.findFirst({
      where: { id: sessionId, charger_id: chargerId, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } },
    });
    if (!session) throw new NotFoundError('That charging session is no longer active.');
    if (session.user_id === senderId) throw new BusinessRuleError('You cannot nudge your own session.');

    const rateMin = await configService.getNumber(SETTING_KEYS.NUDGE_RATE_LIMIT_MINUTES, locationId);
    const maxPer = await configService.getNumber(SETTING_KEYS.MAX_NUDGES_PER_SESSION, locationId);

    // Locked per session: the rate-limit read, the cap read, and the create must be seen as
    // one atomic step by every concurrent nudge attempt on this session (see withAdvisoryLock).
    let data;
    try {
      data = await withAdvisoryLock(`nudge:${sessionId}`, async (tx) => {
        const recent = await tx.messages.findFirst({
          where: { kind: 'nudge', sender_id: senderId, session_id: sessionId },
          orderBy: { created_at: 'desc' },
          select: { created_at: true },
        });
        if (recent && diffMinutes(recent.created_at, now()) < rateMin) {
          throw new BusinessRuleError(`Please wait ${rateMin} minutes between nudges.`);
        }

        const count = await tx.messages.count({ where: { kind: 'nudge', session_id: sessionId } });
        if (count >= maxPer) {
          throw new BusinessRuleError('This session has already received the maximum number of nudges.');
        }

        return tx.messages.create({
          data: {
            location_id: locationId,
            kind: 'nudge',
            sender_id: senderId,
            recipient_id: session.user_id,
            charger_id: chargerId,
            session_id: sessionId,
            body: message,
          },
        });
      });
    } catch (err) {
      if (err instanceof BusinessRuleError) throw err;
      throw new BusinessRuleError('Could not send nudge.');
    }

    await emit(EVENTS.NUDGE_SENT, {
      locationId,
      messageId: data.id,
      chargerId,
      sessionId,
      senderId,
      recipientId: session.user_id,
      message,
    });
    return { id: data.id, success: true };
  },

  /** The nudge recipient thumbs-up/thumbs-down's it. Re-reacting overwrites the previous value. */
  async reactToNudge(userId, { messageId, reaction }) {
    const message = await prisma.messages.findUnique({ where: { id: messageId } });
    if (!message || message.kind !== 'nudge') throw new NotFoundError('Nudge not found');
    if (message.recipient_id !== userId) throw new AuthorizationError('Only the recipient can react to this nudge');

    const updated = await prisma.messages.update({ where: { id: messageId }, data: { reaction } });

    // Also persist onto the original nudge notification's metadata (via the message_id link)
    // so the reaction UI still shows the saved state after a reload — the client reads
    // `notification.metadata.reaction`, which otherwise nothing ever writes.
    const notification = await prisma.notifications.findFirst({
      where: { message_id: messageId, user_id: userId },
      select: { id: true, metadata: true },
    });
    if (notification) {
      await prisma.notifications.update({
        where: { id: notification.id },
        data: { metadata: { ...(notification.metadata || {}), reaction } },
      });
    }

    await emit(EVENTS.NUDGE_REACTED, {
      locationId: updated.location_id,
      messageId: updated.id,
      reaction,
      senderId: updated.sender_id,
      chargerId: updated.charger_id,
    });
    return { id: updated.id, reaction, success: true };
  },

  /**
   * Raise an emergency "I need a charger now" request. Cooldown-limited per user.
   * Broadcast handling (who to alert) is done in the listener.
   */
  async requestEmergency(locationId, userId, { reason, explanation }) {
    // The allowed reasons are admin-editable per office, so this can't be a static z.enum at
    // the schema layer (shared/validation.js) — check against this location's actual list here.
    const allowedReasons = await configService.get(SETTING_KEYS.EMERGENCY_REASONS, locationId);
    if (!Array.isArray(allowedReasons) || !allowedReasons.includes(reason)) {
      throw new BusinessRuleError('Please choose a valid reason.');
    }

    const cooldownH = await configService.getNumber(SETTING_KEYS.EMERGENCY_COOLDOWN_HOURS, locationId);
    const windowMin = await configService.getNumber(SETTING_KEYS.EMERGENCY_RESPONSE_WINDOW_MINUTES, locationId);

    // Locked per user: the cooldown read and the create must be seen as one atomic step by
    // every concurrent request this user fires (double-tap, retry, two tabs) — see withAdvisoryLock.
    let data;
    try {
      data = await withAdvisoryLock(`emergency:${userId}`, async (tx) => {
        const last = await tx.emergency_requests.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          select: { created_at: true },
        });
        if (last) {
          const nextAllowed = addHours(new Date(last.created_at), cooldownH);
          if (now() < nextAllowed) {
            throw new BusinessRuleError(`You can raise another emergency request in ${cooldownH} hours.`);
          }
        }

        return tx.emergency_requests.create({
          data: {
            location_id: locationId,
            user_id: userId,
            reason,
            explanation: explanation || null,
            expires_at: addMinutes(now(), windowMin),
          },
        });
      });
    } catch (err) {
      if (err instanceof BusinessRuleError) throw err;
      throw new BusinessRuleError('Could not raise emergency request.');
    }

    await emit(EVENTS.EMERGENCY_REQUESTED, {
      locationId,
      requestId: data.id,
      userId,
      reason,
      explanation: explanation || null,
      expiresAt: data.expires_at,
    });
    return { id: data.id, expiresAt: data.expires_at, success: true };
  },

  /** A charging user responds to an emergency (offers to wrap up / declines). */
  async respondEmergency(locationId, responderId, { requestId, accept }) {
    const reqRow = await prisma.emergency_requests.findUnique({ where: { id: requestId } });
    if (!reqRow) throw new NotFoundError('Emergency request not found');
    if (reqRow.status !== 'open') throw new BusinessRuleError('This request is no longer open.');

    await prisma.messages.create({
      data: {
        location_id: locationId,
        kind: 'emergency_response',
        sender_id: responderId,
        recipient_id: reqRow.user_id,
        body: accept ? 'is wrapping up for you' : 'cannot help right now',
        metadata: { requestId, accept },
      },
    });

    if (accept) {
      await prisma.emergency_requests.update({ where: { id: requestId }, data: { status: 'resolved' } });
    }

    await emit(EVENTS.EMERGENCY_RESPONDED, {
      locationId,
      requestId,
      responderId,
      requesterId: reqRow.user_id,
      accept,
    });
    return { success: true };
  },

  /** Active emergency requests at a location (for banners / admin). */
  async listActiveEmergencies(locationId) {
    const rows = await prisma.emergency_requests.findMany({
      where: { location_id: locationId, status: 'open', expires_at: { gte: now() } },
      include: { users: { select: { display_name: true } } },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userDisplayName: r.users?.display_name,
      reason: r.reason,
      explanation: r.explanation,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));
  },
};
