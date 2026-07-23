/** Email channel — STUB. Demonstrates the channel seam. Wire SMTP/provider to build. */
import { logger } from '../../utils/logger.js';

export const emailChannel = {
  name: 'email',
  async isEnabled() {
    return false; // disabled until implemented; dispatcher skips disabled channels
  },
  async send() {
    logger.debug('email.channel.send() not implemented — skipping');
    return false;
  },
  async sendBulk() {
    logger.debug('email.channel.sendBulk() not implemented — skipping');
  },
};
