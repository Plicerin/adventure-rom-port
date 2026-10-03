import { GameContext } from '../state/GameContext.js';

/**
 * Base Entity class for all interactable objects in Adventure.
 * Mirrors the object structure found in adventure.asm.
 */
export class Entity {
    constructor(data) {
        this.id = data.id;
        this.room = data.room;
        this.x = data.x;
        this.y = data.y;
        this.movement = data.movement || false;
        this.state = data.state || 0; // Mirrors the state flags in ASM
        this.bounds = this._calculateBounds();
    }

    _calculateBounds() {
        // Basic AABB based on original 2600 sprite sizes (approx 8x8)
        return {
            width: 8,
            height: 8
        };
    }

    update(deltaTime) {
        if (this.movement) {
            // Basic movement logic will be handled by Physics.js,
            // but entity-specific state updates go here.
        }
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
}
