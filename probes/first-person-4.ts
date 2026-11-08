// The third showcase's fourth probe: StarCraft in first person ON THE MAIN SCREEN. The main screen is the 3D view: a
// board of 40 × 24 pixels 16 apart (the main-screen spike's step E) — Spider Mines that look like Flags, owned by an
// empty slot (P8), each coloured every frame by its sprite's owner byte (u.drawAs, with the sprite kept: a write
// alone). A colour raycaster: walls in four shades by distance and side, a floor and a ceiling, the monsters red,
// scaled by distance and cut where a wall is nearer. The minimap shows the real arena from above: right-click it to
// move your Marine (A, then a click on it, to attack-move); the view is the Marine's — its place and the way it faces,
// eased, as probe 3's. B puts the eye over the Marine's shoulder.
//
// The pixels: only the ones whose colour changed are written. The palette is the players' colours (CRGB, below):
// P1 yellow (your Marine, and the Marine in the view), P2 red (the computer's monsters, in the view and on the minimap),
// P3 … P5 and P7 the walls, P6 the floor, P8 the ceiling — and the pixels' owner, so they are dark on the minimap.
//
// Single player.
// probe-players: {"0":{"rgb":[250,220,40]},"1":{"rgb":[220,30,30]},"2":{"rgb":[175,180,190]},"3":{"rgb":[125,130,145]},"4":{"rgb":[85,88,100]},"5":{"rgb":[92,70,52]},"6":{"rgb":[232,232,238]},"7":{"rgb":[22,24,32]}}
//
//   MAP_NAME="TrigScript first person 4" npx tsx probes/lib/first-person-4-map.mts fixtures/eud/first-person-4-base.scx probes/lib/first-person-4-arena.ts
//   NO_BASES=1 MAP_NAME="TrigScript first person 4" npx tsx scripts/build-fixture.mts probes/first-person-4.ts fixtures/eud/first-person-4.scx fixtures/eud/first-person-4-base.scx
import { test, expect, type Unit, type UnitType, type Sim } from "trigscript";
import { ARENA, ARENA_X, ARENA_Y, CELL, START_X, START_Y, BOARD_X, BOARD_Y, BOARD_W, BOARD_H } from "./lib/first-person-4-arena";

/* ── The arena, as the rays see it ── */

const GW = ARENA[0].length, GH = ARENA.length;
const CELLS = ARENA.join("").split("").map((c) => (c === "#" ? 1 : 0));
const CELL_PX = CELL * 32, AX = ARENA_X * 32, AY = ARENA_Y * 32;
const wallAt = game((x: number, y: number): number => CELLS[y * GW + x]);

/* ── The board ── */

/** 40 × 24 pixels, 16 map pixels apart; the middle row (the horizon). */
const COLS = 40, ROWS = 24, MIDROW = ROWS >> 1, N = COLS * ROWS, PITCH = 16;
/** The colours, by player slot (drawAs takes 0 … 11): what each is, as the CRGB line above sets them. */
const MARINE_COLOR = 0, MONSTER = 1, WALL_A = 2, WALL_B = 3, WALL_C = 4, FLOOR = 5, WALL_LIGHT = 6, CEILING = 7;
/** A Spider Mine, which a trigger makes exactly where asked, drawn as a Flag (units.dat's flingy bytes of types 12 … 15). */
const MINE = 13 as UnitType;
const LOOKS = 0x664504;
const looks = (flingy: number) => 70 + flingy * 256 + 109 * 65536 + 71 * 16777216;
const FLAG_LOOK = 126, MINE_LOOK = 89;

/* ── The camera ── */

/** The camera plane's half width (about 67 degrees across); a wall's height in rows a cell, at a distance of one. */
const FOV = 0.66, TALL = COLS / 2 / FOV;
/** How far a ray looks, in cells. */
const FAR = 30;
/** The view turns a share of the way to the Marine's facing each frame, at most TURN_MOST; the place follows by FOLLOW. */
const TURN_EASE = 0.35, TURN_MOST = 0.07, FOLLOW = 0.5;
/** Over the shoulder (B): the eye this many pixels behind the Marine; the Marine drawn as if NEAREST off. */
const BEHIND = 32, NEAREST = 64;

/* ── The monsters ── */

