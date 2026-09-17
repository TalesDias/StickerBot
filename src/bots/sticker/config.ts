import { z } from 'zod';
import { loadEnv } from '../../shared/env.js';

const stickerSchema = z.object({
  STICKER_PACK: z.string().default('Figurinhas Selat®'),
  STICKER_AUTHOR: z.string().default('BoBot'),
  STICKER_QUALITY: z.coerce.number().int().min(1).max(100).default(20),
});

export const stickerConfig = loadEnv('sticker bot', stickerSchema);
