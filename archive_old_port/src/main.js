import { GameContext, persist, resume } from './state/GameContext.js';
import { entityManager } from './entities/EntityManager.js';
import { input } from './engine/Input.js';
import { physics } from './engine/Physics.js';
import { Renderer } from './engine/Renderer.js';
import { Entity } from './entities/Entity.js';

/**
 * Update the UI status display.
 */
function updateStatus() {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    const carried = GameContext.registers.carriedObjectId || 'None';
    statusEl.textContent = `Room: ${GameContext.registers.roomId} | Carrying: ${carried} | Space to use`;
  }
}

/**
 * Main game loop for Adventure.
 * Wires together all ported systems from the ASM implementation.
 */
class Game {
    constructor() {
        this.lastTime = 0;
        this.player = null; // Created in init() after checking for saved state
    }

    init() {
        // Create renderer after DOM is ready, then initialize it
        this.renderer = new Renderer();
        this.renderer.init('gameCanvas');

        // Check for fresh start parameter
        const params = new URLSearchParams(window.location.search);
        const forceFresh = params.get('fresh') !== null;

        // Clear saved game state if requested
        if (params.get('clearSave') !== null) {
            localStorage.removeItem("adventure_context");
            console.log("[GameContext] Saved state cleared from localStorage.");
        }

        // A full page reload acts like pressing RESET on the Atari —
        // always start from the initial position. Saved state is only
        // resumed when the game is explicitly asked to continue (e.g.
        // after a room transition that navigates to a new URL).
        const restored = false; // resume() disabled — page reload always starts fresh

        if (restored) {
            // Use restored position
            this.player = new Entity({
                id: 'player',
                room: GameContext.registers.roomId,
                x: GameContext.registers.playerX,
                y: GameContext.registers.playerY,
                movement: true
            });
        } else {
            // Player start comes from the actual ASM CheckGameStart routine
            // (see adventure.asm around line 600): reset puts the player in
            // the Yellow Castle (room $11) at X=$50 (80), Y=$20 (32).
            const testRoom = params.get('room');
            const roomId = testRoom !== null ? parseInt(testRoom, 10) : entityManager.player_start.room;

            this.player = new Entity({
                id: 'player',
                room: roomId,
                x: entityManager.player_start.x,
                y: entityManager.player_start.y,
                movement: true
            });
        }

        // Initialize entities based on the game mode in GameContext
        entityManager.init(GameContext.registers.gameMode);

        // Set initial player position
        GameContext.updatePlayerPos(this.player.x, this.player.y);
        GameContext.registers.roomId = this.player.room;

        // Load entities for the starting room (must be after roomId is set).
        entityManager.loadRoom(GameContext.registers.roomId);

        // Update UI status
        updateStatus();

        console.log(`[Game] Adventure JS initialized. Mode: ${GameContext.registers.gameMode}, Room: ${this.player.room}, Player: (${this.player.x}, ${this.player.y})`);
        console.log(`[Game] GameContext registers:`, JSON.stringify(GameContext.registers));
        console.log(`[Game] Active entities:`, entityManager.getActiveEntities().map(e => `${e.id}(r:${e.room}, x:${e.x}, y:${e.y})`));

        requestAnimationFrame((time) => this.loop(time));
    }

    loop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Auto-save every ~2 seconds (120 frames at 60fps)
        if (this.frameCount === undefined) this.frameCount = 0;
        this.frameCount++;
        if (this.frameCount % 120 === 0) {
            persist();
        }

        try {
            // 1. Process Input
            const moveVector = input.update();
            this.player.velocity = moveVector;

            // Process space bar for using carried item (opening portcullis)
            if (input.keys['Space']) {
                const used = GameContext.useCarriedItem();
                if (used) {
                    console.log('[Game] Item used successfully');
                }
            }

            // 2. Update Physics
            physics.update(this.player, deltaTime);

            // 3. Update Game State
            GameContext.updatePlayerPos(this.player.x, this.player.y);

            entityManager.update(deltaTime);

            // 4. Render
            this.renderer.render(this.player);

            // 5. Update UI
            updateStatus();
        } catch (e) {
            console.error('Game loop error:', e);
            // Continue the loop despite errors
        }

        requestAnimationFrame((time) => this.loop(time));
    }
}

const adventure = new Game();
window.addEventListener('load', () => {
    adventure.init();
});