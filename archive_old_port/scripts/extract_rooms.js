/**
 * ASM Room Data Extractor
 * Reads adventure.asm and extracts all room/object data from ASM tables.
 * Outputs: src/data/world_data.generated.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const asmPath = join(root, 'adventure.asm');
const asm = readFileSync(asmPath, 'utf8');

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Extract hex bytes from a line's .byte directive.
 * Handles inline labels like "LFF32: .byte $10,$0F,$0F"
 * and standalone labels like "Label:" on their own line.
 * Skips <Label and >Label references.
 */
function extractBytes(line) {
  // Find the .byte directive and everything after it
  const byteIdx = line.indexOf('.byte');
  if (byteIdx === -1) return [];
  
  const afterByte = line.slice(byteIdx + 5);
  // Strip comments
  const noComment = afterByte.split(';')[0];
  
  const hexValues = [];
  const parts = noComment.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('<') || trimmed.startsWith('>')) continue;
    // Remove any non-hex prefix (like "LFF32: ")
    const hexPart = trimmed.replace(/^[A-Za-z_\w]+:\s*/, '');
    const match = hexPart.match(/^\$([0-9A-Fa-f]+)$/);
    if (match) {
      hexValues.push(parseInt(match[1], 16));
    }
  }
  return hexValues;
}

/**
 * Extract all ASM labels and their line indices.
 */
function extractLabels() {
  const labels = {};
  const lines = asm.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match label definitions: "LabelName:" at start of line (possibly with whitespace)
    const match = line.match(/^\s*([A-Za-z_]\w*):\s*$/);
    if (match) {
      labels[match[1]] = i;
    }
  }
  return labels;
}

/**
 * Get hex bytes from a label's content line, or the next line if the label
 * is on its own line.
 */
function getBytesFromLabel(label, labels, lines, count) {
  const idx = labels[label];
  if (idx === undefined) return null;
  
  let contentLine = lines[idx].trim();
  if (contentLine.includes('.byte')) {
    const hexValues = extractBytes(lines[idx]);
    return hexValues.length === count ? hexValues : null;
  }
  
  // Label is on its own line; check the next line
  if (idx + 1 < lines.length) {
    const nextLine = lines[idx + 1].trim();
    if (nextLine.includes('.byte')) {
      const hexValues = extractBytes(nextLine);
      return hexValues.length === count ? hexValues : null;
    }
  }
  return null;
}

// ─── Step 1: Extract RoomDataTable ─────────────────────────────────────────

