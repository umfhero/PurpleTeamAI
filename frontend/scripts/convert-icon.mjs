import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = join(__dirname, '../public');
const srcPath = join(publicDir, 'PT.png');
const pngPath = join(publicDir, 'icon.png');

console.log('Resizing PT.png to icon.png...');

sharp(srcPath)
  .resize(256, 256)
  .png()
  .toFile(pngPath)
  .then(() => {
    console.log('✓ Icon generated successfully: public/icon.png');
  })
  .catch((err) => {
    console.error('Error generating icon:', err);
    process.exit(1);
  });
