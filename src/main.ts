// Must be first: the logger and every config schema read process.env at import time.
import 'dotenv/config';

import { logger } from './shared/logger.js';
import { installSignalHandlers } from './shared/lifecycle.js';
import { startSocket } from './gateway/wa/socket.js';
import { registerInbound } from './gateway/inbound.js';
import { registerOutbound } from './gateway/outbound.js';
import { startStickerBot } from './bots/sticker/index.js';

const log = logger.child({ mod: 'main' });

async function main(): Promise<void> {
  installSignalHandlers();

  // Phase 1 runs the gateway and the sticker bot in one process. They still
  // communicate only over RabbitMQ, so phase 2 splits this file in two rather
  // than rewriting either side.
  await startStickerBot();

  registerOutbound();
  await startSocket(registerInbound);

  log.info('stickerbot started');
}

main().catch((err) => {
  log.fatal({ err }, 'failed to start');
  process.exit(1);
});
