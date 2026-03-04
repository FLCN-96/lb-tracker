/**
 * Icon generation helper (run once, requires `sharp`).
 *   npm install --save-dev sharp
 *   node scripts/gen-icons.mjs
 *
 * Generates icon-192.png and icon-512.png from public/icons/icon.svg.
 */
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(__dirname, '../public/icons/icon.svg')
const out = path.resolve(__dirname, '../public/icons')

for (const size of [192, 512]) {
  await sharp(src)
    .resize(size, size)
    .png()
    .toFile(path.join(out, `icon-${size}.png`))
  console.log(`✓ icon-${size}.png`)
}
