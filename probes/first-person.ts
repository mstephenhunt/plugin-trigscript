// The third showcase's first probe: StarCraft in first person. The minimap is the screen: its top is a 3D view drawn
// in the fog of war (the S5 raycaster, outline walls), its bottom a real arena of the game's own cliffs
// (probes/lib/first-person-map.mts), seen from above on the minimap and the main screen alike. Your Marine in the arena
// is the camera: W A S D walk it (orders to a point ahead, so the game's own pathing moves it), the mouse turns the
// view. A computer's Zerglings and Hydralisks chase it with the game's own unit AI; each frame the raycaster reads where
// they are and draws them in the view, scaled by distance and cut where a wall is nearer (fog.sprite, a depth test
// against the walls' heights).
//
// What it asks (the answer sheet, first-person-answers.txt):
//   - V: how the monsters look in the view — (a) lit silhouettes in the fog, (b) green dots (your own Overlords, a
//     dot each, over the view), (c) both: silhouettes with red dots on them (P6's Overlords, seen where they are lit);
//   - T: how the mouse turns — "aim": the view faces the cursor, from the Marine; "steer": the cursor's distance left
//     or right of the Marine is how fast the view turns. Q and E turn too, in both;
//   - whether the minimap keeps up (about 12 pictures a second) with the arena, the monsters and the turning.
//
// Single player; Classic graphics (Options > Graphics) for a sharp minimap.
// probe-players: {"0":{"rgb":[16,252,24]},"1":{"rgb":[244,4,4]},"5":{"rgb":[252,56,40]}}
//
//   npx tsx probes/lib/first-person-map.mts fixtures/eud/first-person-base.scx probes/lib/first-person-arena.ts
//   NO_BASES=1 MAP_NAME="TrigScript first person" npx tsx scripts/build-fixture.mts probes/first-person.ts fixtures/eud/first-person.scx fixtures/eud/first-person-base.scx
import { fog } from "trigscript/fog";
import { Screen } from "trigscript/screen";
import { test, expect, type Sim } from "trigscript";
import { ARENA, ARENA_X, ARENA_Y, CELL, START_X, START_Y } from "./lib/first-person-arena";

const GW = ARENA[0].length;
/** Each cell of the arena: 0 floor, 1 wall. */
const CELLS = ARENA.join("").split("").map((c) => (c === "#" ? 1 : 0));
const cellAt = game((x: number, y: number): number => CELLS[y * GW + x]);
/** A cell in pixels; the arena's corner in pixels. */
const CELL_PX = CELL * 32, AX = ARENA_X * 32, AY = ARENA_Y * 32;

/** The view: 42 columns 3 tiles wide over the top 78 rows of the map, its middle row 39. */
const COLUMNS = 42, WIDTH = 3, HEIGHT = 78, MID = HEIGHT >> 1;
const VIEW = { count: COLUMNS, height: HEIGHT, width: WIDTH, ink: "light", shading: "outline" } as const;
/** The camera plane's half width: the view sees 2 × atan(0.66), about 67 degrees. */
const FOV = 0.66;
/** How far a ray looks, in cells; past it the view is dark (fog). */
const FAR = 28;
/** A wall a cell across at distance d is COLUMNS / 2 / FOV / d columns wide and HEIGHT / d rows tall: columns a row. */
const ASPECT = COLUMNS / 2 / FOV / HEIGHT;

/** The monsters' silhouettes, front on, and their size in cells (a wall is 1). */
const LING = fog.figure([
  "#......#",
  "##....##",
  "##.##.##",
  ".######.",
  "########",
  "########",
  ".##..##.",
  "#.#..#.#",
]);
const HYDRA = fog.figure([
  "..##..",
  ".####.",
  "######",
  "######",
  ".####.",
  "..##..",
  ".####.",
  "######",
  "##..##",
  "#....#",
]);
const LING_TALL = 0.35, LING_WIDE = 0.45, HYDRA_TALL = 0.6, HYDRA_WIDE = 0.4;
/** Nearer than this many pixels, a monster is drawn as if it were this near: at the Marine's feet it is still a shape. */
const NEAREST = 64;
/** The most monsters drawn: what the arena keeps alive. */
const MOST = 8;

