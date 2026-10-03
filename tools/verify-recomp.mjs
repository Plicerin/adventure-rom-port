// Differential test of the translated cartridge (src/advMachine.mjs) against
// the real ROM interpreted on the 6502 core: both get the same inputs each
// frame, and after every frame the CPU registers, cycle count, RAM, TIA write
// log and finished picture must be identical.
// Inputs: random joystick and button, Game Select / Game Reset presses (so all
// three games get played) and flips of the difficulty and color switches.
// With 'cover', identical RAM pokes in both machines move the player to a
// random room now and then, so every room's drawing code runs, and put the
// chalice in the yellow castle now and then, so games get won.
// usage: node tools/verify-recomp.mjs [frames] [seed] [cover]
import { VCS, loadRom } from './atari/vcs.mjs';
import { AdvMachine } from '../src/advMachine.mjs';
import { ROM_DATA } from '../src/advRomData.mjs';

const frames = Number(process.argv[2] ?? 3000), seed = Number(process.argv[3] ?? 1), cover = process.argv[4] === 'cover';
const rom = new VCS(loadRom());
const adv = new AdvMachine();
// every ROM read the translated code makes must land on a byte in the data image
const mapped = new Uint8Array(4096);
for (const [at, h] of ROM_DATA) for (let i = 0; i < h.length / 2; i += 1) mapped[(at + i) & 0xfff] = 1;
const unmapped = new Set();
const busRead = adv.bus.read.bind(adv.bus);
adv.bus.read = (addr) => { if ((addr & 0x1000) && !mapped[addr & 0xfff]) unmapped.add((0xf000 | (addr & 0xfff)).toString(16)); return busRead(addr); };
let s = seed >>> 0;
const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const hex = (v) => v.toString(16);
const ROOM = 0x8a, PREV_ROOM = 0xe2, GAME_STATE = 0xde, GAME_NUMBER = 0xdd; // GAME_STATE 0 = playing
const playing = (ram) => ram[GAME_STATE & 0x7f] === 0;
const CHALICE_ROOM = 0xb9, YELLOW_CASTLE = 0x12, DRAGON_STATES = [0xa8, 0xad, 0xb2]; // dragon state 2 = has eaten the player
const z = (a) => rom.ram[a & 0x7f];
const poke = (addr, v) => { rom.ram[addr & 0x7f] = v; adv.bus.ram[addr & 0x7f] = v; };

let stick = 0xff, switches = 0x0b, bad = 0, selects = 1;
const rooms = new Set(), games = new Set();
const stats = { gamesStarted: 0, wins: 0, eaten: 0 };
for (let f = 0; f < frames; f += 1) {
  if (f % 20 === 0) { const r = rand(); stick = r < 0.2 ? 0x7f : r < 0.4 ? 0xbf : r < 0.6 ? 0xef : r < 0.8 ? 0xdf : 0xff; }
  const fire = rand() < 0.2 ? 0x00 : 0x80;
  if (f % 1500 === 0) switches = (rand() < 0.5 ? 0x40 : 0) | (rand() < 0.5 ? 0x80 : 0) | (rand() < 0.9 ? 0x08 : 0) | 0x03;
  let swchb = switches;
  // every 2000 frames: Game Select 1-3 times (the first press goes to the
  // number screen, each further one advances the game number), then Game Reset
  const phase = f % 2000;
  if (phase === 0) selects = 1 + Math.floor(rand() * 3);
  if (phase < selects * 8 && phase % 8 < 4) swchb &= ~0x02;
  else if (phase >= 30 && phase < 34) swchb &= ~0x01;
  if (cover && playing(rom.ram) && f % 400 === 200) {
    const room = Math.floor(rand() * 0x1e) + 1;
    poke(ROOM, room); poke(PREV_ROOM, room);
  }
  if (cover && playing(rom.ram) && f % 2000 === 1500) poke(CHALICE_ROOM, YELLOW_CASTLE); // the chalice home: a win
  for (const m of [rom, adv.bus]) { m.swcha = stick; m.inpt4 = fire; m.swchb = swchb; }
  const before = rom.ram.slice();
  rom.runFrames(1);
  adv.runFrame();
  const diffs = [];
  for (const r of ['a', 'x', 'y', 's', 'p', 'pc', 'cycles']) if (rom.cpu[r] !== adv.cpu[r]) diffs.push(`${r} rom ${hex(rom.cpu[r])} js ${hex(adv.cpu[r])}`);
  for (let i = 0; i < 128; i += 1) if (rom.ram[i] !== adv.bus.ram[i]) diffs.push(`$${hex(0x80 + i)} rom ${hex(rom.ram[i])} js ${hex(adv.bus.ram[i])}`);
  const wr = rom.lastFrameWrites, wj = adv.bus.lastFrameWrites;
  if (wr.length !== wj.length) diffs.push(`writes rom ${wr.length} js ${wj.length}`);
  for (let i = 0; i < Math.min(wr.length, wj.length); i += 1) {
    if (wr[i].reg !== wj[i].reg || wr[i].value !== wj[i].value || wr[i].cycle !== wj[i].cycle) { diffs.push(`write ${i} rom ${JSON.stringify(wr[i])} js ${JSON.stringify(wj[i])}`); break; }
  }
  const pr = rom.tia.lastFrame, pj = adv.bus.tia.lastFrame;
  if (pr && pr.some((row, y) => row.some((c, x) => c !== pj[y][x]))) diffs.push('picture differs');
  if (diffs.length) { bad += 1; if (bad <= 5) console.log(`frame ${f}: ${diffs.slice(0, 8).join(', ')}`); if (bad === 5) break; }
  rooms.add(z(ROOM));
  if (playing(rom.ram)) games.add(z(GAME_NUMBER) / 2 + 1);
  if (!playing(before) && playing(rom.ram)) stats.gamesStarted += 1;
  if (playing(before) && !playing(rom.ram)) stats.wins += 1;
  for (const d of DRAGON_STATES) if (before[d & 0x7f] !== 2 && z(d) === 2) stats.eaten += 1;
}
if (unmapped.size) console.log('reads outside the data image:', [...unmapped].join(' '));
console.log({ frames, bad, ...stats, roomsSeen: rooms.size, gameNumbers: [...games].sort().join(',') });
process.exit(bad || unmapped.size ? 1 : 0);
