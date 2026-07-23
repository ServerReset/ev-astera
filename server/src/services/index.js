/**
 * Services registry. Each module registers its service here so that listeners and other
 * modules can reach it WITHOUT deep-importing another module's files (avoids cycles and
 * keeps modules swappable). Populated during module registration.
 */
const _services = {};

export function registerService(name, service) {
  _services[name] = service;
}

/** Live proxy — property access always reflects the latest registered service. */
export const services = new Proxy(_services, {
  get(target, prop) {
    return target[prop];
  },
});
