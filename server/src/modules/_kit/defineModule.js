/**
 * defineModule — validates and normalizes a feature-module manifest.
 * See docs/CONTRACTS.md §1 for the full contract.
 *
 * @param {object} m
 * @param {string} m.name                unique module name
 * @param {string} [m.basePath]          path under the scope root, default `/${name}`
 * @param {'location'|'root'} [m.scope]  mount scope, default 'location'
 * @param {(router, ctx) => void} [m.routes]
 * @param {Array<{event:string, handler:Function}>} [m.listeners]
 * @param {Array<{name:string, schedule:string, handler:Function, runOnBoot?:boolean}>} [m.jobs]
 * @param {string[]} [m.realtimeTables]
 */
export function defineModule(m) {
  if (!m || typeof m.name !== 'string' || !m.name) {
    throw new Error('defineModule: `name` is required');
  }
  return {
    name: m.name,
    basePath: m.basePath ?? `/${m.name}`,
    scope: m.scope ?? 'location',
    routes: m.routes ?? (() => {}),
    listeners: m.listeners ?? [],
    jobs: m.jobs ?? [],
    realtimeTables: m.realtimeTables ?? [],
  };
}
