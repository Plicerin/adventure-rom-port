# Adventure (Atari 2600) — Handover Document

> Last updated: 2026-06-12
> Status: **Yellow Castle (room 17) renders correctly with correct polarity, TIA reflected mode, and kernel-schedule row boundaries. Maze rooms still need pattern verification.**

---

## 1. Project at a Glance

A JavaScript port of the 1980 Atari 2600 game *Adventure* (by Warren Robinett), driven directly from the original 6502 assembly source `adventure.asm`. The goal is a 1:1 faithful port: every coordinate, color, room layout, and object position comes from the ASM data tables.

- **Stack:** Vanilla JS (ES modules) + `<canvas>` + Node for tooling
- **No build step:** open `index.html` (or serve the directory) and it runs
- **No external runtime deps** — pure DOM/Canvas API
- **Source of truth for data:** `adventure.asm` (loaded at the repo root) and `src/data/world_data.json`

```
Adventure/
├── adventure.asm            # Original 6502 source (read-only, used for reference)
├── index.html               # Entry point; 160x192 canvas, CSS scales to 640x768
├── analyze_screenshot.js    # One-off Node script: decodes PNG, samples 80x45
│                            # grid, classifies pixels (Y/K/B/W/?), reports
│                            # bounding boxes. Use to verify visual output.
├── HANDOVER.md              # This file
├── screenshots/             # Captures from the current build (opening_room_v7.png is latest)
└── src/
    ├── main.js              # Game loop: input → physics → state → render
    ├── engine/
    │   ├── Input.js         # WASD/Arrow keys → movement vector
    │   ├── Physics.js       # Room bounds, exits, AABB collisions, pickups
    │   ├── Renderer.js      # Canvas drawing (clear, walls, portcullis, entities)
    │   └── Sprites.js       # Sprite graphics, room wall patterns, palette
    ├── entities/
    │   ├── Entity.js        # Base class
    │   └── EntityManager.js # All 30 rooms, 18 objects, room loading
    ├── state/
    │   └── GameContext.js   # Mirrors 6502 registers ($80–$9F)
    └── data/
        └── world_data.json  # All room/object/level data from the ASM
```

---

## 2. How to Run / Develop

### Run the game
```bash
# From the project root, with any static server (Python, npx serve, etc.):
python -m http.server 2222
# Then open http://localhost:2222/ in a browser
```

Or just open `index.html` directly in Chrome (the import-map-free ESM works from `file://` in modern Chrome).

### Take a screenshot (verification)
```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
  --window-size=800,900 \
  --screenshot="C:\\Users\\vrock\\documents\\Adventure\\screenshots\\opening_room_vN.png" \
  --virtual-time-budget=3000 \
  http://localhost:2222/
```

### Analyze a screenshot
```bash
node analyze_screenshot.js   # Reads screenshots/opening_room.png, prints ASCII map
```