/** Their silhouettes: each column's first and last row, in 256ths of the figure's height (as fog.figure() makes them). */
function figure(rows: readonly string[]): { width: number; tops: number[]; bottoms: number[] } {
  const height = rows.length, width = rows[0].length;
  const tops: number[] = [], bottoms: number[] = [];
  for (let x = 0; x < width; x++) {
    let first = -1, last = -1;
    for (let y = 0; y < height; y++) if (rows[y][x] === "#") { if (first < 0) first = y; last = y; }
    tops.push(first < 0 ? 0 : Math.floor((first * 256) / height));
    bottoms.push(first < 0 ? 0 : Math.ceil(((last + 1) * 256) / height));
  }
  return { width, tops, bottoms };
}
const LING = figure(["#......#", "##....##", "##.##.##", ".######.", "########", "########", ".##..##.", "#.#..#.#"]);
const HYDRA = figure(["..##..", ".####.", "######", "######", ".####.", "..##..", ".####.", "######", "##..##", "#....#"]);
const MARINE = figure(["..##..", ".####.", "######", "######", ".####.", ".#..#.", ".#..#."]);
const LING_TALL = 0.35, LING_WIDE = 0.45, HYDRA_TALL = 0.6, HYDRA_WIDE = 0.4, MARINE_TALL = 0.3, MARINE_WIDE = 0.3;
const MOST = 8, BOXES = MOST + 1;
const CLAW_REACH = 112, SPINE_REACH = 160;
const SPAWNS_X = [23, 24, 6, 10, 15];
const SPAWNS_Y = [4, 17, 17, 15, 7];

const AT = reserveLocation("first person 4: where a unit is made");
const SCREEN = reserveLocation("first person 4: the camera, on the board");
const PREY = reserveLocation("first person 4: where the monsters are sent");

/** A wall's colour by its distance (in cells) and side (0 the faces met stepping in x, 1 in y). */
const wallColor = game((distance: fixed, side: number): number => {
  if (distance < 2) return side == 0 ? WALL_LIGHT : WALL_A;
  if (distance < 4) return side == 0 ? WALL_A : WALL_B;
  if (distance < 7) return side == 0 ? WALL_B : WALL_C;
  return WALL_C;
});
/** A unit's facing (0 … 255 clockwise from north) as an angle of atan2's. */
const wrap = game((a: fixed): fixed => { let b = a; if (b > Math.PI) b -= 2 * Math.PI; if (b < -Math.PI) b += 2 * Math.PI; return b; });

