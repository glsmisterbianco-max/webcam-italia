// Genera le icone PNG dell'app (puntino bianco su blu) senza dipendenze.
// Uso: node scripts/make-icons.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function icon(size) {
  const blue = [0x1d, 0x6f, 0xe0];
  const rows = [];
  const cx = size / 2;
  const cy = size * 0.42;
  const r = size * 0.2; // testa del segnaposto
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const inHead = dx * dx + dy * dy <= r * r;
      const hole = dx * dx + dy * dy <= (r * 0.42) ** 2;
      // punta: triangolo sotto la testa
      const t = (y + 0.5 - cy) / (size * 0.33);
      const inTip = t > 0 && t < 1 && Math.abs(dx) <= r * (1 - t) * 0.95;
      const white = (inHead || inTip) && !hole;
      const c = white ? [255, 255, 255] : blue;
      c.forEach((v, i) => (row[1 + x * 3 + i] = v));
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = new URL('../public/icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const s of [192, 512]) writeFileSync(new URL(`icon-${s}.png`, dir), icon(s));
console.log('Icone create in public/icons/');
