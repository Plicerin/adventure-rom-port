// Dev oracle: the real cartridge interpreted by the 6502 core on the shared
// bus. Not used by the game itself.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { M6502 } from '../../src/cpu6502.mjs';
import { VcsBus, TIA, CYCLES_PER_LINE } from '../../src/vcsBus.mjs';

export { TIA, CYCLES_PER_LINE };

// Adventure (Atari, 1980), the standard NTSC cartridge
export const ROM_MD5 = '157bddb7192754a45372be196797f284';

export function loadRom(path = 'rom/adventure.a26') {
  const rom = readFileSync(path);
  const md5 = createHash('md5').update(rom).digest('hex');
  if (md5 !== ROM_MD5) throw new Error(`unexpected ROM md5 ${md5}`);
  return rom;
}

export class VCS extends VcsBus {
  constructor(rom, options = {}) {
    super(rom, options);
    this.cpu = new M6502(this);
    this.cpu.reset();
  }
}
