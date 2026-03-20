import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const logo = join(root, 'public', 'logo-progressistas.png');

// Brand colors
const DARK_NAVY = '#003560';
const LIGHT_BLUE = '#89B8DC';

async function main() {
  // 1. favicon.ico (32x32) — resize logo to fit in a square with navy background
  const favicon32 = await sharp(logo)
    .resize(28, 28, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const faviconComposed = await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 53, b: 96, alpha: 255 } }
  })
    .composite([{ input: favicon32, gravity: 'centre' }])
    .png()
    .toFile(join(root, 'src', 'app', 'favicon.png'));

  // For .ico, just use a PNG renamed — browsers accept it
  const faviconBuf = await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 53, b: 96, alpha: 255 } }
  })
    .composite([{ input: favicon32, gravity: 'centre' }])
    .png()
    .toBuffer();
  writeFileSync(join(root, 'src', 'app', 'favicon.ico'), faviconBuf);

  // 2. icon-192.png
  const icon192Inner = await sharp(logo)
    .resize(160, 160, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 192, height: 192, channels: 4, background: { r: 0, g: 53, b: 96, alpha: 255 } }
  })
    .composite([{ input: icon192Inner, gravity: 'centre' }])
    .png()
    .toFile(join(root, 'public', 'icon-192.png'));

  // 3. icon-512.png
  const icon512Inner = await sharp(logo)
    .resize(420, 420, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 53, b: 96, alpha: 255 } }
  })
    .composite([{ input: icon512Inner, gravity: 'centre' }])
    .png()
    .toFile(join(root, 'public', 'icon-512.png'));

  // 4. apple-touch-icon.png (180x180)
  const appleInner = await sharp(logo)
    .resize(150, 150, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 180, height: 180, channels: 4, background: { r: 0, g: 53, b: 96, alpha: 255 } }
  })
    .composite([{ input: appleInner, gravity: 'centre' }])
    .png()
    .toFile(join(root, 'public', 'apple-touch-icon.png'));

  // 5. og-image.png (1200x630) — for WhatsApp/social sharing
  const ogLogo = await sharp(logo)
    .resize(500, 310, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Create SVG text overlay for "Progressistas"
  const textSvg = Buffer.from(`
    <svg width="1200" height="630">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700');
      </style>
      <text x="600" y="520" text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700"
            fill="white" letter-spacing="2">
        Progressistas
      </text>
      <text x="600" y="570" text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400"
            fill="#89B8DC">
        Grave seu depoimento
      </text>
    </svg>
  `);

  await sharp({
    create: { width: 1200, height: 630, channels: 4, background: { r: 0, g: 53, b: 96, alpha: 255 } }
  })
    .composite([
      { input: ogLogo, gravity: 'north', top: 80, left: 350 },
      { input: textSvg, gravity: 'northwest', top: 0, left: 0 },
    ])
    .png()
    .toFile(join(root, 'public', 'og-image.png'));

  console.log('✅ All icons and OG image generated!');
}

main().catch(console.error);
