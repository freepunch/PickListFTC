/**
 * Generate favicon.ico (32x32) and icon.png (192x192) for PickListFTC.
 * "PL" in bold on dark background with blue accent.
 * No dependencies — raw pixel manipulation + PNG/ICO encoding.
 */

import { writeFileSync } from "fs";
import { deflateSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, "..", "app");

// Colors
const BG = [9, 9, 11]; // #09090b
const FG = [59, 130, 246]; // #3b82f6

// ── Bitmap Font for "PL" ──
// Each letter defined as a grid of 1s (foreground) and 0s (background).
// These are designed to be clear at small sizes.

// P - 5 wide
const P = [
  [1, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
];

// L - 5 wide
const L = [
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
];

/**
 * Render "PL" glyph into an RGBA pixel buffer at given size.
 */
function renderPL(size) {
  const buf = Buffer.alloc(size * size * 4);

  // Fill background
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = BG[0];
    buf[i * 4 + 1] = BG[1];
    buf[i * 4 + 2] = BG[2];
    buf[i * 4 + 3] = 255;
  }

  // Letter grid: P(5) + gap(1) + L(5) = 11 cols, 7 rows
  const gridW = 11;
  const gridH = 7;

  // Add small padding (rounded corners effect at large sizes)
  const pad = Math.max(1, Math.floor(size * 0.12));
  const innerW = size - pad * 2;
  const innerH = size - pad * 2;

  const cellW = innerW / gridW;
  const cellH = innerH / gridH;

  // If size >= 64, draw a subtle rounded-rect background
  if (size >= 64) {
    const r = Math.floor(size * 0.15);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Check if inside rounded rect
        let inside = true;
        // Top-left corner
        if (x < r && y < r) inside = ((x - r) ** 2 + (y - r) ** 2) <= r * r;
        // Top-right corner
        if (x >= size - r && y < r) inside = ((x - (size - r - 1)) ** 2 + (y - r) ** 2) <= r * r;
        // Bottom-left corner
        if (x < r && y >= size - r) inside = ((x - r) ** 2 + (y - (size - r - 1)) ** 2) <= r * r;
        // Bottom-right corner
        if (x >= size - r && y >= size - r) inside = ((x - (size - r - 1)) ** 2 + (y - (size - r - 1)) ** 2) <= r * r;

        if (!inside) {
          buf[(y * size + x) * 4 + 3] = 0; // transparent outside rounded rect
        }
      }
    }
  }

  function setPixel(x, y, r, g, b) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    if (buf[idx + 3] === 0) return; // don't draw on transparent
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = 255;
  }

  // Draw letter grids
  function drawGlyph(glyph, offsetCol) {
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (!glyph[row][col]) continue;
        const gridCol = offsetCol + col;

        const x0 = Math.round(pad + gridCol * cellW);
        const y0 = Math.round(pad + row * cellH);
        const x1 = Math.round(pad + (gridCol + 1) * cellW);
        const y1 = Math.round(pad + (row + 1) * cellH);

        for (let py = y0; py < y1; py++) {
          for (let px = x0; px < x1; px++) {
            setPixel(px, py, FG[0], FG[1], FG[2]);
          }
        }
      }
    }
  }

  drawGlyph(P, 0);
  drawGlyph(L, 6); // 5 (P width) + 1 (gap)

  return buf;
}

/**
 * Encode raw RGBA buffer as PNG.
 */
function encodePNG(rgba, width, height) {
  // Build raw image data with filter byte per row
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter: None
    rgba.copy(row, 1, y * width * 4, (y + 1) * width * 4);
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = deflateSync(raw);

  const chunks = [];

  // Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  function writeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, "ascii");
    const crcData = Buffer.concat([typeB, data]);
    const crc = crc32(crcData);
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc >>> 0);
    chunks.push(len, typeB, data, crcB);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  writeChunk("IHDR", ihdr);

  // IDAT
  writeChunk("IDAT", compressed);

  // IEND
  writeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat(chunks);
}

/**
 * CRC32 for PNG chunks.
 */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Encode a single-image ICO file from RGBA buffer (PNG-compressed).
 */
function encodeICO(pngData, width, height) {
  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count: 1

  // Directory entry: 16 bytes
  const entry = Buffer.alloc(16);
  entry[0] = width >= 256 ? 0 : width; // width (0 = 256)
  entry[1] = height >= 256 ? 0 : height; // height
  entry[2] = 0; // color palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngData.length, 8); // size of image data
  entry.writeUInt32LE(6 + 16, 12); // offset to image data

  return Buffer.concat([header, entry, pngData]);
}

// ── Generate files ──

// favicon.ico — 32x32
const rgba32 = renderPL(32);
const png32 = encodePNG(rgba32, 32, 32);
const ico = encodeICO(png32, 32, 32);
writeFileSync(join(APP_DIR, "favicon.ico"), ico);
console.log("Created app/favicon.ico (32x32)");

// icon.png — 192x192
const rgba192 = renderPL(192);
const png192 = encodePNG(rgba192, 192, 192);
writeFileSync(join(APP_DIR, "icon.png"), png192);
console.log("Created app/icon.png (192x192)");
