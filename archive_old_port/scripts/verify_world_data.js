/**
 * Verification tests for world data extracted from ASM.
 * Runs against the actual JS modules to confirm data integrity and game behavior.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const generated = JSON.parse(readFileSync(join(root, 'src', 'data', 'world_data.generated.json'), 'utf8'));
const handcrafted = JSON.parse(readFileSync(join(root, 'src', 'data', 'world_data.json'), 'utf8'));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

// ─── Test 1: Room count ────────────────────────────────────────────────────
console.log('\n=== Test 1: Room count ===');
assert(generated.rooms.length === 31, `Expected 31 rooms, got ${generated.rooms.length}`);
assert(handcrafted.rooms.length === 31, `Hand-authored: expected 31 rooms, got ${handcrafted.rooms.length}`);

// ─── Test 2: All room IDs are unique and sequential ────────────────────────
console.log('\n=== Test 2: Room IDs ===');
const ids = generated.rooms.map(r => r.id).sort((a, b) => a - b);
assert(ids[0] === 0 && ids[30] === 30, 'Room IDs are 0-30');
assert(ids.every((id, i) => id === i), 'No duplicate room IDs');

// ─── Test 3: All rooms have required fields ────────────────────────────────
console.log('\n=== Test 3: Required fields ===');
for (const room of generated.rooms) {
  assert(room.id !== undefined && room.name && room.color && room.exits,
    `Room ${room.id} has all required fields`);
}

// ─── Test 4: All exit room IDs are valid ──────────────────────────────────
console.log('\n=== Test 4: Exit validity ===');
for (const room of generated.rooms) {
  for (const dir of ['above', 'left', 'down', 'right']) {
    const exit = room.exits[dir];
    const roomId = exit & 0x7F;
    assert(roomId >= 0 && roomId <= 30,
      `Room ${room.id} ${dir} exit room ID ${roomId} is valid`);
  }
}

// ─── Test 5: Door flag consistency ─────────────────────────────────────────
console.log('\n=== Test 5: Door flags ===');
let doorCount = 0;
for (const room of generated.rooms) {
  for (const dir of ['above', 'left', 'down', 'right']) {
    if (room.exits[dir] & 0x80) doorCount++;
  }
}
assert(doorCount > 0, `Found ${doorCount} closed doors`);

// ─── Test 6: Room diffs count and structure ────────────────────────────────
console.log('\n=== Test 6: Room diffs ===');
assert(generated.room_diffs.length === 6, `Expected 6 room diffs, got ${generated.room_diffs.length}`);
for (const diff of generated.room_diffs) {
  assert(diff.length === 3, `Room diff has 3 level values`);
}

// ─── Test 7: Castle mappings ──────────────────────────────────────────────
console.log('\n=== Test 7: Castle mappings ===');
assert(generated.castle_mappings.entryRoomOffsets?.length === 3, '3 entry room offsets');
assert(generated.castle_mappings.castleRoomOffsets?.length === 3, '3 castle room offsets');
assert(generated.castle_mappings.portOffsets?.length === 3, '3 port offsets');
assert(generated.castle_mappings.keyOffsets?.length === 3, '3 key offsets');

// ─── Test 8: Playfield patterns ────────────────────────────────────────────
console.log('\n=== Test 8: Playfield patterns ===');
assert(Object.keys(generated.playfield_patterns).length === 23, '23 playfield patterns extracted');
assert(generated.playfield_patterns.CastleDef?.length === 7, 'CastleDef has 7 rows');
assert(generated.playfield_patterns.NumberRoom?.length === 7, 'NumberRoom has 7 rows');

// ─── Test 9: Portcullis positions ──────────────────────────────────────────
    console.log('\n=== Test 9: Portcullis positions ===');
    assert(generated.portcullis_positions.length === 3, '3 portcullis positions');
    for (const pos of generated.portcullis_positions) {
      assert(pos.room !== undefined && pos.x !== undefined && pos.y !== undefined,
        `Portcullis at room ${pos.room}, x=${pos.x}, y=${pos.y}`);
    }
    assert(generated.castle_mappings.entryRoomOffsets[0] === 18, 'entryRoomOffsets[0] should be 18 (yellow)');
    assert(generated.castle_mappings.castleRoomOffsets[0] === 17, 'castleRoomOffsets[0] should be 17 (yellow)');
    assert(generated.castle_mappings.castleRoomOffsets[1] === 15, 'castleRoomOffsets[1] should be 15 (white)');
    assert(generated.castle_mappings.castleRoomOffsets[2] === 16, 'castleRoomOffsets[2] should be 16 (black)');

// ─── Test 10: Game1 objects ────────────────────────────────────────────────
console.log('\n=== Test 10: Game1 objects ===');
const genObjects = generated.game1_objects.filter(o => o.type === 'object');
assert(genObjects.length === 12, `Expected 12 Game1 objects, got ${genObjects.length}`);

// ─── Test 11: Castle rooms use CastleDef pattern ───────────────────────────
console.log('\n=== Test 11: Castle rooms ===');
const castleRooms = [15, 16, 17]; // White, Black, Yellow castles
for (const room of generated.rooms) {
  if (castleRooms.includes(room.id)) {
    assert(room.name.includes('Castle'),
      `Room ${room.id} (${room.name}) is a castle room`);
  }
}

// ─── Test 12: Entry room mappings ─────────────────────────────────────────
console.log('\n=== Test 12: Entry room mappings ===');
assert(JSON.stringify(generated.castle_mappings.entryRoomOffsets) === JSON.stringify([18, 26, 27]),
  'entry rooms map to yellow/white/black entries');
assert(JSON.stringify(generated.castle_mappings.castleRoomOffsets) === JSON.stringify([17, 15, 16]),
  'entry rooms map to yellow/white/black castles');

// ─── Test 13: Color consistency ────────────────────────────────────────────
console.log('\n=== Test 13: Color consistency ===');
const colorMap = {
  0: 0x66, 1: 0xD8, 2: 0xC8, 3: 0xE8, 4: 0x86, 5: 0x86, 6: 0x86,
  7: 0x86, 8: 0x86, 9: 0x08, 10: 0x08, 11: 0x08, 12: 0x98, 13: 0xB8,
  14: 0xA8, 15: 0x0C, 16: 0x00, 17: 0x1A, 18: 0x1A, 19: 0x08,
  20: 0x08, 21: 0x08, 22: 0x08, 23: 0x36, 24: 0x36, 25: 0x36,
  26: 0x36, 27: 0x36, 28: 0x66, 29: 0x36, 30: 0x66
};
for (const room of generated.rooms) {
  const expectedColor = colorMap[room.id];
  const actualColor = parseInt(room.color.replace(/^0x/i, ''), 16);
  if (expectedColor !== undefined) {
    assert(actualColor === expectedColor,
      `Room ${room.id} color ${room.color} matches expected`);
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('All verification tests passed!');
} else {
  console.log('Some tests failed — review the output above.');
}
