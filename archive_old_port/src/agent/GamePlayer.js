/**
 * Adventure Game Playing Agent
 *
 * Uses Playwright to automate the Atari 2600 Adventure game served at
 * http://localhost:54507.  Reads game state from localStorage,
 * simulates keyboard input, and makes intelligent decisions.
 *
 * Usage:  node src/agent/GamePlayer.js [mode]
 *   mode  — "explore" (default), "solve", or "demo"
 */

import { chromium } from "playwright";

// ─── Game constants ────────────────────────────────────────────────

const GAME_URL = "http://localhost:5501/?game=1&fresh=1&cache=level-fix-2";
const STORAGE_KEY = "adventure_context";

// Room exit map (bit 7 = 0x80 means door is closed / leads to self)
// Source: EntityManager.js worldData.rooms (the authoritative version)
const ROOM_DATA = [
  { id: 0,  name: "Number Room",         exits: { above: 0,  left: 0,  down: 0,  right: 0  } },
  { id: 1,  name: "Top Access (8 Clock)", exits: { above: 8,  left: 2,  down: 128, right: 3  } },
  { id: 2,  name: "Top Access (Green)",   exits: { above: 17, left: 13, down: 131, right: 3  } },
  { id: 3,  name: "Left of Name",         exits: { above: 6,  left: 2,  down: 134, right: 2  } },
  { id: 4,  name: "Top of Blue Maze",     exits: { above: 16, left: 5,  down: 7,  right: 6  } },
  { id: 5,  name: "Blue Maze 1",          exits: { above: 29, left: 6,  down: 8,  right: 4  } },
  { id: 6,  name: "Bottom of Blue Maze",  exits: { above: 7,  left: 4,  down: 3,  right: 5  } },
  { id: 7,  name: "Center of Blue Maze",  exits: { above: 4,  left: 8,  down: 6,  right: 8  } },
  { id: 8,  name: "Blue Maze Entry",      exits: { above: 5,  left: 7,  down: 1,  right: 7  } },
  { id: 9,  name: "Maze Middle",          exits: { above: 10, left: 10, down: 11, right: 10  } },
  { id: 10, name: "Maze Entry",           exits: { above: 3,  left: 9,  down: 9,  right: 9  } },
  { id: 11, name: "Maze Side",            exits: { above: 9,  left: 12, down: 28, right: 13  } },
  { id: 12, name: "Side Corridor",        exits: { above: 28, left: 13, down: 29, right: 11  } },
  { id: 13, name: "Side Corridor 2",      exits: { above: 15,  left: 13, down: 13, right: 2 } },
  { id: 14, name: "Top Entry Room",       exits: { above: 13, left: 16, down: 15, right: 16  } },
  { id: 15, name: "White Castle",         exits: { above: 14, left: 15, down: 13, right: 15 }, portcullis: 1 },
  { id: 16, name: "Black Castle",         exits: { above: 1,  left: 28, down: 4,  right: 28 }, portcullis: 2 },
  { id: 17, name: "Yellow Castle",        exits: { above: 6,  left: 3,  down: 2,  right: 1  }, portcullis: 0 },
  { id: 18, name: "Yellow Castle Entry",  exits: { above: 18, left: 18, down: 18, right: 18  } },
  { id: 19, name: "Black Maze 1",         exits: { above: 21, left: 20, down: 21, right: 22  } },
  { id: 20, name: "Black Maze 2",         exits: { above: 22, left: 21, down: 22, right: 19  } },
  { id: 21, name: "Black Maze 3",         exits: { above: 19, left: 22, down: 19, right: 20  } },
  { id: 22, name: "Black Maze Entry",     exits: { above: 20, left: 19, down: 27, right: 21  } },
  { id: 23, name: "Red Maze 1",           exits: { above: 25, left: 24, down: 25, right: 24  } },
  { id: 24, name: "Top of Red Maze",      exits: { above: 26, left: 23, down: 26, right: 23  } },
  { id: 25, name: "Bottom of Red Maze",   exits: { above: 23, left: 26, down: 23, right: 26  } },
  { id: 26, name: "White Castle Entry",   exits: { above: 24, left: 25, down: 24, right: 25  } },
  { id: 27, name: "Black Castle Entry",   exits: { above: 137, left: 137, down: 137, right: 137 } },
  { id: 28, name: "Other Purple Room",    exits: { above: 29, left: 7,  down: 140, right: 8  } },
  { id: 29, name: "Top Entry Room (R)",   exits: { above: 143, left: 1,  down: 16, right: 3  } },
  { id: 30, name: "Name Room",            exits: { above: 6,  left: 1,  down: 6,  right: 3  } },
];

