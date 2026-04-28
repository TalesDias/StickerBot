import amqp from 'amqplib';
import config from '../config.js';

export const queue_command = "command_jobs";
export const queue_sticker = "sticker_jobs";
export const queue_send    = "send_jobs";

const QUEUES = [queue_sticker, queue_command, queue_send];

let connectionPromise: Promise<amqp.ChannelModel> | null = null;
let producerChannelPromise: Promise<amqp.Channel> | null = null;
const consumerChannels: amqp.Channel[] = [];

async function getConnection(): Promise<amqp.ChannelModel> {
    if (!connectionPromise) {
        connectionPromise = amqp.connect(config.RABBIT_CONNECTION_URI).then(conn => {
            console.log("RabbitMQ connection established");
            conn.on('close', () => { 
                connectionPromise = null; 
                producerChannelPromise = null; 
                console.warn("Connection Closed");
            });
            conn.on('error', (err) => { 
                connectionPromise = null; 
                producerChannelPromise = null;
                console.error("Error on the connection: " + err);
            });
            return conn;
        });
    }

    return connectionPromise;
}

async function createChannel(): Promise<amqp.Channel> {
    const conn = await getConnection();
    const ch   = await conn.createChannel();
    await Promise.all(QUEUES.map(q => ch.assertQueue(q, { durable: true })));
    return ch;
}

export async function getProducerChannel(): Promise<amqp.Channel> {
    if (producerChannelPromise) 
        return producerChannelPromise;

    producerChannelPromise = createChannel().then(ch => {
        console.log("Producer Channel Created");

        ch.on('error', (err) => { 
            producerChannelPromise = null; 
            console.error("Producer Channel error: " + err);
        });
        ch.on('close', () => { 
            producerChannelPromise = null; 
            console.warn("Producer Channel closed");
        });
        return ch;
    });

    return producerChannelPromise;
}

export async function createConsumerChannel(): Promise<amqp.Channel> {
    const ch = await createChannel();
    console.log("Consumer Channel Created");

    ch.on('error', (err) => console.error('Consumer channel error:', err));
    ch.on('close', () => console.warn('Consumer channel closed'));
    
    consumerChannels.push(ch);

    return ch;
}

export async function shutdown(): Promise<void> {
    console.log("Shutting down RabbitMQ...");
    await Promise.allSettled(consumerChannels.map(ch => ch.close()));
    if (producerChannelPromise) 
        await (await producerChannelPromise).close().catch(() => {});
    
    if (connectionPromise) 
        await (await connectionPromise).close().catch(() => {});
    
    console.log("RabbitMQ shutdown complete");
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);