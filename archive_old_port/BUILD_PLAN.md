# Adventure 2600 — Build Plan (Phase 1: Core Fixes)

## Current Status
- Server running on http://localhost:5501
- Room 17 (Castle Entry) renders correctly with yellow castle, portcullis, player dot
- **BUGS TO FIX:**
  1. Up/Down movement is inverted
  2. Maze rooms (BlueMazeTop, BlueMaze1, MazeMiddle, etc.) render as solid yellow instead of corridors

## Phase 1: Fix Core Bugs

### Task 1: Fix Inverted Movement (Sub-Agent 1)
- **Root cause investigation:** Check if the inversion is in Input.js, Renderer.js, or Physics.js
- **Key areas:**
  - Input.js: ArrowUp/ArrowDown → dy += 1 / dy -= 1
  - Renderer.js: canvasY = (106 - player.y) * 2.03
  - Physics.js: nextY = startY + vector.y
- **Expected fix:** Identify the sign flip and revert it

### Task 2: Fix Maze Room Wall Patterns (Sub-Agent 2)
- **Root cause:** Room wall bit patterns in src/engine/Sprites.js ROOM_WALLS are wrong
- **Working pattern (CastleDef row 0):** [0xF0, 0xFE, 0x15] — 3 crenellations
- **Broken pattern (BlueMaze1 row 0):** [0xF0, 0xFF, 0xFF] — solid wall
- **Fix:** Re-derive patterns from adventure.asm lines 2050–2270
- **Verification:** Use analyze_screenshot.js to verify ASCII map shows corridors (not solid yellow)

## Phase 2: Implement Missing Mechanics

### Task 3: Dragon AI + Bat Teleport + Magnet + Bridge (Sub-Agent 3)
- Dragon AI: Random walk + chase when within 40px of player
- Bat teleport: Collision with bat → random room teleport
- Magnet: Pull player toward it when nearby
- Bridge: One-way teleport room 4 → room 11

### Task 4: Carry/Drop + Chalice Win (Sub-Agent 4)
- Pickup collision detection
- Carried object attached to player visually
- Space to drop
- Win condition: room 17 + chalice

### Task 5: 2nd Player + Sound + Score Overlay (Sub-Agent 5)
- IJKL controls for 2nd player
- Web Audio API: pickup chirp, dragon roar, low battery beep
- DOM overlay: level, lives, chalice indicator
- Lives system: 3 lives, game over

## Phase 3: Comparison & Polish

### Task 6: Side-by-Side Comparison (Sub-Agent 6)
- Generate screenshots of each room
- Compare with real Adventure screenshots
- Fix any visual discrepancies
- Iterate until 1:1 fidelity

## Quick Wins (5-Min Tasks)
1. Remove dead code `_getRoomPattern()` from Renderer.js
2. Add frame-swap interval to dragons (alternate GfxDragon0 ↔ GfxDragon1 every 8 frames)
3. Add Space key handler in Input.js to drop carried object
4. Add "Level 1" indicator in HTML overlay

## Verification Checklist
- [ ] All JS syntax checks pass
- [ ] JSON is valid
- [ ] Room 17 renders correctly (castle, portcullis, player)
- [ ] Movement works in all directions (no inversion)
- [ ] Maze rooms show corridors (not solid yellow)
- [ ] Dragon AI moves and chases
- [ ] Bat teleport works
- [ ] Magnet attracts player
- [ ] Bridge teleport works
- [ ] Carry/drop works
- [ ] Chalice win condition triggers
- [ ] 2nd player (IJKL) moves independently
- [ ] Sound effects play
- [ ] Score/lives/chalice overlay visible
- [ ] Lives system works (3 lives, game over)
- [ ] Side-by-side comparison with real Adventure passes

## Files to Check
- src/main.js — game loop, input → physics → state → render
- src/engine/Input.js — WASD/Arrow/IJKL → movement vector
- src/engine/Physics.js — room bounds, exits, AABB collisions, pickups
- src/engine/Renderer.js — clear, drawWalls, drawThinWalls, drawPortcullis, drawObjects
- src/engine/Sprites.js — palette, sprites, room wall patterns
- src/entities/Entity.js — base class
- src/entities/EntityManager.js — 30 rooms, 18 objects, room loading
- src/state/GameContext.js — 6502 registers ($80–$9F)
- src/data/world_data.json — all room/object/level data
- index.html — entry point, canvas 160x192, CSS scales to 640x768
- server.js — Bun static server
- analyze_screenshot.js — PNG decoder + pixel classifier
- HANDOVER.md — this document

## Useful Greps
```bash
# All room patterns
grep -n "CastleDef\|BlueMaze\|MazeMiddle\|RedMaze\|BlackMaze" src/engine/Sprites.js

# All exits with level-adjusted values (>= 0x80)
grep -n "0x80\|128" src/data/world_data.json

# All playfield bit references
grep -n "_getPfBit\|PF0\|PF1\|PF2" src/engine/Renderer.js

# All sprite definitions
grep -n "^const Gfx" src/engine/Sprites.js
```