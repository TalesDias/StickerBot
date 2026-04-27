import * as conn from '../queues/connection.js';
import { StickerJob } from '../types.js';
import { send_sticker, quote_message } from '../services/sender.js';

export async function registerSenderConsumer() {
    try {
        let channel = await conn.getChannel();
        //TODO
        /*

        console.log(`Consumer started - listening to ${
            conn.queue_sticker}, ${conn.queue_send} and ${conn.queue_command}`);

        channel.consume(conn.queue_sticker, async (msg) => {
            if (!msg) return;

            try {
                const job: StickerJob = JSON.parse(msg.content.toString());
                console.log(`Processing sticker job: ${job.messageId}`);
                
                const base64    = job.base64 ? job.base64 : await download_video(job.messageId)
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

        channel.consume(conn.queue_command, async (msg) => {
            if (!msg) return;

            try {
                const job: CommandJob = JSON.parse(msg.content.toString());
                console.log(`Processing command: ${job.command}`);

                let responseText;

                switch (job.command) {
                    case ".marco":
                        responseText = "polo";
                        break;
                    case ".ajuda":
                        responseText = help_message;
                        break;
                    default:
                        responseText = "🫪";
                }

                await quote_message(job.quotedMessageId, responseText);

                channel?.ack(msg);

            } catch (error) {
                console.error(`Error processing command:`, error);
                // Reject and requeue
                channel?.nack(msg, false, true);
            }
        }, { noAck: false });
        */
    } catch (error) {
        console.error('Failed to start consumer:', error);
    }
}