// Objects with their locations and purpose
const OBJECTS = [
  { id: 0,  name: "portcullis_1", room: 17, x: 77, y: 49, pcIndex: 0 },
  { id: 1,  name: "portcullis_2", room: 15, x: 77, y: 49, pcIndex: 1 },
  { id: 2,  name: "portcullis_3", room: 16, x: 77, y: 49, pcIndex: 2 },
  { id: 4,  name: "author",       room: 29, x: 80, y: 105 },
  { id: 5,  name: "number",       room: 0,  x: 80, y: 64 },
  { id: 6,  name: "red_dragon",   room: 14, x: 80, y: 32 },
  { id: 7,  name: "yellow_dragon",room: 1,  x: 80, y: 32 },
  { id: 8,  name: "green_dragon", room: 29, x: 80, y: 32 },
  { id: 9,  name: "sword",        room: 18, x: 32, y: 32 },
  { id: 10, name: "bridge",       room: 4,  x: 41, y: 55 },
  { id: 11, name: "yellow_key",   room: 17, x: 32, y: 64 },
  { id: 12, name: "white_key",    room: 14, x: 32, y: 64 },
  { id: 13, name: "black_key",    room: 29, x: 32, y: 64 },
  { id: 14, name: "bat",          room: 26, x: 32, y: 32 },
  { id: 16, name: "chalice",      room: 28, x: 48, y: 32 },
  { id: 17, name: "magnet",       room: 27, x: 128, y: 32 },
];

// Portcullis: index → key object id needed, target room, open room behind it
const PORTCULLIS_INFO = {
  0: { keyId: 11, keyName: "yellow_key",  interiorRoom: 17, entryRoom: 18, openRoomName: "Yellow Castle Entry" },
  1: { keyId: 12, keyName: "white_key",   interiorRoom: 15, entryRoom: 26, openRoomName: "White Castle" },
  2: { keyId: 13, keyName: "black_key",   interiorRoom: 16, entryRoom: 27, openRoomName: "Black Castle" },
};

// ─── Helpers ───────────────────────────────────────────────────────

function log(label, msg) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] [${label}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Variation 1 / Game 1 RoomDiffs, flattened in ASM order (level 0).
const ROOM_DIFFS_LEVEL0 = [
  0x10, 0x0F, 0x0F, 0x05, 0x11, 0x11,
  0x1D, 0x0A, 0x0A, 0x1C, 0x16, 0x16,
  0x1B, 0x0C, 0x0C, 0x03, 0x0C, 0x0C,
];

/** Resolve a level-0 ASM room exit using the same RoomDiffs table as runtime. */
function resolveExit(roomId, direction) {
  const room = ROOM_DATA.find((r) => r.id === roomId);
  if (!room) return roomId;
  const val = room.exits[direction];
  if (val === undefined) return roomId;
  if ((val & 0x80) === 0) return val;
  const decoded = ROOM_DIFFS_LEVEL0[val - 0x80];
  return Number.isInteger(decoded) ? decoded : roomId;
}

/**
 * Breadth-first search for shortest path between rooms.
 * Returns an array of directions to take, e.g. ["right", "down"].
 */
function findPath(from, to) {
  if (from === to) return [];
  const visited = new Set();
  const queue = [[from, []]];
  visited.add(from);

  while (queue.length) {
    const [current, path] = queue.shift();
    for (const dir of ["above", "left", "down", "right"]) {
      const next = resolveExit(current, dir);
      if (next === to) return [...path, dir];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([next, [...path, dir]]);
      }
    }
  }
  return null; // no path
}

/**
 * Map direction name to a keyboard key code.
 */
function directionToKey(dir) {
  const map = {
    above: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  };
  return map[dir] || "ArrowUp";
}

// ─── GameState reader ──────────────────────────────────────────────

/**
 * Read live game state from window.GameContext (exposed by main.js).
 * This is the authoritative source — far more accurate than localStorage
 * which only updates every ~2 seconds.
 */
