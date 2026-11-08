// ledger: step 7, takes
// The fog library: a figure (`fog.figure(rows)`, worked out when the map is built) standing in a view of fog.columns(),
// scaled to its box and cut where a column's wall is nearer: `fog.sprite(P1, x, y, layout, figure, left, width, top,
// height, near, depths)` (a monster in front of a raycaster's walls).
import { fog } from "trigscript/fog";
const VIEW = { count: 6, height: 24 } as const;
const LING = fog.figure(["#..#", "####", ".##."]);
program(async () => {
  const depths = [0, 0, 30, 0, 0, 0];
  depths[0] = 5;
  fog.sprite(P1, 1, 0, VIEW, LING, 1, 4, 8, 6, 20, depths);
  await nextFrame();
});