/** The looks (V), and the turning (T). */
const FOG_ONLY = 0, DOTS_ONLY = 1, BOTH = 2;
const LOOKS = ["(a) lit silhouettes in the fog", "(b) green dots (your Overlords) over the view", "(c) both: silhouettes with red dots"];
const AIM = 0, STEER = 1;
const TURNS = ["aim: the view faces the cursor", "steer: the cursor's distance left or right of the Marine turns the view"];
/** Steer: no turn within this many pixels of the Marine; past it, radians a game frame a pixel; the most a frame. */
const DEAD = 40, STEER_RATE = 0.0004, STEER_MOST = 0.16;
/** Aim: the most the view turns in a game frame towards the cursor. */
const AIM_MOST = 0.25;
/** Q and E: radians a game frame. */
const KEY_TURN = 0.09;

/** The dots: a pixel a column of the view (3 tiles) and 2 rows; colour 4 is yours (green), 5 is P6's (red). */
const DOT_ROWS = HEIGHT >> 1;
const GREEN = 4, RED = 5;
/** The most dots a picture: a near monster is drawn as its outline in dots, as in the fog. */
const DOTS_MOST = 200;

/** The arena lit whole, every picture: the cover's few large brushes. */
const ARENA_LIGHT = fog.picture(ARENA.map((row) => "#".repeat(row.length * CELL)).flatMap((r) => [r, r]));

const CAMERA = reserveLocation("first person: the camera, on the Marine");
const AHEAD = reserveLocation("first person: where the Marine is sent");
const SPAWN = reserveLocation("first person: where a monster is made");
const PREY = reserveLocation("first person: where the monsters are sent");

/** Where monsters are made, in cells: the far rooms and the hall. */
const SPAWNS_X = [33, 50, 30, 53, 8, 46];
const SPAWNS_Y = [3, 4, 16, 16, 16, 6];

