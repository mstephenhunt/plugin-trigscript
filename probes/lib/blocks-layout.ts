// Where the falling-block showcase draws on its 64 × 64 map, in screen pixels (a pixel two tiles), shared by the script
// (probes/blocks.tsx) and its base map (probes/lib/blocks-map.mts), which lays the frames round the well and the boxes
// in Platform, so the minimap shows them grey on the black of Space.

/** The well: 12 × 22 cells, its top left cell at this pixel. */
export const WELL_X = 2, WELL_Y = 1, WELL_W = 12, WELL_H = 22;
/** The box of the piece to come and the box of the piece held: four cells by two, their top left at these pixels. */
export const NEXT_X = 18, NEXT_Y = 2, HOLD_X = 18, HOLD_Y = 7;
/** The visualizer: a strip of pixels right of the well. */
export const VIS_X = 17, VIS_Y = 11, VIS_W = 13, VIS_H = 13;
/** The screen: the whole map but the strip of platform at the bottom, where the start locations stand. */
export const SCREEN_W = 32, SCREEN_H = 28;

/** The rectangles of Platform the base map lays, in pixels: x, y, width, height. The well's walls and floor, the boxes' rims. */
export const FRAMES: readonly (readonly [number, number, number, number])[] = [
  [WELL_X - 1, WELL_Y - 1, 1, WELL_H + 2],
  [WELL_X + WELL_W, WELL_Y - 1, 1, WELL_H + 2],
  [WELL_X - 1, WELL_Y + WELL_H, WELL_W + 2, 1],
  // A rim one pixel round each box.
  ...[[NEXT_X, NEXT_Y], [HOLD_X, HOLD_Y]].flatMap(([x, y]) => [
    [x - 1, y - 1, 6, 1], [x - 1, y + 2, 6, 1], [x - 1, y, 1, 2], [x + 4, y, 1, 2],
  ] as const),
];
