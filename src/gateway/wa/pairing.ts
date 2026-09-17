import type { WASocket } from 'baileys';
import { gatewayConfig } from '../config.js';
import { logger } from '../../shared/logger.js';

const log = logger.child({ mod: 'wa.pairing' });

/**
 * Headless pairing. No QR is rendered: this runs on a server with no screen, so
 * the phone is linked via "Link with phone number instead".
 *
 * Timing matters. `requestPairingCode` must not be called until the socket is up
 * and has emitted its first connection update — calling it earlier is a known
 * failure mode where a code is produced but never delivered to the phone.
 */
export async function requestPairingIfNeeded(sock: WASocket): Promise<void> {
  if (sock.authState.creds.registered) return;

  const number = gatewayConfig.WA_PAIRING_NUMBER;

  // Baileys generates this as bytesToCrockford(randomBytes(5)): 40 bits of
  // Crockford base32, i.e. exactly 8 characters from 123456789ABCDEFGHJKLMNPQRSTVWXYZ.
  // No 0/I/L/O/U, so it is unambiguous when read out of a log.
  const code = await sock.requestPairingCode(number);

  log.info(
    { number },
    `\n\n    Pairing code: ${code}\n\n` +
      '    On the phone: WhatsApp -> Linked devices -> Link a device\n' +
      '    -> "Link with phone number instead" -> enter the code above.\n' +
      '    A "515 restart required" disconnect right afterwards is normal.\n',
  );
}