program(async () => {
  removeUnit(P2, units.AnyUnit);
  stats(weapons.Claws).range = CLAW_REACH;
  stats(weapons.NeedleSpines).range = SPINE_REACH;
  centerLocation(SCREEN, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 40, 32, 32);
  centerView(SCREEN);

  // The board, a row a frame: mines made as Flags for P8, then each one's place on the board and its sprite, kept.
  const pix: Unit[] = [];
  const spr: number[] = [];
  const at: number[] = [];
  setMemory(LOOKS, "set", looks(FLAG_LOOK));
  let row = 0;
  while (row < ROWS) {
    let col = 0;
    while (col < COLS) {
      centerLocation(AT, BOARD_X + col * PITCH + PITCH / 2, BOARD_Y + row * PITCH + PITCH / 2);
      createUnit(P8, MINE, 1, AT);
      col++;
    }
    await nextFrame();
    row++;
  }
  setMemory(LOOKS, "set", looks(MINE_LOOK));
  for (const u of unitsOf(P8, { type: MINE })) {
    pix.push(u);
    spr.push(u.sprite);
    at.push(Math.floor((u.y - BOARD_Y) / PITCH) * COLS + Math.floor((u.x - BOARD_X) / PITCH));
  }
  /** What each place of the board should show this frame, and what its pixel is drawn as now. */
  const buf: number[] = new Array(N).fill(CEILING);
  const shown: number[] = new Array(N).fill(-1);

  const startX = AX + START_X * CELL_PX + CELL_PX / 2, startY = AY + START_Y * CELL_PX + CELL_PX / 2;
  centerLocation(AT, startX, startY, 32, 32);
  createUnit(P1, units.TerranMarine, 1, AT);
  const made = first(unitsOf(P1, { type: units.TerranMarine }));
  if (made) select(P1, made);
  print("\x04StarCraft in first person, 4: the MAIN SCREEN is the Marine's eyes. Right-click the MINIMAP to move it, A then the minimap to attack-move. B: over the shoulder.");

  let camX = fixed(startX), camY = fixed(startY), angle = fixed(0), behind = false, frame = 0;
  const depths: number[] = new Array(COLS).fill(0);
  const boxLeft: number[] = new Array(BOXES).fill(0);
  const boxWide: number[] = new Array(BOXES).fill(0);
  const boxTop: number[] = new Array(BOXES).fill(0);
  const boxTall: number[] = new Array(BOXES).fill(0);
  const boxNear: number[] = new Array(BOXES).fill(0);
  const boxKind: number[] = new Array(BOXES).fill(0);

  while (true) {
    frame++;
    centerView(SCREEN);
    if (keyPressed(P1, "B")) behind = !behind;

    // The view is the Marine's: its place and facing, eased.
    let marine = first(unitsOf(P1, { type: units.TerranMarine }));
    if (!marine) {
      centerLocation(AT, startX, startY, 32, 32);
      createUnit(P1, units.TerranMarine, 1, AT);
      marine = first(unitsOf(P1, { type: units.TerranMarine }));
    }
    let mx = Math.floor(camX), my = Math.floor(camY);
    if (marine) {
      mx = marine.x;
      my = marine.y;
      camX = camX + (mx - camX) * FOLLOW;
      camY = camY + (my - camY) * FOLLOW;
      const d = wrap((marine.facing - 64) * (Math.PI / 128) - angle);
      angle = wrap(angle + Math.min(Math.max(d * TURN_EASE, -TURN_MOST), TURN_MOST));
      if (marine.hp < 20) marine.hp = 40;
    }
    const dirX = Math.cos(angle), dirY = Math.sin(angle);
    let eyeX = camX, eyeY = camY;
    if (behind) {
      const bx = camX - dirX * BEHIND, by = camY - dirY * BEHIND;
      if (wallAt(Math.floor((bx - AX) / CELL_PX), Math.floor((by - AY) / CELL_PX)) == 0) { eyeX = bx; eyeY = by; }
    }

    // The monsters: kept at MOST, the far ones sent after the Marine twice a second.
    if (frame % 12 == 0) {
      const alive = unitsOf(P2).reduce((so, u) => so + (u.hp > 0 ? 1 : 0), 0);
      if (alive < MOST) {
        const k = (frame / 12) % SPAWNS_X.length;
        centerLocation(AT, AX + SPAWNS_X[k] * CELL_PX + CELL_PX / 2, AY + SPAWNS_Y[k] * CELL_PX + CELL_PX / 2, 64, 64);
        if (frame % 36 == 0) createUnit(P2, units.ZergHydralisk, 1, AT);
        else createUnit(P2, units.ZergZergling, 1, AT);
      }
      centerLocation(PREY, mx, my, 64, 64);
      for (const u of unitsOf(P2)) {
        u.speedUpgrade = true;
        if (Math.abs(u.x - mx) + Math.abs(u.y - my) > 3 * CELL_PX || u.orderId == orders.Guard || u.orderId == orders.PlayerGuard) u.order("attack", PREY);
      }
    }

    // The walls: a ray a column; the column drawn into the board, ceiling, wall, floor.
    const rx = (eyeX - AX) / CELL_PX, ry = (eyeY - AY) / CELL_PX;
    const planeX = -dirY * FOV, planeY = dirX * FOV;
    const stepRayX = planeX * (2 / fixed(COLS)), stepRayY = planeY * (2 / fixed(COLS));
    let rayX = dirX - planeX + stepRayX / 2, rayY = dirY - planeY + stepRayY / 2;
    let col = 0;
    while (col < COLS) {
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
      let top = MIDROW, bottom = MIDROW, color = CEILING;
      if (hit == 0) depths[col] = 0;
      else {
        const distance = face == 0 ? sideX - deltaX : sideY - deltaY;
        const tall = Math.floor(TALL / Math.max(distance, 0.05));
        depths[col] = tall;
        top = Math.max(MIDROW - (tall >> 1), 0);
        bottom = Math.min(MIDROW + ((tall + 1) >> 1), ROWS);
        color = wallColor(distance, face);
      }
      let i = col, r = 0;
      while (r < top) { buf[i] = CEILING; i += COLS; r++; }
      while (r < bottom) { buf[i] = color; i += COLS; r++; }
      while (r < ROWS) { buf[i] = FLOOR; i += COLS; r++; }
      rayX += stepRayX;
      rayY += stepRayY;
      col++;
    }

    // The monsters: each one's box in the view and how near; then drawn over the walls where they are nearer.
    let n = 0;
    for (const u of unitsOf(P2)) {
      if (n >= MOST) break;
      const dx = u.x - eyeX, dy = u.y - eyeY;
      const along = dirX * dx + dirY * dy;
      if (along > 8) {
        const far = Math.max(along, NEAREST);
        const across = (dirX * dy - dirY * dx) * (far / along);
        const near = Math.floor((TALL * CELL_PX) / far);
        const centre = COLS / 2 + (across / far) * (COLS / 2 / FOV);
        const hydra = u.type == units.ZergHydralisk;
        const tall = Math.max(Math.floor(near * (hydra ? HYDRA_TALL : LING_TALL)), 1);
        const wide = Math.max(Math.floor(near * (hydra ? HYDRA_WIDE : LING_WIDE)), 1);
        const left = Math.floor(centre) - (wide >> 1);
        if (left < COLS && left + wide > 0) {
          boxLeft[n] = left; boxWide[n] = wide; boxTall[n] = tall; boxTop[n] = MIDROW + (near >> 1) - tall; boxNear[n] = near; boxKind[n] = hydra ? 1 : 0;
          n++;
        }
      }
    }
    if (behind && eyeX != camX) {
      const near = Math.floor((TALL * CELL_PX) / Math.max(BEHIND, NEAREST));
      const tall = Math.floor(near * MARINE_TALL), wide = Math.max(Math.floor(near * MARINE_WIDE), 1);
      boxLeft[n] = (COLS >> 1) - (wide >> 1); boxWide[n] = wide; boxTall[n] = tall; boxTop[n] = MIDROW + (near >> 1) - tall; boxNear[n] = near; boxKind[n] = 2;
      n++;
    }
    let b = 0;
    while (b < n) {
      let c = Math.max(boxLeft[b], 0);
      const last = Math.min(boxLeft[b] + boxWide[b], COLS), wide = boxWide[b], kind = boxKind[b];
      const paint = kind == 2 ? MARINE_COLOR : MONSTER;
      while (c < last) {
        if (boxNear[b] > depths[c]) {
          let t = 0, bt = 0;
          if (kind == 0) { const k = Math.floor(((c - boxLeft[b]) * LING.width) / wide); t = LING.tops[k]; bt = LING.bottoms[k]; }
          else if (kind == 1) { const k = Math.floor(((c - boxLeft[b]) * HYDRA.width) / wide); t = HYDRA.tops[k]; bt = HYDRA.bottoms[k]; }
          else { const k = Math.floor(((c - boxLeft[b]) * MARINE.width) / wide); t = MARINE.tops[k]; bt = MARINE.bottoms[k]; }
          let r = Math.max(boxTop[b] + ((boxTall[b] * t) >> 8), 0);
          const to = Math.min(boxTop[b] + ((boxTall[b] * bt + 255) >> 8), ROWS);
          let i = r * COLS + c;
          while (r < to) { buf[i] = paint; i += COLS; r++; }
        }
        c++;
      }
      b++;
    }

    // The board: only the pixels whose colour changed are written.
    let k = 0;
    while (k < N) {
      const i = at[k];
      const want = buf[i];
      if (want != shown[i]) {
        pix[k].drawAs(want, spr[k]);
        shown[i] = want;
      }
      k++;
    }
    await nextFrame();
  }
});

