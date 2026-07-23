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

export const messageService = {
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

    // Rate limit: this sender, this session.
    const recent = await prisma.messages.findFirst({
      where: { kind: 'nudge', sender_id: senderId, session_id: sessionId },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });
    if (recent && diffMinutes(recent.created_at, now()) < rateMin) {
      throw new BusinessRuleError(`Please wait ${rateMin} minutes between nudges.`);
    }

    // Cap total nudges on this session (from everyone).
    const count = await prisma.messages.count({ where: { kind: 'nudge', session_id: sessionId } });
    if (count >= maxPer) {
      throw new BusinessRuleError('This session has already received the maximum number of nudges.');
    }

    let data;
    try {
      data = await prisma.messages.create({
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
    } catch {
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
    const cooldownH = await configService.getNumber(SETTING_KEYS.EMERGENCY_COOLDOWN_HOURS, locationId);
    const last = await prisma.emergency_requests.findFirst({
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

    const windowMin = await configService.getNumber(SETTING_KEYS.EMERGENCY_RESPONSE_WINDOW_MINUTES, locationId);
    let data;
    try {
      data = await prisma.emergency_requests.create({
        data: {
          location_id: locationId,
          user_id: userId,
          reason,
          explanation: explanation || null,
          expires_at: addMinutes(now(), windowMin),
        },
      });
    } catch {
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
