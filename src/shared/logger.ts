import pino from 'pino';

/**
 * Root logger. Deliberately independent of `config.ts`: config parsing reports
 * its own failures through this logger, so the logger must exist first.
 *
 * `LOG_LEVEL` is read straight from the environment, which requires
 * `dotenv/config` to have been imported before this module. `src/main.ts` does
 * that as its first import.
 */
const level = process.env.LOG_LEVEL ?? 'info';

export const logger =
  process.env.NODE_ENV === 'production'
    ? // sync: true matters in a container. pino's default writer batches into a
      // 4KB buffer when stdout is not a TTY, so low-volume services can look
      // completely silent in `docker logs` until the buffer happens to fill.
      pino({ level }, pino.destination({ dest: 1, sync: true }))
    : pino({
        level,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      });

export type Logger = typeof logger;
