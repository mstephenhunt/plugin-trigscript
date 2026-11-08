// The first-person probes' base map (TrigScript 4, the third showcase): 128 × 128 Badlands, the top 78 rows the
// raycaster's board (tile 23778, the widest apart of lit and fog in Classic graphics) and under it a real arena — low
// Dirt rooms and corridors cut into High Dirt with the editor's own isometric brush, so that its cliffs are the
// game's. The arena's walls in the 3D view are what a unit cannot walk to: each cell of the raycaster's grid (CELL
// tiles square) is a wall unless most of its minitiles are walkable and reached from where the Marine starts. That
// grid is written beside the map as a TypeScript file the probe imports, so the view and the ground agree.
//
//   npx tsx probes/lib/first-person-map.mts <out.scx> [<grid.ts>]
//   SOUND=1 npx tsx probes/lib/first-person-map.mts <out.scx>     (the sound probe's: plain Dirt, no board, no arena)
//   ARENA=rooms npx tsx probes/lib/first-person-map.mts <out.scx> <grid.ts>
//
// ARENA=rooms (probe 2): the whole map Ice — the view's board plain snow (tile 66, the brightest art, so the widest
// apart of lit and fog in Remastered's minimap) and the arena rooms and doors of Snow floor walled in High Snow, the
// floor's middle Dirt so that it reads dark on the minimap against the white walls. Walls are 4 cells of the plan
// thick and doors 3 wide: the cliffs take about a cell from each side of the floor.
//
// Needs a scm-js checkout beside this one with its tileset data (npm run extract).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const E = process.env.SCMJS_DIR ?? join(import.meta.dirname, "..", "..", "..", "scm-js");
const { createScenario } = await import(join(E, "src/formats/chk/create.ts"));
const { markDirty, serializeScenario } = await import(join(E, "src/formats/chk/scenario.ts"));
const { saveMap } = await import(join(E, "src/formats/mpq/scm.ts"));
const { TILESET_FILENAMES } = await import(join(E, "src/formats/tileset/load.ts"));
const { loadTileset, megatileForTile } = await import(join(E, "src/formats/tileset/decode.ts"));
const { baseTerrain, flatTerrain } = await import(join(E, "src/formats/tileset/terrain.ts"));
const { paintIsomDiamonds, isomWidth, isomHeight } = await import(join(E, "src/editor/isom.ts"));

const [out, gridOut] = process.argv.slice(2);
if (!out) { console.error("usage: first-person-map.mts <out.scx> [<grid.ts>]"); process.exit(2); }
const SOUND = Boolean(process.env.SOUND);
const ROOMS = process.env.ARENA === "rooms";
const ERA = ROOMS ? 6 : 0, BOARD = ROOMS ? 66 : 23778, W = 128, H = 128;
/** The floor, the walls, and the floor's middle (none: the floor as it is). Badlands: Dirt, High Dirt; Ice: Snow, High Snow, Dirt. */
const DIRT = ROOMS ? 2 : 2, HIGH_DIRT = ROOMS ? 3 : 3, FLOOR_MIDDLE = ROOMS ? Number(process.env.MIDDLE ?? 8) : 0;
const part = (ext: string) => new Uint8Array(readFileSync(join(E, "public/tileset", `${TILESET_FILENAMES[ERA]}.${ext}`)));
const ts = loadTileset({ cv5: part("cv5"), vf4: part("vf4"), vr4: part("vr4"), vx4: part("vx4"), wpe: part("wpe") });
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const flat = flatTerrain(W, H, baseTerrain(ts, DIRT), ts, rnd, ERA);

/** The view's rows; the arena's top left tile and its size in cells; tiles a cell. */
export const VIEW_ROWS = 78;
const CELL = 2;
/**
 * The arena, a character a cell (CELL × CELL tiles): "." low ground, "#" high ground. What the brush makes of it is
 * read back: the grid the probe gets is the walkability, not this plan.
 */
const GW = 60, GH = 22;
/**
 * Floor, as rectangles of cells (x, y, width, height). Probe 1: three rooms over a hall, and the ways between. Probe 2
 * (rooms): two rows of rooms walled 4 cells thick, doors 3 wide between them, a long corridor along the bottom row.
 */
