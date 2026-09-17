import { logger } from './logger.js';

type ShutdownHook = {
  name: string;
  run: () => Promise<void> | void;
};

const hooks: ShutdownHook[] = [];
let shuttingDown = false;

/**
 * Registers cleanup to run on SIGTERM/SIGINT. Hooks run in reverse registration
 * order, so resources tear down opposite to how they were built.
 *
 * This exists because the old `src/queues/connection.ts` registered its signal
 * handlers as an import side effect: invisible at the call site, impossible to
 * order, and it would fire twice once a second entrypoint imported it.
 */
export function onShutdown(name: string, run: () => Promise<void> | void): void {
  hooks.push({ name, run });
}

export async function shutdown(reason: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  const log = logger.child({ mod: 'lifecycle' });
  log.info({ reason }, 'shutting down');

  // If a hook hangs (a socket that never closes, a broker that stopped
  // answering) exit anyway rather than ignoring the signal forever.
  const force = setTimeout(() => {
    log.error('shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10_000);
  force.unref();

  for (const hook of [...hooks].reverse()) {
    try {
      await hook.run();
      log.debug({ hook: hook.name }, 'shutdown hook complete');
    } catch (err) {
      log.error({ err, hook: hook.name }, 'shutdown hook failed');
    }
  }

  clearTimeout(force);
  log.info('shutdown complete');
  process.exit(0);
}

/** Called explicitly from main.ts — never as an import side effect. */
export function installSignalHandlers(): void {
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
}
