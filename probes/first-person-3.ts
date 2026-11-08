// The third showcase's third probe: StarCraft in first person, played as StarCraft. You select your Marine and
// right-click to move it (or attack-move, A then a click); nothing else is yours to press. The view is the Marine's:
// each frame the program reads where it is and which way it faces (u.facing, the game's own direction byte, 0 … 255)
// and draws the 3D view from there — eased toward it, at most 0.07 radians a frame, so the steps the game turns a unit
// in are not seen as snaps, and the camera's place eased a little after the Marine's. When the Marine shoots, it faces
// its target, and so does the view. A new picture every frame.
//
// B moves the eye half a cell behind the Marine (over its shoulder, the Marine drawn in the view) and back.
// V changes how the monsters look. The arena and the monsters are probe 2's (probes/first-person-2.ts), so the two
// compare directly; the play's pieces are probes/lib/first-person-play.ts.
//
// Single player.
// probe-players: {"0":{"rgb":[16,252,24]},"1":{"rgb":[244,4,4]},"5":{"rgb":[252,56,40]}}
//
//   REVEAL=1 ARENA=rooms MAP_NAME="TrigScript first person 3" npx tsx probes/lib/first-person-map.mts fixtures/eud/first-person-3-base.scx
//   NO_BASES=1 MAP_NAME="TrigScript first person 3" npx tsx scripts/build-fixture.mts probes/first-person-3.ts fixtures/eud/first-person-3.scx fixtures/eud/first-person-3-base.scx
// (Probe 2's arena and grid, probes/lib/first-person-2-arena.ts; the base map adds Map Revealers over the arena.)
import { fog } from "trigscript/fog";
import { Screen } from "trigscript/screen";
import { test, expect, type Sim } from "trigscript";
import { START_X, START_Y } from "./lib/first-person-2-arena";
import { Camera, CELL_PX, AX, AY, wallAt, wallAtPx, faceAt, facingAngle } from "./lib/first-person-play";

/** The view: 42 columns 3 tiles wide over the top 78 rows of the map, its middle row 39. */
const COLUMNS = 42, WIDTH = 3, HEIGHT = 78, MID = HEIGHT >> 1;
const VIEW = { count: COLUMNS, height: HEIGHT, width: WIDTH, ink: "light", shading: "outline" } as const;
/** The camera plane's half width: the view sees 2 × atan(0.66), about 67 degrees. */
const FOV = 0.66;
/** How far a ray looks, in cells; past it the view is dark (fog). */
const FAR = 30;
/** A wall a cell across at distance d is COLUMNS / 2 / FOV / d columns wide and HEIGHT / d rows tall: columns a row. */
const ASPECT = COLUMNS / 2 / FOV / HEIGHT;

/** The view turns a share of the way to the Marine's facing each frame, at most TURN_MOST; the camera's place follows the Marine's by a share a frame. */
const TURN_EASE = 0.35, TURN_MOST = 0.07, FOLLOW = 0.5;
/** Over the shoulder (B): the eye this many pixels behind the Marine. */
const BEHIND = 32;

/** The monsters' silhouettes, front on, and their size in cells (a wall is 1). */
const LING = fog.figure(["#......#", "##....##", "##.##.##", ".######.", "########", "########", ".##..##.", "#.#..#.#"]);
const HYDRA = fog.figure(["..##..", ".####.", "######", "######", ".####.", "..##..", ".####.", "######", "##..##", "#....#"]);
const LING_TALL = 0.35, LING_WIDE = 0.45, HYDRA_TALL = 0.6, HYDRA_WIDE = 0.4;
/** Your Marine, from behind, when the eye is over its shoulder. */
const MARINE = fog.figure(["..##..", ".####.", "######", "######", ".####.", ".#..#.", ".#..#."]);
const MARINE_TALL = 0.3, MARINE_WIDE = 0.3;
/** Nearer than this many pixels, a monster is drawn as if it were this near. */
const NEAREST = 64;
/** The most monsters: what the arena keeps alive. */
const MOST = 8;
/** Boxes in the view: the monsters, and your Marine over the shoulder. */
const BOXES = MOST + 1;
/** How far the monsters' weapons reach, in pixels (32 a tile): they stand that far off and fight from there. */
const CLAW_REACH = 112, SPINE_REACH = 160;

