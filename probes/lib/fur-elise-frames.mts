// Pictures of the Für Elise visualizer probe's frames as the build works them out (probes/lib/fur-elise-run.ts), to
// look at before a play: the minimap at Remastered's 3 pixels a tile (Space black, the stage's Platform grey, a unit a
// dot in its owner's colour) beside the main screen's view (852 × 330 game pixels, a Flag a coloured block, the lamp a
// ring). Not the game's own drawing — the lifted game draws nothing — but its units, where the probe puts them.
//
//   npx tsx probes/lib/fur-elise-frames.mts <out folder> [frame …]
//
// Writes <out>/frame-NNNN.png for each frame (some of each part when none is named) and <out>/sheet.png of them.
// Needs a scm-js checkout beside this one (its PNG encoder).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MAP_W, MAP_H, STAGE_TILES, VIEW_X, VIEW_Y } from "./fur-elise-layout.ts";
import { A_BARS, BAR_AT, C_START, OVERLORD, RING, S1_START, STORM_BARS, TOTAL, pictureAt, plays, CLIP_A, CLIP_THEME } from "./fur-elise-run.ts";
import { FRAME } from "./note-timeline.ts";

const E = process.env.SCMJS_DIR ?? join(import.meta.dirname, "..", "..", "..", "scm-js");
const { encodePng } = await import(join(E, "src/formats/png.ts"));
const [out, ...named] = process.argv.slice(2);
if (!out) { console.error("usage: fur-elise-frames.mts <out folder> [frame …]"); process.exit(2); }
mkdirSync(out, { recursive: true });

/** The colours of P3 … P8 as the map gives them (the probe's probe-players line), by the run's colour numbers 1 … 6. */
const RGB: readonly (readonly [number, number, number])[] = [[0, 0, 0], [240, 240, 240], [72, 56, 200], [255, 190, 0], [0, 200, 255], [235, 20, 50], [16, 16, 16]];
const A_START = plays.find((p) => p.clip === CLIP_A)!.frame;
const V_START = plays.filter((p) => p.clip === CLIP_THEME)[1].frame;
const at = (start: number, seconds: number) => start + Math.round(seconds / FRAME);
const frames = named.length ? named.map(Number) : [
  at(A_START, 3), at(A_START, A_BARS[3]), at(A_START, A_BARS[20]), at(C_START, STORM_BARS[2] + 0.01), at(C_START, STORM_BARS[9]),
  at(C_START, STORM_BARS[13]), at(S1_START, 6), at(V_START, BAR_AT[4]), at(V_START, BAR_AT[12]),
].filter((f) => f < TOTAL).sort((a, b) => a - b);

const T = 3, MW = MAP_W * T, MH = MAP_H * T, VW = 852, VH = 330, GAP = 12;
const W = MW + GAP + VW, H = Math.max(MH, VH);

function render(f: number): Uint8Array {
  const px = new Uint8Array(W * H * 4).fill(255);
  const set = (x: number, y: number, [r, g, b]: readonly number[]) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (Math.floor(y) * W + Math.floor(x)) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  };
  const box = (x0: number, y0: number, w: number, h: number, c: readonly number[]) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c); };
  box(0, 0, W, H, [24, 24, 24]);
  // The minimap: Space black above, the Platform grey where the stage is.
  box(0, 0, MW, MH, [4, 4, 10]);
  box(STAGE_TILES.x * T, STAGE_TILES.y * T, STAGE_TILES.w * T, Math.min(STAGE_TILES.h, MAP_H - STAGE_TILES.y) * T, [70, 70, 78]);
  // The main screen's view: the Platform.
  box(MW + GAP, 0, VW, VH, [58, 60, 66]);
  for (const p of pictureAt(f)) {
    const c = RGB[p.color];
    // On the minimap, every unit a dot: an Overlord's two tiles, a Spider Mine's one.
    const s = p.unit === OVERLORD ? 5 : 2;
    box(Math.round((p.x / 32) * T - s / 2), Math.round((p.y / 32) * T - s / 2), s, s, c);
    if (p.unit === OVERLORD) continue;
    const vx = MW + GAP + p.x - VIEW_X, vy = p.y - VIEW_Y;
    if (p.unit === RING) {
      // A start location's ring, 121 × 62, as an outline.
      for (let a = 0; a < 360; a += 1) for (const r of [0.92, 1]) set(vx + Math.cos((a * Math.PI) / 180) * 60 * r, vy + Math.sin((a * Math.PI) / 180) * 31 * r, c);
    } else {
      // A Flag: its cloth in the owner's colour, about 14 × 12 above a grey pole.
      box(vx - 1, vy - 14, 2, 26, [150, 150, 150]);
      box(vx + 1, vy - 14, 12, 11, c);
    }
  }
  return px;
}

const cols = 2, SW = cols * (W + 8), SH = Math.ceil(frames.length / cols) * (H + 8);
const sheet = new Uint8Array(SW * SH * 4).fill(200);
for (const [i, f] of frames.entries()) {
  const px = render(f);
  writeFileSync(join(out, `frame-${String(f).padStart(4, "0")}.png`), await encodePng({ width: W, height: H, rgba: px }));
  const left = (i % cols) * (W + 8) + 4, top = Math.floor(i / cols) * (H + 8) + 4;
  for (let y = 0; y < H; y++) sheet.set(px.subarray(y * W * 4, (y + 1) * W * 4), ((top + y) * SW + left) * 4);
}
writeFileSync(join(out, "sheet.png"), await encodePng({ width: SW, height: SH, rgba: sheet }));
console.log(`${frames.length} frames (${frames.map((f) => `${f} = ${(f * FRAME).toFixed(1)} s`).join(", ")}) to ${out}`);