async function readGameState(page) {
  return await page.evaluate(() => {
    if (typeof GameContext === "undefined") return null;
    const r = GameContext.registers;
    return {
      roomId: r.roomId,
      playerX: r.playerX,
      playerY: r.playerY,
      ballX: r.ballX,
      ballY: r.ballY,
      carriedObjectId: r.carriedObjectId,
      portcullisStates: r.portcullisStates || [0x1c, 0x1c, 0x1c],
      frameCounter: r.frameCounter,
    };
  });
}

/**
 * Read active entities in the current room via page.evaluate().
 * Reads from entityManager which is a global export in the game.
 */
async function readActiveEntities(page) {
  return await page.evaluate(() => {
    if (typeof entityManager === "undefined") return [];
    return entityManager.getActiveEntities().map((e) => ({
      id: e.id,
      room: e.room,
      x: e.x,
      y: e.y,
      carriedBy: e.carriedBy ?? null,
    }));
  });
}

/**
 * Read game state with retry. Falls back to known initial state if
 * GameContext is not yet exposed on window.
 */
async function readGameContext(page, retries = 3, delayMs = 200) {
  let result = await readGameState(page);
  if (result && result.roomId !== null) return result;

  // GameContext not ready yet — retry a few times
  for (let i = 0; i < retries; i++) {
    await sleep(delayMs);
    result = await readGameState(page);
    if (result && result.roomId !== null) return result;
  }

  // Last resort: return known initial state
  return {
    roomId: 17,
    playerX: 80,
    playerY: 32,
    carriedObjectId: null,
    portcullisStates: [0x1c, 0x1c, 0x1c],
  };
}

// ─── Movement primitives ───────────────────────────────────────────

/**
 * Hold a direction for a number of frames, then release.
 * Each frame ≈ 16 ms at 60 fps; we hold for `frames * 16` ms.
 */
async function moveDirection(page, dir, frames = 60) {
  const key = directionToKey(dir);
  await page.keyboard.down(key);
  await sleep(frames * 16);
  await page.keyboard.up(key);
  await sleep(50); // small pause between moves
}

/**
 * Walk from current position to target (tx, ty) inside the same room.
 * Moves along X first, then Y.  The game uses 8x8 AABB collision,
 * so we need to overlap the target item's box (8x8) for pickup.
 */
async function walkTo(page, tx, ty, currentX, currentY, maxFrames = 300) {
  let cx = currentX;
  let cy = currentY;
  let framesRemaining = maxFrames;

  // Move along X first
  if (cx < tx) {
    const needed = Math.min(tx - cx, framesRemaining);
    if (needed > 0) {
      log("AGENT", `Move Right from ${cx} → ${Math.min(tx, cx + needed)}`);
      await moveDirection(page, "right", needed);
      cx += needed;
      framesRemaining -= needed;
    }
  } else if (cx > tx) {
    const needed = Math.min(cx - tx, framesRemaining);
    if (needed > 0) {
      log("AGENT", `Move Left from ${cx} → ${Math.max(tx, cx - needed)}`);
      await moveDirection(page, "left", needed);
      cx -= needed;
      framesRemaining -= needed;
    }
  }

  // Game/ROM Y increases upward: ArrowUp increases Y and ArrowDown decreases Y.
  if (cy < ty) {
    const needed = Math.min(ty - cy, framesRemaining);
    if (needed > 0) {
      log("AGENT", `Move Up from ${cy} → ${Math.min(ty, cy + needed)}`);
      await moveDirection(page, "above", needed);
      cy += needed;
      framesRemaining -= needed;
    }
  } else if (cy > ty) {
    const needed = Math.min(cy - ty, framesRemaining);
    if (needed > 0) {
      log("AGENT", `Move Down from ${cy} → ${Math.max(ty, cy - needed)}`);
      await moveDirection(page, "down", needed);
      cy -= needed;
      framesRemaining -= needed;
    }
  }

  return { x: cx, y: cy };
}

/**
 * Navigate between rooms.  Follows BFS path, walking one step per
 * direction until the target room is reached.
 */