program(async () => {
  removeUnit(P1, units.AnyUnit);
  removeUnit(P2, units.AnyUnit);
  // Your dots must not light the fog round them: an Overlord of yours that sees nothing.
  stats(units.ZergOverlord).sight = 0;
  displayText("\x04StarCraft in first person: the MINIMAP is the screen. W A S D walk, the mouse turns, Q E turn too.");
  displayText("\x04V changes how the monsters look, T how the mouse turns. Do not select the Marine (if you did, press Esc).");
  displayText("\x11Classic graphics (Options > Graphics) draws the minimap sharp.");
  await nextFrame();
  fog.reveal(P1);
  await nextFrame();

  const dots = new Screen(1, 0, COLUMNS, DOT_ROWS, "dots", 3, 2);

  centerLocation(SPAWN, AX + START_X * CELL_PX + CELL_PX / 2, AY + START_Y * CELL_PX + CELL_PX / 2, 32, 32);
  createUnit(P1, units.TerranMarine, 1, SPAWN);
  let marine = first(unitsOf(P1, { type: units.TerranMarine }));

  let angle = 0, look = BOTH, turning = AIM, frame = 0, moving = false;
  /** The last walking order: the keys it was for, the view's angle then, and its frame. */
  let sentKeys = 0, sentAngle = 0, sentAt = 0;
  const heights: number[] = new Array(COLUMNS).fill(0);
  const faces: number[] = new Array(COLUMNS).fill(0);
  /** How near each column's wall is: the rows it stands, before it is cut to the view. */
  const depths: number[] = new Array(COLUMNS).fill(0);
  // The monsters this picture, nearest last: each one's box in the view and how near it is.
  const boxLeft: number[] = new Array(MOST).fill(0);
  const boxWide: number[] = new Array(MOST).fill(0);
  const boxTop: number[] = new Array(MOST).fill(0);
  const boxTall: number[] = new Array(MOST).fill(0);
  const boxNear: number[] = new Array(MOST).fill(0);
  const boxKind: number[] = new Array(MOST).fill(0);
  // The dots drawn last picture, to take off the board: each one's column and row of dots.
  const dotX: number[] = new Array(DOTS_MOST).fill(0);
  const dotY: number[] = new Array(DOTS_MOST).fill(0);
  let dotCount = 0;

  while (true) {
    frame++;
    if (!marine) {
      centerLocation(SPAWN, AX + START_X * CELL_PX + CELL_PX / 2, AY + START_Y * CELL_PX + CELL_PX / 2, 32, 32);
      createUnit(P1, units.TerranMarine, 1, SPAWN);
      marine = first(unitsOf(P1, { type: units.TerranMarine }));
      if (!marine) { await nextFrame(); continue; }
    }
    if (keyPressed(P1, "V")) { look = (look + 1) % 3; displayText(`\x04Monsters: ${LOOKS[look]}`); }
    if (keyPressed(P1, "T")) { turning = 1 - turning; displayText(`\x04Turning: ${TURNS[turning]}`); }
    const mx = marine.x, my = marine.y;

    // Turning: the mouse, as the variant says, and Q and E.
    const at = mouse(P1);
    const cx = at.x - mx, cy = at.y - my;
    if (turning == AIM) {
      if (Math.abs(cx) + Math.abs(cy) > 24) {
        let d = Math.atan2(cy, cx) - angle;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        angle += Math.min(Math.max(d, -AIM_MOST), AIM_MOST);
      }
    } else {
      if (cx > DEAD) angle += Math.min((cx - DEAD) * STEER_RATE, STEER_MOST);
      if (cx < -DEAD) angle -= Math.min((-DEAD - cx) * STEER_RATE, STEER_MOST);
    }
    if (keyHeld(P1, "Q")) angle -= KEY_TURN;
    if (keyHeld(P1, "E")) angle += KEY_TURN;
    if (angle > Math.PI) angle -= 2 * Math.PI;
    if (angle < -Math.PI) angle += 2 * Math.PI;
    const dirX = Math.cos(angle), dirY = Math.sin(angle);

    // Walking: an order to a point ahead (forward and back along the view, sideways across it), kept off the walls.
    let fwd = 0, side = 0;
    if (keyHeld(P1, "W")) fwd++;
    if (keyHeld(P1, "S")) fwd--;
    if (keyHeld(P1, "D")) side++;
    if (keyHeld(P1, "A")) side--;
    if (fwd != 0 || side != 0) {
      // Along the way, a cell's length at a time, as far as 4 cells or the last floor before a wall; a new order only
      // when the keys or the view changed, or every 8 frames (an order every frame makes a unit stutter).
      const wayX = dirX * fwd - dirY * side, wayY = dirY * fwd + dirX * side;
      let reach = 0, k = 1;
      while (k <= 4) {
        const qx = mx + Math.floor(wayX * (k * 32)), qy = my + Math.floor(wayY * (k * 32));
        if (cellAt(Math.floor((qx - AX) / CELL_PX), Math.floor((qy - AY) / CELL_PX)) == 1) break;
        reach = k * 32;
        k++;
      }
      const keys = fwd * 3 + side;
      if (keys != sentKeys || Math.abs(angle - sentAngle) > 0.12 || frame - sentAt >= 8) {
        centerLocation(AHEAD, mx + Math.floor(wayX * reach), my + Math.floor(wayY * reach), 8, 8);
        marine.order("move", AHEAD);
        sentKeys = keys;
        sentAngle = angle;
        sentAt = frame;
      }
      moving = true;
    } else if (moving) {
      centerLocation(AHEAD, mx, my, 8, 8);
      marine.order("move", AHEAD);
      moving = false;
      sentKeys = 0;
    }
    if (marine.hp < 20) marine.hp = 40;

    // The screen follows the Marine, every frame.
    centerLocation(CAMERA, mx, my, 32, 32);
    centerView(CAMERA);

    // The monsters: kept at MOST, sent after the Marine twice a second.
    if (frame % 12 == 0) {
      const alive = unitsOf(P2).reduce((so, u) => so + (u.hp > 0 ? 1 : 0), 0);
      if (alive < MOST) {
        const k = frame % SPAWNS_X.length;
        centerLocation(SPAWN, AX + SPAWNS_X[k] * CELL_PX + CELL_PX / 2, AY + SPAWNS_Y[k] * CELL_PX + CELL_PX / 2, 64, 64);
        if (frame % 36 == 0) createUnit(P2, units.ZergHydralisk, 1, SPAWN);
        else createUnit(P2, units.ZergZergling, 1, SPAWN);
      }
      centerLocation(PREY, mx, my, 64, 64);
      order(P2, units.AnyUnit, locations.Anywhere, PREY, "attack");
    }

    // A picture every other frame (the minimap redraws the fog about every other frame).
    if ((frame & 1) == 0) {
      // The camera, in cells.
      const px = fixed(mx - AX) / CELL_PX, py = fixed(my - AY) / CELL_PX;
      const planeX = -dirY * FOV, planeY = dirX * FOV;
      const stepRayX = planeX * (2 / fixed(COLUMNS)), stepRayY = planeY * (2 / fixed(COLUMNS));
      let rayX = dirX - planeX + stepRayX / 2, rayY = dirY - planeY + stepRayY / 2;
      let col = 0;
      while (col < COLUMNS) {
        let mapX = Math.floor(px), mapY = Math.floor(py);
        const deltaX = Math.abs(rayX) < 0.01 ? 100 : Math.abs(1 / rayX);
        const deltaY = Math.abs(rayY) < 0.01 ? 100 : Math.abs(1 / rayY);
        let stepX = 1, stepY = 1;
        let sideX = (mapX + 1 - px) * deltaX, sideY = (mapY + 1 - py) * deltaY;
        if (rayX < 0) { stepX = -1; sideX = (px - mapX) * deltaX; }
        if (rayY < 0) { stepY = -1; sideY = (py - mapY) * deltaY; }
        let face = 0, hit = 0, steps = 0;
        while (hit == 0 && steps < FAR) {
          if (sideX < sideY) { sideX += deltaX; mapX += stepX; face = 0; }
          else { sideY += deltaY; mapY += stepY; face = 1; }
          hit = cellAt(mapX, mapY);
          steps++;
        }
        if (hit == 0) { heights[col] = 0; depths[col] = 0; faces[col] = -1; }
        else {
          const distance = face == 0 ? sideX - deltaX : sideY - deltaY;
          const tall = Math.floor(HEIGHT / Math.max(distance, 0.05));
          depths[col] = tall;
          heights[col] = Math.min(HEIGHT, tall);
          faces[col] = (mapY * GW + mapX) * 2 + face;
        }
        rayX += stepRayX;
        rayY += stepRayY;
        col++;
      }

      // Each monster: where it is from the camera (along the view, and across it), its box in the view, how near.
      let n = 0;
      for (const u of unitsOf(P2)) {
        if (n >= MOST) break;
        u.speedUpgrade = true;
        const dx = u.x - mx, dy = u.y - my;
        const along = dirX * dx + dirY * dy;
        if (along > 8) {
          // Nearer than NEAREST it is drawn at NEAREST, where it is across the view.
          const far = Math.max(along, NEAREST);
          const across = (dirX * dy - dirY * dx) * (far / along);
          // Rows a thing a cell tall stands at this distance: HEIGHT × CELL_PX / far.
          const near = Math.floor((HEIGHT * CELL_PX) / far);
          const centre = COLUMNS / 2 + (across / far) * (COLUMNS / 2 / FOV);
          const hydra = u.type == units.ZergHydralisk;
          const tall = Math.max(Math.floor(near * (hydra ? HYDRA_TALL : LING_TALL)), 1);
          const wide = Math.max(Math.floor(near * ASPECT * (hydra ? HYDRA_WIDE : LING_WIDE)), 1);
          const left = Math.floor(centre) - (wide >> 1);
          if (left < COLUMNS && left + wide > 0) {
            boxLeft[n] = left;
            boxWide[n] = wide;
            boxTall[n] = tall;
            boxTop[n] = MID + (near >> 1) - tall;
            boxNear[n] = near;
            boxKind[n] = hydra ? 1 : 0;
            n++;
          }
        }
      }

      // The arena and the walls first: when a picture asks for more units than the game makes in a frame, what is
      // drawn last is what goes missing.
      fog.light(P1, ARENA_X, ARENA_Y, ARENA_LIGHT);
      fog.columns(P1, 1, 0, VIEW, heights, faces);
      if (look != DOTS_ONLY) {
        let i = 0;
        while (i < n) {
          if (boxKind[i] == 1) fog.sprite(P1, 1, 0, VIEW, HYDRA, boxLeft[i], boxWide[i], boxTop[i], boxTall[i], boxNear[i], depths);
          else fog.sprite(P1, 1, 0, VIEW, LING, boxLeft[i], boxWide[i], boxTop[i], boxTall[i], boxNear[i], depths);
          i++;
        }
      }
      // The dots: last picture's taken off the board, this one's drawn, then only the changes made on the map.
      let j = 0;
      while (j < dotCount) { dots.set(dotX[j], dotY[j], 0); j++; }
      dotCount = 0;
      if (look != FOG_ONLY) {
        const color = look == BOTH ? RED : GREEN;
        let i = 0;
        while (i < n) {
          let c = Math.max(boxLeft[i], 0);
          const last = Math.min(boxLeft[i] + boxWide[i], COLUMNS);
          const wide = boxWide[i];
          while (c < last && dotCount < DOTS_MOST - DOT_ROWS) {
            if (boxNear[i] > depths[c]) {
              // The figure's span in this column, in dots (two rows each).
              const k = Math.floor(((c - boxLeft[i]) * 8) / wide);
              let t = 0, b = 0;
              if (boxKind[i] == 1) { const kk = Math.floor(((c - boxLeft[i]) * 6) / wide); t = HYDRA.tops[kk]; b = HYDRA.bottoms[kk]; }
              else { t = LING.tops[k]; b = LING.bottoms[k]; }
              const from = Math.max((boxTop[i] + ((boxTall[i] * t) >> 8)) >> 1, 0);
              const to = Math.min((boxTop[i] + ((boxTall[i] * b + 255) >> 8) + 1) >> 1, DOT_ROWS);
              // Filled when small; tall, its top and bottom dots, and whole at the first and last column.
              const whole = to - from <= 6 || c == Math.max(boxLeft[i], 0) || c == last - 1;
              let r = from;
              while (r < to) {
                if (whole || r == from || r == to - 1) {
                  dots.set(c, r, color);
                  dotX[dotCount] = c;
                  dotY[dotCount] = r;
                  dotCount++;
                }
                r++;
              }
            }
            c++;
          }
          i++;
        }
      }
      dots.present();
      // Kept on the board through the next frame too: the minimap shows it whole.
      memory.vision.countdown = 2;
    }
    await nextFrame();
  }
});

