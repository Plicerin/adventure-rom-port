import { GameContext } from '../state/GameContext.js';
import { Entity } from './Entity.js';

// Load full world data with all rooms and objects
const worldData = {
  rooms: [
    { "id": 0, "name": "Number Room", "color": "$66", "exits": { "above": 0, "left": 0, "down": 0, "right": 0 } },
    { "id": 1, "name": "Top Access (8 Clock)", "color": "$D8", "exits": { "above": 8, "left": 2, "down": 128, "right": 3 } },
    { "id": 2, "name": "Top Access (Green)", "color": "$C8", "exits": { "above": 17, "left": 3, "down": 131, "right": 1 } },
    { "id": 3, "name": "Left of Name", "color": "$E8", "exits": { "above": 6, "left": 1, "down": 134, "right": 2 } },
    { "id": 4, "name": "Top of Blue Maze", "color": "$86", "exits": { "above": 16, "left": 5, "down": 7, "right": 6 } },
    { "id": 5, "name": "Blue Maze 1", "color": "$86", "exits": { "above": 29, "left": 6, "down": 8, "right": 4 } },
    { "id": 6, "name": "Bottom of Blue Maze", "color": "$86", "exits": { "above": 7, "left": 4, "down": 3, "right": 5 } },
    { "id": 7, "name": "Center of Blue Maze", "color": "$86", "exits": { "above": 4, "left": 8, "down": 6, "right": 8 } },
    { "id": 8, "name": "Blue Maze Entry", "color": "$86", "exits": { "above": 5, "left": 7, "down": 1, "right": 7 } },
    { "id": 9, "name": "Maze Middle", "color": "$08", "exits": { "above": 10, "left": 10, "down": 11, "right": 10 } },
    { "id": 10, "name": "Maze Entry", "color": "$08", "exits": { "above": 3, "left": 9, "down": 9, "right": 9 } },
    { "id": 11, "name": "Maze Side", "color": "$08", "exits": { "above": 9, "left": 12, "down": 28, "right": 13 } },
    { "id": 12, "name": "Side Corridor", "color": "$98", "exits": { "above": 28, "left": 13, "down": 29, "right": 11 } },
    { "id": 13, "name": "Side Corridor 2", "color": "$B8", "exits": { "above": 15, "left": 11, "down": 14, "right": 12 } },
    { "id": 14, "name": "Top Entry Room", "color": "$A8", "exits": { "above": 13, "left": 16, "down": 15, "right": 16 } },
    { "id": 15, "name": "White Castle", "color": "$0C", "exits": { "above": 14, "left": 15, "down": 13, "right": 15 }, "portcullis": { "object": 1, "x": "0x4D", "y": "0x31" } },
    { "id": 16, "name": "Black Castle", "color": "$00", "exits": { "above": 1, "left": 28, "down": 4, "right": 28 }, "portcullis": { "object": 2, "x": "0x4D", "y": "0x31" } },
    { "id": 17, "name": "Yellow Castle", "color": "$1A", "exits": { "above": 6, "left": 1, "down": 2, "right": 3 }, "portcullis": { "object": 0, "x": "0x4D", "y": "0x31" } },
    { "id": 18, "name": "Yellow Castle Entry", "color": "$1A", "exits": { "above": 18, "left": 18, "down": 18, "right": 18 } },
    { "id": 19, "name": "Black Maze 1", "color": "$08", "exits": { "above": 21, "left": 20, "down": 21, "right": 22 } },
    { "id": 20, "name": "Black Maze 2", "color": "$08", "exits": { "above": 22, "left": 21, "down": 22, "right": 19 } },
    { "id": 21, "name": "Black Maze 3", "color": "$08", "exits": { "above": 19, "left": 22, "down": 19, "right": 20 } },
    { "id": 22, "name": "Black Maze Entry", "color": "$08", "exits": { "above": 20, "left": 19, "down": 27, "right": 21 } },
    { "id": 23, "name": "Red Maze 1", "color": "$36", "exits": { "above": 25, "left": 24, "down": 25, "right": 24 } },
    { "id": 24, "name": "Top of Red Maze", "color": "$36", "exits": { "above": 26, "left": 23, "down": 26, "right": 23 } },
    { "id": 25, "name": "Bottom of Red Maze", "color": "$36", "exits": { "above": 23, "left": 26, "down": 23, "right": 26 } },
    { "id": 26, "name": "White Castle Entry", "color": "$36", "exits": { "above": 24, "left": 25, "down": 24, "right": 25 } },
    { "id": 27, "name": "Black Castle Entry", "color": "$36", "exits": { "above": 137, "left": 137, "down": 137, "right": 137 } },
    { "id": 28, "name": "Other Purple Room", "color": "$66", "exits": { "above": 29, "left": 7, "down": 140, "right": 8 } },
    { "id": 29, "name": "Top Entry Room (R)", "color": "$36", "exits": { "above": 143, "left": 1, "down": 16, "right": 3 } },
    { "id": 30, "name": "Name Room", "color": "$66", "exits": { "above": 6, "left": 1, "down": 2, "right": 3 } }
  ],
  objects: [
    { "object": "black_dot", "id": 3, "room": 21, "x": 81, "y": 18 },
    { "object": "red_dragon", "id": 6, "room": 14, "x": 80, "y": 32, "movement": 0, "state": 0 },
    { "object": "yellow_dragon", "id": 7, "room": 1, "x": 80, "y": 32, "movement": 0, "state": 0 },
    { "object": "green_dragon", "id": 8, "room": 29, "x": 80, "y": 32, "movement": 0, "state": 0 },
    { "object": "magnet", "id": 17, "room": 27, "x": 128, "y": 32 },
    { "object": "sword", "id": 9, "room": 18, "x": 32, "y": 32 },
    { "object": "chalice", "id": 16, "room": 28, "x": 48, "y": 32 },
    { "object": "bridge", "id": 10, "room": 4, "x": 41, "y": 55 },
    { "object": "yellow_key", "id": 11, "room": 17, "x": 32, "y": 64 },
    { "object": "white_key", "id": 12, "room": 14, "x": 32, "y": 64 },
    { "object": "black_key", "id": 13, "room": 29, "x": 32, "y": 64 },
    { "object": "bat", "id": 14, "room": 26, "x": 32, "y": 32, "movement": 0, "state": 0 },
    { "object": "author", "id": 4, "room": 29, "x": 80, "y": 105 },
    { "object": "number", "id": 5, "room": 0, "x": 80, "y": 64 },
    { "object": "invisible_surround", "id": 15, "room": 0, "x": 80, "y": 48 }
  ],
  // ASM CheckGameStart (reset pressed) places player in Yellow Castle area (room $11=17)
  // at X=$50=80, ROM Y=$20=32.
  // The ROM's Y axis is inverted: higher ROM Y = higher on screen.
  // ROM $6A=106 → top of visible area, ROM $0D=13 → bottom.
  // Canvas Y = (106 - ROM_Y) * (189 / 93), so (106-32) * 2.032 ≈ 150.
  // Stored in ROM Y coords; converted to canvas Y in renderer.
  // The actual castle interior is room $12=18 — a square room with no exits.
  player_start: { room: 17, x: 80, y: 32 },
  level: 0,
  room_diffs: [
    [16, 15, 15], [5, 17, 17], [29, 10, 10], [28, 22, 22], [27, 12, 12], [3, 12, 12]
  ],
  thin_walls: { left: 13, right: 150 }
};

