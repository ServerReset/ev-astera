/** Structured JSON logger (winston). Human-friendly in dev, JSON in prod. */
import winston from 'winston';
import { env } from '../config/index.js';

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${message}${rest}`;
  })
);

export const logger = winston.createLogger({
  level: env.isProd ? 'info' : 'debug',
  format: env.isProd
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : devFormat,
  transports: [new winston.transports.Console()],
});
