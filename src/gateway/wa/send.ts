import type { AnyMessageContent, WASocket, proto } from 'baileys';
import type { OutboundEnvelope } from '../../contracts/envelopes.js';
import { logger } from '../../shared/logger.js';

const log = logger.child({ mod: 'wa.send' });

function toContent(job: OutboundEnvelope): AnyMessageContent {
  if (job.payload.type === 'sticker') {
    return { sticker: Buffer.from(job.payload.base64, 'base64') };
  }
  return { text: job.payload.text };
}

export async function send(sock: WASocket, job: OutboundEnvelope): Promise<void> {
  // Quoting needs the message content, not just its key: `quoteStub` is the
  // original node with thumbnails stripped. The key is passed back exactly as
  // received — an `@lid` participant must not be rewritten or the quote breaks.
  const quoted = job.replyTo
    ? ({
        key: {
          id: job.replyTo.id,
          remoteJid: job.replyTo.remoteJid,
          fromMe: job.replyTo.fromMe,
          ...(job.replyTo.participant ? { participant: job.replyTo.participant } : {}),
        },
        message: job.replyTo.quoteStub ?? {},
      } as proto.IWebMessageInfo)
    : undefined;

  await sock.sendMessage(job.chatJid, toContent(job), quoted ? { quoted } : {});

  log.info(
    { correlationId: job.correlationId, type: job.payload.type, chatJid: job.chatJid },
    'sent',
  );
}
