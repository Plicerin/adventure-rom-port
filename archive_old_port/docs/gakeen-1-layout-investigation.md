# External layout investigation: `gakeen-1`

Source checkout inspected:

`\\gakeen-1\Users\vrock\Documents\Adventure`

The share is reachable. The checkout has no usable Git metadata, so the copied files below are an evidence snapshot rather than a merge source.

## Obtained solution for the disputed section

The room containing the yellow dragon is ROM room `1`, named `Top Access (8 Clock)`.

The room directly above it is ROM room `8`, named `Blue Maze Entry`.

The reciprocal vertical relationship is:

- Room 1: `above = 8`
- Room 8: `down = 1`

Room 1's wall renderer is `BelowYellowCastle`; room 8's wall renderer is `BlueMazeEntry`.

The supplied Variation 1 atlas is authoritative for spatial placement and color identity. The yellow dragon is in the green room, and the Blue Maze Entry is directly above that room. The green dragon is in a separate orange room. Any ASM room-ID or color decoding that produces a different spatial relationship is an incorrect interpretation and must be reconciled against the atlas.

## Evidence

Remote checkout:

- `src/data/world_data.json`: room 1 has `above: 8`; room 8 has `down: 1`.
- `src/engine/Sprites.js`: room 1 maps to `BelowYellowCastle`; room 8 maps to `BlueMazeEntry`.
- `adventure.asm`, `RoomDataTable`: room `$01` uses `BelowYellowCastle` and exit bytes `$08,$02,$80,$03`; room `$08` uses `BlueMazeEntry` and exit bytes `$05,$07,$01,$07`.

The local authoritative ASM contains the same room-1/room-8 relationship.

The reference checkout was also served and inspected live. Its room-1 and room-8 non-castle playfields use black walls over the gray room field; the local renderer had been incorrectly painting those playfield walls from each room's color byte (salmon for room 1, blue for room 8). The local renderer now matches the reference behavior while retaining the native local raster and existing route data.

## Local result

The current local production checkout already contains the corrected relationship and wall mapping:

- `src/entities/EntityManager.js`: room 1 `above: 8`; room 8 `down: 1`.
- `src/data/world_data.json`: room 1 `above: 8`; room 8 `down: 1`.
- `src/engine/Sprites.js`: room 1 `BelowYellowCastle`; room 8 `BlueMazeEntry`.

No production layout overwrite was made, because the remote copy is stale in unrelated areas. In particular, its `world_data.json` has older room-2/room-3/room-13 routes and does not preserve the current ASM-backed closed-door values. Copying that file wholesale would regress the local port.

## Evidence snapshot obtained locally

- `docs/gakeen-1-layout-obtained/remote-world_data.json`
- `docs/gakeen-1-layout-obtained/remote-Sprites.js`
- `docs/gakeen-1-layout-obtained/remote-EntityManager.js`

These files were copied byte-for-byte from the UNC checkout and verified with `cmp`.