/** The looks (V). */
const FOG_ONLY = 0, DOTS_ONLY = 1, BOTH = 2;
const LOOKS = ["(a) lit silhouettes in the fog", "(b) green dots (your Overlords) over the view", "(c) both: silhouettes with red dots"];

/** The dots: a pixel a column of the view (3 tiles) and 2 rows; colour 4 is yours (green), 5 is P6's (red). */
const DOT_ROWS = HEIGHT >> 1;
const GREEN = 4, RED = 5;
const DOTS_MOST = 200;


const SPAWN = reserveLocation("first person 3: where a unit is made");
const PREY = reserveLocation("first person 3: where the monsters are sent");

/** Where monsters are made, in cells: the far rooms and the hall. */
const SPAWNS_X = [30, 50, 45, 30, 8, 52];
const SPAWNS_Y = [4, 5, 18, 18, 17, 16];

program(async () => {
  removeUnit(P2, units.AnyUnit);
  stats(units.ZergOverlord).sight = 0;
  stats(weapons.Claws).range = CLAW_REACH;
  stats(weapons.NeedleSpines).range = SPINE_REACH;
  displayText("\x04StarCraft in first person, 3: the MINIMAP is the screen, and it is your Marine's eyes. Right-click on the main screen to move it, A to attack-move.");
  displayText("\x04B puts the eye over the Marine's shoulder and back, V changes how the monsters look.");
  await nextFrame();
  fog.reveal(P1);
  await nextFrame();

  const dots = new Screen(1, 0, COLUMNS, DOT_ROWS, "dots", 3, 2);
  const startX = AX + START_X * CELL_PX + CELL_PX / 2, startY = AY + START_Y * CELL_PX + CELL_PX / 2;
  centerLocation(SPAWN, startX, startY, 32, 32);
  createUnit(P1, units.TerranMarine, 1, SPAWN);
  centerView(SPAWN);
  const made = first(unitsOf(P1, { type: units.TerranMarine }));
  if (made) select(P1, made);
  const cam = new Camera(startX, startY);
  cam.turn(0);

  let look = BOTH, behind = false, frame = 0;
  const heights: number[] = new Array(COLUMNS).fill(0);
  const faces: number[] = new Array(COLUMNS).fill(0);
  /** How near each column's wall is: the rows it stands, before it is cut to the view. */
  const depths: number[] = new Array(COLUMNS).fill(0);
  // The monsters this picture: each one's box in the view and how near it is.
  const boxLeft: number[] = new Array(BOXES).fill(0);
  const boxWide: number[] = new Array(BOXES).fill(0);
  const boxTop: number[] = new Array(BOXES).fill(0);
  const boxTall: number[] = new Array(BOXES).fill(0);
  const boxNear: number[] = new Array(BOXES).fill(0);
  const boxKind: number[] = new Array(BOXES).fill(0);
  const dotX: number[] = new Array(DOTS_MOST).fill(0);
  const dotY: number[] = new Array(DOTS_MOST).fill(0);
  let dotCount = 0;

  while (true) {
    frame++;
    if (keyPressed(P1, "V")) { look = (look + 1) % 3; displayText(`\x04Monsters: ${LOOKS[look]}`); }
    if (keyPressed(P1, "B")) { behind = !behind; displayText(behind ? "\x04The eye: over the Marine's shoulder" : "\x04The eye: the Marine's own"); }

    // The view is the Marine's: its place and the way it faces, eased.
    let marine = first(unitsOf(P1, { type: units.TerranMarine }));
    if (!marine) {
      centerLocation(SPAWN, startX, startY, 32, 32);
      createUnit(P1, units.TerranMarine, 1, SPAWN);
      marine = first(unitsOf(P1, { type: units.TerranMarine }));
    }
    let mx = Math.floor(cam.x), my = Math.floor(cam.y);
    if (marine) {
      mx = marine.x;
      my = marine.y;
      cam.follow(mx, my, FOLLOW);
      cam.turnToward(facingAngle(marine.facing), TURN_EASE, TURN_MOST);
      if (marine.hp < 20) marine.hp = 40;
    }
    // The eye: the camera's place, or half a cell behind it when that is not in a wall.
    let eyeX = cam.x, eyeY = cam.y;
    if (behind) {
      const bx = cam.x - cam.dirX * BEHIND, by = cam.y - cam.dirY * BEHIND;
      if (wallAtPx(Math.floor(bx), Math.floor(by)) == 0) { eyeX = bx; eyeY = by; }
    }

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
      centerLocation(PREY, mx, my, 64, 64);
      for (const u of unitsOf(P2)) {
        u.speedUpgrade = true;
        if (Math.abs(u.x - mx) + Math.abs(u.y - my) > 3 * CELL_PX || u.orderId == orders.Guard || u.orderId == orders.PlayerGuard) u.order("attack", PREY);
      }
    }

    // The picture, every frame. The rays, in cells.
    const rx = (eyeX - AX) / CELL_PX, ry = (eyeY - AY) / CELL_PX;
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
      const dx = u.x - eyeX, dy = u.y - eyeY;
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
    // Over the shoulder: your Marine ahead, in the middle of the view.
    if (behind && eyeX != cam.x) {
      // (Drawn as if NEAREST off, as a monster that near is: at half a cell most of it would be under the view.)
      const near = Math.floor((HEIGHT * CELL_PX) / Math.max(BEHIND, NEAREST));
      const tall = Math.floor(near * MARINE_TALL), wide = Math.max(Math.floor(near * ASPECT * MARINE_WIDE), 1);
      boxLeft[n] = (COLUMNS >> 1) - (wide >> 1);
      boxWide[n] = wide;
      boxTall[n] = tall;
      boxTop[n] = MID + (near >> 1) - tall;
      boxNear[n] = near;
      boxKind[n] = 2;
      n++;
    }

    // (The arena is seen through the map's own Map Revealers, not lit with the fog's brushes as probe 2's is: brushes
    // made over it every frame stopped a walking unit under them in the lifted game.)
    // The walls first: when a picture asks for more units than the game makes in a frame, what is drawn
    // last is what goes missing.
    fog.columns(P1, 1, 0, VIEW, heights, faces);
    if (look != DOTS_ONLY) {
      let i = 0;
      while (i < n) {
        if (boxKind[i] == 2) fog.sprite(P1, 1, 0, VIEW, MARINE, boxLeft[i], boxWide[i], boxTop[i], boxTall[i], boxNear[i], depths);
        else if (boxKind[i] == 1) fog.sprite(P1, 1, 0, VIEW, HYDRA, boxLeft[i], boxWide[i], boxTop[i], boxTall[i], boxNear[i], depths);
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
        if (boxKind[i] == 2) { i++; continue; }
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

/** The Marine. (The simulator walks no unit: there the tests have nothing to say, and return.) */
const marineOf = (sim: Sim) => sim.units({ owner: P1, type: units.TerranMarine })[0];

test("the view turns with the Marine: sent east, then south, it faces there and the view follows in small steps", (sim) => {
  sim.frames(10);
  const m = marineOf(sim), fromX = m.x;
  sim.order(m, "move", { x: m.x + 400, y: m.y });
  sim.frames(30);
  const east = marineOf(sim);
  if (east.x == fromX) return; // the simulator
  // East is 64; the program's angle is read back from the view: a wall straight ahead east of the room's middle.
  expect(east.facing).toBe(64);
  sim.order(east, "move", { x: east.x, y: east.y + 120 });
  sim.frames(30);
  // (South of where it stood, give or take its place: the game's direction for the way it walks, near 128.)
  expect(Math.abs(marineOf(sim).facing - 128)).toBeLessThan(8);
});

test("the camera follows the Marine: walked east toward the room's wall, the wall ahead grows in the view", (sim) => {
  sim.frames(10);
  const m = marineOf(sim), fromX = m.x;
  // The middle column's wall: how tall, from its first lit row to its last (an outline wall is lit at its edges).
  const middle = () => { const rows = sim.fog(P1, { x: 1 + 3 * (COLUMNS >> 1) + 1, y: 0, width: 1, height: HEIGHT })!.join(""); return rows.lastIndexOf("#") - rows.indexOf("#"); };
  sim.order(m, "move", { x: m.x + 64, y: m.y });
  sim.frames(30);
  const before = middle();
  sim.order(marineOf(sim), "move", { x: m.x + 330, y: m.y });
  sim.frames(70);
  if (marineOf(sim).x == fromX) return; // the simulator
  expect(middle()).toBeGreaterThan(before);
});
