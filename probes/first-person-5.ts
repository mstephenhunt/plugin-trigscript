// The third showcase's fifth probe: probe 4 (the 3D view on the MAIN screen, the arena on the minimap) with palettes
// that read. Played, probe 4 was "hard to see": a pixel is a Flag, whose glyph is only about half the player's colour —
// its pole and base are grey on every pixel — so greys, browns and darks drown in the Flags' own metal; the bright red
// monsters were the one thing that read. Here every colour is saturated and bright, and V switches between three
// palettes; O switches black outlines on and off (a column drawn black where one wall face meets another, so shapes
// read on any palette); B the eye over the Marine's shoulder.
//
//   1 "fire":    walls white, pale yellow, yellow, orange by distance (the faces met stepping in y one step further),
//                floor blue, ceiling black, monsters red, your Marine cyan
//   2 "ice":     walls cyan, slate blue, blue by distance; floor black, ceiling purple; monsters red, your Marine yellow
//   3 "outline": walls green (faces met stepping in x) and purple (in y), floor and ceiling black, monsters red,
//                your Marine yellow
//
// The colours are the players': P1 … P8 by CRGB (below), P9 … P12 the game's own (measured in the spike's recording:
// P9 dark green, P10 pale yellow, P11 tan, P12 slate blue). The pixels are P8's, which is black: a black patch on the minimap.
// Right-click the minimap to move the Marine, A then the minimap to attack-move.
//
// Single player.
// probe-players: {"0":{"rgb":[255,220,0]},"1":{"rgb":[255,20,20]},"2":{"rgb":[255,255,255]},"3":{"rgb":[255,128,0]},"4":{"rgb":[150,40,255]},"5":{"rgb":[0,60,235]},"6":{"rgb":[0,240,255]},"7":{"rgb":[0,0,0]}}
//
//   MAP_NAME="TrigScript first person 5" npx tsx probes/lib/first-person-4-map.mts fixtures/eud/first-person-5-base.scx
//   NO_BASES=1 MAP_NAME="TrigScript first person 5" npx tsx scripts/build-fixture.mts probes/first-person-5.ts fixtures/eud/first-person-5.scx fixtures/eud/first-person-5-base.scx
// (Probe 4's map and arena, probes/lib/first-person-4-arena.ts.)
import { test, expect, type Unit, type UnitType, type Sim } from "trigscript";
import { ARENA, ARENA_X, ARENA_Y, CELL, START_X, START_Y, BOARD_X, BOARD_Y, BOARD_W, BOARD_H } from "./lib/first-person-4-arena";

/* ── The arena, as the rays see it ── */

const GW = ARENA[0].length, GH = ARENA.length;
const CELLS = ARENA.join("").split("").map((c) => (c === "#" ? 1 : 0));
const CELL_PX = CELL * 32, AX = ARENA_X * 32, AY = ARENA_Y * 32;
const wallAt = game((x: number, y: number): number => CELLS[y * GW + x]);
/**
 * Each wall's straight stretches, a number each, by the side a ray comes from (as probes/lib/first-person-play.ts):
 * where one meets another the outline draws a black column.
 */
function faceRuns(fromX: number, fromY: number, first: number): number[] {
  const out: number[] = ARENA.join("").split("").map(() => 0);
  let id = first;
  const along = fromX != 0;
  for (let a = 0; a < (along ? GW : GH); a++) {
    let open = false;
    for (let b = 0; b < (along ? GH : GW); b++) {
      const x = along ? a : b, y = along ? b : a;
      const fx = x + fromX, fy = y + fromY;
      const face = ARENA[y][x] === "#" && fx >= 0 && fy >= 0 && fx < GW && fy < GH && ARENA[fy][fx] === ".";
      if (face) { if (!open) id++; out[y * GW + x] = id; }
      open = face;
    }
  }
  return out;
}
const FROM_WEST = faceRuns(-1, 0, 0), FROM_EAST = faceRuns(1, 0, 10000), FROM_NORTH = faceRuns(0, -1, 20000), FROM_SOUTH = faceRuns(0, 1, 30000);
const faceAt = game((x: number, y: number, side: number, step: number): number => {
  const i = y * GW + x;
  if (side == 0) return step > 0 ? FROM_WEST[i] : FROM_EAST[i];
  return step > 0 ? FROM_NORTH[i] : FROM_SOUTH[i];
});

/* ── The board ── */

/** 40 × 24 pixels, 16 map pixels apart; the middle row (the horizon). */
const COLS = 40, ROWS = 24, MIDROW = ROWS >> 1, N = COLS * ROWS, PITCH = 16;
/** The colours, by player slot (drawAs takes 0 … 11), as the CRGB line above sets P1 … P8; P9 … P12 the game's own. */
const YELLOW = 0, RED = 1, WHITE = 2, ORANGE = 3, PURPLE = 4, BLUE = 5, CYAN = 6, BLACK = 7, GREEN = 8, PALE_YELLOW = 9, TAN = 10, SLATE = 11;
/** The palettes (V): each one's wall colours by level (distance band, plus a step for the faces met stepping in y), five a palette. */
const PALETTES = ["1 fire: walls white to orange, floor blue, ceiling black", "2 ice: walls cyan to blue, floor black, ceiling purple", "3 outline: walls green and purple, floor and ceiling black"];
const WALLS = [WHITE, PALE_YELLOW, YELLOW, ORANGE, ORANGE, CYAN, SLATE, BLUE, BLUE, BLUE, GREEN, PURPLE, GREEN, PURPLE, GREEN];
const FLOORS = [BLUE, BLACK, BLACK];
const CEILINGS = [BLACK, PURPLE, BLACK];
const MARINES = [CYAN, YELLOW, YELLOW];
/** The outline's colour, and what the board starts as. */
const OUTLINE = BLACK, CEILING = BLACK, FLOOR = BLUE, MONSTER = RED;
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

