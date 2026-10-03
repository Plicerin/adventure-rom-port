import { GameContext } from '../state/GameContext.js';
import { entityManager } from '../entities/EntityManager.js';
import { getSprite, ROOM_BACKGROUND, PALETTE, ROOM_WALLS, ROOM_WALL_BY_ID } from './Sprites.js';
import { SPRITE_DEFS } from './Sprites.js';

const worldData = { thin_walls: { left: 13, right: 150 } };

export class Renderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error('Renderer: Canvas not found:', canvasId);
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 160;
    this.canvas.height = 192;
    this.ctx.imageSmoothingEnabled = false;
  }

  render(player) {
    this.clear();
    this.drawWalls();
    this.drawThinWalls();
    this.drawPortcullis();
    this.drawObjects(player);

    // Debug overlay: show room and player position
    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this.ctx.fillRect(0, 0, 200, 50);
    this.ctx.fillStyle = '#00FF00';
    this.ctx.font = '14px monospace';
    this.ctx.fillText(`Room: ${GameContext.registers.roomId}`, 10, 20);
    // Show both ROM Y and converted canvas Y
    const canvasY = (106 - player.y) * (189 / 93);
    this.ctx.fillText(`X: ${player.x} Y: ${player.y}→${Math.round(canvasY)}`, 10, 40);
  }

  clear() {
    this.ctx.fillStyle = ROOM_BACKGROUND;
    this.ctx.fillRect(0, 0, 160, 192);
  }

  drawWalls() {
    const roomId = GameContext.registers.roomId;
    console.log(`[Renderer] drawWalls: roomId=${roomId}`);
    const patternName = ROOM_WALL_BY_ID[roomId];
    if (!patternName) {
      console.log('drawWalls: No patternName for roomId', roomId);
      return;
    }
    const pattern = ROOM_WALLS[patternName];
    if (!pattern) {
      console.log('drawWalls: No pattern for patternName', patternName);
      return;
    }

    const BAND_HEIGHT = 27;
    // Wall colors per room (from ASM COLUPF values)
    const wallColor = (roomId === 15) ? PALETTE['$0C'] :  // White Castle (off-white)
                    (roomId === 17 || roomId === 18) ? PALETTE['$00'] :  // Yellow Castle (dark grey walls for visibility)
                    (roomId === 16) ? PALETTE['$00'] :  // Black Castle
                    '#000000';  // Default
    this.ctx.fillStyle = wallColor;

    for (let row = 0; row < pattern.length; row++) {
      const [pf0, pf1, pf2] = pattern[row];
      const y = row * BAND_HEIGHT;

      // TIA reflected mode: bits 0-19 on left (0-79), right half (80-159) reverses the bit order
      // Left pixel i uses bit floor(i/4), right pixel (80+j) uses bit (19 - floor(j/4))
      for (let x = 0; x < 160; x++) {
        const bitPos = x < 80 ? Math.floor(x / 4) : Math.floor((159 - x) / 4);
        const bit = this._getPfBit(pf0, pf1, pf2, bitPos);
        if (bit) {
          this.ctx.fillRect(x, y, 1, BAND_HEIGHT);
        }
      }
    }
  }

  _getPfBit(pf0, pf1, pf2, i) {
    // TIA playfield REF=1 mode: PF0 LSB, PF1 MSB (reversed), PF2 LSB
    // Per Stella guide table for "C. Reflected Serial Output"
    // PF0 upper nibble: bits 4,5,6,7 (LSB order)
    // PF1: bits 7,6,5,4,3,2,1,0 for i=4..11 (MSB first, which is reverse scan)
    // PF2: bits 0,1,2,3,4,5,6,7 (LSB order)
    if (i < 4) {
      return (pf0 >> (i + 4)) & 1;  // PF0 bits 4,5,6,7
    } else if (i < 12) {
      return (pf1 >> (11 - i)) & 1;  // PF1 bits 7,6,5,4,3,2,1,0
    } else {
      return (pf2 >> (i - 12)) & 1;  // PF2 bits 0-7
    }
  }

  drawThinWalls() {
    const roomId = GameContext.registers.roomId;
    if (roomId === 15 || roomId === 16 || roomId === 17 || roomId === 18) {
      return;
    }
    this.ctx.fillStyle = '#000000';
    const left = entityManager.thin_walls.left;
    const right = entityManager.thin_walls.right;
    this.ctx.fillRect(left, 0, 1, 192);
    this.ctx.fillRect(right, 0, 1, 192);
  }

  drawPortcullis() {
    const roomId = GameContext.registers.roomId;
    if (roomId !== 15 && roomId !== 16 && roomId !== 17 && roomId !== 18) {
      return;
    }
    const openPortcullises = GameContext.registers.openPortcullises || [];
    const isOpen = openPortcullises.includes(roomId);
    const sprite = getSprite(isOpen ? 'portcullis_open' : 'portcullis_closed', isOpen ? '#666666' : '#000000');
    if (!sprite) return;
    const x = 77;
    const y = 49;
    this.ctx.drawImage(sprite, x, y);
  }

  drawObjects(player) {
    const entities = entityManager.getActiveEntities();
    console.log('[Renderer] Active entities:', entities.map(e => `${e.id}(room:${e.room},x:${e.x},y:${e.y})`));
    for (const entity of entities) {
      this._drawEntity(entity);
    }
    this._drawPlayer(player);
  }

  _drawEntity(entity) {
    const spriteId = this._spriteIdFor(entity);
    console.log(`[Renderer] Drawing ${entity.id}: state=${entity.state} → spriteId=${spriteId}`);
    if (!spriteId) return;
    const color = this._colorFor(entity);
    const bytes = SPRITE_DEFS[spriteId];
    if (!bytes || bytes.length === 0) return;

    const x = entity.x;
    // Convert ROM Y to canvas Y (ROM Y axis is inverted)
    const ROM_Y_MAX = 106;
    const ROM_RANGE = 93;
    const CANVAS_HEIGHT = 189;
    const y = (ROM_Y_MAX - entity.y) * (CANVAS_HEIGHT / ROM_RANGE);

    this.ctx.fillStyle = color;
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      for (let bit = 0; bit < 8; bit++) {
        if (b & (0x80 >> bit)) {
          this.ctx.fillRect(x + i, y + bit, 1, 1);
        }
      }
    }
  }

  _drawPlayer(player) {
    // Convert ROM Y to canvas Y. ROM Y axis is inverted:
    // ROM $6A=106 → top of visible area, ROM $0D=13 → bottom.
    // Canvas Y = (106 - ROM_Y) * (189 / 93), scaled to full canvas.
    const ROM_Y_MIN = 13;
    const ROM_Y_MAX = 106;
    const ROM_RANGE = ROM_Y_MAX - ROM_Y_MIN;  // 93
    const CANVAS_HEIGHT = 189;  // wall area height
    const canvasY = (ROM_Y_MAX - player.y) * (CANVAS_HEIGHT / ROM_RANGE);
    // Draw player as a 4x4 white square (original ROM sprite size)
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(player.x - 2, canvasY - 2, 4, 4);

    // Draw carried item attached to player
    const carriedId = GameContext.registers.carriedObjectId;
    if (carriedId) {
      const entity = { id: carriedId, state: 0 };
      const spriteId = this._spriteIdFor(entity);
      if (spriteId) {
        const color = this._colorFor(entity);
        const bytes = SPRITE_DEFS[spriteId];
        if (bytes && bytes.length > 0) {
          // Draw carried item offset to the right of the player
          const offsetX = player.x + 8;
          this.ctx.fillStyle = color;
          for (let i = 0; i < bytes.length; i++) {
            const b = bytes[i];
            for (let bit = 0; bit < 8; bit++) {
              if (b & (0x80 >> bit)) {
                this.ctx.fillRect(offsetX + i, canvasY + bit, 1, 1);
              }
            }
          }
        }
      }
    }
  }

  _spriteIdFor(entity) {
    switch (entity.id) {
      case 'chalice': return 'chalice';
      case 'magnet': return 'magnet';
      case 'sword': return 'sword';
      case 'yellow_key': return 'key';
      case 'white_key': return 'key';
      case 'black_key': return 'key';
      case 'bridge': return 'bridge';
      case 'red_dragon': return this._dragonSprite(entity.state);
      case 'yellow_dragon': return this._dragonSprite(entity.state);
      case 'green_dragon': return this._dragonSprite(entity.state);
      case 'bat': return this._batSprite(entity.state);
      case 'black_dot': return 'black_dot';
      case 'author': return 'author';
      case 'number': return 'num1';
      case 'invisible_surround': return 'invisible_surround';
      default: return null;
    }
  }

  _dragonSprite(state) {
    // ASM DragonStates table:
    // 00 → GfxDrag0 (alive), 01 → GfxDrag2 (eating),
    // 02 → GfxDrag0 (alive), FF → GfxDrag1 (dead)
    const stateNum = state & 0xFF;
    if (stateNum === 0x01) return 'dragon_eating';
    if (stateNum === 0xFF) return 'dragon_dead';
    return 'red_dragon';  // 0x00, 0x02 all use GfxDrag0
  }

  _batSprite(state) {
    // ASM BatStates table:
    // 03 → GfxBat1, FF → GfxBat2
    const stateNum = state & 0xFF;
    if (stateNum === 0xFF) return 'bat2';
    return 'bat';
  }

  _colorFor(entity) {
    switch (entity.id) {
      case 'red_dragon': return PALETTE['$36'];
      case 'yellow_dragon': return PALETTE['$1A'];
      case 'green_dragon': return PALETTE['$A8'];
      case 'yellow_key': return PALETTE['$1A'];
      case 'white_key': return PALETTE['$1C'];
      case 'black_key': return PALETTE['$00'];
      case 'chalice': return PALETTE['$D9'];
      case 'magnet': return PALETTE['$00'];
      case 'bridge': return PALETTE['$66'];
      case 'sword': return PALETTE['$1A'];
      case 'bat': return PALETTE['$D8'];
      case 'black_dot': return PALETTE['$08'];
      case 'author': return PALETTE['$D8'];
      case 'number': return PALETTE['$1A'];
      default: return '#FFFFFF';
    }
  }
}