/**
 * EntityManager handles the lifecycle of entities and room-based loading.
 *
 * Data is sourced directly from adventure.asm:
 *   - 30 rooms from `RoomDataTable`
 *   - 13+ objects from `Game1Objects` / `Game2Objects`
 *   - Per-room exits, colors, and wall patterns
 *
 * Each room's exits are stored in offsets 5-8 of the RoomDataTable
 * row (above, left, down, right). The thin walls at X=$0D and X=$96
 * are rendered by the Renderer as vertical lines on the playfield.
 */
export class EntityManager {
    constructor() {
        this.allEntities = [];
        this.activeEntities = [];
        this.rooms = worldData.rooms;
        this.level = worldData.level;
        this.room_diffs = worldData.room_diffs;
        this.thin_walls = worldData.thin_walls;
    }

    init(gameMode = 'game1') {
        // Build all entities from the world data
        this.allEntities = worldData.objects.map(objData => new Entity({
            id: objData.object,
            room: objData.room,
            x: objData.x,
            y: objData.y,
            movement: objData.movement || false,
            state: objData.state || 0,
        }));
        // loadRoom is called by main.js after roomId is set.
    }

    /**
     * Filter entities to those in the current room, and notify the
     * renderer of the room change.
     */
    loadRoom(roomId) {
        this.activeEntities = this.allEntities.filter(e => e.room === roomId);
        const room = this.rooms.find(r => r.id === roomId);
        console.log(`[EntityManager] Room ${roomId} (${room?.name || '?'}) loaded: ${this.activeEntities.length} entities.`, this.activeEntities.map(e => `${e.id}@(${e.x},${e.y})`));
    }

    update(deltaTime) {
        this.activeEntities.forEach(entity => entity.update(deltaTime));
    }

    getActiveEntities() {
        return this.activeEntities;
    }

    getEntityById(id) {
        return this.allEntities.find(e => e.id === id);
    }

    getRoom(roomId) {
        return this.rooms.find(r => r.id === roomId) || null;
    }

    /**
     * The current room's wall pattern (PF0/PF1/PF2 scanline rows),
     * or null. The renderer paints these as black horizontal bands.
     */
    getRoomWalls(roomId) {
        const room = this.rooms.find(r => r.id === roomId);
        return room || null;
    }

    get player_start() {
        return worldData.player_start;
    }
}

export const entityManager = new EntityManager();
