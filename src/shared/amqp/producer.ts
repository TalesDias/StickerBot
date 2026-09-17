import * as conn from './connection.js';
import { logger } from '../logger.js';
import type { InboundEnvelope, OutboundEnvelope } from '../../contracts/envelopes.js';

const log = logger.child({ mod: 'amqp.producer' });

async function publish(queue: string, body: unknown, correlationId: string): Promise<void> {
  try {
    const channel = await conn.getProducerChannel();
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(body)), {
      persistent: true,
      contentType: 'application/json',
      correlationId,
    });
    log.debug({ queue, correlationId }, 'published');
  } catch (err) {
    log.error({ err, queue, correlationId }, 'failed to publish');
    throw err;
  }
}

export function publishStickerJob(job: InboundEnvelope): Promise<void> {
  return publish(conn.queue_sticker, job, job.ref.id);
}

export function publishCommandJob(job: InboundEnvelope): Promise<void> {
  return publish(conn.queue_command, job, job.ref.id);
}

export function publishSendJob(job: OutboundEnvelope): Promise<void> {
  return publish(conn.queue_send, job, job.correlationId);
}
