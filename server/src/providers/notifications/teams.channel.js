/** Microsoft Teams channel — STUB. Demonstrates the channel seam. Wire an incoming webhook to build. */
import { logger } from '../../utils/logger.js';

export const teamsChannel = {
  name: 'teams',
  async isEnabled() {
    return false; // disabled until implemented
  },
  async send() {
    logger.debug('teams.channel.send() not implemented — skipping');
    return false;
  },
  async sendBulk() {
    logger.debug('teams.channel.sendBulk() not implemented — skipping');
  },
};
