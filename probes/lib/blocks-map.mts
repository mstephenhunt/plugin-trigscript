// The base map of the falling-block showcase (probes/blocks.tsx): probes/lib/screen-map.mts's 64 × 64 of Space, with
// the well's walls and floor and the rims of the two boxes laid in Platform (probes/lib/blocks-layout.ts), so the
// minimap shows them grey round the pieces' Overlords; the start locations stand on the strip of platform at the bottom.
//
//   npx tsx probes/lib/blocks-map.mts <out.scx>
//
// Needs a scm-js checkout beside this one with its tileset data (npm run extract).
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FRAMES } from "./blocks-layout.ts";

const E = process.env.SCMJS_DIR ?? join(import.meta.dirname, "..", "..", "..", "scm-js");
const { createScenario } = await import(join(E, "src/formats/chk/create.ts"));
const { markDirty, serializeScenario } = await import(join(E, "src/formats/chk/scenario.ts"));
const { saveMap } = await import(join(E, "src/formats/mpq/scm.ts"));
const { TILESET_FILENAMES } = await import(join(E, "src/formats/tileset/load.ts"));
const { loadTileset } = await import(join(E, "src/formats/tileset/decode.ts"));
const { baseTerrain, flatTerrain } = await import(join(E, "src/formats/tileset/terrain.ts"));

const [out] = process.argv.slice(2);
if (!out) { console.error("usage: blocks-map.mts <out.scx>"); process.exit(2); }
/** Space Platform; its ISOM terrains Space (2) and Platform (3). */
const ERA = 1, PLATFORM = 3, SPACE = 2, W = 64, H = 64;
/** The rows of platform along the bottom. */
const STRIP = 8;
const part = (ext: string) => new Uint8Array(readFileSync(join(E, "public/tileset", `${TILESET_FILENAMES[ERA]}.${ext}`)));
const ts = loadTileset({ cv5: part("cv5"), vf4: part("vf4"), vr4: part("vr4"), vx4: part("vx4"), wpe: part("wpe") });
let seed = 1;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const space = flatTerrain(W, H, baseTerrain(ts, SPACE), ts, rnd, ERA);
const platform = flatTerrain(W, H, baseTerrain(ts, PLATFORM), ts, rnd, ERA);
const tiles = space.tiles.slice();
const lay = (tx: number, ty: number) => { if (tx >= 0 && ty >= 0 && tx < W && ty < H) tiles[ty * W + tx] = platform.tiles[ty * W + tx]; };
for (let y = H - STRIP; y < H; y++) for (let x = 0; x < W; x++) lay(x, y);
// A pixel is two tiles square.
for (const [x, y, w, h] of FRAMES) for (let ty = y * 2; ty < (y + h) * 2; ty++) for (let tx = x * 2; tx < (x + w) * 2; tx++) lay(tx, ty);
const scn = createScenario({
  width: W, height: H, era: ERA, tiles, isom: space.isom,
  name: "Korobeiniki",
  description: "Falling blocks on the minimap, to the Tetris theme (Korobeiniki, a Russian folk song) arranged for TrigScript: the music follows the game. Classic graphics (Options > Graphics) give the sharpest minimap. Host as multiplayer, alone.",
});
scn.playerTypes = scn.playerTypes.map((t: number, i: number) => (i === 0 ? 6 : i === 1 ? 5 : i < 8 ? 0 : t));
scn.editorPlayerTypes = [...scn.playerTypes];
scn.playerRaces = scn.playerRaces.map((r: number, i: number) => (i === 0 ? 1 : i === 1 ? 0 : i < 8 ? 7 : r));
const start = (owner: number, tx: number, ty: number, serial: number) => ({ classInstance: serial, x: tx * 32 + 16, y: ty * 32 + 16, unitId: 214, relationFlags: 0, validStates: 0, validProperties: 0, owner, hitPointsPercent: 100, shieldPercent: 100, energyPercent: 100, resourceAmount: 0, hangarUnits: 0, stateFlags: 0, unused: 0, relatedSerial: 0 });
scn.units.push(start(0, 12, H - 4, 1), start(1, W - 12, H - 4, 2));
markDirty(scn, "OWNR", "IOWN", "SIDE", "UNIT", "MTXM", "TILE", "ISOM");
writeFileSync(out, await saveMap(serializeScenario(scn), { extras: new Map(), compress: "pkware", listfile: true }));