async function navigateTo(page, targetRoomId) {
  const state = await readGameContext(page);
  const path = findPath(state.roomId, targetRoomId);

  if (!path) {
    log("AGENT", `No path from room ${state.roomId} to room ${targetRoomId}`);
    return false;
  }

  log("AGENT", `Path from ${state.roomId} (${getRoomName(state.roomId)}) → ${targetRoomId} (${getRoomName(targetRoomId)}): ${path.join(" → ")}`);

  for (const dir of path) {
    // Hold in bounded chunks and observe the authoritative room after each
    // chunk. A fixed 40-frame press is insufficient from Room 17's spawn.
    let transitioned = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const before = await readGameContext(page);
      await moveDirection(page, dir, 24);
      const after = await readGameContext(page);
      if (after.roomId !== before.roomId) {
        log("AGENT", `Moved ${dir} → now in room ${after.roomId} (${getRoomName(after.roomId)})`);
        transitioned = true;
        break;
      }
    }

    if (!transitioned) {
      const blocked = await readGameContext(page);
      log("AGENT", `✗ Exit ${dir} did not transition after 240 frames; still in room ${blocked.roomId} at (${blocked.playerX}, ${blocked.playerY})`);
      return false;
    }

    const newState = await readGameContext(page);
    if (newState.roomId === targetRoomId) break;
  }

  const final = await readGameContext(page);
  return final.roomId === targetRoomId;
}

function getRoomName(id) {
  const r = ROOM_DATA.find((r) => r.id === id);
  return r ? r.name : `Unknown(${id})`;
}

// ─── Action primitives ─────────────────────────────────────────────

/**
 * Pick up an item by walking over it.
 * The game auto-pickups when the player's AABB overlaps the item's AABB.
 * Each entity is 8x8 pixels.
 */
async function pickupItem(page, itemId, targetX, targetY) {
  const state = await readGameContext(page);
  log("AGENT", `Attempting to pick up ${itemId} at (${targetX}, ${targetY}), currently at (${state.playerX}, ${state.playerY})`);

  // Walk to the item's position — need to overlap the 8x8 box
  // Aim for the center of the item's bounding box
  const aimX = targetX + 4; // center offset
  const aimY = targetY + 4;

  await walkTo(page, aimX, aimY, state.playerX, state.playerY, 200);

  // Wait for pickup to register (game checks collision each frame)
  await sleep(500);

  const after = await readGameContext(page);
  if (after.carriedObjectId === itemId) {
    log("AGENT", `✓ Picked up ${itemId}`);
    return true;
  }
  log("AGENT", `✗ Failed to pick up ${itemId} (now carrying: ${after.carriedObjectId || "nothing"})`);
  return false;
}

/**
 * Drop the currently carried item at the player's current position.
 */
async function dropItem(page) {
  log("AGENT", "Dropping carried item (E key)");
  await page.keyboard.press("KeyE");
  await sleep(200);
  const state = await readGameContext(page);
  log("AGENT", `After drop — carrying: ${state.carriedObjectId || "nothing"}`);
}

/**
 * Open a portcullis by carrying the correct key near it.
 *
 * The game's physics auto-advances the portcullis state when a carried
 * key collides with the portcullis gate (within 16px).  Each frame the
 * key is near, the state advances by 1.  State cycles: 0x1c → 0x1d → …
 * → 0x38 → wraps to 0x01 (open).
 *
 * This method walks the player (carrying the key) near the portcullis
 * position and holds there until the portcullis opens.
 */
