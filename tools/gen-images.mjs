// Renders the site's images from the translated cartridge (no ROM needed):
// the poster (game 1's start in front of the gold castle), room screenshots,
// object plates drawn from the cartridge's graphics tables in the object
// table's colors (each graphics byte is two scanlines, as the kernel draws
// it), and the app icons. Pixels are 2:1 like the game.
// usage: node tools/gen-images.mjs   -> img/*.png
import { mkdirSync } from 'node:fs';
import { AdvMachine } from '../src/advMachine.mjs';
import { romImage } from '../src/advRomData.mjs';
import { writeFramePng } from './atari/png.mjs';

const FIRST = 39, LINES = 194;
const ROOM_BACKGROUND = 0x08; // the grey of every room
const m = new AdvMachine();
const run = (n) => { for (let i = 0; i < n; i += 1) m.runFrame(); };
const visible = () => m.bus.tia.lastFrame.slice(FIRST, FIRST + LINES).map((r) => Array.from(r));
const visit = (room) => { m.bus.ram[0x8a & 0x7f] = room; m.bus.ram[0xe2 & 0x7f] = room; run(6); return visible(); };

mkdirSync('img', { recursive: true });
run(30); m.bus.swchb = 0x0a; run(4); m.bus.swchb = 0x0b; run(30);
const start = visible();
writeFramePng('img/start.png', start, 4, 2);
for (const [name, room] of [['labyrinth', 0x06], ['black-castle', 0x10], ['red-maze', 0x18], ['author', 0x1e]]) writeFramePng(`img/room-${name}.png`, visit(room), 4, 2);

// object plates: graphics tables (terminated by $00) and colors from the object table
const rom = romImage();
const PLATES = {
  yorgle: [0xfd3a, 0x1a], grundle: [0xfd3a, 0xc8], rhindle: [0xfd3a, 0x36],
  bat: [0xfd1a, 0x00], sword: [0xfd7c, 0x1a], 'key-gold': [0xfd00, 0x1a], 'key-white': [0xfd00, 0x0e],
  'key-black': [0xfd00, 0x00], chalice: [0xfdf3, 0xcb], magnet: [0xfe12, 0x00]
};
for (const [name, [at, color]] of Object.entries(PLATES)) {
  const bytes = [];
  for (let a = at; rom[a & 0xfff]; a += 1) bytes.push(rom[a & 0xfff]);
  const rows = [new Array(12).fill(ROOM_BACKGROUND)];
  for (const b of bytes) {
    const row = [ROOM_BACKGROUND, ROOM_BACKGROUND];
    for (let bit = 7; bit >= 0; bit -= 1) row.push((b >> bit) & 1 ? color : ROOM_BACKGROUND);
    row.push(ROOM_BACKGROUND, ROOM_BACKGROUND);
    rows.push(row, row);
  }
  rows.push(new Array(12).fill(ROOM_BACKGROUND));
  writeFramePng(`img/obj-${name}.png`, rows, 6, 3);
}

// icons: the gold castle's crenellated top from the start screen, on its own colors
for (const size of [180, 192, 512]) {
  const src = start.slice(0, 120).map((r) => r.slice(8, 152));
  const scale = size / src[0].length / 2;
  const rows = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => {
    const sy = Math.floor((y - size * 0.15) / (scale * 1.6)), sx = Math.floor(x / (scale * 2));
    return sy >= 0 && sy < src.length && sx < src[0].length ? src[sy][sx] : ROOM_BACKGROUND;
  }));
  writeFramePng(`img/icon-${size}.png`, rows, 1, 1);
}
console.log('wrote img/');
