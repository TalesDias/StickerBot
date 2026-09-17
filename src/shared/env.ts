import type { ZodType } from 'zod';
import { logger } from './logger.js';

/**
 * Parses `process.env` through a Zod schema once, at startup.
 *
 * Replaces the old hand-rolled `verifyKey()` helper, which threw on the first
 * missing variable one at a time. This reports every problem at once, so a
 * misconfigured deployment takes one restart to diagnose instead of five.
 */
export function loadEnv<T>(name: string, schema: ZodType<T>): T {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const key = issue.path.join('.') || '(root)';
      return `  ${key}: ${issue.message}`;
    });

    logger.fatal(
      `invalid ${name} configuration:\n${problems.join('\n')}\n` +
        'Check .env against .env.example.',
    );
    process.exit(1);
  }

  return result.data;
}