async function openPortcullis(page, pcIndex) {
  const info = PORTCULLIS_INFO[pcIndex];
  if (!info) {
    log("AGENT", `Unknown portcullis index ${pcIndex}`);
    return false;
  }

  const state = await readGameContext(page);
  const states = state.portcullisStates || [0x1c, 0x1c, 0x1c];
  let current = states[pcIndex] ?? 0x1c;

  log("AGENT", `Opening portcullis ${pcIndex} (${info.openRoomName}), key=${info.keyName}, current state=0x${current.toString(16)}`);

  // If we don't have the key, we can't open it
  if (state.carriedObjectId !== info.keyId) {
    log("AGENT", `Need ${info.keyName} (id ${info.keyId}) but carrying ${state.carriedObjectId || "nothing"}`);
    return false;
  }

  // If already open, skip
  if (current === 0x01) {
    log("AGENT", `Portcullis ${pcIndex} already open (0x01)`);
    return true;
  }

  // Walk to the portcullis position
  const pcObj = OBJECTS.find((o) => o.pcIndex === pcIndex);
  if (!pcObj) {
    log("AGENT", `Portcullis object for index ${pcIndex} not found`);
    return false;
  }

  // Aim near the portcullis — within 16px for collision detection
  // Portcullis is at pcX=77, pcY=49 (8x2 hitbox)
  // We need to be within 16px, so aim at the portcullis position
  await walkTo(page, pcObj.x, pcObj.y, state.playerX, state.playerY, 200);
  await sleep(300);

  // Now hold near the portcullis.  Each frame the key is near,
  // the state advances.  We need to cycle from current → 0x01.
  // Steps: from 0x1c to 0x01 = (0x39 - current) % 0x39 steps
  let stepsNeeded = (0x39 - current) & 0xff;
  if (stepsNeeded === 0) stepsNeeded = 0x39;

  log("AGENT", `Holding near portcullis — ~${stepsNeeded} frames needed to open`);

  // Hold ArrowRight to stay in place near the portcullis
  // while the game advances the state each frame
  const holdFrames = Math.min(stepsNeeded + 20, 200); // cap at 200 frames (~3.3s)
  await page.keyboard.down("ArrowRight");
  await sleep(holdFrames * 16);
  await page.keyboard.up("ArrowRight");
  await sleep(300);

  // Check if it opened
  const checkState = await readGameContext(page);
  const newSt = checkState.portcullisStates?.[pcIndex];
  if (newSt === 0x01) {
    log("AGENT", `✓ Portcullis ${pcIndex} is now OPEN (0x01)`);
    return true;
  }
  if (newSt !== undefined && newSt !== current) {
    log("AGENT", `  State advanced to 0x${newSt.toString(16)} (need 0x01)`);
  } else {
    log("AGENT", `  State unchanged at 0x${newSt?.toString(16) ?? "???"}`);
  }
  return false;
}

// ─── Mode: explore ─────────────────────────────────────────────────

async function modeExplore(page) {
  log("MODE", "Exploration mode — randomly walking around and logging state");

  const directions = ["above", "down", "left", "right"];
  let step = 0;
  const maxSteps = 100;

  while (step < maxSteps) {
    const state = await readGameContext(page);
    const entities = await readActiveEntities(page);

    log("STATE", `Room ${state.roomId} (${getRoomName(state.roomId)}) | Pos (${state.playerX}, ${state.playerY}) | Carrying: ${state.carriedObjectId || "None"} | Portcullis: [${state.portcullisStates.map((s) => "0x" + s.toString(16)).join(", ")}]`);
    log("ENTITIES", entities.map((e) => `${e.id}@(${e.x},${e.y})`).join(", "));

    // Random action
    const r = Math.random();
    if (r < 0.7) {
      // Move in a random direction
      const idx = Math.floor(Math.random() * 4);
      log("ACTION", `Move ${directions[idx]}`);
      await moveDirection(page, directions[idx], 40);
    } else if (r < 0.85) {
      // Drop item if carrying
      if (state.carriedObjectId) {
        log("ACTION", `Drop ${state.carriedObjectId}`);
        await dropItem(page);
      }
    } else {
      // Just observe
      log("ACTION", "Observe");
      await sleep(200);
    }

    step++;
    await sleep(100);

    // Every 20 steps, full dump
    if (step % 20 === 0) {
      log("───", "=== FULL STATE DUMP ===");
    }
  }

  log("MODE", "Exploration complete");
}

// ─── Mode: solve ───────────────────────────────────────────────────

/**
 * Solve mode follows the optimal path to collect the chalice:
 *
 * 1. Pick up yellow_key (id 11) in room 17
 * 2. Open portcullis 0 (yellow castle) using yellow_key
 * 3. Enter room 18 (Yellow Castle Entry) and get sword (id 9)
 * 4. Exit room 18 → navigate to room 14 for white_key (id 12)
 * 5. Open portcullis 1 (white castle) using white_key
 * 6. Navigate to room 29 for black_key (id 13)
 * 7. Open portcullis 2 (black castle) using black_key
 * 8. Navigate to room 28 and pick up chalice (id 16) — WIN!
 *
 * Path planning:
 *   Room 17 → 14:  17→3→2→14  (right, above, above)
 *   Room 14 → 29:  14→13→12→29 (down, right, down)
 *   Room 29 → 28:  29→16→28    (down, left)
 */
