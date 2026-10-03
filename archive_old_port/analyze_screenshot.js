// analyze_screenshot.js — decode opening_room.png and report what's in it.
// Pure Node, no external deps. Handles 8-bit RGB / RGBA PNGs only.

const fs = require('fs');
const zlib = require('zlib');

const FILE = './screenshots/opening_room.png';
const buf = fs.readFileSync(FILE);

if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
  console.error('Not a PNG'); process.exit(1);
}

let off = 8;
let width = 0, height = 0, bitDepth = 0, colorType = 0;
const idatChunks = [];

while (off < buf.length) {
  const len = buf.readUInt32BE(off); off += 4;
  const type = buf.slice(off, off + 4).toString('ascii'); off += 4;
  const data = buf.slice(off, off + len); off += len;
  off += 4; // skip CRC
  if (type === 'IHDR') {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data.readUInt8(8);
    colorType = data.readUInt8(9);
  } else if (type === 'IDAT') {
    idatChunks.push(data);
  } else if (type === 'IEND') break;
}

const channels = colorType === 6 ? 4 : (colorType === 2 ? 3 : 0);
if (channels === 0) { console.error('Unsupported color type:', colorType); process.exit(1); }
if (bitDepth !== 8) { console.error('Unsupported bit depth:', bitDepth); process.exit(1); }

const raw = zlib.inflateSync(Buffer.concat(idatChunks));
const stride = width * channels;
const pixels = Buffer.alloc(stride * height);

// Reverse PNG filters
let src = 0;
for (let y = 0; y < height; y++) {
  const filter = raw[src++];
  for (let x = 0; x < stride; x++) {
    const cur = raw[src++];
    const left = x >= channels ? pixels[y*stride + x - channels] : 0;
    const up = y > 0 ? pixels[(y-1)*stride + x] : 0;
    const upLeft = (x >= channels && y > 0) ? pixels[(y-1)*stride + x - channels] : 0;
    let v;
    if (filter === 0) v = cur;
    else if (filter === 1) v = (cur + left) & 0xff;
    else if (filter === 2) v = (cur + up) & 0xff;
    else if (filter === 3) v = (cur + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) {
      const p = left + up - upLeft;
      const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
      const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      v = (cur + pred) & 0xff;
    } else { v = cur; }
    pixels[y*stride + x] = v;
  }
}

const at = (x, y) => {
  const i = (y * width + x) * channels;
  return [pixels[i], pixels[i+1], pixels[i+2]];
};

// Classify a pixel
const classify = ([r, g, b]) => {
  const y = 0.299*r + 0.587*g + 0.114*b;
  if (r > 220 && g > 220 && b > 220) return 'W'; // bright white
  if (r < 50 && g < 50 && b < 50) return 'K'; // black
  if (r > 200 && g > 140 && g < 200 && b < 80) return 'Y'; // yellow
  if (r > 160 && g > 160 && b > 140) return '.'; // background gray
  if (r > 100 && g < 80 && b < 80) return 'R'; // red
  if (b > 150 && r < 120 && g < 120) return 'B'; // blue
  return '?';
};

// Sample a downscaled grid
const COLS = 80, ROWS = 45;
const cellW = width / COLS, cellH = height / ROWS;
const grid = [];
for (let row = 0; row < ROWS; row++) {
  let line = '';
  for (let col = 0; col < COLS; col++) {
    const x = Math.floor((col + 0.5) * cellW);
    const y = Math.floor((row + 0.5) * cellH);
    line += classify(at(Math.min(x, width-1), Math.min(y, height-1)));
  }
  grid.push(line);
}

// Color statistics
const stats = { W:0, K:0, Y:0, '.':0, R:0, B:0, '?':0 };
let totalSamples = 0;
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const ch = grid[row][col];
    stats[ch] = (stats[ch] || 0) + 1;
    totalSamples++;
  }
}

console.log(`File:        ${FILE}`);
console.log(`Dimensions:  ${width} x ${height}`);
console.log(`Channels:    ${channels} (colorType ${colorType})`);
console.log(`Sampled:     ${COLS} x ${ROWS} grid (${totalSamples} cells)`);
console.log('');
console.log('=== Color distribution (% of sampled cells) ===');
for (const k of Object.keys(stats)) {
  const pct = (100 * stats[k] / totalSamples).toFixed(1);
  console.log(`  ${k === '.' ? '· (background gray)' : k}: ${pct}%  (${stats[k]} cells)`);
}
console.log('');
console.log('=== Legend ===');
console.log('  Y = yellow (castle / key)');
console.log('  W = white (player)');
console.log('  K = black (walls / portcullis)');
console.log('  · = background gray');
console.log('  R = red, B = blue, ? = other');
console.log('');
console.log(`=== ASCII map (${COLS} cols × ${ROWS} rows) ===`);
for (const line of grid) console.log(line);

// Find bounding box of yellow pixels
let yMin = ROWS, yMax = -1, xMin = COLS, xMax = -1, yCount = 0;
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    if (grid[row][col] === 'Y') {
      yCount++;
      if (row < yMin) yMin = row;
      if (row > yMax) yMax = row;
      if (col < xMin) xMin = col;
      if (col > xMax) xMax = col;
    }
  }
}
if (yCount > 0) {
  const realX = (x => Math.round(x * cellW));
  const realY = (y => Math.round(y * cellH));
  console.log('');
  console.log('=== Yellow regions (likely castle + key) ===');
  console.log(`  Yellow pixel count: ${yCount} of ${totalSamples} sampled cells`);
  console.log(`  Bounding box in image: x=[${realX(xMin)}, ${realX(xMax+1)}], y=[${realY(yMin)}, ${realY(yMax+1)}]`);
  console.log(`  In grid coords:        x=[${xMin}, ${xMax}], y=[${yMin}, ${yMax}]`);
}

// Find bounding box of black pixels
let kMin = ROWS, kMax = -1, kxMin = COLS, kxMax = -1, kCount = 0;
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    if (grid[row][col] === 'K') {
      kCount++;
      if (row < kMin) kMin = row;
      if (row > kMax) kMax = row;
      if (col < kxMin) kxMin = col;
      if (col > kxMax) kxMax = col;
    }
  }
}
if (kCount > 0) {
  const realX = (x => Math.round(x * cellW));
  const realY = (y => Math.round(y * cellH));
  console.log('');
  console.log('=== Black regions (walls + portcullis) ===');
  console.log(`  Black pixel count: ${kCount} of ${totalSamples} sampled cells`);
  console.log(`  Bounding box in image: x=[${realX(kxMin)}, ${realX(kxMax+1)}], y=[${realY(kMin)}, ${realY(kMax+1)}]`);
}

// Find white pixels (player)
let wMin = ROWS, wMax = -1, wxMin = COLS, wxMax = -1, wCount = 0;
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    if (grid[row][col] === 'W') {
      wCount++;
      if (row < wMin) wMin = row;
      if (row > wMax) wMax = row;
      if (col < wxMin) wxMin = col;
      if (col > wxMax) wxMax = col;
    }
  }
}
if (wCount > 0) {
  const realX = (x => Math.round(x * cellW));
  const realY = (y => Math.round(y * cellH));
  console.log('');
  console.log('=== White regions (player) ===');
  console.log(`  White pixel count: ${wCount} of ${totalSamples} sampled cells`);
  console.log(`  Bounding box in image: x=[${realX(wxMin)}, ${realX(wxMax+1)}], y=[${realY(wMin)}, ${realY(wMax+1)}]`);
}
