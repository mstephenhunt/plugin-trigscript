// The third showcase's second probe: StarCraft in first person, after play 1 ("a bit janky"). The minimap is the
// screen — a 3D view in the fog at the top, a real arena under it — and your Marine is the camera. What changed:
//
//   - a picture EVERY frame (the minimap redraws its fog about every other frame, at its own moments; a picture every
//     other frame was sometimes shown twice and the view changed unevenly), and turning in small even steps: at most
//     0.07 radians a frame (4 degrees), eased toward the cursor;
//   - the camera walks by its own grid collision at a steady 6 pixels a frame (W S along the view, A D across it), and
//     the Marine is put where it is with Move Unit: nothing blocks it, nothing paths;
//   - the monsters stop short of you: Zerglings' claws reach 3.5 tiles and Hydralisks' spines 5 (weapons.dat), so the
//     game's own unit AI holds them 2 to 3 cells off, in front of you, and they fight from there;
//   - a wall's straight stretch is one face (probes/lib/first-person-play.ts, faceAt): the outline draws its corners
//     and ends, not a line at every cell;
//   - the arena is rooms and doors (probes/lib/first-person-map.mts, ARENA=rooms): walls 5 to 7 cells thick, the
//     view's walls the plan's own, straight; the whole map is Ice, the view's board plain snow (the brightest art, the
//     widest apart of lit and fog in Remastered's minimap).
//
// The camera and its walking and turning are probes/lib/first-person-play.ts, apart from the drawing.
// V changes how the monsters look, T how the mouse turns ("aim": the view turns toward the cursor seen from the Marine;
// "steer": the cursor's distance left or right of the Marine is how fast it turns). Q E turn too.
//
// Single player.
// probe-players: {"0":{"rgb":[16,252,24]},"1":{"rgb":[244,4,4]},"5":{"rgb":[252,56,40]}}
//
//   ARENA=rooms MAP_NAME="TrigScript first person 2" npx tsx probes/lib/first-person-map.mts fixtures/eud/first-person-2-base.scx probes/lib/first-person-2-arena.ts
//   NO_BASES=1 MAP_NAME="TrigScript first person 2" npx tsx scripts/build-fixture.mts probes/first-person-2.ts fixtures/eud/first-person-2.scx fixtures/eud/first-person-2-base.scx
import { fog } from "trigscript/fog";
import { Screen } from "trigscript/screen";
import { test, expect, type Sim } from "trigscript";
import { ARENA, ARENA_X, ARENA_Y, CELL, START_X, START_Y } from "./lib/first-person-2-arena";
import { Camera, CELL_PX, AX, AY, wallAt, faceAt } from "./lib/first-person-play";

/** The view: 42 columns 3 tiles wide over the top 78 rows of the map, its middle row 39. */
const COLUMNS = 42, WIDTH = 3, HEIGHT = 78, MID = HEIGHT >> 1;
const VIEW = { count: COLUMNS, height: HEIGHT, width: WIDTH, ink: "light", shading: "outline" } as const;
/** The camera plane's half width: the view sees 2 × atan(0.66), about 67 degrees. */
const FOV = 0.66;
/** How far a ray looks, in cells; past it the view is dark (fog). */
const FAR = 30;
/** A wall a cell across at distance d is COLUMNS / 2 / FOV / d columns wide and HEIGHT / d rows tall: columns a row. */
const ASPECT = COLUMNS / 2 / FOV / HEIGHT;

/** Walking: pixels a frame, and how far the camera keeps off a wall. */
const SPEED = 6, RADIUS = 20;
/** Aim: the share of the way to the cursor's angle turned in a frame, and the most. Steer: no turn within DEAD pixels of the Marine; past it, radians a frame a pixel, and the most. Q E: radians a frame. */
const AIM_EASE = 0.35, TURN_MOST = 0.07, DEAD = 40, STEER_RATE = 0.00025, STEER_MOST = 0.06, KEY_TURN = 0.05;