async function modeSolve(page) {
  log("MODE", "=== SOLVE MODE START ===");

  // ── Step 1: Pick up yellow_key (id 11) in room 17 ────────────
  {
    const state = await readGameContext(page);
    log("STEP", `1. Start in room ${state.roomId} (${getRoomName(state.roomId)})`);

    if (state.carriedObjectId !== 11) {
      await pickupItem(page, 11, 32, 64);
    } else {
      log("STEP", "Already carrying yellow_key");
    }
  }

  // ── Step 2: Open portcullis 0 (yellow castle) ─────────────────
  {
    log("STEP", "2. Open portcullis 0 (yellow castle)");
    const opened = await openPortcullis(page, 0);
    if (opened) {
      // Drop the key at the portcullis location
      await dropItem(page);
    }
  }

  // ── Step 3: Enter room 18 (Yellow Castle Entry) and get sword ─
  {
    log("STEP", "3. Enter room 18 (Yellow Castle Entry)");

    // Room 18 is the entry room for the yellow castle.
    // The player is in room 17 (interior). To enter room 18, they need
    // to go through the open portcullis. The portcullis transition
    // happens when the player walks into the gate from the interior room.
    // The portcullis is at X=77, Y=49 in room 17.
    // Walk to the portcullis and go right to trigger transition.

    // First, drop the key if we still have it
    const before = await readGameContext(page);
    if (before.carriedObjectId === 11) {
      await dropItem(page);
    }

    // Walk to the portcullis and push through
    log("AGENT", "Walking to portcullis and entering castle");
    const pcObj = OBJECTS.find((o) => o.pcIndex === 0);
    if (pcObj) {
      await walkTo(page, pcObj.x, pcObj.y, before.playerX, before.playerY, 100);
      await sleep(200);
      // Walk right to go through the open portcullis
      await moveDirection(page, "right", 40);
      await sleep(400);
    }

    // If we didn't transition, try going to room 18 directly
    const afterEnter = await readGameContext(page);
    if (afterEnter.roomId !== 18) {
      log("AGENT", `Not in room 18 (in room ${afterEnter.roomId}), trying alternate entry`);
      // Try going down from room 17 → room 2, then navigate to 18
      // Actually room 17→down→2, and room 2 doesn't lead to 18
      // The only way to room 18 is through the portcullis in room 17
      // or from room 17's right exit to room 3...
      // Let's try: go to room 17's right exit, then find a way
      log("AGENT", "Attempting to enter room 18 via portcullis from inside");
      // Walk to the bottom of room 17 and try going down
      // Actually, the portcullis transition from interior goes to entry room
      // when walking in the correct direction through the gate
      // Try walking left from the portcullis
      await moveDirection(page, "left", 40);
      await sleep(400);
    }

    const enterState = await readGameContext(page);
    log("STEP", `Now in room ${enterState.roomId} (${getRoomName(enterState.roomId)})`);

    // Pick up sword if we're in room 18
    if (enterState.roomId === 18 && enterState.carriedObjectId !== 9) {
      await pickupItem(page, 9, 32, 32);
    } else {
      log("STEP", `Not in room 18 or already carrying sword`);
    }
  }

  // ── Step 4: Get white_key (id 12) in room 14 ──────────────────
  {
    log("STEP", "4. Navigate to room 14 for white_key");

    // Path: current room → 14
    // From room 18: need to exit back to 17, then 17→3→2→14
    // Room 18 has no valid exits (all self), so must go through portcullis
    let currentState = await readGameContext(page);
    if (currentState.roomId === 18) {
      log("AGENT", "Exiting room 18 through portcullis back to room 17");
      // Walk up from bottom of room 18 to go through portcullis
      await moveDirection(page, "up", 40);
      await sleep(400);
      currentState = await readGameContext(page);
    }

    log("AGENT", `Currently in room ${currentState.roomId}, navigating to 14`);
    await navigateTo(page, 14);

    const room14State = await readGameContext(page);
    if (room14State.carriedObjectId !== 12) {
      await pickupItem(page, 12, 32, 64);
    } else {
      log("STEP", "Already carrying white_key");
    }
  }

  // ── Step 5: Open portcullis 1 (white castle) ──────────────────
  {
    log("STEP", "5. Open portcullis 1 (white castle)");
    const opened = await openPortcullis(page, 1);
    if (opened) {
      await dropItem(page);
    }
  }

  // ── Step 6: Get black_key (id 13) in room 29 ──────────────────
  {
    log("STEP", "6. Navigate to room 29 for black_key");

    // Path from room 14: 14→13→12→29
    await navigateTo(page, 29);

    const room29State = await readGameContext(page);
    if (room29State.carriedObjectId !== 13) {
      await pickupItem(page, 13, 32, 64);
    } else {
      log("STEP", "Already carrying black_key");
    }
  }

  // ── Step 7: Open portcullis 2 (black castle) ──────────────────
  {
    log("STEP", "7. Open portcullis 2 (black castle)");
    const opened = await openPortcullis(page, 2);
    if (opened) {
      await dropItem(page);
    }
  }

  // ── Step 8: Navigate to room 28 and pick up chalice ───────────
  {
    log("STEP", "8. Navigate to room 28 (chalice)");
    // Path from room 29: 29→16 (down) → 28 (left)
    await navigateTo(page, 28);

    const room28State = await readGameContext(page);
    if (room28State.carriedObjectId !== 16) {
      await pickupItem(page, 16, 48, 32);
    } else {
      log("STEP", "Already carrying chalice");
    }
  }

  // ── Done ──────────────────────────────────────────────────────
  const finalState = await readGameContext(page);
  if (finalState.carriedObjectId === 16) {
    log("MODE", "=== CHALICE COLLECTED — YOU WIN! ===");
  } else {
    log("MODE", `=== Solve complete. Carrying: ${finalState.carriedObjectId || "nothing"} ===`);
  }
}

