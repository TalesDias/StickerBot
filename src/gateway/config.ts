import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { loadEnv } from '../shared/env.js';

const csv = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const gatewaySchema = z.object({
  /** Where Signal credentials and pre-keys live. Never inside the repo. */
  WA_AUTH_DIR: z
    .string()
    .min(1, 'required (e.g. ~/.local/share/stickerbot/auth)')
    .transform((dir) =>
      dir.startsWith('~') ? path.join(os.homedir(), dir.slice(1)) : dir,
    )
    .transform((dir) => path.resolve(dir)),

  /** E.164, digits only. Used for the headless pairing-code flow. */
  WA_PAIRING_NUMBER: z
    .string()
    .regex(/^\d{8,15}$/, 'E.164 digits only — no +, spaces, parentheses or dashes'),

  WA_ACCOUNT: z.string().default('default'),

  /**
   * Chats the gateway is allowed to publish from. Baileys delivers every message
   * on the account; Evolution's webhook config used to filter this server-side.
   * This is both the log-noise fix and the privacy boundary.
   */
  PUBLISHED_GROUPS: z
    .string()
    .min(1, 'required — at least one chat JID, comma separated')
    .transform(csv),

  /** Media above this is skipped without downloading. base64 inflates it by 4/3. */
  MAX_MEDIA_SIZE_KB: z.coerce.number().int().positive().default(3000),
});

export const gatewayConfig = loadEnv('gateway', gatewaySchema);
