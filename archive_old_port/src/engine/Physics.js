import { GameContext } from '../state/GameContext.js';
import { entityManager } from '../entities/EntityManager.js';
import { ROOM_WALLS, ROOM_WALL_BY_ID } from './Sprites.js';

const getRoomData = (roomId) => entityManager.getRoom(roomId);

/**
 * Physics handles collision detection and movement resolution.
 *
 * Bounds come directly from the ASM (see MoveGroundObject):
 *   - Ball Y >= $6A (106) is top, Y < $0D (13) is bottom
 *   - Ball X >= $9F (159) is right edge, X < $03 (3) is left edge
 *   - Other objects wrap at $9B (155) instead of $9F
 *
 * The 30 rooms (from RoomDataTable) provide the room-to-room
 * adjacency (offsets 5-8: above, left, down, right). When the player
 * crosses an edge, the new room is looked up in the current room's
 * exits and the player is clamped to the matching edge.
 */
export class Physics {
    constructor() {
        this.collisionPadding = 2;
    }

    update(player, deltaTime) {
        const inputVector = player.velocity;
        this.resolveMovement(player, inputVector);
        this.handleSpecialCollisions(player);
    }

    /**
     * Resolves movement against room bounds, the per-room exits
     * adjacency table (from RoomDataTable), and entities.
     */
    resolveMovement(entity, vector) {
        const currentRoomId = GameContext.registers.roomId;
        const bounds = { x_min: 3, x_max: 159, x_max_other_objects: 155, y_min: 13, y_max: 106 };
        const isBall = entity.id === 'player';
        const ROOM_MAX_X = isBall ? bounds.x_max : bounds.x_max_other_objects;
        const ROOM_MAX_Y = bounds.y_max;
        const ROOM_MIN_X = bounds.x_min;
        const ROOM_MIN_Y = bounds.y_min;

        const startX = entity.x;
        const startY = entity.y;
        const nextX = startX + vector.x;
        const nextY = startY + vector.y;

        // Debug: log movement attempt
        if (Math.abs(vector.x) > 0 || Math.abs(vector.y) > 0) {
            console.log(`[Physics] Move: ${startX},${startY} → ${nextX.toFixed(1)},${nextY.toFixed(1)} vec=(${vector.x},${vector.y}) room=${currentRoomId}`);
        }

        // 1. Try a room transition in any direction where the player
        //    crosses the edge. The exit direction is looked up in the
        //    current room's exits table (offsets 5-8 from RoomDataTable).
        if (nextX > ROOM_MAX_X) {
            const next = this._getExitRoom(currentRoomId, 'right');
            if (next !== null && next !== currentRoomId) {
                this._transitionEW(entity, next, nextY, ROOM_MIN_X, ROOM_MAX_X, ROOM_MAX_Y, 'right');
                console.log(`[Physics] Player now in room ${entity.room} at (${entity.x},${entity.y})`);
                return;
            }
        } else if (nextX < ROOM_MIN_X) {
            const next = this._getExitRoom(currentRoomId, 'left');
            if (next !== null && next !== currentRoomId) {
                this._transitionEW(entity, next, nextY, ROOM_MIN_X, ROOM_MAX_X, ROOM_MAX_Y, 'left');
                console.log(`[Physics] Player now in room ${entity.room} at (${entity.x},${entity.y})`);
                return;
            }
        }
        // ROM Y axis is inverted: high Y = top edge, low Y = bottom edge
        if (nextY >= ROOM_MAX_Y) {
            const next = this._getExitRoom(currentRoomId, 'above');
            if (next !== null && next !== currentRoomId) {
                this._transitionNS(entity, next, nextX, ROOM_MIN_Y, ROOM_MAX_Y, ROOM_MAX_X, 'above');
                console.log(`[Physics] Player now in room ${entity.room} at (${entity.x},${entity.y})`);
                return;
            }
        } else if (nextY < ROOM_MIN_Y) {
            const next = this._getExitRoom(currentRoomId, 'down');
            if (next !== null && next !== currentRoomId) {
                this._transitionNS(entity, next, nextX, ROOM_MIN_Y, ROOM_MAX_Y, ROOM_MAX_X, 'down');
                console.log(`[Physics] Player now in room ${entity.room} at (${entity.x},${entity.y})`);
                return;
            }
        }

        // 2. Clamp to the current room's bounds.
        const targetX = Math.max(ROOM_MIN_X, Math.min(ROOM_MAX_X, nextX));
        const targetY = Math.max(ROOM_MIN_Y, Math.min(ROOM_MAX_Y, nextY));

        // 3. Check playfield wall collision
        const wallCollisionX = this.checkPlayfieldCollision(targetX, startY, currentRoomId);
        const wallCollisionY = this.checkPlayfieldCollision(startX, targetY, currentRoomId);

        // 4. AABB check against other entities in the current room.
        const activeEntities = entityManager.getActiveEntities();
        let collisionX = wallCollisionX;
        let collisionY = wallCollisionY;
        for (const other of activeEntities) {
            if (other === entity) continue;
            if (this.checkCollision(targetX, startY, other)) collisionX = true;
            if (this.checkCollision(startX, targetY, other)) collisionY = true;
        }
        if (!collisionX) entity.x = targetX;
        if (!collisionY) entity.y = targetY;
    }