// ─── Mode: demo ────────────────────────────────────────────────────

/**
 * Demo mode: a short, scripted sequence that demonstrates the agent
 * picking up an item, moving between rooms, and dropping it.
 */
async function modeDemo(page) {
  log("MODE", "=== DEMO MODE ===");
  log("MODE", "Picking up yellow_key, moving around, and dropping it");

  // 1. Read initial state
  const initial = await readGameContext(page);
  log("STATE", `Initial: room ${initial.roomId} (${getRoomName(initial.roomId)}) at (${initial.playerX}, ${initial.playerY})`);

  // 2. Pick up yellow_key
  log("ACTION", "Pick up yellow_key (id 11)");
  await pickupItem(page, 11, 32, 64);

  // 3. Move around a bit
  log("ACTION", "Move around");
  await moveDirection(page, "right", 30);
  await sleep(200);
  await moveDirection(page, "down", 30);
  await sleep(200);

  // 4. Show state
  const afterMove = await readGameContext(page);
  log("STATE", `After move: room ${afterMove.roomId} at (${afterMove.playerX}, ${afterMove.playerY}), carrying: ${afterMove.carriedObjectId}`);

  // 5. Drop the item
  log("ACTION", "Drop yellow_key");
  await dropItem(page);

  // 6. Final state
  const finalState = await readGameContext(page);
  log("STATE", `Final: room ${finalState.roomId} at (${finalState.playerX}, ${finalState.playerY}), carrying: ${finalState.carriedObjectId || "None"}`);

  // 7. Walk to the dropped key's approximate location and pick it up again
  log("ACTION", "Walk back and pick up yellow_key again");
  await pickupItem(page, 11, 32, 64);

  log("MODE", "=== DEMO COMPLETE ===");
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "explore";

  if (!["explore", "solve", "demo"].includes(mode)) {
    console.error(`Usage: node src/agent/GamePlayer.js [explore|solve|demo]`);
    process.exit(1);
  }

  log("BOOT", `Adventure Game Player — mode: ${mode}`);
  log("BOOT", `Game URL: ${GAME_URL}`);

  let browser;
  try {
    // Launch browser (headless for automation)
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"],
    });

    const context = await browser.newContext({
      viewport: { width: 640, height: 576 },
    });

    const page = await context.newPage();

    // Intercept console messages from the game
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.startsWith("[GameContext]") || text.startsWith("[EntityManager]") || text.startsWith("[Game]")) {
        log("GAME", text);
      }
    });

    // Navigate to the game
    log("BOOT", `Navigating to ${GAME_URL}`);
    await page.goto(GAME_URL, { waitUntil: "networkidle", timeout: 15000 });
    await sleep(2500); // let the game initialize and auto-save to localStorage

    // Read initial state
    const initState = await readGameContext(page);
    log("BOOT", `Game state: room ${initState.roomId} at (${initState.playerX}, ${initState.playerY})`);

    // Run the selected mode
    switch (mode) {
      case "explore":
        await modeExplore(page);
        break;
      case "solve":
        await modeSolve(page);
        break;
      case "demo":
        await modeDemo(page);
        break;
    }

    log("BOOT", "Agent finished");
  } catch (err) {
    log("ERROR", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      log("BOOT", "Browser closed");
    }
  }
}

main();