const FLOOR: [number, number, number, number][] = ROOMS ? [
  // The top row: three rooms, 6 cells deep, walls 7 cells thick between them; doors 3 cells across at a wall's end
  // (high ground stops a cell short of the floor, so a wall needs 5 cells of its own to stand; a door in a wall's
  // middle leaves stubs too small for it).
  [3, 3, 13, 6], [23, 3, 13, 6], [43, 3, 14, 6],
  [16, 6, 7, 3], [36, 3, 7, 3],
  // Doors down from the first room and the last, through a wall 5 thick.
  [7, 9, 3, 5], [50, 9, 3, 5],
  // The bottom row: a room and a long hall, a wall standing into the hall from above.
  [3, 14, 13, 6], [23, 14, 34, 6], [16, 17, 7, 3],
] : [
  [3, 2, 14, 7], [22, 2, 16, 7], [43, 2, 14, 7], [3, 13, 54, 7],
  [17, 3, 5, 5], [38, 3, 5, 5], [6, 9, 6, 4], [27, 9, 6, 4], [48, 9, 6, 4],
];
/** High ground left standing in them: pillars. */
const PILLARS: [number, number, number, number][] = ROOMS ? [[36, 14, 7, 3]] : [[18, 15, 4, 3], [40, 15, 4, 3]];
const PLAN: string[] = Array.from({ length: GH }, (_, y) => Array.from({ length: GW }, (_, x) => {
  const inside = (r: [number, number, number, number]) => x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3];
  return FLOOR.some(inside) && !PILLARS.some(inside) ? "." : "#";
}).join(""));
const AX = (W - GW * CELL) >> 1, AY = 80;
/** Where the Marine starts, a floor cell of the plan (the probe's START_X, START_Y). */
const START = ROOMS ? { x: 7, y: 5 } : { x: 8, y: 5 };

const scn = createScenario({
  width: W, height: H, era: ERA, tiles: flat.tiles, isom: flat.isom,
  name: process.env.MAP_NAME ?? (SOUND ? "TrigScript sound probe" : ROOMS ? "TrigScript first person 2" : "TrigScript first person"),
  description: process.env.MAP_DESCRIPTION ?? "A probe of the first-person showcase. Single player.",
});

if (!SOUND) {
  // High Dirt over everything but the plan's floor: the diamonds (centred on pixel 64x, 32y) whose centre is not on
  // a floor cell of the arena.
  const floor = (px: number, py: number) => {
    const cx = Math.floor((px / 32 - AX) / CELL), cy = Math.floor((py / 32 - AY) / CELL);
    return cx >= 0 && cy >= 0 && cx < GW && cy < GH && PLAN[cy][cx] === ".";
  };
  // (Rooms: the high ground stops a cell short of the floor, so that its cliff stands on the wall's edge and the plan's
  // floor is all walkable: the view's walls are then the plan's, straight.)
  const nearFloor = (px: number, py: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (floor(px + dx * CELL * 32, py + dy * CELL * 32)) return true;
    return false;
  };
  const high: { x: number; y: number }[] = [];
  for (let y = 0; y < isomHeight(scn); y++) for (let x = 0; x < isomWidth(scn); x++) {
    if ((x + y) % 2 !== 0) continue;
    if (y * 32 < (VIEW_ROWS - 4) * 32) continue;
    if (ROOMS ? !nearFloor(x * 64, y * 32) : !floor(x * 64, y * 32)) high.push({ x, y });
  }
  if (!paintIsomDiamonds(scn, ts, high, HIGH_DIRT, rnd)) throw new Error("no High Dirt");
  // The floor's middle, where the floor is two cells or more from a wall of the plan.
  if (FLOOR_MIDDLE) {
    const deep = (px: number, py: number) => {
      for (let dy = -2 * CELL * 32; dy <= 2 * CELL * 32; dy += CELL * 32) for (let dx = -2 * CELL * 32; dx <= 2 * CELL * 32; dx += CELL * 32) if (!floor(px + dx, py + dy)) return false;
      return true;
    };
    const middle: { x: number; y: number }[] = [];
    for (let y = 0; y < isomHeight(scn); y++) for (let x = 0; x < isomWidth(scn); x++) if ((x + y) % 2 === 0 && deep(x * 64, y * 32)) middle.push({ x, y });
    if (middle.length && !paintIsomDiamonds(scn, ts, middle, FLOOR_MIDDLE, rnd)) throw new Error("no floor middle");
  }
  // The board over the view's rows (tiles only: the lattice under them is left as it was, which the game never reads).
  for (let y = 0; y < VIEW_ROWS; y++) for (let x = 0; x < W; x++) scn.tiles[y * W + x] = BOARD;
}