function extractRoomDataTable() {
  const rooms = [];
  const lines = asm.split('\n');
  const labels = extractLabels();

  const roomStartLine = labels.RoomDataTable !== undefined ? labels.RoomDataTable : 2698;
  const roomEndLine = labels.RoomDiffs !== undefined ? labels.RoomDiffs - 1 : lines.length - 1;

  for (let i = roomStartLine; i <= roomEndLine; i++) {
    const line = lines[i];
    if (!line.includes('.byte')) continue;

    const hexValues = extractBytes(line);
    if (hexValues.length < 7) continue;

    // Extract room id from comment: ";00; ...", ";0A; ...", ";1E; ...", etc.
    const commentMatch = line.match(/;([0-9A-Fa-f]+);/);
    if (!commentMatch) continue;
    const roomId = parseInt(commentMatch[1], 16);

    // Extract room name from comment, then strip trailing color names
    const nameMatch = line.match(/;[0-9A-Fa-f]+;\s*(.*)/);
    let name = nameMatch ? nameMatch[1].trim() : `Room ${roomId}`;
    // Strip trailing color/status names and any trailing junk
    name = name.replace(/\s+(Purple|Green|Blue|White|Black|Red|Invisible|Yellow|Re|Dupl|R|Rev)\s*$/, '').trim();
    // Clean up leading quote/apostrophe and extra whitespace
    name = name.replace(/^['"]?\s*/, '').replace(/\s+/g, ' ');

    rooms.push({
      id: roomId,
      name: name,
      color: `0x${hexValues[0].toString(16).padStart(2, '0').toUpperCase()}`,
      ctrlpf: `0x${hexValues[2].toString(16).padStart(2, '0').toUpperCase()}`,
      // RoomDataTable has no standalone PF byte; its PF pattern is referenced by pointer.
      exits: {
        above: hexValues[3],
        left: hexValues[4],
        down: hexValues[5],
        right: hexValues[6]
      }
    });
  }

  return rooms;
}

// ─── Step 2: Extract RoomDiffs ─────────────────────────────────────────────

function extractRoomDiffs() {
  const diffs = [];
  const lines = asm.split('\n');
  const labels = extractLabels();

  const roomDiffsStart = labels.RoomDiffs !== undefined ? labels.RoomDiffs : 2733;

  // Find the next label AFTER RoomDiffs to determine the end of the section
  let roomDiffsEnd = lines.length - 1;
  for (const [label, idx] of Object.entries(labels)) {
    if (idx > roomDiffsStart) {
      roomDiffsEnd = idx - 1;
      break;
    }
  }

  for (let i = roomDiffsStart; i <= roomDiffsEnd; i++) {
    const line = lines[i];
    if (!line.includes('.byte')) continue;

    const hexValues = extractBytes(line);
    if (hexValues.length === 3) {
      diffs.push(hexValues);
    }
  }

  return diffs;
}

// ─── Step 3: Extract Castle/Portcullis Mappings ────────────────────────────

function extractCastleMappings() {
  const labels = extractLabels();
  const lines = asm.split('\n');

  return {
    portOffsets: getBytesFromLabel('PortOffsets', labels, lines, 3),
    keyOffsets: getBytesFromLabel('KeyOffsets', labels, lines, 3),
    entryRoomOffsets: getBytesFromLabel('EntryRoomOffsets', labels, lines, 3),
    castleRoomOffsets: getBytesFromLabel('CastleRoomOffsets', labels, lines, 3)
  };
}

// ─── Step 4: Extract Game Objects ──────────────────────────────────────────

function extractGameObjects(gameNum) {
  const labels = extractLabels();
  const lines = asm.split('\n');
  const objLabel = gameNum === 1 ? 'Game1Objects' : 'Game2Objects';
  const labelIdx = labels[objLabel];
  if (labelIdx === undefined) return [];

  const objects = [];
  const objEndLabel = gameNum === 1 ? 'Game2Objects' : undefined;
  const objEndIdx = objEndLabel ? (labels[objEndLabel] - 1) : lines.length;

  for (let i = labelIdx; i <= objEndIdx; i++) {
    const line = lines[i];
    if (!line.includes('.byte')) continue;

    const hexValues = extractBytes(line);
    if (hexValues.length === 0) continue;

    // Extract object name from comment: ";Red Dragon (Room, X, Y)" -> "red_dragon"
    const nameMatch = line.match(/;\s*(\w+(?:\s+\w+)*)/);
    let objName = nameMatch ? nameMatch[1].toLowerCase().replace(/\s+/g, '_') : `obj_${hexValues[0]}`;

    // Portcullis state entries: single byte 0x1C
    if (hexValues.length === 1 && hexValues[0] === 0x1C) {
      objects.push({ type: 'portcullis_state', object: objName, state: hexValues[0] });
      continue;
    }

    // Bat carrying/fed-up: two bytes
    if (hexValues.length === 2 && objName.includes('bat')) {
      objects.push({ type: 'bat_flags', carrying: hexValues[0], fedUp: hexValues[1] });
      continue;
    }

    if (hexValues.length >= 3) {
      const obj = {
        type: 'object',
        object: objName,
        room: hexValues[0],
        x: hexValues[1],
        y: hexValues[2]
      };
      if (hexValues.length >= 5) {
        obj.movement = hexValues[3];
        obj.state = hexValues[4];
      }
      objects.push(obj);
    }
  }

  return objects;
}

// ─── Step 5: Extract Playfield Patterns ────────────────────────────────────

function extractPlayfieldPatterns() {
  const labels = extractLabels();
  const lines = asm.split('\n');

  const patternNames = [
    'NumberRoom', 'BelowYellowCastle', 'LeftOfName', 'BlueMazeTop',
    'BlueMaze1', 'BlueMazeBottom', 'BlueMazeCenter', 'BlueMazeEntry',
    'MazeMiddle', 'MazeSide', 'MazeEntry', 'SideCorridor',
    'CastleDef', 'WhiteCastleEntry', 'TopEntryRoom',
    'BlackMaze1', 'BlackMaze3', 'BlackMaze2', 'BlackMazeEntry',
    'RedMaze1', 'RedMazeBottom', 'RedMazeTop', 'TwoExitRoom'
  ];

  const patterns = {};

  for (const patternName of patternNames) {
    const labelIdx = labels[patternName];
    if (labelIdx === undefined) continue;

    // Check if the label line has .byte content
    let startLine = labelIdx;
    if (!lines[labelIdx].includes('.byte')) {
      // Label is on its own line; .byte content is on the next line
      startLine = labelIdx + 1;
    }

    const rows = [];
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('.byte')) break;
      const hexValues = extractBytes(line);
      if (hexValues.length > 0) rows.push(hexValues);
    }

    if (rows.length > 0) patterns[patternName] = rows;
  }

  return patterns;
}

