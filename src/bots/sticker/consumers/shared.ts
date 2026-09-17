import type { Channel, ConsumeMessage } from 'amqplib';
import { createConsumerChannel } from '../../../shared/amqp/connection.js';
import { logger } from '../../../shared/logger.js';
import type { InboundEnvelope } from '../../../contracts/envelopes.js';

/**
 * Consumes JSON envelopes off a queue.
 *
 * Failure handling differs deliberately from the code this replaces. The old
 * consumers used `nack(msg, false, true)` for every error, so a message that can
 * never succeed requeues forever, pinning a core and blocking the queue behind
 * it. New code should not reintroduce that, so a failed message is logged with
 * its body and dropped. Capturing them in a dead-letter queue instead is tracked
 * in todolist.md.
 */
export async function consumeEnvelopes(
  queue: string,
  mod: string,
  handler: (job: InboundEnvelope) => Promise<void>,
): Promise<Channel> {
  const log = logger.child({ mod });
  const channel = await createConsumerChannel();

  await channel.prefetch(1);

  await channel.consume(
    queue,
    (msg: ConsumeMessage | null) => {
      if (!msg) return;

      void (async () => {
        try {
          const job = JSON.parse(msg.content.toString()) as InboundEnvelope;
          await handler(job);
          channel.ack(msg);
        } catch (err) {
          log.error(
            { err, body: msg.content.toString().slice(0, 500) },
            'dropping message that could not be processed',
          );
          channel.nack(msg, false, false);
        }
      })();
    },
    { noAck: false },
  );

  log.info({ queue }, 'consumer started');

  return channel;
}