const AT = reserveLocation("first person 5: where a unit is made");
const SCREEN = reserveLocation("first person 5: the camera, on the board");
const PREY = reserveLocation("first person 5: where the monsters are sent");

/** A wall's colour in a palette by its distance (in cells) and side (0 the faces met stepping in x, 1 in y). */
const wallColor = game((palette: number, distance: fixed, side: number): number => {
  if (palette == 2) return WALLS[10 + side];
  let level = side;
  if (distance >= 2) level++;
  if (distance >= 4) level++;
  if (distance >= 7) level++;
  return WALLS[palette * 5 + Math.min(level, 4)];
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
  print("\x04StarCraft in first person, 5: the MAIN SCREEN is the Marine's eyes. Right-click the MINIMAP to move it, A then the minimap to attack-move.");
  print("\x04V: the next palette. O: outlines on or off. B: over the shoulder.");

  let camX = fixed(startX), camY = fixed(startY), angle = fixed(0), behind = false, frame = 0, palette = 0, outline = true;
  const depths: number[] = new Array(COLS).fill(0);
  /** Each column's wall face (0 none), and whether it is drawn as an outline. */
  const faces: number[] = new Array(COLS).fill(0);
  const tops: number[] = new Array(COLS).fill(0);
  const bottoms: number[] = new Array(COLS).fill(0);
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
    if (keyPressed(P1, "V")) { palette = (palette + 1) % 3; print(`\x04Palette ${PALETTES[palette]}`); }
    if (keyPressed(P1, "O")) { outline = !outline; print(outline ? "\x04Outlines on" : "\x04Outlines off"); }
    const ceiling = CEILINGS[palette], floor = FLOORS[palette];

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
      let top = MIDROW, bottom = MIDROW, color = ceiling;
      faces[col] = 0;
      if (hit == 0) depths[col] = 0;
      else {
        const distance = face == 0 ? sideX - deltaX : sideY - deltaY;
        const tall = Math.floor(TALL / Math.max(distance, 0.05));
        depths[col] = tall;
        top = Math.max(MIDROW - (tall >> 1), 0);
        bottom = Math.min(MIDROW + ((tall + 1) >> 1), ROWS);
        color = wallColor(palette, distance, face);
        faces[col] = faceAt(mapX, mapY, face, face == 0 ? stepX : stepY);
      }
      tops[col] = top;
      bottoms[col] = bottom;
      let i = col, r = 0;
      while (r < top) { buf[i] = ceiling; i += COLS; r++; }
      while (r < bottom) { buf[i] = color; i += COLS; r++; }
      while (r < ROWS) { buf[i] = floor; i += COLS; r++; }
      rayX += stepRayX;
      rayY += stepRayY;
      col++;
    }

    // The outlines: where one face meets another, the nearer column's wall drawn black.
    if (outline) {
      let c = 1;
      while (c < COLS) {
        if (faces[c] != faces[c - 1] && (faces[c] != 0 || faces[c - 1] != 0)) {
          const e = depths[c] >= depths[c - 1] ? c : c - 1;
          let r = tops[e], i = tops[e] * COLS + e;
          while (r < bottoms[e]) { buf[i] = OUTLINE; i += COLS; r++; }
        }
        c++;
      }
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
      const paint = kind == 2 ? MARINES[palette] : MONSTER;
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

test("960 pixels on their cells, P8's, drawn as the view: ceiling above, floor below, a wall between; V changes the palette", (sim) => {
  sim.seconds(3);
  const mines = sim.units({ type: MINE });
  expect(mines.length).toBe(N);
  expect(mines.every((u) => u.owner === 7 && (u.x - BOARD_X - PITCH / 2) % PITCH === 0 && (u.y - BOARD_Y - PITCH / 2) % PITCH === 0)).toBe(true);
  const owners = spriteOwners(sim);
  if (!owners.length) return; // the simulator
  const at = (c: number, r: number) => spriteOwners(sim).find((p) => p.x === BOARD_X + c * PITCH + PITCH / 2 && p.y === BOARD_Y + r * PITCH + PITCH / 2)!.owner;
  expect([at(0, 0), at(39, 0), at(0, 23), at(39, 23)]).toEqual([BLACK, BLACK, BLUE, BLUE]);
  expect([WHITE, PALE_YELLOW, YELLOW, ORANGE, BLACK]).toContain(at(20, MIDROW));
  sim.press("V");
  sim.frames(4);
  expect([at(0, 0), at(0, 23)]).toEqual([PURPLE, BLACK]);
  expect([CYAN, SLATE, BLUE, BLACK]).toContain(at(20, MIDROW));
  sim.press("V");
  sim.frames(4);
  expect([at(0, 0), at(0, 23)]).toEqual([BLACK, BLACK]);
  expect([GREEN, PURPLE, BLACK]).toContain(at(20, MIDROW));
});

test("the pixels stay put while the Marine walks and the monsters come", (sim) => {
  sim.seconds(3);
  const before = sim.units({ type: MINE }).map((u) => u.x * 65536 + u.y).sort((a, b) => a - b).join(",");
  const m = sim.units({ owner: P1, type: units.TerranMarine })[0];
  sim.order(m, "move", { x: m.x + 300, y: m.y + 100 });
  sim.seconds(15);
  expect(sim.units({ type: MINE }).map((u) => u.x * 65536 + u.y).sort((a, b) => a - b).join(",")).toBe(before);
});
