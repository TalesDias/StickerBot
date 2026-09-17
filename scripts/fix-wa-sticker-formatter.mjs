import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('node_modules/wa-sticker-formatter/dist/internal/crop.js');

if (!fs.existsSync(filePath)) {
  console.log('wa-sticker-formatter is not installed; skipping compatibility patch.');
  process.exit(0);
}

const source = fs.readFileSync(filePath, 'utf8');
const target = "            '-vsync',\n            '0',\n";

if (!source.includes(target)) {
  console.log('wa-sticker-formatter already patched or target option not found.');
  process.exit(0);
}

// ffmpeg 7+ removed -vsync. The option is deleted rather than translated to
// -fps_mode: the same command already pins the rate via the fps=15 filter, and
// deleting it reproduces the state this project has been running against.
const patched = source.replace(target, '');

fs.writeFileSync(filePath, patched);
console.log('Patched wa-sticker-formatter: removed obsolete -vsync 0 ffmpeg option.');
