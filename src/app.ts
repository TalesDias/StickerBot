import express from 'express';
import { Request, Response} from 'express';

import { publishStickerJob, publishCommandJob } from './queues/producer.js';
import config from './config.js';
import { startConsumer } from './workers/consumer.js'; 
import { WebhookPayload } from './types.js';
import { closeRabbitMQ } from './queues/connection.js';

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_, res: Response) => {
  res.json({ status: 'ok', message: 'Sticker Bot is running' });
});

app.post("/webhook/messages-upsert", async (req: Request, res: Response) => {
    try {
        const payload: WebhookPayload = req.body;
        const data = payload.data;

        if (!data?.key?.id || !data.key.remoteJid) {
            res.sendStatus(200);
            return;
        }

        const msgId = data.key.id;
        const jid   = data.key.remoteJid;

        if (jid !== config.STICKER_GROUP) {
            res.sendStatus(200);
            return;
        }

        if (data.key.fromMe) {
            res.sendStatus(200);
            return;
        }

        if (data.messageType === 'imageMessage' || data.messageType === 'videoMessage') {
            console.log(`[Webhook] New ${data.messageType} received - ID: ${msgId}`);

            await publishStickerJob({
                messageId: msgId,
                from: jid,
                quotedMessageId: msgId,
                base64:  data.message?.base64,
                caption: data.message?.imageMessage?.caption || data.message?.videoMessage?.caption,
                timestamp: new Date().toISOString()
            });
        } 
        else if (data.message?.conversation?.startsWith('.')) {
            console.log(`[Webhook] Command received: ${data.message.conversation}`);

            await publishCommandJob({
                messageId: msgId,
                from: jid,
                quotedMessageId: msgId,
                command: data.message.conversation.trim().toLowerCase(),
                timestamp: new Date().toISOString()
            });
        } 
        else {
            console.log(`[Webhook] Ignoring normal message`);
        }

        res.sendStatus(200);

    } catch (error) {
        console.error('[Webhook] An error occurred:', error);
        res.sendStatus(200);
    }
});


const PORT = 3001;
app.listen(PORT, () => {
    startConsumer();
    console.log(`Sticker Bot started on port ${PORT}`);
    console.log(`Webhook listening at /webhook/messages-upsert`);
});


let isShuttingDown = false;

// Shutdown cleanly
const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\nReceived ${signal} signal. Closing consumers...`);

    await closeRabbitMQ();

    console.log('Shutdown complete');
    process.exit(0);
};

process.on('SIGTERM', () => shutdown("SIGTERM"));
process.on('SIGINT', () => shutdown("SIGINT"));
