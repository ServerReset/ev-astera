/** Selects the active auth provider from AUTH_PROVIDER. All code imports `authProvider` from here. */
import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { localProvider } from './local.provider.js';
import { entraProvider } from './entra.provider.js';
import { AUTH_PROVIDER_METHODS } from './auth.interface.js';

const providers = {
  local: localProvider,
  entra: entraProvider,
};

const selected = providers[env.authProvider];
if (!selected) {
  throw new Error(`Unknown AUTH_PROVIDER "${env.authProvider}". Valid: ${Object.keys(providers).join(', ')}`);
}

// Fail fast if a provider forgot a method.
for (const m of AUTH_PROVIDER_METHODS) {
  if (typeof selected[m] !== 'function') {
    throw new Error(`Auth provider "${env.authProvider}" is missing method: ${m}`);
  }
}

logger.info(`Auth provider: ${env.authProvider}`);
export const authProvider = selected;