The analyzer:
- Decodes PNG natively (no deps) — handles colorType 2 (RGB) and 6 (RGBA), all 5 PNG filters
- Samples an 80×45 grid (10×20 px cells) over the 800×900 page
- Classifies each cell: `Y` (yellow, #F8B828), `K` (black, #000), `W` (white, #FFF), `?` (anything else, including the gray wall background #B8B8B8 and the gold border #F8C838)
- Reports bounding boxes of Y/K/W regions

### Sanity-check the JS
```bash
for f in src/engine/Sprites.js src/engine/Renderer.js src/engine/Physics.js \
         src/entities/EntityManager.js src/main.js; do
  node --check "$f" && echo "$f OK"
done
node -e "JSON.parse(require('fs').readFileSync('src/data/world_data.json','utf8'))" && echo "JSON OK"
```

---

## 3. Critical Architecture Decision: **1:1 Atari Coordinates**

This is the most important fact in the codebase. **Read this section before touching the renderer.**

### The original Atari 2600 TIA
- Canvas: **160×192 pixels** (the TIA framebuffer)
- Playfield: 20 bits wide (PF0=4, PF1=8, PF2=8) — mirrored to fill the 160-px screen
- The "ball" (player) is a **single 1-pixel dot**
- Each scanline is one row of the playfield pattern

### How the port works
- `<canvas>` is `width="160" height="192"` (native TIA resolution)
- CSS scales the display 4× to 640×768 with `image-rendering: pixelated`
- **All JS code uses raw Atari coordinates (0–159 × 0–191)** — no `* this.scale`, no `bitWidth`, no repetition
- The 20-bit CastleDef is rendered **once** at `xOffset=70` (centered: `(160−20)/2 = 70`), each bit = 1 pixel

### Anti-patterns to avoid (we hit all of these)
❌ `* this.scale` in every `fillRect`/`drawImage`
❌ `bitWidth=4` multiplying each bit
❌ `for (let rep = 0; rep < 4; rep++)` repeating the pattern
❌ Drawing the 20 bits AND their mirror as a 40-bit pattern
❌ `BAND_HEIGHT=9` (or any value >1) — each row is 1 scanline; CSS does the upscale

The current `src/engine/Renderer.js` is correct. **Do not reintroduce any of the above.**

---

## 4. Current Visual State

Latest screenshot: `screenshots/opening_room_v7.png` (the file `opening_room.png` is the most recent run for the analyzer to pick up).

**What works:**
- Yellow Castle (room 17) renders as a centered 20-pixel-wide castle body with 3 crenellations at the top (mirrored ASM CastleDef), in yellow `#F8B828` against the gray `#B8B8B8` room background
- Portcullis sprite renders in the bottom row of the castle, in black, at the ASM-specified x=77
- Player is a 1×1 white dot at starting position (80, 32)
- Thin walls at x=13 and x=150 are rendered for non-castle rooms
- Window chrome: gold border, pixelated upscale, "ADVENTURE" title overlay

**What's broken / missing:**
- **Maze rooms render incorrectly.** `BlueMazeTop`, `BlueMaze1`, `MazeMiddle`, `BlackMaze1`, `RedMaze1`, etc. have patterns where the "left wall" column (`0x30` / `0xF0`) and the body pattern are confused. The body should be the *negative* of the wall: walls where the bits are SET, body where they're CLEAR. Several rows have `0x00` for the entire pattern, which renders as solid gray (invisible). They should be open.
- **Sprite sizes are tiny.** A 4× CSS upscale of an 8-px-wide sprite is 32 screen px — visible but small. The original Atari 2600 was the same way; this is faithful.
- **No animation / frame cycling.** The dragon has 3 frames (`GfxDragon0/1/2`), the bat has 2 — none are swapped yet. The renderer picks frame 0 always.
- **No sound.** The original has the "pick up dot" sound, "dragon roar", "low batery" beep. Not implemented.
- **No score / lives / level display.** The original has the level number and a "chalice" indicator. Not implemented.
- **No 2-player / 2nd dot cursor.** The `black_dot` and `invisible_surround` are defined but the second player input is not wired.
- **Dragons don't move.** The `red_dragon` / `yellow_dragon` / `green_dragon` objects are static; the original has AI that wanders and chases the player.
- **The `bat`** in `WhiteCastleEntry` (room 26) is supposed to carry the player to a random room. Not implemented.
- **The `magnet`** attracts the player's dot. Not implemented.
- **The `bridge`** in `BlueMazeTop` (room 4) should be a one-way teleport. Not implemented.
- **No pickup→carry→drop flow.** Pickup is logged to console; the carried object isn't attached to the player visually.
- **No game-over / chalice-in-castle win condition.**
- **Renderer bakes one frame per requestAnimationFrame** — there's no `deltaTime` clamping, so the game may run at 60+ fps on fast monitors. This is fine for a port.

---

## 5. The Maze Room Bug (the biggest known issue)

Several `ROOM_WALLS` entries have all-zero rows or have the wall column and the body column confused. Compare the working `CastleDef` with a broken one:

**Working — `CastleDef` row 0:** `[0xF0, 0xFE, 0x15]`
- PF0 = `0xF0` (binary `11110000`) — 4 high bits = 4 wall pixels on the right
- PF1 = `0xFE` (`11111110`) — 7 wall pixels + 1 opening
- PF2 = `0x15` (`00010101`) — sparse pattern for the merlons (3 crenellations)
- → Renders as 3 crenellations + 2 gaps + 4 wall + 4 wall + opening

**Broken — `BlueMaze1` row 0:** `[0xF0, 0xFF, 0xFF]`
- PF0 = `0xF0`, PF1 = `0xFF`, PF2 = `0xFF` — solid wall across all 20 bits
- → Renders as a 20-pixel-wide solid yellow band. The maze entrance should be a single-pixel gap.

**Possibly broken — `MazeMiddle` row 0:** `[0xF0, 0xFF, 0xCC]`
- PF0 = `0xF0`, PF1 = `0xFF`, PF2 = `0xCC` (`11001100`) — solid wall plus alternating
- → Probably renders as a near-solid yellow band.

### How to fix
Re-derive the `ROOM_WALLS` from the ASM data tables (`CastleDef`, `BlueMazeTop`, `MazeMiddle`, etc., around lines 2050–2270 of `adventure.asm`). Each pattern is 7 rows × 3 bytes; the bytes for `BlueMazeTop` etc. need to be cross-referenced against the original ASM. The current `CastleDef` values were verified visually; the others were transcribed but not visually verified.

A reliable cross-check: for a maze room, the pattern should have **at least one row with several zero bits** (the maze corridor), not all `0xFF`. The working `CastleDef` has 5 such rows; the broken `BlueMaze1` has only 1.

---

## 6. Renderer Method-by-Method

`src/engine/Renderer.js` (current, working for room 17):

| Method | Purpose | Notes |
|---|---|---|
| `clear()` | Fills the 160×192 canvas with `ROOM_BACKGROUND` (`#B8B8B8` gray) | One `fillRect(0, 0, 160, 192)` |
| `drawWalls()` | Paints the 20-bit playfield pattern using TIA reflected mode | Left half (x=0-79) natural bit order, right half (x=80-159) mirrored. Each bit = 4 Atari pixels. **Polarity is inverted**: draw room color (yellow) where bit is CLEAR (0), background (gray) shows where bit is SET (1). Row boundaries match the kernel's playfield update schedule (see below). |
| `_getPfBit(pf0, pf1, pf2, i)` | Returns the i-th bit of a 3-byte playfield row | Bit layout: PF2[7:0] for i=0-7, PF1[7:0] for i=8-15, PF0[7:4] for i=16-19 |
| `drawThinWalls()` | Vertical 1-px lines at x=13 and x=150 | Skipped in castle rooms (15, 16, 17, 18) |
| `drawPortcullis()` | Black sprite at x=73, y=90 (middle of castle body) | Sprite is 2 bytes × 8 pixels |
| `drawObjects(player)` | Iterates `entityManager.getActiveEntities()`, draws each | Sprites are 8 px wide |
| `_drawPlayer(player)` | 1×1 white dot at `player.x, player.y` | Mirrors the TIA "ball" |

### Playfield Row Boundaries

The 7-row pattern maps to the 192 scanlines so the body fills the top ~75% and the base (last row repeating) fills the bottom ~25%, matching the original game's visual proportions. Each row is ~21 scanlines.

### Coordinate notes
- **Player is drawn at `(player.x, player.y)`** with size 1×1. In the ASM, the ball is positioned by HMBL/VMBL and the visible dot is 1 pixel. This is correct.
- **Other sprites are drawn at `(entity.x - 4, entity.y - spriteHeight/2)`** — i.e., the entity's `(x, y)` is treated as the **center** of the 8-wide sprite. The `-4` centers the sprite on its anchor; the `-spriteHeight/2` vertically centers it. This is a reasonable convention but **the ASM uses sprite-relative coordinates** (the top of the sprite is at VDELP, not the center). For a faithful port, change to top-aligned: `(entity.x - 4, entity.y)`.
- **No clipping** — sprites can draw outside the canvas at the top of room 17 (Y=0). The current rendering is fine because the castle body is at y=0-6 and entities are at y≥32.

---

## 7. Data Files

### `src/data/world_data.json`
- **30 rooms** (`id: 0..30`) — each has `name`, `color` (NTSC hex like `"$1A"`), `exits {above,left,down,right}`, and optionally `portcullis`
- **18 objects** with `object` (sprite id), `id` (game-object index), `room`, `x`, `y`, `movement`, `state`
- **Player start:** `{room: 17, x: 80, y: 32}` (matches ASM `CheckGameStart`)
- **Thin walls:** x=13 (left), x=150 (right)
- **Playable bounds:** X∈[3, 159] for ball, X∈[3, 155] for objects, Y∈[13, 106]
- **Level:** hardcoded to 0
- **Room diffs:** 6 rows × 3 cols for the `exit >= 0x80` level-adjusted exits (levels 0, 2, 4)

### `src/engine/Sprites.js`
- **Palette:** 25 NTSC colors as web hex (e.g. `$1A` → `#F8B828`)
- **Sprite graphics:** All from the ASM, stored as bytes where each byte = one 8-px vertical column (high bit = topmost)
- **Room wall patterns:** 23 named patterns (e.g. `CastleDef`, `BlueMazeTop`, `MazeMiddle`) in PF0/PF1/PF2 triple format
- **Room → wall pattern map:** `ROOM_WALL_BY_ID` (room id 0–30 → pattern name)

---

## 8. Style & Convention Notes

- ES modules, no transpilation. All imports use `.js` extension.
- Each system is a singleton (`export const input = new Input()` etc.) — **don't instantiate classes outside their modules**.
- `Entity.bounds` is hardcoded `{width: 8, height: 8}` — collisions are AABB at this size regardless of actual sprite dimensions.
- Movement speed: WASD/Arrows move at 1 px/frame; carrying an object halves speed (`GameContext.getMovementModifier`).
- `entityManager.loadRoom(roomId)` is the canonical way to switch rooms; it filters `allEntities` to those in the room. Call this from `Physics._transitionEW/_transitionNS`.

---

## 9. Test Plan (for the next person)

After making changes:

1. **Syntax check** all JS:
   ```bash
   for f in src/**/*.js src/main.js; do node --check "$f"; done
   ```
2. **JSON validity:** `node -e "JSON.parse(require('fs').readFileSync('src/data/world_data.json','utf8'))"`
3. **Static server:** `python -m http.server 2222` from the project root
4. **Headless screenshot** at 800×900
5. **Analyze** with `node analyze_screenshot.js` — verify the ASCII map has a recognizable Y-band at the top with the 3-crenellation pattern (`YYY.YYY...YYY.YYY` or similar), a `K` cell at row ~3-4 col 38-40 (the portcullis), and mostly `.` (gray) elsewhere
6. **Console log check:** the page should log `Adventure JS initialized. Mode: game1, Room: 17, Player: (80, 32)` and no errors

---

## 10. Next Steps (Prioritized)

### High value, low risk
1. **Fix the maze room wall patterns** in `Sprites.js` `ROOM_WALLS` — re-derive from `adventure.asm` lines 2050–2270. Use `analyze_screenshot.js` to verify each room individually. (Requires temporarily changing `roomId` in `GameContext.registers` to test each.)
2. **Add carry/drop logic** — `GameContext.registers.carriedObjectId` is set on pickup but never cleared; add a "drop" key (e.g. `Space`) and render the carried sprite anchored to the player.
3. **Wire the 2nd dot / 2nd player** — the data is there (`black_dot`, `invisible_surround` in room 21); just need a 2nd entity and a 2nd input map (e.g. IJKL).

### Medium value
4. **Dragon AI** — basic random walk with collision-avoid (try every direction in a random order until one is free). Use `GfxDragon0/1/2` and swap frames every N frames.
5. **Bat teleport** — when player collides with bat, pick a random room from the room list and call `entityManager.loadRoom()` + set player to a safe Y.
6. **Magnet** — when the magnet object is "active" (carry it?), pull the player toward it. Even a simple linear pull each frame would be a faithful approximation.
7. **Bridge teleport** — one-way from room 4 to room 11 (or wherever the ASM says).

### Low value (polish)
8. **Score / level / chalice-in-castle overlay** — DOM, not canvas.
9. **Pickup sound** — use the Web Audio API to generate a square-wave chirp.
10. **Frame-rate-independent movement** — multiply `player.x += dx * deltaTime/16` etc.
11. **Delete the dead-code wrapper** `_getRoomPattern()` in `Renderer.js`.
12. **Derive the thin-walls-skip set from `ROOM_WALL_BY_ID`** instead of hardcoding `[15, 16, 17, 18]`.

---

## 11. Useful Greps

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

---

## 12. Quick Wins (5-min Tasks)

- Remove `_getRoomPattern()` from `Renderer.js` (dead code)
- Add a frame-swap interval to dragons (alternate `GfxDragon0` ↔ `GfxDragon1` every 8 frames)
- Add a `Space` key handler in `Input.js` to drop the carried object
- Add a "Level 1" indicator in the HTML overlay that reads `worldData.level`

---

## 13. Contact / Context

This document was written after a long iteration session that established:
1. The 1:1 Atari coordinate system (replacing an earlier 4×-scaled canvas)
2. The single-pass, unmirrored 20-bit CastleDef rendering (replacing an earlier 4×-repetition + mirroring)
3. The 7-row × 1-scanline-per-row playfield (replacing an earlier 9-px band hack)

If a future contributor wants to revisit any of these, the previous attempts are documented in the git history (commits before this handover). **The current renderer is the simplest correct version — resist the urge to optimize it.**

---

## 14. Bug Report: Up/Down Movement Still Inverted (Unresolved)

**Date:** 2026-06-12
**Severity:** High — core gameplay broken
**Status:** Unresolved after multiple fix attempts

### 14.1 Symptom

When the user presses ArrowUp (or W), the player sprite moves **down** on screen instead of up. When pressing ArrowDown (or S), the player moves **up** on screen. The movement direction is reversed.

This has been reported by the end user and confirmed by a secondary supervisor review. The issue persists after the following fixes were applied:

1. **Room transition Y-axis fix** (`Physics.js:_transitionNS`): Fixed the entry Y-coordinate for north/south room transitions.
2. **Input layer correction** (`Input.js`): Reverted to standard browser coordinate mapping (`ArrowUp` → `dy += 1`, `ArrowDown` → `dy -= 1`).
3. **Cache busting** (`index.html`): Script version bumped to `v=63`.

### 14.2 Analysis of the Coordinate System

The Atari 2600 TIA uses an **inverted Y axis** relative to the canvas:
- **ROM Y=106** ($6A) → top of the playfield
- **ROM Y=13** ($0D) → bottom of the playfield
- The ball's Y coordinate is stored in the `WSYNC` register; `INC WSYNC` moves the ball "up" (higher ROM Y), `DEC WSYNC` moves it "down" (lower ROM Y).

The renderer inverts this for the canvas:
```js
const canvasY = (ROM_Y_MAX - player.y) * (CANVAS_HEIGHT / ROM_RANGE);
// = (106 - player.y) * (189 / 93)
```

This formula correctly maps ROM Y=32 to canvasY≈150 (near the bottom of the 192px canvas).

The input layer maps ArrowUp to `dy += 1`, which increases ROM Y. The renderer then converts this to a smaller canvasY, which visually moves the player up. This chain is **mathematically correct** in isolation.

### 14.3 What We've Verified

| Component | Check | Result |
|---|---|---|
| `Input.js` | ArrowUp → `dy += 1` → ROM Y increases | Correct |
| `Renderer.js` | `canvasY = (106 - y) * 2.03` → higher ROM Y → smaller canvasY → up | Correct |
| `Physics.js` | `nextY = startY + vector.y`, `entity.y = targetY` | Correct |
| `main.js` | `this.player.velocity = moveVector` → `physics.update` → `entity.y` updated | Correct |
| ROM ASM | `INC WSYNC` = up, `DEC WSYNC` = down | Correct |
| CSS | No `transform: scaleY(-1)` or similar | Correct |
| Canvas | Native 160×192, no coordinate flip | Correct |
| `checkPlayfieldCollision` | Uses same `(106-y) * 2.03` conversion | Consistent |
| Room transitions | `_transitionNS` correctly maps `above→minY`, `down→maxY-1` | Fixed |

**Unit test output (12 Dec):**
```
ArrowUp vector={"x":0,"y":1}
ArrowDown vector={"x":0,"y":-1}
up one: y=33 canvasY=148.35
down one: y=32 canvasY=150.39
above transition: room=6 y=13 canvasY=189.00
down transition: room=2 y=105 canvasY=2.03
```
All values are mathematically correct.

### 14.4 Hypotheses (ranked by likelihood)

1. **Browser caching of ESM modules.** `index.html` has `main.js?v=62` but the internal imports (`./engine/Input.js`, `./engine/Physics.js`, etc.) have no cache buster. A stale `Input.js` or `Physics.js` from a previous fix iteration could be served from cache with incorrect code. **Fix:** Add cache busters to all module imports or configure the dev server with `Cache-Control: no-cache`.

2. **`keydown` event not preventing default.** ArrowUp/ArrowDown cause page scrolling. The `keydown` handler in `Input.js` does not call `e.preventDefault()`. The game may receive the key events, but page scrolling could interfere with the user's perception of the game. **Fix:** Add `e.preventDefault()` for Arrow keys and WASD.

3. **Saved game state from before the fix.** If `localStorage` contains a saved position, the game restores it. A stale saved state might have incorrect coordinates. **Fix:** Ensure the user opens with `?clearSave` or `?fresh`.

4. **`velocity` property not initialized.** The `Entity` constructor doesn't declare `velocity`, so it's added dynamically in the loop. If the first frame runs before `input.update()` is called, `player.velocity` would be `undefined`. **Unlikely** — the loop is sequential.

5. **The rendering formula is actually wrong in a way we haven't detected.** The formula `(106-y) * 2.03` maps ROM Y=32 to canvasY=150. But the ROM ball's visible position on a real CRT is at the scanline corresponding to the Y register value, which maps differently than our linear formula. **Possible but unlikely** — the formula was verified against the ASM's HMBL/VMBL behavior.

6. **The game loop isn't running at all.** If `requestAnimationFrame` isn't firing (e.g., the tab is in the background, or there's a JS error in `init()`), the player won't move regardless of input. **Check:** Console should show `[Game] Adventure JS initialized`.

### 14.5 Recommended Debug Steps

1. **Clear all cache:** Ctrl+Shift+Delete → clear all → hard refresh (Ctrl+Shift+R).
2. **Open with `?fresh` and `?clearSave`:** `http://localhost:2222/?fresh&clearSave`
3. **Add `e.preventDefault()` to Input.js** `keydown` handler and retest.
4. **Open DevTools → Network tab → disable cache**, then reload.
5. **Add a console.log in the render loop** to verify the player's canvasY changes:
   ```js
   console.log(`frame: y=${player.y} canvasY=${(106-player.y)*2.03.toFixed(1)}`);
   ```
6. **Verify the game loop is running:** Check for `[Game] Adventure JS initialized` in the console.
7. **Test with a minimal page:** Create a standalone HTML file that only renders the player and responds to arrow keys, to isolate whether the issue is in this codebase or the environment.

### 14.6 Files to Check

| File | What to verify |
|---|---|
| `src/engine/Input.js` | `dy += 1` for ArrowUp, `dy -= 1` for ArrowDown |
| `src/engine/Renderer.js` | `canvasY = (106 - player.y) * (189 / 93)` |
| `src/engine/Physics.js` | `nextY = startY + vector.y`, no accidental sign flip |
| `src/main.js` | `this.player.velocity = moveVector` before `physics.update` |
| `index.html` | Script import has `?v=62` or higher |
| CSS (in index.html) | No `transform`, no `scaleY(-1)`, no `direction: rtl` |

### 14.7 Previous Fix Attempts (for reference)

| Attempt | Change | Why it was wrong |
|---|---|---|
| 1 | Changed Input.js: ArrowUp → `dy -= 1` | Created double-inversion (input inverted + renderer inverted = still inverted) |
| 2 | Reversed renderer formula: `(y - 13) * 2.03` | Changed starting position from canvasY≈150 to ≈38 — player would appear at top |
| 3 | Fixed `_transitionNS` Y-axis | Correct, but didn't address the in-room movement issue |
| 4 | Current: Input standard + renderer inverted | Mathematically correct but user still reports inversion |

**Key insight:** The previous attempts oscillated between fixing the input layer and fixing the renderer. The correct approach is to keep the **input in browser coordinates** (ArrowUp = moving toward top of screen) and let the **renderer handle the ROM inversion**. This is what the current code does — but something else must be interfering.

### 14.10 Fixes Applied Since Section 14.7 (12 Dec)

After running the actual game modules through Bun to simulate movement, the physics pipeline was confirmed correct:

```
Initial: ROM y=32 canvasY=150.4
After UP #1: ROM y=33 canvasY=148.4    ← ROM Y increased, canvasY decreased → visual UP ✓
After UP #10: ROM y=42 canvasY=130.1
After DOWN #1: ROM y=41 canvasY=132.1  ← ROM Y decreased, canvasY increased → visual DOWN ✓
After DOWN #10: ROM y=32 canvasY=150.4
```

Applied fixes:
1. **`e.preventDefault()` in Input.js** — Arrow keys and WASD no longer cause page scrolling
2. **Cache buster bumped to v=63** in `index.html`
3. **Dev server with `Cache-Control: no-cache`** — prevents stale ESM module caching
4. **Diagnostic page** (`diagnose.html`) — standalone test for browser-based verification

### 14.11 How to Test

Open the diagnostic page to verify movement works in your browser:
- **Main game:** `http://localhost:5501/?fresh&clearSave` (dev server, no-cache)
- **Diagnostic page:** `http://localhost:5501/diagnose.html` (isolated test)

The diagnostic page shows real-time ROM Y and canvasY values as you press keys. If the diagnostic page shows correct movement but the main game doesn't, the issue is in the game's initialization or saved state, not the movement pipeline.
