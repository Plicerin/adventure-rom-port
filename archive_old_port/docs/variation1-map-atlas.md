# Atari Adventure Variation 1 — visual map atlas

Source image: `C:\Users\admin\Pictures\adventure-variation-1-atari-2600-map.webp`
Measured image size: 1600 x 1352 pixels.
Image coordinates: origin at top-left; X increases right; Y increases downward.

This is a visual reference only. Numeric ROM room IDs and exact collision apertures must be reconciled against Variation 1 ASM data before implementation.

## Measured palette

- Outside background: RGB 255,255,255
- Gray floor/interior: RGB 170,170,170
- Blue field: RGB 66,72,200
- Yellow field: RGB 210,210,64
- Green field: RGB 92,186,92
- Light green: RGB 135,183,84
- Olive: RGB 160,171,79
- Orange: RGB 198,108,58
- Purple: RGB 146,70,192
- Black: RGB 0,0,0

## Major visible regions

| Neutral identifier | Approximate image box | Description |
|---|---|---|
| `purple_upper` | (320,0)-(640,194) | Purple rectangular enclosure; gray interior; small central lower extension; small orange/yellow glyph near (414,148). |
| `orange_upper` | (320,194)-(640,387) | Orange-framed rectangular enclosure; gray interior; small black glyph near (574,341). |
| `black_castle` | (320,387)-(640,580) | Black castle-like enclosure with gray interior, heavy upper/side walls, alternating upper slots, and a centered barred gate around (472,500)-(486,532). |
| `blue_maze_upper` | (320,580)-(960,966) | Connected blue maze complex with gray corridors, constrictions, turns, and labels A-M. Central purple barred/outlined feature around (400,681)-(466,729). |
| `yellow_castle` | (960,580)-(1280,966) | Yellow castle-like region with upper gray chamber, central lower projection, lower side corridors, upper gate-like slots, and a barred gate around (1112,886)-(1126,918). |
| `green_long_room` | (640,966)-(1280,1160) | Two adjacent native 320-pixel room units rendered as one long mostly open horizontal gray-floored region with green boundary bands. |

At the atlas scale, `green_long_room` is not one logical room:

- Left unit `(640,966)-(960,1160)`: green top-entry shape with a centered top aperture, continuous bottom band, a thin black line on the left edge, and an open right edge into the adjacent green unit. It is the destination after moving left from the right unit and must return right to that unit.
- Right unit `(960,966)-(1280,1160)`: green room directly below the Yellow Castle; the Yellow Castle’s centered downward passage enters this unit.
- The atlas route is Yellow Castle -> right green unit -> left green unit by moving left; the left unit returns to the right green unit through its open right edge.
| `blue_maze_lower_left` | (0,966)-(640,1160) | Blue maze extending off the left edge; gray corridors and rectangular turns. |
| `olive_right_room` | (1280,966)-(1600,1160) | Long gray-floored olive room directly right of the green room; right boundary near x=1576-1580. |
| `orange_lower_right` | (1280,1159)-(1600,1352) | Orange-framed rectangular enclosure with small black and green glyphs. |

## Labels visible in the atlas

The blue maze and adjacent boundaries show letters A through M. Visible placements include:

- Left/upper blue side: J, K, C, B, A
- Central/right boundary: L, M, I, H, G, F, E, D
- Lower-left section: L, M, I, H, G, F, E, D, with J/K near the right boundary
- Yellow-castle left edge: C, B, A

The image alone does not prove whether these letters are room IDs, map-sector labels, or annotations. Do not convert them to numeric ROM IDs without ASM/table confirmation.

## Adjacency and openings

### Yellow castle to green room

The yellow castle ends around y=966 and the long green room begins immediately below it. A centered downward connection is visibly present around x=1088-1152. The green destination floor extends substantially left and right from that arrival area. It is not a narrow dead-end or sealed vertical shaft.

Validation rule for Variation 1:

- The yellow-castle downward arrival must enter the right green unit.
- Moving left from that unit must enter the adjacent left green unit.
- The left green unit must render one top aperture, a continuous bottom band, its ASM-backed thin left line, and an open right edge into the right green unit.
- The left unit must allow the reciprocal right transition to the right green unit while rejecting unsupported bottom transitions; only its declared top and right transitions are active.
- The exact aperture width must come from Variation 1 raster/ASM data, not a generic centered opening.

### Other vertical adjacency

- `purple_upper` -> `orange_upper`: aligned boundary around y=194; gray central continuity is visible; no evidence of a full-width black barrier.
- `orange_upper` -> `black_castle`: boundary around y=387; predominantly black castle structure with local gate/slot geometry.
- `black_castle` -> `blue_maze_upper`: boundary around y=580; mostly black edge with local geometry determining passages.
- `yellow_castle` -> `green_long_room`: open centered downward connection around y=966.
- `green_long_room` -> `orange_lower_right`: orange region begins below the green/olive row at approximately y=1159 on the right.

### Horizontal adjacency

- `blue_maze_upper` -> `yellow_castle`: shared interface near x=960, concentrated around A/B/C rows; not a single continuous open corridor.
- `blue_maze_lower_left` -> `green_long_room`: interface near x=640; treat the black vertical segment near x=662-666 as a boundary except where source raster shows an aperture.
- `green_long_room` -> `olive_right_room`: aligned horizontal rooms near x=1280; strong vertical boundary near x=1276-1280, so do not assume the entire interface is open.

## Black geometry classification

Treat these as walls unless a source-supported aperture interrupts them:

- Thick outer borders around colored regions.
- Continuous horizontal/vertical separators.
- The black castle enclosure.
- Long vertical boundaries near x=662-666, x=1276-1280, and x=1576-1580.

Treat these as gate-like structures, not ordinary full-width walls:

- Black-castle barred gate around (472,500)-(486,532).
- Yellow-castle barred gate around (1112,886)-(1126,918).
- Repeating black/gray vertical castle slots.

Treat these as labels or objects, not walls:

- Isolated black glyphs inside gray interiors.
- Letter labels A-M.

Gray floor is the visually continuous traversable interior. A passage exists where gray floor continues through or around a boundary without a continuous black stroke.

## Confidence and limitations

High confidence: image dimensions, palette, major region boxes, yellow-castle-to-green-room adjacency, broad left/right openness of the green room, and distinction between large walls versus isolated glyphs.

Medium confidence: exact traversal interpretation of castle slots and maze interfaces.

Low confidence: numeric ROM room IDs, exact Variation 1 exit-table destinations, and exact collision aperture widths. Those require the Variation 1 ASM/ROM tables.
