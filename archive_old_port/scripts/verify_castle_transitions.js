/**
 * Runtime verification for ASM-faithful castle entry and room transitions.
 * Uses the current Physics.update API and the authoritative castle constants.
 */
import { GameContext } from '../src/state/GameContext.js?v=thin-lines-15';
import { entityManager } from '../src/entities/EntityManager.js?v=thin-lines-15';
import { physics } from '../src/engine/Physics.js?v=thin-lines-15';
import { Entity } from '../src/entities/Entity.js?v=thin-lines-15';
import { ROOM_CTRLPF, ROOM_WALLS, ROOM_WALL_BY_ID } from '../src/engine/Sprites.js?v=thin-lines-15';

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

function reset(room, portcullisStates = [0x1c, 0x1c, 0x1c]) {
  entityManager.init('game1');
  GameContext.registers.level = 0;
  GameContext.registers.roomId = room;
  GameContext.registers.portcullisStates = [...portcullisStates];
  GameContext.registers.carriedObjectId = null;
  entityManager.loadRoom(room);
}

console.log('\n=== Test 1: Open yellow portcullis enters Yellow Castle ===');
reset(18, [1, 0x1c, 0x1c]);
const entryPlayer = new Entity({ id: 'player', room: 18, x: 80, y: 12, movement: true });
physics.update(entryPlayer, 16);
assert(entryPlayer.room === 17, `Player enters room 17, got ${entryPlayer.room}`);
assert(GameContext.registers.roomId === 17, `Register room synchronizes to 17, got ${GameContext.registers.roomId}`);
assert(entryPlayer.x === 0x50 && entryPlayer.y === 0x2c,
  `ASM castle spawn is (80,44), got (${entryPlayer.x},${entryPlayer.y})`);

console.log('\n=== Test 2: Fresh yellow entry portal is usable ===');
reset(18, [0x1c, 0x1c, 0x1c]);
const freshEntryPlayer = new Entity({ id: 'player', room: 18, x: 80, y: 12, movement: true });
physics.update(freshEntryPlayer, 16);
assert(freshEntryPlayer.room === 17, `Fresh entry reaches room 17, got ${freshEntryPlayer.room}`);
assert(GameContext.registers.roomId === 17, `Register room synchronizes to 17, got ${GameContext.registers.roomId}`);

console.log('\n=== Test 3: Normal room transition synchronizes player and register ===');
reset(1);
const transitionPlayer = new Entity({ id: 'player', room: 1, x: 80, y: 32, movement: true });
physics._loadRoomForPlayer(transitionPlayer, 2);
assert(transitionPlayer.room === 2, `Player reaches room 2, got ${transitionPlayer.room}`);
assert(GameContext.registers.roomId === 2, `Register room synchronizes to 2, got ${GameContext.registers.roomId}`);

console.log('\n=== Test 4: RoomDiffs decoding uses one flat ASM index ===');
reset(1);
GameContext.registers.level = 2;
const encodedRoom = GameContext.getRoom(1);
const expected = GameContext._decodeExitRoom(encodedRoom.exits.down);
const actual = physics._decodeExit(encodedRoom, 'down');
assert(expected === actual, `Physics and GameContext agree at level 2 (${actual})`);

console.log('\n=== Test 5: Atlas green-room top aperture and open-right geometry ===');
reset(2);
GameContext.registers.fixtureMode = true;
const greenRoom = GameContext.getRoom(13);
const greenPattern = ROOM_WALLS[ROOM_WALL_BY_ID[13]];
assert(greenRoom.color === '$B8'
  && greenRoom.exits.above === 15
  && greenRoom.exits.left === 13
  && greenRoom.exits.down === 13
  && greenRoom.exits.right === 2
  && ROOM_CTRLPF[13] === 0xA1
  && ROOM_WALL_BY_ID[13] === 'BelowYellowCastle'
  && greenPattern[0][2] === 0x0F
  && greenPattern[1][0] === 0x00
  && greenPattern[1][1] === 0x00
  && greenPattern[1][2] === 0x00
  && greenPattern[6][2] === 0xFF,
  'Room 13 is the atlas green room with a top aperture, open right edge, continuous bottom band, and left thin wall');
