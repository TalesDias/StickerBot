import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from 'baileys';
import type { Boom } from '@hapi/boom';
import { multiFileAuthStore } from '../auth/index.js';
import { requestPairingIfNeeded } from './pairing.js';
import { logger } from '../../shared/logger.js';
import { onShutdown } from '../../shared/lifecycle.js';

const log = logger.child({ mod: 'wa.socket' });

export type ConnectionState = 'connecting' | 'open' | 'closed';

type Listener = (state: ConnectionState, sock: WASocket | null) => void;

let sock: WASocket | null = null;
let state: ConnectionState = 'closed';
let attempts = 0;
let stopped = false;
const listeners: Listener[] = [];

/** Latest socket, or null while disconnected. */
export function getSocket(): WASocket | null {
  return sock;
}

export function getState(): ConnectionState {
  return state;
}

/** Notified on every transition. Used to gate the outbound consumer. */
export function onStateChange(listener: Listener): void {
  listeners.push(listener);
}

function setState(next: ConnectionState): void {
  if (state === next) return;
  state = next;
  for (const listener of listeners) {
    try {
      listener(next, sock);
    } catch (err) {
      log.error({ err }, 'connection state listener failed');
    }
  }
}

/** Exponential backoff with jitter, capped at 60s. */
function backoffMs(): number {
  const base = Math.min(1000 * 2 ** attempts, 60_000);
  return base / 2 + Math.random() * (base / 2);
}

export async function startSocket(
  onMessages: (sock: WASocket) => void,
): Promise<void> {
  const { state: authState, saveCreds } = await multiFileAuthStore.load();

  // A metadata fetch failure must never block startup; the bundled version is
  // a fine fallback.
  const { version } = await fetchLatestBaileysVersion().catch((err) => {
    log.warn({ err }, 'could not fetch latest WA version, using bundled');
    return { version: undefined as unknown as [number, number, number] };
  });

  const connect = async (): Promise<void> => {
    if (stopped) return;
    setState('connecting');

    sock = makeWASocket({
      version,
      auth: authState,
      // Baileys at info level drowns out everything else.
      logger: logger.child({ mod: 'baileys' }, { level: 'warn' }),
      // Headless: pairing is done by code, not QR.
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      // Keeps notifications going to the phone instead of being swallowed here.
      markOnlineOnConnect: false,
      // Without this, reconnects replay history and the bot re-answers old messages.
      syncFullHistory: false,
    });

    // Must be first: Signal keys rotate on send *and* receive, and dropping an
    // update makes messages silently stop reaching recipients.
    sock.ev.on('creds.update', saveCreds);

    onMessages(sock);

    let pairingRequested = false;

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;

      // Pairing must wait for the WebSocket to actually be open: Baileys'
      // sendRawMessage throws `428 Connection Closed` otherwise. A `qr` in the
      // update is the reliable signal — Baileys only generates one once the
      // socket is open and the server is offering a login.
      if (update.qr && !authState.creds.registered && !pairingRequested) {
        pairingRequested = true;
        void requestPairingIfNeeded(sock!).catch((err) =>
          log.error({ err }, 'failed to request pairing code'),
        );
      }

      if (connection === 'connecting') {
        log.info('connecting to WhatsApp');
        return;
      }

      if (connection === 'open') {
        attempts = 0;
        log.info('connection open');
        setState('open');
        return;
      }

      if (connection !== 'close') return;

      const status = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      setState('closed');

      if (status === DisconnectReason.loggedOut) {
        // Only fatal for an established session. Before registration this just
        // means the pairing attempt did not complete (an expired code, a
        // dismissed prompt) — there is no session to lose, so retry.
        if (authState.creds.registered) {
          log.fatal(
            'logged out — the session is gone and the device must be re-paired. ' +
              'Delete WA_AUTH_DIR entirely (not partially) and restart.',
          );
          stopped = true;
          process.exit(1);
        }

        log.warn('pairing did not complete, retrying with a new code');
      }

      if (status === DisconnectReason.restartRequired) {
        // Normal immediately after linking. Not an error, no backoff.
        log.info('restart required, reconnecting');
        void connect();
        return;
      }

      if (status === DisconnectReason.connectionReplaced) {
        log.error(
          'connection replaced — another process is using these credentials. ' +
            'Only one gateway may run per auth directory.',
        );
      }

      const delay = backoffMs();
      attempts += 1;
      log.warn({ status, delay: Math.round(delay), attempt: attempts }, 'connection closed, reconnecting');
      setTimeout(() => void connect(), delay);
    });
  };

  onShutdown('wa-socket', async () => {
    stopped = true;
    sock?.end(undefined);
    await saveCreds().catch(() => {});
  });

  await connect();
}
