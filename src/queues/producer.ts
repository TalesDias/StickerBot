import * as conn from './connection.js';
import { StickerJob, CommandJob, SendJob } from '../types.js';

export async function publishStickerJob(job: StickerJob): Promise<void> {
    try {
        const channel = await conn.getProducerChannel();
        channel.sendToQueue(conn.queue_sticker, Buffer.from(JSON.stringify(job)), {
            persistent: true
        });

        console.log(`Published ${job.messageId} to queue ${conn.queue_sticker}`);
    } catch (error) {
        console.error(`Failed to publish to ${conn.queue_sticker}:`, error);
        throw error;
    }
}

export async function publishCommandJob(job: CommandJob): Promise<void> {
    try {
        const channel = await conn.getProducerChannel();
        channel.sendToQueue(conn.queue_command, Buffer.from(JSON.stringify(job)), {
            persistent: true
        });

        console.log(`Published ${job.messageId} to queue ${conn.queue_command}`);
    } catch (error) {
        console.error(`Failed to publish to ${conn.queue_command}:`, error);
        throw error;
    }
}

export async function publishSendJob(job: SendJob): Promise<void> {
    try {
        const channel = await conn.getProducerChannel();
        channel.sendToQueue(conn.queue_send, Buffer.from(JSON.stringify(job)), {
            persistent: true
        });

        console.log(`Published ${job.messageId} to queue ${conn.queue_send}`);
    } catch (error) {
        console.error(`Failed to publish to ${conn.queue_send}:`, error);
        throw error;
    }
}