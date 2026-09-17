import { constants } from 'node:fs';
import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import { useMultiFileAuthState, type AuthenticationState } from 'baileys';
import { gatewayConfig } from '../config.js';
import { logger } from '../../shared/logger.js';
import { onShutdown } from '../../shared/lifecycle.js';

const log = logger.child({ mod: 'auth' });

export interface AuthStore {
  load(): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }>;
}

/**
 * Refuses auth directories that live somewhere unsafe.
 *
 * `useMultiFileAuthState` rewrites creds.json on every update plus one file per
 * Signal pre-key — hundreds of small writes. On a network filesystem that is
 * slow, and a torn write costs a re-pair. Keeping it out of the repo also stops
 * it being copied into a Docker build context.
 */
async function assertSafeAuthDir(dir: string): Promise<void> {
  const projectRoot = path.resolve(process.cwd());
  if (dir === projectRoot || dir.startsWith(projectRoot + path.sep)) {
    throw new Error(
      `WA_AUTH_DIR (${dir}) is inside the project directory. Put it somewhere ` +
        'durable and local, e.g. ~/.local/share/stickerbot/auth, or /data/auth in Docker.',
    );
  }

  // Network mounts: many small writes are slow and partial writes corrupt the
  // session. Detected generically rather than hardcoding a path.
  try {
    const mounts = await readFile('/proc/mounts', 'utf8');
    for (const line of mounts.split('\n')) {
      const [, target, fstype] = line.split(' ');
      if (!target || !fstype) continue;
      if (!/^(fuse\.sshfs|nfs\d?|cifs|smbfs)$/.test(fstype)) continue;
      if (dir === target || dir.startsWith(target + path.sep)) {
        throw new Error(
          `WA_AUTH_DIR (${dir}) is on a ${fstype} mount at ${target}. ` +
            'Auth state must live on local disk or a Docker named volume.',
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('WA_AUTH_DIR')) throw err;
    log.debug('could not read /proc/mounts; skipping network-mount check');
  }
}

/**
 * Exactly one process may own an auth directory. Two sockets sharing credentials
 * produces `440 connectionReplaced` and can force a logout — which means
 * re-pairing, which is the thing most likely to get a number flagged.
 */
async function acquireLock(dir: string): Promise<void> {
  const lockPath = path.join(dir, 'auth.lock');

  try {
    await writeFile(lockPath, String(process.pid), { flag: 'wx' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;

    const holder = Number.parseInt(await readFile(lockPath, 'utf8').catch(() => ''), 10);
    const stale = !holder || !isAlive(holder);

    if (!stale) {
      throw new Error(
        `auth directory ${dir} is already in use by pid ${holder}. ` +
          'Refusing to start a second WhatsApp socket on the same credentials.',
      );
    }

    log.warn({ holder }, 'reclaiming stale auth lock from a dead process');
    await writeFile(lockPath, String(process.pid));
  }

  onShutdown('auth-lock', async () => {
    await unlink(lockPath).catch(() => {});
  });
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export const multiFileAuthStore: AuthStore = {
  async load() {
    const dir = gatewayConfig.WA_AUTH_DIR;

    await assertSafeAuthDir(dir);
    await mkdir(dir, { recursive: true });
    await acquireLock(dir);

    const existed = await access(path.join(dir, 'creds.json'), constants.F_OK)
      .then(() => true)
      .catch(() => false);

    log.info({ dir, existing: existed }, existed ? 'loading saved credentials' : 'no credentials yet, will pair');

    return useMultiFileAuthState(dir);
  },
};
