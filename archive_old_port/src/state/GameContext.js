/**
 * GameContext mirrors the 6502 registers used in adventure.asm.
 * It provides a single source of truth for the game state, plus
 * localStorage persistence helpers that save/load/resume state on the
 * client with an expiry window (default 1 hour) and a freshness check.
 */

// Default "freshness" threshold — when the stored entry is older than this,
// we treat it as stale and refuse to restore from disk so the user starts
// fresh rather than returning to a state they have no way to recover.
const SAVE_TTL_MS = 60 * 60 * 1000;

/**
 * Save the current GameContext snapshot to localStorage.
 */
export function persist() {
  const regs = GameContext.registers;
  const entry = {
    roomId: regs.roomId,
    playerX: regs.playerX,
    playerY: regs.playerY,
    ballX: regs.ballX,
    ballY: regs.ballY,
    carriedObjectId: regs.carriedObjectId,
    gameMode: regs.gameMode,
    openPortcullises: regs.openPortcullises || [],
    timestamp: Date.now(),
  };
  localStorage.setItem("adventure_context", JSON.stringify(entry));
  console.log("[GameContext] Persisted to localStorage (key: adventure_context).");
}

/**
 * Try to restore state from localStorage. Refuses a stale entry (older than
 * SAVE_TTL_MS) — when freshness is not satisfied we return null so the caller
 * knows to start fresh rather than recover an unreachable state.
 */
export function resume() {
  const raw = localStorage.getItem("adventure_context");
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('[GameContext] resume() — invalid stored JSON, ignoring.', e);
    return null;
  }

  // Check timestamp freshness
  if (parsed.timestamp && (Date.now() - parsed.timestamp > SAVE_TTL_MS)) {
    console.log('[GameContext] resume() — entry too old, starting fresh.');
    return null;
  }

  if (!parsed.roomId && !parsed.playerX) return null;

  // Apply the saved state.
  GameContext.registers.roomId = parsed.roomId ?? 0;
  GameContext.registers.playerX = parsed.playerX | 0;
  GameContext.registers.playerY = parsed.playerY | 0;
  GameContext.registers.ballX = parsed.ballX | 0;
  GameContext.registers.ballY = parsed.ballY | 0;
  GameContext.registers.carriedObjectId = parsed.carriedObjectId ?? null;
  GameContext.registers.gameMode = parsed.gameMode ?? 'game1';
  GameContext.registers.openPortcullises = parsed.openPortcullises || [];

  console.log(
    "[GameContext] Resumed from localStorage: room=" + parsed.roomId +
    " pos=(" + parsed.playerX + "," + parsed.playerY + ")"
  );

  return true;
}

// --- Existing GameContext API (the original behaviour, preserved) ---------

export const GameContext = {
  registers: {
    roomId: 0,
    playerX: 0,
    playerY: 0,
    ballX: 0,
    ballY: 0,
    carriedObjectId: null,
    gameMode: 'game1',
    frameCounter: 0,
    colorMode: 'color',
  },

  updatePlayerPos(x, y) { this.registers.playerX = x; this.registers.playerY = y; },
  updateBallPos(x, y)     { this.registers.ballX = x; this.registers.ballY    = y; },

  setCarriedItem(id) {
    this.registers.carriedObjectId = id;
  },

  useCarriedItem() {
    const carried = this.registers.carriedObjectId;
    if (!carried) return false;
    const roomId = this.registers.roomId;
    // Check if current room has a portcullis that matches the carried key
    const room = entityManager.getRoom(roomId);
    if (!room || !room.portcullis) return false;
    const portcullis = room.portcullis;
    // Map key names to portcullis object IDs
    const keyToPortcullis = { 'yellow_key': 0, 'white_key': 1, 'black_key': 2 };
    const pcId = keyToPortcullis[carried];
    if (pcId !== portcullis.object) return false;
    // Use the key to open the portcullis
    console.log(`[GameContext] Used ${carried} to open portcullis in room ${roomId}`);
    // Remove the key from inventory
    this.registers.carriedObjectId = null;
    // Mark portcullis as open
    if (!this.registers.openPortcullises) {
      this.registers.openPortcullises = [];
    }
    if (!this.registers.openPortcullises.includes(roomId)) {
      this.registers.openPortcullises.push(roomId);
    }
    return true;
  },

  getMovementModifier() {
    if (this.registers.carriedObjectId) return 0.5;
    return 1.0;
  },
};