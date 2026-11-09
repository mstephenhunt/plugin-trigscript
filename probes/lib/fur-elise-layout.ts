// Where the Für Elise visualizer probe draws on its 128 × 128 map, shared by the script (probes/fur-elise-visual.ts)
// and its base map (probes/lib/fur-elise-map.mts). Map pixels unless a name says tiles.
//
// The top of the map is Space, black on the minimap: the piano roll, a cell an Overlord two tiles square (Korobeiniki's
// board, played), a column a key. The bottom is Platform, ground a unit stands on: the stage the camera looks at, a
// keyboard of Spider Mines given a Flag's looks (the main-screen spike's pixel, played: placed exactly where asked).

/** The keyboard: D2 to E6, every note the probe plays (keyRange of the A section and the storm). */
export const LO = 38, HI = 88, KEYS = HI - LO + 1;

/** The map, in tiles. */
export const MAP_W = 128, MAP_H = 128;

/* ── The minimap roll ── */

/** A roll cell is two tiles square: its centre is 64·c + 32. */
export const CELL = 64;
/** The column of the lowest key: the 51 keys in the middle of the map's 64 columns. */
export const ROLL_COL = Math.floor((MAP_W / 2 - KEYS) / 2);
/** The keyboard's two rows of cells: the upper has every key (black ones in their colour), the lower the white keys' fronts. */
export const ROLL_KEY_ROW = 42;
/** Rows of falling notes above the keyboard, and the frames a row stands for (Remastered redraws its minimap about every other frame). */
export const ROLL_ROWS = 40, ROLL_STEP = 2;

/* ── The stage, on the main screen ── */

/**
 * The view's top left corner on the map, the camera centred 426 × 240 from it (Remastered's widescreen view is 852
 * game pixels across; the console hides the bottom ~150). Text lines show along the view's left, x 0 … 233 between y
 * 100 and 290 (measured in earlier recordings), so the stage keeps to the right of x 240.
 */
export const VIEW_X = 1664, VIEW_Y = 3200, CAM_X = VIEW_X + 426, CAM_Y = VIEW_Y + 240;
/** The keyboard on the stage: white keys PITCH apart from view x WHITE_X0, their row at view y WHITE_Y; black keys a row above. */
export const PITCH = 20, WHITE_X0 = 250, WHITE_Y = 262, BLACK_Y = 242;
/**
 * Falling notes: STAGE_ROWS rows of Flags, ROW_GAP apart, upwards from view y FALL_Y0; a row a frame. A trigger cannot
 * make a Spider Mine overlapping another (the game puts it beside its place), and in the lifted game one made 16 pixels
 * above a neighbour 10 across was moved: so rows are 18 apart (and the lowest 18 above the black keys), white keys 20,
 * a black key 10 across and 20 up from its white neighbours; two Flags are never in one row closer than 16.
 */
export const STAGE_ROWS = 12, ROW_GAP = 18, FALL_Y0 = 224;
/** The sync lamp: a start-location ring, black, white on the frame a note starts. In view pixels. */
export const LAMP_X = 120, LAMP_Y = 50;
/** The Platform under the stage and the start locations, in tiles. */
export const STAGE_TILES = { x: 36, y: 96, w: 70, h: 32 } as const;
