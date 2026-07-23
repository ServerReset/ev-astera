/**
 * Vercel Cron target (see vercel.json's crons entry, daily schedule). Vercel sends
 * `Authorization: Bearer $CRON_SECRET` automatically for configured cron paths — this
 * is the only auth these jobs get, so the secret check comes first and is not optional.
 * Each job runs independently so one failure doesn't block the rest.
 */
import { env, assertConfig } from '../../server/src/config/index.js';
import { logger } from '../../server/src/utils/logger.js';
import { dailyReset } from '../../server/src/jobs/dailyReset.js';
import { weeklyReset } from '../../server/src/jobs/weeklyReset.js';
import { cleanup } from '../../server/src/jobs/cleanup.js';
import { carpoolMaterialize, carpoolMatch, carpoolComplete } from '../../server/src/modules/carpool/jobs.js';

assertConfig();

async function run(name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    logger.info(`cron job ${name} done`, { ms: Date.now() - started, ...result });
    return { name, ok: true, ...result };
  } catch (err) {
    logger.error(`cron job ${name} threw`, { message: err.message });
    return { name, ok: false, error: err.message };
  }
}

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${env.cronSecret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const results = [];
  results.push(await run('dailyReset', dailyReset));
  if (new Date().getDay() === 1) {
    results.push(await run('weeklyReset', weeklyReset));
  }
  results.push(await run('cleanup', cleanup));
  results.push(await run('carpoolMaterialize', carpoolMaterialize));
  results.push(await run('carpoolMatch', carpoolMatch));
  results.push(await run('carpoolComplete', carpoolComplete));

  res.status(200).json({ ranAt: new Date().toISOString(), results });
}
