import { GameContext } from '../state/GameContext.js';

/**
 * Input handles raw keyboard events and converts them into
 * "cooked" movement vectors based on the current game state.
 */
export class Input {
    constructor() {
        this.keys = {};
        this.vector = { x: 0, y: 0 };

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            // Prevent page scrolling from game keys
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) {
                e.preventDefault();
            }
        });
    }

    /**
     * Processes raw input and applies modifiers from GameContext.
     * This mirrors the 'ReadStick' and 'Cooked Movement' logic in ASM.
     */
    update() {
        let dx = 0;
        let dy = 0;

        if (this.keys['ArrowUp'] || this.keys['KeyW']) dy += 1;   // ROM: up = INC Y
        if (this.keys['ArrowDown'] || this.keys['KeyS']) dy -= 1;  // ROM: down = DEC Y
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;

        // Apply movement modifier (e.g., slower when carrying items)
        const modifier = GameContext.getMovementModifier();

        this.vector.x = dx * modifier;
        this.vector.y = dy * modifier;

        return this.vector;
    }

    getVector() {
        return this.vector;
    }
}

export const input = new Input();