// Where a unit can walk, a minitile at a time, and what of it is reached from the start.
const MW = W * 4, MH = H * 4;
const walk = new Uint8Array(MW * MH);
for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
  const mega = megatileForTile(ts, scn.tiles[ty * W + tx]);
  for (let m = 0; m < 16; m++) if (mega >= 0 && (ts.megatileFlags[mega * 16 + m] & 1)) walk[(ty * 4 + (m >> 2)) * MW + tx * 4 + (m & 3)] = 1;
}
// Where a unit fits: walkable with all eight neighbours walkable too (a unit is about two minitiles across), as
// scmjs map generate's walk grid has it.
{
  const raw = walk.slice();
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    let ok = 1;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!raw[(y + dy) * MW + x + dx]) { ok = 0; break; }
    walk[y * MW + x] = ok;
  }
}
// What of it is reached from the arena's floor: the piece of walkable ground with the most of the plan's floor in it
// (the high ground over the cliffs is walkable too, and reached from nowhere).
const reached = new Uint8Array(MW * MH);
if (!SOUND) {
  const label = new Int32Array(MW * MH);
  const x0 = AX * 4, y0 = AY * 4, x1 = (AX + GW * CELL) * 4, y1 = (AY + GH * CELL) * 4;
  let best = 0, bestSize = 0, next = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const s = y * MW + x;
    if (!walk[s] || label[s]) continue;
    const id = ++next, queue = [s];
    label[s] = id;
    let size = 0;
    while (queue.length) {
      const i = queue.pop()!;
      const cx = i % MW, cy = (i / MW) | 0;
      if (PLAN[Math.floor((cy / 4 - AY) / CELL)][Math.floor((cx / 4 - AX) / CELL)] === ".") size++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue;
        const j = ny * MW + nx;
        if (!label[j] && walk[j]) { label[j] = id; queue.push(j); }
      }
    }
    if (size > bestSize) { bestSize = size; best = id; }
  }
  for (let i = 0; i < label.length; i++) if (label[i] === best) reached[i] = 1;
  // The plan's floor the brush left out of it: a room cut off, which no monster would reach.
  let floor = 0;
  for (const row of PLAN) for (const c of row) if (c === ".") floor++;
  console.log(`the floor reached: ${(bestSize / (floor * CELL * CELL * 16) * 100).toFixed(0)}% of the plan's`);
}
// The grid: a cell is floor when at least half of its minitiles are reached — or, for rooms, the plan itself, with what
// the ground made of it said: how much of the plan's floor a unit can walk, and how much of its walls it can reach.
if (ROOMS) {
  let floorAll = 0, floorWalked = 0, wallAll = 0, wallWalked = 0;
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
    for (let my = 0; my < CELL * 4; my++) for (let mx = 0; mx < CELL * 4; mx++) {
      const r = reached[((AY + cy * CELL) * 4 + my) * MW + (AX + cx * CELL) * 4 + mx];
      if (PLAN[cy][cx] === ".") { floorAll++; floorWalked += r; } else { wallAll++; wallWalked += r; }
    }
  }
  console.log(`rooms: ${(floorWalked / floorAll * 100).toFixed(0)}% of the plan's floor walked, ${(wallWalked / wallAll * 100).toFixed(1)}% of its walls`);
}
const grid: string[] = ROOMS ? [...PLAN] : [];
for (let cy = 0; cy < GH && !ROOMS; cy++) {
  let row = "";
  for (let cx = 0; cx < GW; cx++) {
    let n = 0;
    for (let my = 0; my < CELL * 4; my++) for (let mx = 0; mx < CELL * 4; mx++) n += reached[((AY + cy * CELL) * 4 + my) * MW + (AX + cx * CELL) * 4 + mx];
    row += n * 2 >= CELL * CELL * 16 ? "." : "#";
  }
  grid.push(row);
}

scn.playerTypes = scn.playerTypes.map((t: number, i: number) => (i === 0 ? 6 : i === 1 ? 5 : i < 8 ? 0 : t));
scn.editorPlayerTypes = [...scn.playerTypes];
scn.playerRaces = scn.playerRaces.map((r: number, i: number) => (i === 0 ? 1 : i === 1 ? 0 : i < 8 ? 7 : r));
const start = (owner: number, tx: number, ty: number, serial: number) => ({ classInstance: serial, x: tx * 32 + 16, y: ty * 32 + 16, unitId: 214, relationFlags: 0, validStates: 0, validProperties: 0, owner, hitPointsPercent: 100, shieldPercent: 100, energyPercent: 100, resourceAmount: 0, hangarUnits: 0, stateFlags: 0, unused: 0, relatedSerial: 0 });
if (SOUND) scn.units.push(start(0, 60, 100, 1), start(1, 120, 120, 2));
else scn.units.push(start(0, AX + START.x * CELL + 1, AY + START.y * CELL + 1, 1), start(1, 4, H - 4, 2));
markDirty(scn, "OWNR", "IOWN", "SIDE", "UNIT", "MTXM", "TILE", "ISOM");
writeFileSync(out, await saveMap(serializeScenario(scn), { extras: new Map(), compress: "pkware", listfile: true }));
const holes = [...scn.tiles].filter((t: number) => t === 0).length;
console.log(`${out}: ${holes} tiles the brush could not join; arena ${GW} × ${GH} cells of ${CELL} tiles at tile (${AX}, ${AY})`);
if (!SOUND) for (const r of grid) console.log(`  ${r}`);
if (gridOut && !SOUND) {
  writeFileSync(gridOut, [
    "// Written by probes/lib/first-person-map.mts from the map it builds: do not edit. The arena of the first-person",
    "// probes as the raycaster sees it, a cell CELL tiles square: \"#\" a wall (what the Marine cannot walk to), \".\" floor.",
    `export const ARENA_X = ${AX}, ARENA_Y = ${AY}, CELL = ${CELL};`,
    `/** Where the Marine starts, a cell. */`,
    `export const START_X = ${START.x}, START_Y = ${START.y};`,
    "export const ARENA = [",
    ...grid.map((r) => `  ${JSON.stringify(r)},`),
    "];",
    "",
  ].join("\n"));
}
