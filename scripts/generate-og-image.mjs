/**
 * Generate og-image.png (1200x630) for PickListFTC.
 * Dark background with "PickListFTC" wordmark and tagline.
 * No dependencies — raw pixel manipulation + PNG encoding.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { deflateSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR);

const W = 1200;
const H = 630;

// Colors
const BG = [9, 9, 11]; // zinc-950
const WHITE = [255, 255, 255];
const ACCENT = [59, 130, 246]; // #3b82f6
const MUTED = [113, 113, 122]; // zinc-500
const CARD_BG = [24, 24, 27]; // zinc-900
const BORDER = [39, 39, 42]; // zinc-800

// ── Bitmap font (5x7 per character, bold style) ──

const FONT = {
  A: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  B: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
  ],
  C: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  D: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
  ],
  E: [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ],
  F: [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
  ],
  G: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,0],
    [1,0,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  H: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  I: [
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [1,1,1,1,1],
  ],
  K: [
    [1,0,0,0,1],
    [1,0,0,1,0],
    [1,0,1,0,0],
    [1,1,0,0,0],
    [1,0,1,0,0],
    [1,0,0,1,0],
    [1,0,0,0,1],
  ],
  L: [
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ],
  M: [
    [1,0,0,0,1],
    [1,1,0,1,1],
    [1,0,1,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  N: [
    [1,0,0,0,1],
    [1,1,0,0,1],
    [1,0,1,0,1],
    [1,0,0,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  O: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  P: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
  ],
  R: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,1,0,0],
    [1,0,0,1,0],
    [1,0,0,0,1],
  ],
  S: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,0],
    [0,1,1,1,0],
    [0,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  T: [
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
  ],
  U: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  V: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,0,1,0],
    [0,1,0,1,0],
    [0,0,1,0,0],
  ],
  W: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,1,0,1],
    [1,1,0,1,1],
    [1,0,0,0,1],
  ],
  Y: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,0,1,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
  ],
  " ": [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
  ],
  "&": [
    [0,1,1,0,0],
    [1,0,0,1,0],
    [1,0,0,1,0],
    [0,1,1,0,0],
    [1,0,1,0,1],
    [1,0,0,1,0],
    [0,1,1,0,1],
  ],
  "2": [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [1,1,1,1,1],
  ],
  "0": [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,1,1],
    [1,0,1,0,1],
    [1,1,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  "5": [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  "-": [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [1,1,1,1,1],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
  ],
  "6": [
    [0,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
};

const buf = Buffer.alloc(W * H * 4);

// Fill background
for (let i = 0; i < W * H; i++) {
  buf[i * 4] = BG[0];
  buf[i * 4 + 1] = BG[1];
  buf[i * 4 + 2] = BG[2];
  buf[i * 4 + 3] = 255;
}

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const idx = (y * W + x) * 4;
  buf[idx] = r;
  buf[idx + 1] = g;
  buf[idx + 2] = b;
  buf[idx + 3] = a;
}

function fillRect(x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      setPixel(x, y, color[0], color[1], color[2]);
    }
  }
}

function drawText(text, startX, startY, scale, color) {
  const chars = text.toUpperCase().split("");
  let cursorX = startX;

  for (const ch of chars) {
    const glyph = FONT[ch];
    if (!glyph) {
      cursorX += 3 * scale; // unknown char = small space
      continue;
    }

    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (!glyph[row][col]) continue;
        fillRect(
          cursorX + col * scale,
          startY + row * scale,
          scale,
          scale,
          color
        );
      }
    }
    cursorX += 6 * scale; // 5 cols + 1 spacing
  }

  return cursorX - startX; // total width drawn
}

function measureText(text, scale) {
  const chars = text.toUpperCase().split("");
  let w = 0;
  for (const ch of chars) {
    const glyph = FONT[ch];
    if (!glyph) {
      w += 3 * scale;
    } else {
      w += 6 * scale;
    }
  }
  return w - scale; // subtract trailing gap
}

// Draw a subtle border around the whole image
fillRect(0, 0, W, 1, BORDER);
fillRect(0, H - 1, W, 1, BORDER);
fillRect(0, 0, 1, H, BORDER);
fillRect(W - 1, 0, 1, H, BORDER);

// ── Wordmark: "PickList" in white, "FTC" in accent ──
const wordScale = 8;
const word1 = "PickList";
const word2 = "FTC";
const w1 = measureText(word1, wordScale);
const w2 = measureText(word2, wordScale);
const totalWordW = w1 + wordScale + w2; // gap = 1 scale unit
const wordX = Math.round((W - totalWordW) / 2);
const wordY = 200;

drawText(word1, wordX, wordY, wordScale, WHITE);
drawText(word2, wordX + w1 + wordScale, wordY, wordScale, ACCENT);

// ── Tagline ──
const tagline = "Scouting & Alliance Selection for FTC";
const tagScale = 3;
const tagW = measureText(tagline, tagScale);
const tagX = Math.round((W - tagW) / 2);
const tagY = wordY + 7 * wordScale + 40;
drawText(tagline, tagX, tagY, tagScale, MUTED);

// ── Season line ──
const season = "DECODE 2025-2026";
const sScale = 2;
const sW = measureText(season, sScale);
const sX = Math.round((W - sW) / 2);
const sY = tagY + 7 * tagScale + 30;
drawText(season, sX, sY, sScale, BORDER);

// ── Accent line under wordmark ──
const lineW = 120;
const lineX = Math.round((W - lineW) / 2);
const lineY = wordY + 7 * wordScale + 16;
fillRect(lineX, lineY, lineW, 3, ACCENT);

// ── Encode PNG ──
function encodePNG(rgba, width, height) {
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    rgba.copy(row, 1, y * width * 4, (y + 1) * width * 4);
    rawRows.push(row);
  }
  const compressed = deflateSync(Buffer.concat(rawRows), { level: 9 });
  const chunks = [];

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

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeChunk("IHDR", ihdr);
  writeChunk("IDAT", compressed);
  writeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat(chunks);
}

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

function crc32(b) {
  let crc = 0xffffffff;
  for (let i = 0; i < b.length; i++) {
    crc = crcTable[(crc ^ b[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const png = encodePNG(buf, W, H);
writeFileSync(join(PUBLIC_DIR, "og-image.png"), png);
console.log("Created public/og-image.png (1200x630)");
