import { queue_command } from '../../../shared/amqp/connection.js';
import { publishSendJob } from '../../../shared/amqp/producer.js';
import { ENVELOPE_VERSION } from '../../../contracts/envelopes.js';
import { logger } from '../../../shared/logger.js';
import { HELP_MESSAGE } from '../types.js';
import { consumeEnvelopes } from './shared.js';

const log = logger.child({ mod: 'bot.command' });

export function registerCommandConsumer() {
  return consumeEnvelopes(queue_command, 'bot.command', async (job) => {
    const command = job.text?.trim().toLowerCase();

    // Re-checked here even though the gateway already filters. In phase 2 the
    // gateway publishes all text and this becomes the only guard — without it
    // the default branch below answers every message in the chat.
    if (!command?.startsWith('.')) {
      log.debug({ messageId: job.ref.id }, 'not a command, ignoring');
      return;
    }

    let responseText: string;
    switch (command) {
      case '.marco':
        responseText = 'polo';
        break;
      case '.ajuda':
        responseText = HELP_MESSAGE;
        break;
      default:
        responseText = '🫪';
    }

    await publishSendJob({
      v: ENVELOPE_VERSION,
      account: job.account,
      chatJid: job.chatJid,
      replyTo: job.ref,
      payload: { type: 'text', text: responseText },
      idempotencyKey: `${job.ref.id}:command`,
      correlationId: job.ref.id,
      timestamp: new Date().toISOString(),
    });

    log.info({ messageId: job.ref.id, command }, 'reply queued for sending');
  });
}
