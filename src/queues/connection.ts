import amqp from 'amqplib';
import config from '../config.js';

let conn: amqp.ChannelModel;
let channel: amqp.Channel;

const queue_command = "command_jobs";
const queue_sticker = "sticker_jobs";
const queue_send    = "message_jobs"

export async function getChannel() {
    if(channel) return channel;

    conn    = await amqp.connect(config.RABBIT_CONNECTION_URI);
    channel = await conn.createChannel();

    await channel.assertQueue(queue_sticker, { durable: true });
    await channel.assertQueue(queue_command, { durable: true });
    await channel.assertQueue(queue_send, { durable: true });

    conn.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
    });

    return channel;
}

export async function closeRabbitMQ() {
    try {
        if (channel) {
            await channel.close();
            console.log('RabbitMQ channel closed');
        }
        if (conn) {
            await conn.close();
            console.log('RabbitMQ connection closed');
        }
    } catch (err) {
        console.error('Error during RabbitMQ shutdown:', err);
    }
}

export {queue_command, queue_sticker, queue_send}