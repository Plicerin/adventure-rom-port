/**
 * Compare ASM-extracted world data against current hand-authored world_data.json
 * Reports discrepancies between the two sources.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const asmPath = join(root, 'adventure.asm');
const generatedPath = join(root, 'src', 'data', 'world_data.generated.json');
const handcraftedPath = join(root, 'src', 'data', 'world_data.json');

const asm = readFileSync(asmPath, 'utf8');
const generated = JSON.parse(readFileSync(generatedPath, 'utf8'));
const handcrafted = JSON.parse(readFileSync(handcraftedPath, 'utf8'));

// ─── Helpers ───────────────────────────────────────────────────────────────

let issues = [];

function normalizeHex(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/^\$/, '0x').toUpperCase();
}

function report(section, room, field, generatedVal, handcraftedVal) {
  issues.push({ section, room, field, generated: generatedVal, handcrafted: handcraftedVal });
}

// ─── Compare Rooms ─────────────────────────────────────────────────────────

function compareRooms() {
  const genRooms = generated.rooms;
  const handRooms = handcrafted.rooms;
  
  console.log('=== ROOM COMPARISON ===\n');
  console.log(`  ASM-extracted: ${genRooms.length} rooms`);
  console.log(`  Hand-authored: ${handRooms.length} rooms`);
  console.log();

  // Check room count
  if (genRooms.length !== handRooms.length) {
    report('rooms', 'count', 'count', genRooms.length, handRooms.length);
  }

  // Check each room
  for (let i = 0; i < Math.max(genRooms.length, handRooms.length); i++) {
    const gen = genRooms[i];
    const hand = handRooms[i];
    const roomLabel = gen ? `Room ${gen.id} (${gen.name})` : `Room ${i} (MISSING)`;
    const handLabel = hand ? `Room ${hand.id} (${hand.name})` : 'MISSING';

    if (!gen) {
      report('rooms', i, 'exists', 'no', 'yes');
      continue;
    }
    if (!hand) {
      report('rooms', gen.id, 'exists', 'yes', 'no');
      continue;
    }

    // Compare room id
    if (gen.id !== hand.id) {
      report('rooms', i, 'id', gen.id, hand.id);
    }

    // Compare color
    if (normalizeHex(gen.color) !== normalizeHex(hand.color)) {
      report('rooms', gen.id, 'color', gen.color, hand.color);
    }

    // Compare exits
    for (const dir of ['above', 'left', 'down', 'right']) {
      if (gen.exits[dir] !== hand.exits[dir]) {
        const genExit = gen.exits[dir];
        const handExit = hand.exits[dir];
        const genDoor = genExit & 0x80;
        const handDoor = handExit & 0x80;
        const genRoomId = genExit & 0x7F;
        const handRoomId = handExit & 0x7F;
        
        report('rooms', gen.id, `exit.${dir}`,
          `${genExit} (door=${genDoor}, room=${genRoomId})`,
          `${handExit} (door=${handDoor}, room=${handRoomId})`
        );
      }
    }
  }

  // Print summary
  const roomIssues = issues.filter(i => i.section === 'rooms');
  if (roomIssues.length === 0) {
    console.log('  ✓ All rooms match between ASM and hand-authored data');
  } else {
    console.log(`  ⚠ Found ${roomIssues.length} discrepancies:\n`);
    for (const issue of roomIssues) {
      console.log(`    Room ${issue.room}: ${issue.field}`);
      console.log(`      ASM:     ${issue.generated}`);
      console.log(`      Hand:    ${issue.handcrafted}`);
      console.log();
    }
  }
}

// ─── Compare Room Diffs ────────────────────────────────────────────────────

function compareRoomDiffs() {
  console.log('\n=== ROOM DIFFS COMPARISON ===\n');
  
  const genDiffs = generated.room_diffs;
  const handDiffs = handcrafted.room_diffs;

  console.log(`  ASM-extracted: ${genDiffs.length} diffs`);
  console.log(`  Hand-authored: ${handDiffs.length} diffs`);

  if (genDiffs.length !== handDiffs.length) {
    report('room_diffs', 'count', 'count', genDiffs.length, handDiffs.length);
  }

  for (let i = 0; i < Math.max(genDiffs.length, handDiffs.length); i++) {
    const gen = genDiffs[i];
    const hand = handDiffs[i];
    
    if (!gen || !hand) {
      report('room_diffs', i, 'exists', gen ? 'yes' : 'no', hand ? 'yes' : 'no');
      continue;
    }

    for (let j = 0; j < Math.max(gen.length, hand.length); j++) {
      if (gen[j] !== hand[j]) {
        report('room_diffs', i, `level[${j}]`, gen[j], hand[j]);
      }
    }
  }

  const diffIssues = issues.filter(i => i.section === 'room_diffs');
  if (diffIssues.length === 0) {
    console.log('  ✓ All room diffs match');
  } else {
    console.log(`  ⚠ Found ${diffIssues.length} discrepancies:\n`);
    for (const issue of diffIssues) {
      console.log(`    Diff ${issue.room}: ${issue.field}`);
      console.log(`      ASM:     ${issue.generated}`);
      console.log(`      Hand:    ${issue.handcrafted}`);
      console.log();
    }
  }
}

// ─── Compare Objects ───────────────────────────────────────────────────────

function compareObjects() {
  console.log('\n=== OBJECTS COMPARISON ===\n');

  // world_data.json is deliberately the Game 2/Variation 2 table, while
  // world_data.generated.json currently contains the ASM Game 1 table.
  // Comparing these different variations creates false discrepancies and
  // previously obscured the real room-data result. Game 1 is verified against
  // EntityManager.GAME1_OBJECTS by the dedicated runtime checks.
  console.log('  Skipped: generated data is Game 1; hand-authored data is Game 2.');
  console.log('  Use scripts/verify_world_data.js for the active variation checks.');
  return;

  const genObjects = generated.game1_objects.filter(o => o.type === 'object' || o.type === 'portcullis');
  const handObjects = handcrafted.objects;

  console.log(`  ASM-extracted: ${genObjects.length} objects`);
  console.log(`  Hand-authored: ${handObjects.length} objects`);

  // Build lookup by object name
  const genMap = {};
  for (const obj of genObjects) {
    genMap[obj.object] = obj;
  }

  // Map ASM object names to hand-authored names
  const nameMap = {
    'black_dot': 'number',
    'reddragon': 'red_dragon',
    'yellowdragon': 'yellow_dragon',
    'greendragon': 'green_dragon',
    'magnet': 'magnet',
    'sword': 'sword',
    'challise': 'chalice',
    'chalice': 'chalice',
    'bridge': 'bridge',
    'yellowkey': 'yellow_key',
    'whitekey': 'white_key',
    'blackkey': 'black_key',
    'bat': 'bat'
  };

  for (const handObj of handObjects) {
    // Find the matching ASM object
    let genObj = genMap[handObj.object];
    if (!genObj) {
      // Try the name mapping
      const mappedName = nameMap[handObj.object];
      if (mappedName) {
        genObj = genMap[mappedName];
      }
    }

    if (!genObj) {
      report('objects', handObj.object, 'exists', 'no', 'yes');
      continue;
    }

    for (const field of ['room', 'x', 'y']) {
      if (genObj[field] !== handObj[field]) {
        report('objects', handObj.object, field, genObj[field], handObj[field]);
      }
    }
  }

  const objIssues = issues.filter(i => i.section === 'objects');
  if (objIssues.length === 0) {
    console.log('  ✓ All objects match');
  } else {
    console.log(`  ⚠ Found ${objIssues.length} discrepancies:\n`);
    for (const issue of objIssues) {
      console.log(`    ${issue.room}: ${issue.field}`);
      console.log(`      ASM:     ${issue.generated}`);
      console.log(`      Hand:    ${issue.handcrafted}`);
      console.log();
    }
  }
}

// ─── Compare Castle Mappings ───────────────────────────────────────────────

function compareCastleMappings() {
  console.log('\n=== CASTLE MAPPINGS COMPARISON ===\n');

  const gen = generated.castle_mappings;
  const hand = {
    entryRoomOffsets: handcrafted._room_diffs_comment ? [18, 26, 27] : null,
    castleRoomOffsets: handcrafted._room_diffs_comment ? [17, 15, 16] : null
  };

  // These are inferred from the hand-authored data's portcullis structure
  // ASM source is definitive
  console.log('  ASM-extracted:');
  console.log(`    entryRoomOffsets: [${gen.entryRoomOffsets}]`);
  console.log(`    castleRoomOffsets: [${gen.castleRoomOffsets}]`);
  console.log(`    portOffsets: [${gen.portOffsets}]`);
  console.log(`    keyOffsets: [${gen.keyOffsets}]`);
  console.log();
  console.log('  ✓ Castle mappings extracted from ASM (definitive source)');
}

// ─── Compare Portcullis Positions ──────────────────────────────────────────

function comparePortcullisPositions() {
  console.log('\n=== PORTCULLIS POSITIONS COMPARISON ===\n');

  const genPorts = generated.portcullis_positions;
  const handPorts = handcrafted.objects.filter(o => o.object.startsWith('portcullis'));

  console.log(`  ASM-extracted: ${genPorts.length} positions`);
  console.log(`  Hand-authored: ${handPorts.length} positions`);

  for (let i = 0; i < Math.max(genPorts.length, handPorts.length); i++) {
    const gen = genPorts[i];
    const hand = handPorts[i];
    
    if (!gen || !hand) {
      report('portcullis', i, 'exists', gen ? 'yes' : 'no', hand ? 'yes' : 'no');
      continue;
    }

    for (const field of ['room', 'x', 'y']) {
      if (gen[field] !== hand[field]) {
        report('portcullis', i, field, gen[field], hand[field]);
      }
    }
  }

  const portIssues = issues.filter(i => i.section === 'portcullis');
  if (portIssues.length === 0) {
    console.log('  ✓ All portcullis positions match');
  } else {
    console.log(`  ⚠ Found ${portIssues.length} discrepancies:\n`);
    for (const issue of portIssues) {
      console.log(`    Portcullis ${issue.room}: ${issue.field}`);
      console.log(`      ASM:     ${issue.generated}`);
      console.log(`      Hand:    ${issue.handcrafted}`);
      console.log();
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log('Comparing ASM-extracted data vs hand-authored world_data.json\n');
  console.log('='.repeat(60));
  console.log();

  compareRooms();
  compareRoomDiffs();
  compareObjects();
  compareCastleMappings();
  comparePortcullisPositions();

  console.log('\n' + '='.repeat(60));
  console.log(`\nTotal issues found: ${issues.length}`);
  
  if (issues.length > 0) {
    console.log('\nIssues by section:');
    const sections = {};
    for (const issue of issues) {
      sections[issue.section] = (sections[issue.section] || 0) + 1;
    }
    for (const [section, count] of Object.entries(sections)) {
      console.log(`  ${section}: ${count} discrepancies`);
    }
    console.log();
  }
}

main();
