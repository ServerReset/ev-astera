/**
 * Minimal `{{varName}}` placeholder substitution for admin-editable notification templates
 * (see shared/constants.js's NOTIF_TPL_* setting keys). An unknown placeholder is left as-is
 * rather than blanked, so an admin's typo in a template is visible/debuggable instead of
 * silently vanishing from the rendered notification.
 */
export function renderTemplate(template, vars = {}) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
