// The base map of the fourth first-person probe (the third Showcase): the 3D view on the MAIN screen, the arena on the
// minimap. 64 × 64 Ice, so that the arena (60 × 44 tiles) fills most of the minimap; along the top, rows 0 … 12, the
// board the view is drawn on — 40 × 24 pixels 16 apart (the main-screen spike's step E), plain Snow a unit stands on —
// with nothing of the arena's in the camera's way. Under it the arena: rooms of Snow, Dirt in their middles, walled in
// High Snow set back a cell from the floor (as probe 2's, probes/lib/first-person-map.mts ARENA=rooms), so the view's
// walls are the plan's. Map Revealers of Player 1's light the board (whose pixels belong to an empty slot) and the arena.
// The raycaster's grid is written beside the map as a TypeScript file.
//
//   MAP_NAME="TrigScript first person 4" npx tsx probes/lib/first-person-4-map.mts <out.scx> [<grid.ts>]
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
if (!out) { console.error("usage: first-person-4-map.mts <out.scx> [<grid.ts>]"); process.exit(2); }
const ERA = 6, W = 64, H = 64;
/** Ice: Snow, High Snow, Dirt. */
const SNOW = 2, HIGH_SNOW = 3, DIRT = 8;
const part = (ext: string) => new Uint8Array(readFileSync(join(E, "public/tileset", `${TILESET_FILENAMES[ERA]}.${ext}`)));
const ts = loadTileset({ cv5: part("cv5"), vf4: part("vf4"), vr4: part("vr4"), vx4: part("vx4"), wpe: part("wpe") });
let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const flat = flatTerrain(W, H, baseTerrain(ts, SNOW), ts, rnd, ERA);

/** The board, in pixels: 40 × 24 pixels 16 apart, its top left corner; the camera centred under it (the console). */
export const BOARD_X = 352, BOARD_Y = 16, BOARD_W = 640, BOARD_H = 384;
/** The arena: a character a cell, CELL tiles square, its top left tile. */
const CELL = 2, AX = 2, AY = 16;
/**
 * The plan: two rooms over a long hall, walls 5 to 6 cells thick, doors 3 across at a wall's end (a door in a wall's
 * middle leaves stubs too small for the high ground to stand).
 */
const GW = 30, GH = 23;
const FLOOR: [number, number, number, number][] = [
  [2, 2, 11, 7], [19, 2, 9, 7], [13, 6, 6, 3],
  [5, 9, 3, 5], [22, 9, 3, 5],
  [2, 14, 26, 7],
];
const PILLARS: [number, number, number, number][] = [[12, 18, 6, 3]];
const PLAN: string[] = Array.from({ length: GH }, (_, y) => Array.from({ length: GW }, (_, x) => {
  const inside = (r: [number, number, number, number]) => x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3];
  return FLOOR.some(inside) && !PILLARS.some(inside) ? "." : "#";
}).join(""));
/** Where the Marine starts, a cell. */
const START = { x: 6, y: 5 };

const scn = createScenario({
  width: W, height: H, era: ERA, tiles: flat.tiles, isom: flat.isom,
  name: process.env.MAP_NAME ?? "TrigScript first person 4",
  description: process.env.MAP_DESCRIPTION ?? "StarCraft in first person, on the main screen. Single player.",
});

const floor = (px: number, py: number) => {
  const cx = Math.floor((px / 32 - AX) / CELL), cy = Math.floor((py / 32 - AY) / CELL);
  return cx >= 0 && cy >= 0 && cx < GW && cy < GH && PLAN[cy][cx] === ".";
};
const nearFloor = (px: number, py: number) => {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (floor(px + dx * CELL * 32, py + dy * CELL * 32)) return true;
  return false;
};
// High Snow over the arena but the floor and a cell round it; the board's rows, above, stay Snow.
const high: { x: number; y: number }[] = [];
const middle: { x: number; y: number }[] = [];
for (let y = 0; y < isomHeight(scn); y++) for (let x = 0; x < isomWidth(scn); x++) {
  if ((x + y) % 2 !== 0 || y < AY - 1) continue;
  if (!nearFloor(x * 64, y * 32)) high.push({ x, y });
  let deep = true;
  for (let dy = -2; dy <= 2 && deep; dy++) for (let dx = -2; dx <= 2; dx++) if (!floor(x * 64 + dx * CELL * 32, y * 32 + dy * CELL * 32)) { deep = false; break; }
  if (deep) middle.push({ x, y });
}
if (!paintIsomDiamonds(scn, ts, high, HIGH_SNOW, rnd)) throw new Error("no High Snow");
if (middle.length && !paintIsomDiamonds(scn, ts, middle, DIRT, rnd)) throw new Error("no Dirt");
const holes = [...scn.tiles].filter((t: number) => t === 0).length;

