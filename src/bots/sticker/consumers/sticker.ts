import { queue_sticker } from '../../../shared/amqp/connection.js';
import { publishSendJob } from '../../../shared/amqp/producer.js';
import { ENVELOPE_VERSION } from '../../../contracts/envelopes.js';
import { logger } from '../../../shared/logger.js';
import { toSticker } from '../formatter.js';
import { getStickerType } from '../types.js';
import { consumeEnvelopes } from './shared.js';

const log = logger.child({ mod: 'bot.sticker' });

export function registerStickerConsumer() {
  return consumeEnvelopes(queue_sticker, 'bot.sticker', async (job) => {
    const jobLog = log.child({ messageId: job.ref.id });

    if (!job.media || job.media.kind !== 'inline') {
      // Phase 1 drops these; replying "file too large" is deferred (todolist.md).
      jobLog.warn(
        { reason: job.media?.kind === 'rejected' ? job.media.reason : 'no media' },
        'skipping sticker job without usable media',
      );
      return;
    }

    const stickerBase64 = await toSticker(job.media.base64, getStickerType(job.text));

    await publishSendJob({
      v: ENVELOPE_VERSION,
      account: job.account,
      chatJid: job.chatJid,
      replyTo: job.ref,
      payload: { type: 'sticker', base64: stickerBase64 },
      idempotencyKey: `${job.ref.id}:sticker`,
      correlationId: job.ref.id,
      timestamp: new Date().toISOString(),
    });

    jobLog.info('sticker queued for sending');
  });
}
