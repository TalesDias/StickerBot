import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('node_modules/wa-sticker-formatter/dist/internal/crop.js');

if (!fs.existsSync(filePath)) {
  console.log('wa-sticker-formatter is not installed; skipping compatibility patch.');
  process.exit(0);
}

const source = fs.readFileSync(filePath, 'utf8');
const target = "            '-vsync',\n            '0',\n";
const patched = source.replace(target, '-fps_mode');

if (patched === source) {
  console.log('wa-sticker-formatter already patched or target option not found.');
  process.exit(0);
}

fs.writeFileSync(filePath, patched);
console.log('Patched wa-sticker-formatter: removed obsolete -vsync 0 ffmpeg option.');
