import * as conn from '../queues/connection.js';
import { SendJob } from '../types.js';
import { send_sticker, quote_message } from '../services/sender.js';

export async function registerSenderConsumer() {
    try {
        let channel = await conn.createConsumerChannel();

        console.log(`Consumer started - listening to ${conn.queue_send}`);

        channel.consume(conn.queue_send, async (msg) => {
            if (!msg) return;

            try {
                const job: SendJob = JSON.parse(msg.content.toString());
                console.log(`Processing send job: ${job.messageId}`);
                
                let result;
                if(job.type === "Sticker"){
                    result = await send_sticker(job.messageId, job.data);
                }
                else{
                    result = await quote_message(job.messageId, job.data)
                }

                if (result === 200) {
                    console.log(`Message sent sent for ${job.messageId}`);
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
