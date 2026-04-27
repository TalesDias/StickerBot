import * as conn from '../queues/connection.js';
import { StickerJob, CommandJob } from '../types.js';
import { to_sticker } from '../services/formatter.js';
import { send_sticker, quote_message } from '../services/sender.js';
import { download_video } from '../services/mediaDownloader.js';   

async function startConsumer() {
    try {
        let channel = await conn.getChannel();

        console.log('Consumer started - listening to sticker_jobs and command_jobs');

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

    } catch (error) {
        console.error('Failed to start consumer:', error);
    }
}

const help_message = `*Commandos Gerais*
.ajuda
.marco

*Comandos em Imagens:*
.circulo
.quadrado (padrão)
.arredondado 
.esticado
.original`;

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

export { startConsumer };