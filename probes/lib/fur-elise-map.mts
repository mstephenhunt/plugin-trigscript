// The base map of the Für Elise visualizer probe (probes/fur-elise-visual.ts): 128 × 128 Space Platform, Space at the
// top for the minimap's piano roll (black there, the Overlords' colours on it) and Platform at the bottom for the stage
// the camera looks at (probes/lib/fur-elise-layout.ts); Player 1's Map Revealers placed over the whole map, so every
// player's units are seen (they are kept by 1.16.1 too, which refuses a revealer a trigger makes); the start locations
// on the platform, out of the camera's way.
//
//   MAP_NAME="Für Elise visual probe" npx tsx probes/lib/fur-elise-map.mts <out.scx>
//
// Needs a scm-js checkout beside this one with its tileset data (npm run extract).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MAP_H, MAP_W, STAGE_TILES } from "./fur-elise-layout.ts";

const E = process.env.SCMJS_DIR ?? join(import.meta.dirname, "..", "..", "..", "scm-js");
const { createScenario } = await import(join(E, "src/formats/chk/create.ts"));
const { markDirty, serializeScenario } = await import(join(E, "src/formats/chk/scenario.ts"));
const { saveMap } = await import(join(E, "src/formats/mpq/scm.ts"));
const { TILESET_FILENAMES } = await import(join(E, "src/formats/tileset/load.ts"));
const { loadTileset } = await import(join(E, "src/formats/tileset/decode.ts"));
const { baseTerrain, flatTerrain } = await import(join(E, "src/formats/tileset/terrain.ts"));

const [out] = process.argv.slice(2);
if (!out) { console.error("usage: fur-elise-map.mts <out.scx>"); process.exit(2); }
/** Space Platform; its ISOM terrains Space (2) and Platform (3). */
const ERA = 1, PLATFORM = 3, SPACE = 2, W = MAP_W, H = MAP_H;
const part = (ext: string) => new Uint8Array(readFileSync(join(E, "public/tileset", `${TILESET_FILENAMES[ERA]}.${ext}`)));
const ts = loadTileset({ cv5: part("cv5"), vf4: part("vf4"), vr4: part("vr4"), vx4: part("vx4"), wpe: part("wpe") });
let seed = 1;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const space = flatTerrain(W, H, baseTerrain(ts, SPACE), ts, rnd, ERA);
const platform = flatTerrain(W, H, baseTerrain(ts, PLATFORM), ts, rnd, ERA);
const tiles = space.tiles.slice();
for (let y = STAGE_TILES.y; y < Math.min(H, STAGE_TILES.y + STAGE_TILES.h); y++) for (let x = STAGE_TILES.x; x < STAGE_TILES.x + STAGE_TILES.w; x++) tiles[y * W + x] = platform.tiles[y * W + x];
const scn = createScenario({
  width: W, height: H, era: ERA, tiles, isom: space.isom,
  name: process.env.MAP_NAME ?? "Für Elise visual probe",
  description: process.env.MAP_DESCRIPTION ?? "Für Elise (Beethoven), drawn as it plays: falling notes on the minimap and on the main screen. A probe of TrigScript (scmjs.dev). Host as multiplayer, alone, with the game's music off.",
});
scn.playerTypes = scn.playerTypes.map((t: number, i: number) => (i === 0 ? 6 : i === 1 ? 5 : i < 8 ? 0 : t));
scn.editorPlayerTypes = [...scn.playerTypes];
scn.playerRaces = scn.playerRaces.map((r: number, i: number) => (i === 0 ? 1 : i === 1 ? 0 : i < 8 ? 7 : r));
const unit = (unitId: number, owner: number, x: number, y: number, serial: number) => ({ classInstance: serial, x, y, unitId, relationFlags: 0, validStates: 0, validProperties: 0, owner, hitPointsPercent: 100, shieldPercent: 100, energyPercent: 100, resourceAmount: 0, hangarUnits: 0, stateFlags: 0, unused: 0, relatedSerial: 0 });
const START_LOCATION = 214, MAP_REVEALER = 101;
let serial = 1;
// The start locations at the platform's right end, below the stage's view.
const sx = STAGE_TILES.x + STAGE_TILES.w - 4, sy = STAGE_TILES.y + STAGE_TILES.h - 3;
scn.units.push(unit(START_LOCATION, 0, sx * 32 + 16, sy * 32 + 16, serial++), unit(START_LOCATION, 1, (sx - 4) * 32 + 16, sy * 32 + 16, serial++));
// Map Revealers every 14 tiles (a sight of 10 reaches the corners between them).
for (let y = 7; y < H; y += 14) for (let x = 7; x < W; x += 14) scn.units.push(unit(MAP_REVEALER, 0, x * 32 + 16, y * 32 + 16, serial++));
markDirty(scn, "OWNR", "IOWN", "SIDE", "UNIT", "MTXM", "TILE", "ISOM");
writeFileSync(out, await saveMap(serializeScenario(scn), { extras: new Map(), compress: "pkware", listfile: true }));
