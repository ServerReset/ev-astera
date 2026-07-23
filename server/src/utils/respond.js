/** Response envelope helpers. Keep every success response consistent. */
import { PAGE_SIZE } from '../../../shared/constants.js';

export function ok(res, data, status = 200) {
  return res.status(status).json({ data });
}

export function created(res, data) {
  return res.status(201).json({ data });
}

export function noContent(res) {
  return res.status(204).end();
}

export function paginated(res, items, page = 1, total = items.length, pageSize = PAGE_SIZE) {
  return res.status(200).json({ data: items, meta: { page, total, pageSize } });
}
