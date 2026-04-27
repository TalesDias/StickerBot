import * as conn from '../queues/connection.js';
import { StickerJob } from '../types.js';
import { to_sticker } from '../services/formatter.js';
import { send_sticker } from '../services/sender.js';
import { download_video } from '../services/mediaDownloader.js';   

export async function registerStickerConsumer() {
    try {
        let channel = await conn.getChannel();

        console.log(`Consumer started - listening to ${conn.queue_sticker}`);

        channel.consume(conn.queue_sticker, async (msg) => {
            if (!msg) return;

            try {
                const job: StickerJob = JSON.parse(msg.content.toString());
                console.log(`Processing sticker job: ${job.messageId}`);
                
                const base64    = job.base64 ? job.base64 : await download_video(job.messageId);
                const sticker64 = await to_sticker(base64, getStickerType(job.caption));
                const result    = await send_sticker(job.quotedMessageId, sticker64);

                if (result === 200) {
                    console.log(`Sticker processed and sent for ${job.messageId}`);
                }

                channel?.ack(msg);

            } catch (error) {
                console.error(`Error processing sticker ${msg.content.toString()}:`, error);
                // Reject and requeue 
                channel?.nack(msg, false, true);
            }
        }, { noAck: false });

    } catch (error) {
        console.error('Failed to start consumer:', error);
    }
}


function getStickerType(caption?: string): string {
    if (!caption?.startsWith('.')) return "crop";

    switch (caption.toLowerCase()) {
        case ".circulo":    return 'circle';
        case ".quadrado":   return 'crop';
        case ".arredondado": return 'rounded';
        case ".esticado":   return 'default';
        case ".original":   return 'full';
        default:            return 'crop';
    }
}
