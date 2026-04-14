import { Sticker } from 'wa-sticker-formatter';
import {Buffer} from 'buffer';

async function to_sticker(image_base64, sticker_type = 'rounded') {
    const img_buffer = Buffer.from(image_base64, 'base64');

    const sticker = new Sticker(img_buffer, {
      pack: "Figurinhas Selat®",
      author: "BoBot",
      quality: 95,
      type: sticker_type
    });

    const sticker_buffer = await sticker.toBuffer();

    return sticker_buffer.toString('base64');
}

export {to_sticker};