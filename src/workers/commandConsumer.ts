import * as conn from '../queues/connection.js';
import { publishSendJob } from '../queues/producer.js';
import { CommandJob} from '../types.js';


const help_message = `*Commandos Gerais*
.ajuda
.marco

*Comandos em Imagens:*
.circulo
.quadrado (padrão)
.arredondado 
.esticado
.original`;

export async function registerCommandConsumer() {
    try {
        let channel = await conn.createConsumerChannel();

        console.log(`Consumer started - listening to ${conn.queue_command}`);

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

                await publishSendJob({
                    messageId: job.messageId,
                    type: "Text",
                    data: responseText,
                    timestamp: new Date().toISOString()
                });

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