/** The monsters' silhouettes, front on, and their size in cells (a wall is 1). */
const LING = fog.figure(["#......#", "##....##", "##.##.##", ".######.", "########", "########", ".##..##.", "#.#..#.#"]);
const HYDRA = fog.figure(["..##..", ".####.", "######", "######", ".####.", "..##..", ".####.", "######", "##..##", "#....#"]);
const LING_TALL = 0.35, LING_WIDE = 0.45, HYDRA_TALL = 0.6, HYDRA_WIDE = 0.4;
/** Nearer than this many pixels, a monster is drawn as if it were this near. */
const NEAREST = 64;
/** The most monsters: what the arena keeps alive. */
const MOST = 8;
/** How far the monsters' weapons reach, in pixels (32 a tile): they stand that far off and fight from there. */
const CLAW_REACH = 112, SPINE_REACH = 160;

/** The looks (V), and the turning (T). */
const FOG_ONLY = 0, DOTS_ONLY = 1, BOTH = 2;
const LOOKS = ["(a) lit silhouettes in the fog", "(b) green dots (your Overlords) over the view", "(c) both: silhouettes with red dots"];
const AIM = 0, STEER = 1;
const TURNS = ["aim: the view turns toward the cursor", "steer: the cursor's distance left or right of the Marine turns the view"];

/** The dots: a pixel a column of the view (3 tiles) and 2 rows; colour 4 is yours (green), 5 is P6's (red). */
const DOT_ROWS = HEIGHT >> 1;
const GREEN = 4, RED = 5;
const DOTS_MOST = 200;

/** The arena lit whole, every picture: the cover's few large brushes. */
const ARENA_LIGHT = fog.picture(ARENA.map((row) => "#".repeat(row.length * CELL)).flatMap((r) => [r, r]));

const CAMERA = reserveLocation("first person 2: the camera");
const SPAWN = reserveLocation("first person 2: where a unit is made");
const PREY = reserveLocation("first person 2: where the monsters are sent");

/** Where monsters are made, in cells: the far rooms and the hall. */
const SPAWNS_X = [30, 50, 45, 30, 8, 52];
const SPAWNS_Y = [4, 5, 18, 18, 17, 16];