// Where a unit fits (walkable, its eight neighbours too), and the share of the plan's floor and walls it makes.
const MW = W * 4, MH = H * 4;
const raw = new Uint8Array(MW * MH);
for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
  const mega = megatileForTile(ts, scn.tiles[ty * W + tx]);
  for (let m = 0; m < 16; m++) if (mega >= 0 && (ts.megatileFlags[mega * 16 + m] & 1)) raw[(ty * 4 + (m >> 2)) * MW + tx * 4 + (m & 3)] = 1;
}
const fits = new Uint8Array(MW * MH);
for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
  let ok = 1;
  for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!raw[(y + dy) * MW + x + dx]) { ok = 0; break; }
  fits[y * MW + x] = ok;
}
// (Reached from where the Marine starts: the high ground's top is walkable too, and reached from nowhere.)
{
  const reached = new Uint8Array(MW * MH);
  const s0 = ((AY + START.y * CELL) * 4 + 4) * MW + (AX + START.x * CELL) * 4 + 4;
  const queue = [s0];
  reached[s0] = 1;
  while (queue.length) {
    const i = queue.pop()!;
    for (const j of [i + 1, i - 1, i + MW, i - MW]) if (j >= 0 && j < MW * MH && fits[j] && !reached[j]) { reached[j] = 1; queue.push(j); }
  }
  fits.set(reached);
}
let floorAll = 0, floorFits = 0, wallAll = 0, wallFits = 0;
for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) for (let my = 0; my < CELL * 4; my++) for (let mx = 0; mx < CELL * 4; mx++) {
  const f = fits[((AY + cy * CELL) * 4 + my) * MW + (AX + cx * CELL) * 4 + mx];
  if (PLAN[cy][cx] === ".") { floorAll++; floorFits += f; } else { wallAll++; wallFits += f; }
}

scn.playerTypes = scn.playerTypes.map((t: number, i: number) => (i === 0 ? 6 : i === 1 ? 5 : i < 8 ? 0 : t));
scn.editorPlayerTypes = [...scn.playerTypes];
scn.playerRaces = scn.playerRaces.map((r: number, i: number) => (i === 0 ? 1 : i === 1 ? 0 : i < 8 ? 7 : r));
const unit = (owner: number, unitId: number, tx: number, ty: number, serial: number) => ({ classInstance: serial, x: tx * 32 + 16, y: ty * 32 + 16, unitId, relationFlags: 0, validStates: 0, validProperties: 0, owner, hitPointsPercent: 100, shieldPercent: 100, energyPercent: 100, resourceAmount: 0, hangarUnits: 0, stateFlags: 0, unused: 0, relatedSerial: 0 });
scn.units.push(unit(0, 214, AX + START.x * CELL, AY + START.y * CELL, 1), unit(1, 214, W - 3, H - 2, 2));
// Map Revealers of Player 1's: over the board (its pixels are an empty slot's, seen only where Player 1 sees) and over
// the arena, so the minimap shows it whole. Each sees 10 tiles round.
let serial = 10;
for (const [tx, ty] of [[16, 6], [26, 6], [36, 6]]) scn.units.push(unit(0, 101, tx, ty, serial++));
for (const ty of [AY + 6, AY + 19, AY + 32, H - 4]) for (const tx of [5, 17, 29, 41, 53, 60]) scn.units.push(unit(0, 101, tx, ty, serial++));
markDirty(scn, "OWNR", "IOWN", "SIDE", "UNIT", "MTXM", "TILE", "ISOM");
writeFileSync(out, await saveMap(serializeScenario(scn), { extras: new Map(), compress: "pkware", listfile: true }));
console.log(`${out}: ${holes} tiles the brush could not join; ${(floorFits / floorAll * 100).toFixed(0)}% of the plan's floor walked, ${(wallFits / wallAll * 100).toFixed(1)}% of its walls`);
for (const r of PLAN) console.log(`  ${r}`);
if (gridOut) {
  writeFileSync(gridOut, [
    "// Written by probes/lib/first-person-4-map.mts from the map it builds: do not edit. The fourth first-person probe's",
    "// arena as the raycaster sees it, a cell CELL tiles square (\"#\" a wall, \".\" floor), and the board the view is drawn on.",
    `export const ARENA_X = ${AX}, ARENA_Y = ${AY}, CELL = ${CELL};`,
    `/** Where the Marine starts, a cell. */`,
    `export const START_X = ${START.x}, START_Y = ${START.y};`,
    `/** The board, in pixels: its top left corner and size. */`,
    `export const BOARD_X = ${BOARD_X}, BOARD_Y = ${BOARD_Y}, BOARD_W = ${BOARD_W}, BOARD_H = ${BOARD_H};`,
    "export const ARENA = [",
    ...PLAN.map((r) => `  ${JSON.stringify(r)},`),
    "];",
    "",
  ].join("\n"));
}
