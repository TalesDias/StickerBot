import type { WASocket, WAMessage } from 'baileys';
import { gatewayConfig } from './config.js';
import { classify, extractText, toInboundEnvelope } from './wa/normalize.js';
import { downloadMedia } from './wa/download.js';
import { publishCommandJob, publishStickerJob } from '../shared/amqp/producer.js';
import { logger } from '../shared/logger.js';

const log = logger.child({ mod: 'inbound' });

const allowed = new Set(gatewayConfig.PUBLISHED_GROUPS);

export function registerInbound(sock: WASocket): void {
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    // 'append' is history sync. Without this guard every reconnect replays old
    // messages and the bot re-answers them.
    if (type !== 'notify') {
      log.debug({ type, count: messages.length }, 'ignoring non-notify upsert');
      return;
    }

    for (const msg of messages) {
      void handle(sock, msg).catch((err) =>
        log.error({ err, id: msg.key?.id }, 'failed to handle inbound message'),
      );
    }
  });

  log.info(
    { chats: gatewayConfig.PUBLISHED_GROUPS.length },
    'listening for messages',
  );
}

async function handle(sock: WASocket, msg: WAMessage): Promise<void> {
  const id = msg.key?.id;
  const chatJid = msg.key?.remoteJid;

  if (!id || !chatJid) return;

  // The bot's own stickers come back through messages.upsert; without this it
  // reacts to itself.
  if (msg.key.fromMe) return;

  // Baileys delivers every message on the account. Everything outside the
  // allowlist is dropped here, at debug level, and goes no further.
  if (!allowed.has(chatJid)) {
    log.debug({ chatJid }, 'chat not in PUBLISHED_GROUPS, dropping');
    return;
  }

  const jobLog = log.child({ messageId: id, chatJid });
  const kind = classify(msg);

  if (kind === 'image' || kind === 'video') {
    const media = await downloadMedia(sock, msg, kind);
    jobLog.info({ kind, media: media?.kind }, 'publishing sticker job');
    await publishStickerJob(toInboundEnvelope(msg, kind, media));
    return;
  }

  const text = extractText(msg);

  // Phase 1 keeps the command filter here, matching the behavior the Evolution
  // webhook had. Phase 2 moves it into the consumer so the gateway stays
  // bot-agnostic; the consumer already re-checks, so that change is a no-op.
  if (kind === 'text' && text?.startsWith('.')) {
    jobLog.info({ command: text }, 'publishing command job');
    await publishCommandJob(toInboundEnvelope(msg, kind));
    return;
  }

  jobLog.debug({ kind }, 'nothing to do for this message');
}
