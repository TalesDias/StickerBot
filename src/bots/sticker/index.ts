import { registerStickerConsumer } from './consumers/sticker.js';
import { registerCommandConsumer } from './consumers/command.js';

/**
 * The sticker bot. Imports only `contracts` and `shared` — never `baileys` or
 * anything under `gateway/`, so phase 2 can lift it into its own process
 * unchanged.
 */
export async function startStickerBot(): Promise<void> {
  await Promise.all([registerStickerConsumer(), registerCommandConsumer()]);
}