/** Each pixel's sprite owner byte, read from the game's memory through the deaths table (the spike's way); none in the simulator. */
function spriteOwners(sim: Sim): { x: number; y: number; owner: number }[] {
  const mem = (a: number) => { const e = (a - 0x58a364) / 4; return sim.deaths(e % 12, Math.floor(e / 12) as UnitType) >>> 0; };
  const out: { x: number; y: number; owner: number }[] = [];
  for (let slot = 0; slot < 1700; slot++) {
    const u = 0x59cca8 + slot * 336;
    if ((mem(u + 0x64) & 0xffff) !== 13 || mem(u + 0x0c) === 0) continue;
    const pos = mem(u + 0x28);
    out.push({ x: pos & 0xffff, y: pos >>> 16, owner: (mem(mem(u + 0x0c) + 8) >>> 16) & 255 });
  }
  return out;
}

test("960 pixels on their cells, P8's, and drawn as the view: ceiling above, floor below, walls between", (sim) => {
  sim.seconds(3);
  const mines = sim.units({ type: MINE });
  expect(mines.length).toBe(N);
  expect(mines.every((u) => u.owner === 7 && (u.x - BOARD_X - PITCH / 2) % PITCH === 0 && (u.y - BOARD_Y - PITCH / 2) % PITCH === 0)).toBe(true);
  const owners = spriteOwners(sim);
  if (!owners.length) return; // the simulator
  const at = (c: number, r: number) => owners.find((p) => p.x === BOARD_X + c * PITCH + PITCH / 2 && p.y === BOARD_Y + r * PITCH + PITCH / 2)!.owner;
  // The top row is ceiling and the bottom floor wherever no wall reaches them; the middle row a wall, the room being shut.
  expect([at(0, 0), at(39, 0), at(0, 23), at(39, 23)]).toEqual([CEILING, CEILING, FLOOR, FLOOR]);
  expect([WALL_LIGHT, WALL_A, WALL_B, WALL_C]).toContain(at(20, MIDROW));
});

test("the pixels stay put while the Marine walks and the monsters come", (sim) => {
  sim.seconds(3);
  const before = sim.units({ type: MINE }).map((u) => u.x * 65536 + u.y).sort((a, b) => a - b).join(",");
  const m = sim.units({ owner: P1, type: units.TerranMarine })[0];
  sim.order(m, "move", { x: m.x + 300, y: m.y + 100 });
  sim.seconds(15);
  expect(sim.units({ type: MINE }).map((u) => u.x * 65536 + u.y).sort((a, b) => a - b).join(",")).toBe(before);
});