/** The Marine. (The simulator walks no unit — it takes the orders and leaves the units where they are — so these tests
 * say something only in the game, and return early in the simulator.) */
const marineOf = (sim: Sim) => sim.units({ owner: P1, type: units.TerranMarine })[0];
/** The mouse held east of the Marine, `frames` frames, with W down when `walk`. */
function holdEast(sim: Sim, frames: number, walk: boolean) {
  for (let f = 0; f < frames; f++) {
    const m = marineOf(sim);
    if (m) sim.moveMouse(m.x + 300, m.y);
    if (walk) sim.press("W");
    sim.frames(1);
  }
}

test("W walks the Marine the way the view faces, and the mouse turns it", (sim) => {
  holdEast(sim, 10, false);
  const from = marineOf(sim).x;
  holdEast(sim, 60, true);
  const m = marineOf(sim);
  if (m.x == from && m.orderId == orders.Move) return; // the simulator
  expect(m.x - from).toBeGreaterThan(160);
});

test("the monsters come for the Marine, and are drawn in the view in front of the floor", (sim) => {
  holdEast(sim, 40, false);
  const before = sim.fog(P1, { x: 1, y: MID + 6, width: 126, height: HEIGHT - MID - 6 });
  if (!before) return;
  const made = sim.units({ owner: P2 }).map((u) => u.x * 65536 + u.y);
  holdEast(sim, 400, false);
  if (sim.units({ owner: P2 }).every((u) => made.includes(u.x * 65536 + u.y) || u.orderId != orders.AttackMove)) return; // the simulator
  const m = marineOf(sim);
  const close = sim.units({ owner: P2 }).filter((u) => Math.abs(u.x - m.x) + Math.abs(u.y - m.y) < 160).length;
  expect(close).toBeGreaterThan(0);
  // Below the horizon, past the walls' feet: lit only where a monster stands.
  const lit = (rows: string[]) => rows.join("").split("").filter((c) => c === "#").length;
  const after = sim.fog(P1, { x: 1, y: MID + 6, width: 126, height: HEIGHT - MID - 6 })!;
  expect(lit(after)).toBeGreaterThan(lit(before) + 20);
});
