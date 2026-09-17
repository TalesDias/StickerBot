import amqp from 'amqplib';
import { sharedConfig } from '../config.js';
import { logger } from '../logger.js';
import { onShutdown } from '../lifecycle.js';

const log = logger.child({ mod: 'amqp' });

// Queue names are unchanged from the Evolution-era implementation. Phase 2
// replaces this with a topic exchange and per-chat queues; see todolist.md.
export const queue_command = 'command_jobs';
export const queue_sticker = 'sticker_jobs';
export const queue_send = 'send_jobs';

const QUEUES = [queue_sticker, queue_command, queue_send];

let connectionPromise: Promise<amqp.ChannelModel> | null = null;
let producerChannelPromise: Promise<amqp.Channel> | null = null;
const consumerChannels: amqp.Channel[] = [];

async function getConnection(): Promise<amqp.ChannelModel> {
  if (!connectionPromise) {
    connectionPromise = amqp.connect(sharedConfig.RABBIT_CONNECTION_URI).then((conn) => {
      log.info('RabbitMQ connection established');

      // Clearing the memoized promises re-arms lazy reconnection: the next call
      // that needs a connection builds a fresh one.
      conn.on('close', () => {
        connectionPromise = null;
        producerChannelPromise = null;
        log.warn('RabbitMQ connection closed');
      });
      conn.on('error', (err) => {
        connectionPromise = null;
        producerChannelPromise = null;
        log.error({ err }, 'RabbitMQ connection error');
      });

      return conn;
    });
  }

  return connectionPromise;
}

async function createChannel(): Promise<amqp.Channel> {
  const conn = await getConnection();
  const ch = await conn.createChannel();
  await Promise.all(QUEUES.map((q) => ch.assertQueue(q, { durable: true })));
  return ch;
}

export async function getProducerChannel(): Promise<amqp.Channel> {
  if (producerChannelPromise) return producerChannelPromise;

  producerChannelPromise = createChannel().then((ch) => {
    log.debug('producer channel created');

    ch.on('error', (err) => {
      producerChannelPromise = null;
      log.error({ err }, 'producer channel error');
    });
    ch.on('close', () => {
      producerChannelPromise = null;
      log.warn('producer channel closed');
    });

    return ch;
  });

  return producerChannelPromise;
}

export async function createConsumerChannel(): Promise<amqp.Channel> {
  const ch = await createChannel();
  log.debug('consumer channel created');

  ch.on('error', (err) => log.error({ err }, 'consumer channel error'));
  ch.on('close', () => log.warn('consumer channel closed'));

  consumerChannels.push(ch);

  return ch;
}

export async function closeAmqp(): Promise<void> {
  await Promise.allSettled(consumerChannels.map((ch) => ch.close()));

  if (producerChannelPromise) {
    await (await producerChannelPromise).close().catch(() => {});
  }
  if (connectionPromise) {
    await (await connectionPromise).close().catch(() => {});
  }

  log.info('RabbitMQ shutdown complete');
}

onShutdown('amqp', closeAmqp);