// ─── Step 6: Extract Portcullis Object Positions ───────────────────────────

function extractPortcullisPositions() {
  const labels = extractLabels();
  const lines = asm.split('\n');

  const port1 = getBytesFromLabel('PortInfo1', labels, lines, 3);
  const port2 = getBytesFromLabel('PortInfo2', labels, lines, 3);
  const port3 = getBytesFromLabel('PortInfo3', labels, lines, 3);

  return [
    { room: port1?.[0], x: port1?.[1], y: port1?.[2] },
    { room: port2?.[0], x: port2?.[1], y: port2?.[2] },
    { room: port3?.[0], x: port3?.[1], y: port3?.[2] }
  ];
}

// ─── Step 7: Extract Player Start ──────────────────────────────────────────

function extractPlayerStart() {
  return {
    room: 0x11, // 17 = Yellow Castle interior
    x: 0x50,    // 80
    y: 0x20     // 32
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log('Extracting room data from adventure.asm...\n');

  const rooms = extractRoomDataTable();
  console.log(`  Rooms: ${rooms.length} extracted`);

  const roomDiffs = extractRoomDiffs();
  console.log(`  RoomDiffs: ${roomDiffs.length} entries extracted`);

  const castleMappings = extractCastleMappings();
  console.log(`  Castle mappings:`, JSON.stringify(castleMappings));

  const game1Objects = extractGameObjects(1);
  console.log(`  Game1 objects: ${game1Objects.length} entries extracted`);

  const patterns = extractPlayfieldPatterns();
  console.log(`  Playfield patterns: ${Object.keys(patterns).length} extracted`);

  const portcullisPositions = extractPortcullisPositions();
  console.log(`  Portcullis positions: ${portcullisPositions.length} extracted`);

  // Add portcullis objects to game1_objects
  const portcullisObjects = portcullisPositions.map((pos, i) => ({
    type: 'portcullis',
    object: `portcullis_${i + 1}`,
    room: pos.room,
    x: pos.x,
    y: pos.y
  }));
  game1Objects.push(...portcullisObjects);

  const playerStart = extractPlayerStart();
  console.log(`  Player start:`, playerStart);

  const output = {
    _generated_from: 'adventure.asm',
    _extraction_date: new Date().toISOString(),
    rooms: rooms.map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      ctrlpf: r.ctrlpf,
      exits: {
        above: r.exits.above,
        left: r.exits.left,
        down: r.exits.down,
        right: r.exits.right
      }
    })),
    room_diffs: roomDiffs,
    castle_mappings: castleMappings,
    playfield_patterns: patterns,
    portcullis_positions: portcullisPositions,
    player_start: playerStart,
    game1_objects: game1Objects
  };

  const outputPath = join(root, 'src', 'data', 'world_data.generated.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`\n  Written to: ${outputPath}`);
}

main();
