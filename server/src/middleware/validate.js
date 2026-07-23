/**
 * Zod validation middleware. `validate(schema, 'body'|'query'|'params')`.
 * Replaces the validated source with the parsed (and defaulted) value.
 * Rejects unknown fields when the schema is strict.
 */
import { ValidationError } from '../utils/errors.js';

export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(new ValidationError(details[0]?.message || 'Invalid input', { issues: details }));
    }
    // req.params and req.query are defined as getter-only accessors by Express (no setter),
    // and this package is `"type": "module"` (strict mode everywhere), so `req.query = ...`
    // throws "Cannot set property query" instead of silently no-oping. Mutate in place instead.
    if (source === 'params' || source === 'query') Object.assign(req[source], result.data);
    else req[source] = result.data;
    next();
  };