const greenLeftPlayer = new Entity({ id: 'player', room: 2, x: 2, y: 67, movement: true });
physics._checkRoomBoundaries(greenLeftPlayer);
assert(greenLeftPlayer.room === 13 && greenLeftPlayer.x === 158,
  `Room 2 left entry reaches the open-right green Room 13 at X=158, got room ${greenLeftPlayer.room} X=${greenLeftPlayer.x}`);
greenLeftPlayer.velocity.x = -1;
for (let i = 0; i < 20; i++) physics.update(greenLeftPlayer, 16);
assert(greenLeftPlayer.room === 13 && greenLeftPlayer.x < 158,
  `Green Room 13 accepts inward movement, got room ${greenLeftPlayer.room} X=${greenLeftPlayer.x}`);
greenLeftPlayer.x = 159;
greenLeftPlayer.velocity.x = 1;
physics._checkRoomBoundaries(greenLeftPlayer);
assert(greenLeftPlayer.room === 2 && greenLeftPlayer.x === 3,
  `Green Room 13 right opening returns to Room 2 at X=3, got room ${greenLeftPlayer.room} X=${greenLeftPlayer.x}`);
greenLeftPlayer.velocity.x = 1;
for (let i = 0; i < 20; i++) physics.update(greenLeftPlayer, 16);
assert(greenLeftPlayer.room === 2 && greenLeftPlayer.x > 3,
  `Room 2 accepts inward movement after the green-room right return, got room ${greenLeftPlayer.room} X=${greenLeftPlayer.x}`);
greenLeftPlayer.x = 2;
greenLeftPlayer.velocity.x = -1;
physics._checkRoomBoundaries(greenLeftPlayer);
assert(greenLeftPlayer.room === 13 && greenLeftPlayer.x === 158,
  `Room 2 returns to the green room without teleporting, got room ${greenLeftPlayer.room} X=${greenLeftPlayer.x}`);
greenLeftPlayer.x = 80;
greenLeftPlayer.y = 13;
greenLeftPlayer.velocity.x = 0;
greenLeftPlayer.velocity.y = -1;
physics._checkRoomBoundaries(greenLeftPlayer);
assert(greenLeftPlayer.room === 13,
  `Green Room 13 still rejects a down exit, got room ${greenLeftPlayer.room}`);

const atlasRightPlayer = new Entity({ id: 'player', room: 2, x: 159, y: 67, movement: true });
physics._checkRoomBoundaries(atlasRightPlayer);
assert(atlasRightPlayer.room === 3 && atlasRightPlayer.x === 3,
  `Room 2 right exit enters atlas Room 3 at X=3, got room ${atlasRightPlayer.room} X=${atlasRightPlayer.x}`);
atlasRightPlayer.velocity.x = 1;
for (let i = 0; i < 20; i++) physics.update(atlasRightPlayer, 16);
assert(atlasRightPlayer.room === 3 && atlasRightPlayer.x > 3,
  `Atlas Room 3 accepts inward movement, got room ${atlasRightPlayer.room} X=${atlasRightPlayer.x}`);
atlasRightPlayer.x = 2;
atlasRightPlayer.velocity.x = -1;
physics._checkRoomBoundaries(atlasRightPlayer);
assert(atlasRightPlayer.room === 2 && atlasRightPlayer.x === 158,
  `Room 3 returns to Room 2 without teleporting, got room ${atlasRightPlayer.room} X=${atlasRightPlayer.x}`);

console.log('\n=== Test 6: Black Castle exits into Room 1 beyond its solid lower raster band ===');
reset(16);
const room16Player = new Entity({ id: 'player', room: 16, x: 80, y: 106, movement: true });
room16Player.velocity.y = 1;
physics.update(room16Player, 16);
assert(room16Player.room === 1 && room16Player.y === 30,
  `Room 16 -> Room 1 uses playable spawn y=30, got room ${room16Player.room} y=${room16Player.y}`);
room16Player.velocity.y = 1;
physics.update(room16Player, 16);
assert(room16Player.room === 1 && room16Player.y > 30,
  `Room 1 accepts inward movement after Black Castle exit, got y=${room16Player.y}`);

console.log('\n' + '='.repeat(56));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed !== 0) {
  process.exitCode = 1;
} else {
  console.log('All castle transition tests passed!');
}
