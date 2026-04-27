import * as conn from './connection.js';
import { StickerJob, CommandJob } from '../types.js';

export async function publishStickerJob(job: StickerJob): Promise<void> {
    try {
        const channel = await conn.getChannel();
        channel.sendToQueue(conn.queue_sticker, Buffer.from(JSON.stringify(job)), {
            persistent: true
        });

        console.log(`Published sticker job: ${job.messageId}`);
    } catch (error) {
        console.error('Failed to publish sticker job:', error);
        throw error;
    }
}

export async function publishCommandJob(job: CommandJob): Promise<void> {
    try {
        const channel = await conn.getChannel();
        channel.sendToQueue(conn.queue_command, Buffer.from(JSON.stringify(job)), {
            persistent: true
        });

        console.log(`Published command job: ${job.command}`);
    } catch (error) {
        console.error('Failed to publish command job:', error);
        throw error;
    }
}