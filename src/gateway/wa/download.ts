import { downloadMediaMessage, type WASocket, type WAMessage } from 'baileys';
import type { InboundKind, InboundMedia } from '../../contracts/envelopes.js';
import { gatewayConfig } from '../config.js';
import { logger } from '../../shared/logger.js';

const log = logger.child({ mod: 'wa.download' });

/** protobufjs represents int64 as a Long object, not a number. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return 0;
}

function mediaNode(msg: WAMessage, kind: InboundKind) {
  if (kind === 'image') return msg.message?.imageMessage;
  if (kind === 'video') return msg.message?.videoMessage;
  return undefined;
}

/**
 * Downloads media into the envelope, in the gateway, at receipt time.
 *
 * It happens here rather than in the bot for two reasons: only the gateway holds
 * a socket (and the reupload fallback needs `sock.updateMediaMessage`), and
 * WhatsApp media URLs expire — receipt is the highest-success moment.
 *
 * Note this changes video behavior. Under Evolution, images arrived base64 in the
 * webhook while videos were fetched lazily by the worker; that is impossible now,
 * so both are fetched eagerly here.
 */
export async function downloadMedia(
  sock: WASocket,
  msg: WAMessage,
  kind: InboundKind,
): Promise<InboundMedia | undefined> {
  const node = mediaNode(msg, kind);
  if (!node) return undefined;

  const mimetype = node.mimetype ?? 'application/octet-stream';
  const bytes = toNumber(node.fileLength);
  const limit = gatewayConfig.MAX_MEDIA_SIZE_KB * 1024;

  // Checked before downloading, so an oversized file never touches the network
  // or memory. The user-facing "too large" reply is deferred (see todolist.md).
  if (bytes > limit) {
    log.warn({ bytes, limit, mimetype }, 'media exceeds size limit, not downloading');
    return { kind: 'rejected', mimetype, bytes, reason: 'too_large' };
  }

  try {
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { logger: log, reuploadRequest: sock.updateMediaMessage },
    );

    return {
      kind: 'inline',
      mimetype,
      bytes: buffer.length,
      base64: buffer.toString('base64'),
    };
  } catch (err) {
    log.error({ err, mimetype, bytes }, 'media download failed');
    return { kind: 'rejected', mimetype, bytes, reason: 'download_failed' };
  }
}
