import { Buffer } from 'buffer';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { stickerConfig } from './config.js';

export async function toSticker(
  imageBase64: string,
  stickerType: string = StickerTypes.CROPPED,
): Promise<string> {
  const imgBuffer = Buffer.from(imageBase64, 'base64');

  const sticker = new Sticker(imgBuffer, {
    pack: stickerConfig.STICKER_PACK,
    author: stickerConfig.STICKER_AUTHOR,
    quality: stickerConfig.STICKER_QUALITY,
    type: stickerType,
  });

  const stickerBuffer = await sticker.toBuffer();

  return stickerBuffer.toString('base64');
}
