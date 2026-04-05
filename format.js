import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import {spawn} from 'child_process'
import { readFileSync } from 'fs';

const inputPath = process.argv[2];


async function format() {
    const imageBuffer = readFileSync(inputPath);

    const sticker = new Sticker(imageBuffer, {
      pack: "Figurinhas Selat®",
      author: "BoBot",
      quality: 95,
      type: StickerTypes.ROUNDED
    });

    const buffer = await sticker.toBuffer()

    const stickerPath = "downloads/sticker.webp";
    await sticker.toFile(stickerPath)

    const sender = spawn('python3', ['./send.py', stickerPath])

    sender.stdout.on('data', (data) => {
        console.log(`Python sender: ${data}`);
    });

    sender.stderr.on('data', (data) => {
        console.error(`Python error: ${data}`);
    });

    sender.on('close', (code) => {
        console.log(`send.py finished with code ${code}`);
    });
}

format();