program(async () => {
  removeUnit(P1, units.AnyUnit);
  removeUnit(P2, units.AnyUnit);
  stats(units.ZergOverlord).sight = 0;
  stats(weapons.Claws).range = CLAW_REACH;
  stats(weapons.NeedleSpines).range = SPINE_REACH;
  displayText("\x04StarCraft in first person, 2: the MINIMAP is the screen. W S walk, A D step sideways, the mouse turns, Q E turn too.");
  displayText("\x04V changes how the monsters look, T how the mouse turns. Do not select the Marine (if you did, press Esc).");
  await nextFrame();
  fog.reveal(P1);
  await nextFrame();

  const dots = new Screen(1, 0, COLUMNS, DOT_ROWS, "dots", 3, 2);
  const cam = new Camera(AX + START_X * CELL_PX + CELL_PX / 2, AY + START_Y * CELL_PX + CELL_PX / 2);
  cam.turn(0);
  centerLocation(SPAWN, Math.floor(cam.x), Math.floor(cam.y), 32, 32);
  createUnit(P1, units.TerranMarine, 1, SPAWN);

  let look = BOTH, turning = AIM, frame = 0;
  const heights: number[] = new Array(COLUMNS).fill(0);
  const faces: number[] = new Array(COLUMNS).fill(0);
  /** How near each column's wall is: the rows it stands, before it is cut to the view. */
  const depths: number[] = new Array(COLUMNS).fill(0);
  // The monsters this picture: each one's box in the view and how near it is.
  const boxLeft: number[] = new Array(MOST).fill(0);
  const boxWide: number[] = new Array(MOST).fill(0);
  const boxTop: number[] = new Array(MOST).fill(0);
  const boxTall: number[] = new Array(MOST).fill(0);
  const boxNear: number[] = new Array(MOST).fill(0);
  const boxKind: number[] = new Array(MOST).fill(0);
  const dotX: number[] = new Array(DOTS_MOST).fill(0);
  const dotY: number[] = new Array(DOTS_MOST).fill(0);
  let dotCount = 0;

  while (true) {
    frame++;
    if (keyPressed(P1, "V")) { look = (look + 1) % 3; displayText(`\x04Monsters: ${LOOKS[look]}`); }
    if (keyPressed(P1, "T")) { turning = 1 - turning; displayText(`\x04Turning: ${TURNS[turning]}`); }

    // Turning: small even steps.
    const at = mouse(P1);
    const cx = at.x - Math.floor(cam.x), cy = at.y - Math.floor(cam.y);
    if (turning == AIM) {
      if (Math.abs(cx) + Math.abs(cy) > 24) cam.turnToward(Math.atan2(cy, cx), AIM_EASE, TURN_MOST);
    } else {
      if (cx > DEAD) cam.turn(Math.min((cx - DEAD) * STEER_RATE, STEER_MOST));
      if (cx < -DEAD) cam.turn(-Math.min((-DEAD - cx) * STEER_RATE, STEER_MOST));
    }
    if (keyHeld(P1, "Q")) cam.turn(-KEY_TURN);
    if (keyHeld(P1, "E")) cam.turn(KEY_TURN);

    // Walking: the camera by its own collision, the Marine put where it is.
    let fwd = 0, side = 0;
    if (keyHeld(P1, "W")) fwd++;
    if (keyHeld(P1, "S")) fwd--;
    if (keyHeld(P1, "D")) side++;
    if (keyHeld(P1, "A")) side--;
    const px = Math.floor(cam.x), py = Math.floor(cam.y);
    centerLocation(CAMERA, px, py, 32, 32);
    if (cam.walk(fwd, side, SPEED, RADIUS)) {
      const nx = Math.floor(cam.x), ny = Math.floor(cam.y);
      centerLocation(SPAWN, nx, ny, 32, 32);
      moveUnit(P1, units.TerranMarine, 1, locations.Anywhere, SPAWN);
      centerLocation(CAMERA, nx, ny, 32, 32);
    }
    centerView(CAMERA);
    const marine = first(unitsOf(P1, { type: units.TerranMarine }));
    if (!marine) {
      centerLocation(SPAWN, Math.floor(cam.x), Math.floor(cam.y), 32, 32);
      createUnit(P1, units.TerranMarine, 1, SPAWN);
    } else if (marine.hp < 20) marine.hp = 40;

    // The monsters: kept at MOST; the ones far off (more than 3 cells) sent toward the camera twice a second. Near,
    // the game's own AI has them fight from where their weapons reach.
    if (frame % 12 == 0) {
      const alive = unitsOf(P2).reduce((so, u) => so + (u.hp > 0 ? 1 : 0), 0);
      if (alive < MOST) {
        const k = (frame / 12) % SPAWNS_X.length;
        centerLocation(SPAWN, AX + SPAWNS_X[k] * CELL_PX + CELL_PX / 2, AY + SPAWNS_Y[k] * CELL_PX + CELL_PX / 2, 64, 64);
        if (frame % 36 == 0) createUnit(P2, units.ZergHydralisk, 1, SPAWN);
        else createUnit(P2, units.ZergZergling, 1, SPAWN);
      }
      centerLocation(PREY, Math.floor(cam.x), Math.floor(cam.y), 64, 64);
      for (const u of unitsOf(P2)) {
        u.speedUpgrade = true;
        if (Math.abs(u.x - cam.x) + Math.abs(u.y - cam.y) > 3 * CELL_PX || u.orderId == orders.Guard || u.orderId == orders.PlayerGuard) u.order("attack", PREY);
      }
    }

    // The picture, every frame. The rays, in cells.
    const rx = (cam.x - AX) / CELL_PX, ry = (cam.y - AY) / CELL_PX;
    const dirX = cam.dirX, dirY = cam.dirY;
    const planeX = -dirY * FOV, planeY = dirX * FOV;
    const stepRayX = planeX * (2 / fixed(COLUMNS)), stepRayY = planeY * (2 / fixed(COLUMNS));
    let rayX = dirX - planeX + stepRayX / 2, rayY = dirY - planeY + stepRayY / 2;
    let col = 0;
    while (col < COLUMNS) {
      let mapX = Math.floor(rx), mapY = Math.floor(ry);
      const deltaX = Math.abs(rayX) < 0.01 ? 100 : Math.abs(1 / rayX);
      const deltaY = Math.abs(rayY) < 0.01 ? 100 : Math.abs(1 / rayY);
      let stepX = 1, stepY = 1;
      let sideX = (mapX + 1 - rx) * deltaX, sideY = (mapY + 1 - ry) * deltaY;
      if (rayX < 0) { stepX = -1; sideX = (rx - mapX) * deltaX; }
      if (rayY < 0) { stepY = -1; sideY = (ry - mapY) * deltaY; }
      let face = 0, hit = 0, steps = 0;
      while (hit == 0 && steps < FAR) {
        if (sideX < sideY) { sideX += deltaX; mapX += stepX; face = 0; }
        else { sideY += deltaY; mapY += stepY; face = 1; }
        hit = wallAt(mapX, mapY);
        steps++;
      }
      if (hit == 0) { heights[col] = 0; depths[col] = 0; faces[col] = -1; }
      else {
        const distance = face == 0 ? sideX - deltaX : sideY - deltaY;
        const tall = Math.floor(HEIGHT / Math.max(distance, 0.05));
        depths[col] = tall;
        heights[col] = Math.min(HEIGHT, tall);
        faces[col] = faceAt(mapX, mapY, face, face == 0 ? stepX : stepY);
      }
      rayX += stepRayX;
      rayY += stepRayY;
      col++;
    }

    // Each monster: where it is from the camera (along the view, and across it), its box in the view, how near.
    let n = 0;
    for (const u of unitsOf(P2)) {
      if (n >= MOST) break;
      const dx = u.x - cam.x, dy = u.y - cam.y;
      const along = dirX * dx + dirY * dy;
      if (along > 8) {
        const far = Math.max(along, NEAREST);
        const across = (dirX * dy - dirY * dx) * (far / along);
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

    // The arena and the walls first: when a picture asks for more units than the game makes in a frame, what is drawn
    // last is what goes missing.
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
            let t = 0, b = 0;
            if (boxKind[i] == 1) { const kk = Math.floor(((c - boxLeft[i]) * 6) / wide); t = HYDRA.tops[kk]; b = HYDRA.bottoms[kk]; }
            else { const k = Math.floor(((c - boxLeft[i]) * 8) / wide); t = LING.tops[k]; b = LING.bottoms[k]; }
            const from = Math.max((boxTop[i] + ((boxTall[i] * t) >> 8)) >> 1, 0);
            const to = Math.min((boxTop[i] + ((boxTall[i] * b + 255) >> 8) + 1) >> 1, DOT_ROWS);
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
    await nextFrame();
  }
});

/** The Marine. (The simulator walks no unit; Move Unit it does: these tests hold in both.) */
const marineOf = (sim: Sim) => sim.units({ owner: P1, type: units.TerranMarine })[0];

test("W walks the camera and the Marine a steady 6 pixels a frame the way the view faces, D across it", (sim) => {
  for (let f = 0; f < 10; f++) { const m = marineOf(sim); if (m) sim.moveMouse(m.x + 300, m.y); sim.frames(1); }
  const from = marineOf(sim).x;
  for (let f = 0; f < 30; f++) { sim.moveMouse(marineOf(sim).x + 300, marineOf(sim).y); sim.press("W"); sim.frames(1); }
  sim.frames(4);
  // 30 frames of W, the first two before the key arrives: about 28 × 6.
  const went = marineOf(sim).x - from;
  // (The simulator brings a key a frame sooner than the game, 2 frames after it goes down: a step more.)
  expect(went >= 150 && went <= 192).toBe(true);
  const y = marineOf(sim).y;
  for (let f = 0; f < 10; f++) { sim.moveMouse(marineOf(sim).x + 300, marineOf(sim).y); sim.press("D"); sim.frames(1); }
  sim.frames(4);
  expect(marineOf(sim).y - y).toBeGreaterThan(40);
});

test("the camera stops at a wall: turned west, W toward the room's west wall ends a radius off it", (sim) => {
  for (let f = 0; f < 70; f++) { const m = marineOf(sim); if (m) sim.moveMouse(m.x - 300, m.y); sim.frames(1); }
  for (let f = 0; f < 70; f++) { const m = marineOf(sim); sim.moveMouse(m.x - 300, m.y); sim.press("W"); sim.frames(1); }
  sim.frames(4);
  // The first room's floor begins at cell 3: pixel AX + 3 × CELL_PX, and the camera keeps RADIUS off (within a step).
  const x = marineOf(sim).x - (AX + 3 * CELL_PX + RADIUS);
  expect(x >= 0 && x <= SPEED).toBe(true);
});
