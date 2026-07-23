import * as icons from 'lucide-react';
import { HelpCircle } from 'lucide-react';

/**
 * Icon — resolves a lucide icon by string name (used by the module registry's nav config
 * and notification metadata, which store icons as strings rather than components).
 */
export function Icon({ name, ...props }) {
  const Cmp = icons[name] || HelpCircle;
  return <Cmp {...props} />;
}