    /**
     * Check collision against playfield walls.
     * The TIA playfield renders walls at specific X positions based on PF bits.
     * For each Y band, we check if the playfield has a pixel at the entity's position.
     */
    checkPlayfieldCollision(x, y, roomId) {
        // Skip wall collision in rooms where the portcullis has been opened
        const openPortcullises = GameContext.registers.openPortcullises || [];
        if (openPortcullises.includes(roomId)) return false;

        const patternName = ROOM_WALL_BY_ID[roomId];
        if (!patternName) return false;
        const pattern = ROOM_WALLS[patternName];
        if (!pattern) return false;

        const BAND_HEIGHT = 27;
        // Convert ROM Y to canvas Y for wall collision
        const canvasY = (106 - y) * (189 / 93);
        const band = Math.floor(canvasY / BAND_HEIGHT);
        if (band >= pattern.length) return false;

        const [pf0, pf1, pf2] = pattern[band];
        const bitPos = x < 80 ? Math.floor(x / 4) : Math.floor((159 - x) / 4);

        // Same bit extraction logic as Renderer
        let bit;
        if (bitPos < 4) {
            bit = (pf0 >> (bitPos + 4)) & 1;  // PF0 bits 4,5,6,7
        } else if (bitPos < 12) {
            bit = (pf1 >> (11 - bitPos)) & 1;  // PF1 bits 7,6,5,4,3,2,1,0
        } else {
            bit = (pf2 >> (bitPos - 12)) & 1;  // PF2 bits 0-7
        }

        // Debug: log every wall check for the player
        if (x >= 0 && x <= 159 && band < 7) {
            console.log(`[Physics] Wall check: room=${roomId}, pat=${patternName}, x=${x}, y=${y}, canvasY=${Math.round(canvasY)}, band=${band}, bitPos=${bitPos}, pf=[${pf0},${pf1},${pf2}], bit=${bit}`);
        }
        return bit === 1;
    }

    /**
     * Look up the adjacent room in the given direction from the
     * current room's exits table. Returns null if no exit exists.
     * The original ASM uses offsets 5-8 (above, left, down, right);
     * values >= 0x80 are "level-adjusted" exits that index into
     * the `RoomDiffs` table (see adventure.asm line ~2693).
     *
     * AdjustRoomLevel formula:
     *   index = (exit - 0x80) + (level / 2)
     *   col   = (level / 2) % 3   (3 columns: levels 0, 2, 4)
     *   result = RoomDiffs[index][col]
     */
    _getExitRoom(roomId, direction) {
        const room = entityManager.getRoom(roomId);
        if (!room || !room.exits) {
            console.warn(`[Physics] No room data for room ${roomId}`);
            return null;
        }
        const exit = room.exits[direction];
        if (exit === undefined || exit === null || exit === 0) {
            console.log(`[Physics] No exit from room ${roomId} ${direction} (exit=${exit})`);
            return null;
        }
        // For exits >= 0x80, use room_diffs lookup
        if (exit >= 0x80) {
            const levelCol = (entityManager.level >> 1) % 3;
            const adjustedIndex = (exit - 0x80) + (entityManager.level >> 1);
            const diffs = entityManager.room_diffs || [];
            if (adjustedIndex < 0 || adjustedIndex >= diffs.length) {
                console.warn(`[Physics] RoomDiff index ${adjustedIndex} out of range for exit ${exit} from room ${roomId}`);
                return null;
            }
            return diffs[adjustedIndex][levelCol];
        }
        console.log(`[Physics] Exit from room ${roomId} ${direction} -> room ${exit}`);
        return exit;
    }

    _transitionEW(entity, newRoomId, nextY, minX, maxX, maxY, fromDir) {
        console.log(`[Physics] Transition EW: room ${entity.room} (${fromDir}) -> room ${newRoomId}, pos=(${minX},${nextY})`);
        entityManager.loadRoom(newRoomId);
        GameContext.registers.roomId = newRoomId;
        entity.room = newRoomId;
        // Coming from 'right' (walked off right edge) -> appear on left edge of new room
        // Coming from 'left' (walked off left edge) -> appear on right edge of new room
        entity.x = fromDir === 'right' ? minX : maxX;
        entity.y = Math.max(0, Math.min(maxY, nextY));
    }

    _transitionNS(entity, newRoomId, nextX, minY, maxY, maxX, fromDir) {
        console.log(`[Physics] Transition NS: room ${entity.room} (${fromDir}) -> room ${newRoomId}, pos=(${nextX},${minY})`);
        entityManager.loadRoom(newRoomId);
        GameContext.registers.roomId = newRoomId;
        entity.room = newRoomId;
        // ROM Y axis inverted: 'above' = walking off high Y edge (screen top) -> appear at low Y (room bottom)
        // 'down' = walking off low Y edge (screen bottom) -> appear at ROM $69 (room top)
        entity.y = fromDir === 'above' ? minY : maxY - 1;
        entity.x = Math.max(0, Math.min(maxX, nextX));
    }

    handleSpecialCollisions(player) {
        const activeEntities = entityManager.getActiveEntities();
        for (const entity of activeEntities) {
            if (this.checkCollision(player.x, player.y, entity)) {
                if (this.isPickable(entity.id) && GameContext.registers.carriedObjectId === null) {
                    GameContext.setCarriedItem(entity.id);
                    console.log(`Picked up: ${entity.id}`);
                }
            }
        }
    }

    checkCollision(x, y, other) {
        return (
            x < other.x + 8 &&
            x + 8 > other.x &&
            y < other.y + 8 &&
            y + 8 > other.y
        );
    }

    isPickable(id) {
        const pickables = ['sword', 'chalice', 'yellow_key', 'white_key', 'black_key', 'magnet', 'bridge'];
        return pickables.includes(id);
    }
}

export const physics = new Physics();