import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import {Buffer} from 'buffer';

async function to_sticker(image_base64) {
    const img_buffer = Buffer.from(image_base64, 'base64');

    const sticker = new Sticker(img_buffer, {
      pack: "Figurinhas Selat®",
      author: "BoBot",
      quality: 95,
      type: StickerTypes.ROUNDED
    });

    const sticker_buffer = await sticker.toBuffer();

    return sticker_buffer.toString('base64');
}

export {to_sticker};