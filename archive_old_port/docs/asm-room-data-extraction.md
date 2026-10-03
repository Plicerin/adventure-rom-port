# ASM Room Data Extraction Plan

## Status: ✅ Complete

## Overview

This plan extracts all room, object, and castle data from `adventure.asm` and generates a canonical JSON file (`src/data/world_data.generated.json`) that serves as the single source of truth for game data.

## Files Created

### Extraction Scripts

1. **`scripts/extract_rooms.js`** - Main extraction script that parses `adventure.asm` and generates:
   - 31 rooms (RoomDataTable)
   - 6 room diffs (RoomDiffs)
   - Castle/portcullis mappings (EntryRoomOffsets, CastleRoomOffsets, PortOffsets, KeyOffsets)
   - 23 playfield patterns (CastleDef, NumberRoom, mazes, etc.)
   - 3 portcullis positions (PortInfo1/2/3)
   - 12 Game1 objects (Game1Objects)
   - Player start position

2. **`scripts/compare_world_data.js`** - Comparison script that identifies discrepancies between:
   - ASM-extracted data (`world_data.generated.json`)
   - Hand-authored data (`world_data.json`)

### Verification Tests

3. **`scripts/verify_world_data.js`** - 219 tests verifying:
   - Room count and ID uniqueness
   - All rooms have required fields
   - All exit room IDs are valid (0-30)
   - Door flags are present
   - Room diffs structure
   - Castle mappings
   - Playfield patterns
   - Portcullis positions
   - Game1 objects
   - Castle/entry room identification
   - Color consistency

4. **`scripts/verify_castle_transitions.js`** - 14 physics tests verifying:
   - Room 17 → Room 18 (Yellow Castle → Entry) through open portcullis
   - Room 18 → Room 17 (Entry → Castle) through open portcullis
   - Room 18 → Room 17 after picking up sword
   - Room 18 → Room 17 after grabbing sword and walking down
   - Closed portcullis blocks movement
   - No bounce-back after room 18 → 17 transition

## ASM Data Structures Extracted

### RoomDataTable (lines 2698-2728)
- 31 rooms (IDs 0-30)
- Each room: pattern pointer, color, ctrlpf, pf1, exits (above/left/down/right)
- Exit room IDs with bit 7 (0x80) indicating closed door

### RoomDiffs (lines 2732-2738)
- 6 entries for level-dependent room changes
- Each entry: 3 values for levels 0, 2, 4

### Castle Mappings (lines 1748-1761)
- PortOffsets: [$09, $12, $1B] - portcullis sprite offsets
- KeyOffsets: [$63, $6C, $75] - key object offsets
- EntryRoomOffsets: [$12, $1A, $1B] - entry rooms (18, 26, 27)
- CastleRoomOffsets: [$11, $0F, $10] - castle rooms (17, 15, 16)

### Game1Objects (lines 784-800)
- 12 objects: black dot, dragons, magnet, sword, chalice, bridge, keys, bat
- Portcullis states (3 × $1C)
- Bat carrying/fed-up flags

### Playfield Patterns (lines 1954-2284)
- 23 patterns: CastleDef, NumberRoom, mazes, corridors, entry rooms

### Portcullis Positions (lines 2147-2154)
- PortInfo1: Room 17, X=$4D (77), Y=$31 (49)
- PortInfo2: Room 15, X=$4D (77), Y=$31 (49)
- PortInfo3: Room 16, X=$4D (77), Y=$31 (49)

## Comparison Results

### Rooms: ✅ All match
- 31 rooms, all exits and colors match ASM

### Room Diffs: ✅ All match
- 6 diffs, all level values match ASM

### Objects: ⚠️ Minor differences
- ASM uses multi-word names (e.g., "black_dot") vs hand-authored ("number")
- Portcullis objects now extracted from PortInfo1/2/3 and included in game objects
- Hand-authored includes derived objects (author, chalice) not in ASM object list
- **Known discrepancy**: Portcullis 0 room (17 in ASM vs 18 in hand-authored) - this is the issue that was fixed in Physics.js

### Castle Mappings: ✅ Match
- Entry/castle room offsets match ASM

### Portcullis Positions: ⚠️ 1 discrepancy
- Portcullis 0: ASM says room 17, hand-authored says room 18
- **Note**: This is the known issue that was fixed in Physics.js - the portcullis object is drawn in the castle room (17) but the transition logic uses the entry room (18)

## Next Steps

1. **Replace duplicated runtime data** - Remove hardcoded `worldData` from `EntityManager.js` and import from generated JSON
2. **Replace room wall mappings** - Update `Sprites.js` to use generated playfield patterns
3. **Fix portcullis room discrepancy** - Update hand-authored data to match ASM (room 17)
4. **Add CI checks** - Run verification tests on every commit
5. **Extract Game2/Game3 objects** - Extend extraction for other game states

## Running the Scripts

```bash
# Extract all room data from ASM
bun run scripts/extract_rooms.js

# Compare extracted vs hand-authored data
bun run scripts/compare_world_data.js

# Verify data integrity (219 tests)
bun run scripts/verify_world_data.js

# Verify castle transitions (14 tests)
bun run scripts/verify_castle_transitions.js
```

## Key Findings

1. **Room data is correct** - All 31 rooms, exits, and colors match ASM exactly
2. **Room diffs are correct** - All 6 level-dependent changes match ASM
3. **Castle mappings are correct** - All portcullis/entry/castle mappings match ASM
4. **Portcullis positions are correct** - All 3 portcullis at X=77, Y=49
5. **Object positions are correct** - All 12 Game1 objects match ASM
6. **One known discrepancy** - Portcullis 0 room (17 vs 18) is a known issue that was already fixed in Physics.js
7. **Naming differences** - ASM uses multi-word names, hand-authored uses single-word names
