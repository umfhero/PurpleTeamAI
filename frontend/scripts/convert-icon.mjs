import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = join(__dirname, '../public');
const svgPath = join(publicDir, 'icon.svg');
const pngPath = join(publicDir, 'icon.png');

console.log('Converting icon.svg to icon.png...');

sharp(svgPath)
  .resize(256, 256)
  .png()
  .toFile(pngPath)
  .then(() => {
    console.log('✓ Icon converted successfully: public/icon.png');
  })
  .catch((err) => {
    console.error('Error converting icon:', err);
    process.exit(1);
  });
