import { z } from 'zod';
import { loadEnv } from './env.js';

/**
 * Configuration needed by both the gateway and the bots. Each of those has its
 * own schema for its own keys; this covers only what genuinely crosses that line.
 */
const sharedSchema = z.object({
  RABBIT_CONNECTION_URI: z.string().min(1, 'required (e.g. amqp://guest:guest@localhost:5672)'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  NODE_ENV: z.string().default('development'),
});

export const sharedConfig = loadEnv('shared', sharedSchema);
