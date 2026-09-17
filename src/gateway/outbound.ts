import type { Channel } from 'amqplib';
import { createConsumerChannel, queue_send } from '../shared/amqp/connection.js';
import type { OutboundEnvelope } from '../contracts/envelopes.js';
import { logger } from '../shared/logger.js';
import { getSocket, onStateChange } from './wa/socket.js';
import { send } from './wa/send.js';

const log = logger.child({ mod: 'outbound' });

let channel: Channel | null = null;
let consumerTag: string | null = null;

/**
 * Drains the send queue, but only while the socket is open.
 *
 * Consumption is started on 'open' and cancelled on 'close' rather than nacking
 * while disconnected: unacked jobs simply stay durable in the queue and drain
 * when the connection returns. prefetch(1) keeps sends serial, so a reconnect
 * can strand at most one in-flight message.
 */
export function registerOutbound(): void {
  onStateChange((state) => {
    if (state === 'open') void start();
    else void stop();
  });
}

async function start(): Promise<void> {
  if (consumerTag) return;

  try {
    channel ??= await createConsumerChannel();
    await channel.prefetch(1);

    const { consumerTag: tag } = await channel.consume(
      queue_send,
      (msg) => {
        if (!msg) return;

        void (async () => {
          const sock = getSocket();
          if (!sock) {
            // Lost the socket between delivery and handling: requeue so it is
            // retried once the connection is back.
            channel?.nack(msg, false, true);
            return;
          }

          try {
            const job = JSON.parse(msg.content.toString()) as OutboundEnvelope;
            await send(sock, job);
            channel?.ack(msg);
          } catch (err) {
            log.error(
              { err, body: msg.content.toString().slice(0, 300) },
              'failed to send, dropping',
            );
            channel?.nack(msg, false, false);
          }
        })();
      },
      { noAck: false },
    );

    consumerTag = tag;
    log.info({ queue: queue_send }, 'outbound consumer started');
  } catch (err) {
    log.error({ err }, 'failed to start outbound consumer');
  }
}

async function stop(): Promise<void> {
  if (!consumerTag || !channel) return;

  const tag = consumerTag;
  consumerTag = null;

  await channel.cancel(tag).catch(() => {});
  log.info('outbound consumer paused (socket not open)');
}
