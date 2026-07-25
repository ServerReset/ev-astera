/**
 * Resolves one notification template's admin-editable title/body for a location and renders
 * its runtime variables — the single call every listener makes instead of a hardcoded literal.
 * See shared/constants.js's NOTIFICATION_TEMPLATES for the full template catalog and defaults.
 */
import { configService } from '../services/config.service.js';
import { notifTplSettingKey } from '../../../shared/constants.js';
import { renderTemplate } from './renderTemplate.js';

/**
 * @param {string} templateKey  one of NOTIFICATION_TEMPLATES' `key` values
 * @param {string} locationId
 * @param {object} [vars]       runtime values for the template's `{{placeholders}}`
 * @returns {Promise<{title: string, body: string}>}
 */
export async function getNotificationCopy(templateKey, locationId, vars = {}) {
  const [title, body] = await Promise.all([
    configService.get(notifTplSettingKey(templateKey, 'title'), locationId),
    configService.get(notifTplSettingKey(templateKey, 'body'), locationId),
  ]);
  return { title: renderTemplate(title, vars), body: renderTemplate(body, vars) };
}
