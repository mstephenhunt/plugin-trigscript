// The Für Elise visualizer probe's run (probes/fur-elise-visual.ts), worked out when the script is built: which clip
// starts on which frame, the text shown, and the picture of every frame on both screens, turned into the changes the
// program plays back. Plain data and functions — no sound, nothing of the game's — so the same run is what the probe
// plays, what tests/fur-elise-run.test.ts checks and what a picture of a frame is drawn from
// (probes/lib/fur-elise-frames.mts).
import { FRAME, changesOver, frameNotes, isBlack, keyRange, keyX, rollCells, type FramedNote, type Pixel } from "./note-timeline";
import { A_PLAYING, A_SECTION, STORM, STORM_PLAYING, THEME_TWICE, barStarts, length, perform, type PlayedNote } from "./fur-elise-score";
import {
  LO, HI, CELL, ROLL_COL, ROLL_KEY_ROW, ROLL_ROWS, ROLL_STEP, VIEW_X, VIEW_Y, CAM_X, PITCH, WHITE_X0, WHITE_Y, BLACK_Y,
  STAGE_ROWS, ROW_GAP, FALL_Y0, LAMP_X, LAMP_Y,
} from "./fur-elise-layout";

/* ── The notes ── */

export const A_NOTES = perform(A_SECTION, A_PLAYING);
export const STORM_NOTES = perform(STORM, STORM_PLAYING);
export const THEME_NOTES = perform(THEME_TWICE, A_PLAYING);
export const A_LONG = length(A_SECTION, A_PLAYING), STORM_LONG = length(STORM, STORM_PLAYING), THEME_LONG = length(THEME_TWICE, A_PLAYING);
/** When each bar of the theme starts, in seconds, and the frame it starts in: the S2 part plays a clip a bar from there. */
export const BAR_AT = barStarts(THEME_TWICE, A_PLAYING);
export const BAR_FRAME = BAR_AT.map((t) => Math.floor(t / FRAME + 1e-9));
/** Clicks, CLICK_EVERY frames apart: the lamp's calibration. */
export const CLICK_EVERY = 24, CLICKS = 6;
/** The clips, by their place in the probe's list: the clicks, the A section, the storm, the theme, then the theme's bars. */
export const CLIP_CLICKS = 0, CLIP_A = 1, CLIP_STORM = 2, CLIP_THEME = 3, CLIP_BAR0 = 4;

/* ── The run, frame by frame ── */

/** How a part looks: each screen's roll, and the storm's extras. */
export interface Look {
  readonly roll: "falling" | "rising" | "keys";
  /** Frames a row of the stage's roll stands for: 1, a row a frame (the main screen is redrawn every frame), or 2. */
  readonly stageStep: number;
  readonly flash: boolean;
  readonly boom: boolean;
  readonly webs: boolean;
}
const PLAIN: Look = { roll: "falling", stageStep: 1, flash: false, boom: false, webs: false };
/** A note of the run: on the game's clock, with its part's look and whether it is a bar's first. */
export interface RunNote extends FramedNote<PlayedNote> { readonly look: Look; readonly downbeat: boolean }

export const runNotes: RunNote[] = [];
export const captions: { frame: number; text: string }[] = [];
export const plays: { frame: number; clip: number }[] = [];
/** Frames the lamp is lit by itself (the clicks). */
export const clicks = new Set<number>();
/** The effects: a frame, a kind (1 a Wraith's explosion, 2 a Battlecruiser's, 3 a Disruption Web made, 4 one taken away), where. */
export const fxList: { frame: number; kind: number; x: number; y: number }[] = [];

/** A part's notes put on the run from `start`, each with its look (by its time), downbeats marked from the bar starts. */
function place(played: readonly PlayedNote[], start: number, look: (time: number) => Look, bars: readonly number[]) {
  for (const n of frameNotes(played, start, 2)) {
    const t = n.source.time;
    runNotes.push({ ...n, look: look(t), downbeat: bars.some((b) => Math.abs(b - t) < 1e-6) });
  }
}

export const SETUP = 8;
let at = 48;
captions.push({ frame: 4, text: "Für Elise visual probe. Remastered graphics, the game's music off; record it all. About 100 seconds." });
// T: the clicks.
captions.push({ frame: at - 24, text: "T: six clicks, the lamp (top left) white on each." });
plays.push({ frame: at, clip: CLIP_CLICKS });
for (let k = 0; k < CLICKS; k++) clicks.add(at + k * CLICK_EVERY);
at += CLICKS * CLICK_EVERY + 24;
// A: the A section.
captions.push({ frame: at - 24, text: "A1: the A section. Falling notes, right hand gold, left cyan." });
plays.push({ frame: at, clip: CLIP_A });
// From bar 9 the first time (the 18th bar played) the main screen's notes fall half as fast.
export const A_BARS = barStarts(A_SECTION, A_PLAYING);
place(A_NOTES, at, (t) => (t < A_BARS[17] - 1e-6 ? PLAIN : { ...PLAIN, stageStep: 2 }), A_BARS);
captions.push({ frame: at + Math.round(A_BARS[17] / FRAME) - 6, text: "A2: the main screen's notes fall half as fast." });
at += Math.round(A_LONG / FRAME) + 48;
// C: the storm, its first seven bars quiet, the rest with explosions.
export const STORM_BARS = barStarts(STORM, STORM_PLAYING);
captions.push({ frame: at - 24, text: "C-a: the storm. Red flashes on the chords, Disruption Webs." });
plays.push({ frame: at, clip: CLIP_STORM });
export const C_START = at;
place(STORM_NOTES, at, (t) => (t < STORM_BARS[7] - 1e-6 ? { ...PLAIN, flash: true, webs: true } : { ...PLAIN, flash: true, boom: true }), STORM_BARS);
captions.push({ frame: at + Math.round(STORM_BARS[7] / FRAME) - 6, text: "C-b: explosions (the game's own explosion sounds)." });
at += Math.round(STORM_LONG / FRAME) + 60;
// S1 and S2: the theme twice, as one clip and as a clip a bar.
captions.push({ frame: at - 24, text: "S1: the theme as one clip." });
plays.push({ frame: at, clip: CLIP_THEME });
place(THEME_NOTES, at, () => PLAIN, BAR_AT);
export const S1_START = at;
at += Math.round(THEME_LONG / FRAME) + 48;
captions.push({ frame: at - 24, text: "S2: the same, a clip a bar." });
BAR_AT.slice(0, -1).forEach((_, k) => plays.push({ frame: at + BAR_FRAME[k], clip: CLIP_BAR0 + k }));
place(THEME_NOTES, at, () => PLAIN, BAR_AT);
export const S2_START = at;
at += Math.round(THEME_LONG / FRAME) + 48;
// V: the theme again, two other looks.
captions.push({ frame: at - 24, text: "V1: notes rising from the keys." });
plays.push({ frame: at, clip: CLIP_THEME });
place(THEME_NOTES, at, (t) => ({ ...PLAIN, roll: t < BAR_AT[9] - 1e-6 ? "rising" : "keys" }), BAR_AT);
captions.push({ frame: at + Math.round(BAR_AT[9] / FRAME) - 6, text: "V2: the keys alone." });
at += Math.round(THEME_LONG / FRAME) + 72;
captions.push({ frame: at, text: "The end. Thank you." });
export const TOTAL = at + 24;

const range = keyRange(runNotes);
if (range.lo !== LO || range.hi !== HI) throw new Error(`The notes need the keys ${range.lo}…${range.hi}; the layout has ${LO}…${HI}.`);

/* ── What each frame shows ── */

/** The colours, as players: 1 white (P3), 2 indigo (P4), 3 gold (P5), 4 cyan (P6), 5 red (P7), 6 black (P8). */
export const WHITE = 1, INDIGO = 2, GOLD = 3, CYAN = 4, RED = 5, BLACK = 6;
/** Kinds of pixel: an Overlord on the minimap, a Flag on the stage, the lamp's ring. */
export const OVERLORD = 0, FLAG = 1, RING = 2;
const colorOf = (n: RunNote) => (n.hand === 1 ? CYAN : n.look.flash && n.chord ? RED : GOLD);
/** Frames a key stays lit: its note's, at least two. */
const lit = (n: RunNote, f: number) => n.on <= f && f < n.on + Math.max(2, n.len);

export const rollX = (note: number) => (ROLL_COL + note - LO) * CELL + CELL / 2;
export const rollY = (row: number) => row * CELL + CELL / 2;
export const stageX = (note: number) => VIEW_X + WHITE_X0 + keyX(note, LO, PITCH);
const KEY_LIST = Array.from({ length: HI - LO + 1 }, (_, k) => LO + k);

/** The notes near frame f, by when they start: those a roll or a key might show. */
const SPAN = Math.max(ROLL_ROWS * ROLL_STEP, STAGE_ROWS * 2) + 4;
function near(f: number): RunNote[] {
  return runNotes.filter((n) => n.on - SPAN <= f && f <= n.on + n.len + SPAN);
}

/** Whether two Flags would overlap: a Spider Mine is 15 pixels square (units.dat: 7 each way from its middle). */
const overlap = (a: Pixel, x: number, y: number) => a.unit !== OVERLORD && Math.abs(a.x - x) < 16 && Math.abs(a.y - y) < 16 && (a.x !== x || a.y !== y);

/**
 * The picture of frame f, given the frame before's (`before`). A trigger cannot make a Spider Mine where it would overlap
 * another — the game puts it beside its place — and one taken away still stands until the frame ends (both found in
 * the lifted game: the E5 leaving a row as the D#5 next to it came in). So a falling Flag that would overlap one of
 * this frame or the last waits a frame; the keys and the rows are laid out never to.
 */
function draw(f: number, before: readonly Pixel[]): Pixel[] {
  const out: Pixel[] = [];
  if (f < SETUP) return out;
  const close = near(f);
  // The keys: lit by the last note to start on each, else idle; the storm's chords flash the white keys red.
  const flash = close.some((n) => n.look.flash && n.hand === 0 && n.chord && n.on <= f && f < n.on + 2);
  for (const key of KEY_LIST) {
    const on = close.filter((n) => n.note === key && lit(n, f));
    const idle = isBlack(key) ? INDIGO : flash ? RED : WHITE;
    const color = on.length ? colorOf(on[on.length - 1]) : idle;
    // The minimap: the upper row every key, the lower the white keys' fronts (lit too).
    out.push({ x: rollX(key), y: rollY(ROLL_KEY_ROW), unit: OVERLORD, color });
    if (!isBlack(key)) out.push({ x: rollX(key), y: rollY(ROLL_KEY_ROW + 1), unit: OVERLORD, color });
    // The stage: white keys in a row, black ones above.
    if (f >= SETUP + 1) out.push({ x: stageX(key), y: VIEW_Y + (isBlack(key) ? BLACK_Y : WHITE_Y), unit: FLAG, color });
  }
  // The rolls, by each note's look.
  for (const look of ["falling", "rising"] as const) {
    // Each note a row short on a roll, so that a key struck again shows as two (the storm's repeated D's).
    const short = (ns: readonly RunNote[], by: number) => ns.map((n) => ({ ...n, len: Math.max(1, n.len - by) }));
    const these = close.filter((n) => n.look.roll === look);
    const fast = short(these.filter((n) => n.look.stageStep === 1), 1), slow = short(these.filter((n) => n.look.stageStep === 2), 2);
    for (const c of rollCells(short(these, ROLL_STEP), f, { rows: ROLL_ROWS, step: ROLL_STEP, direction: look })) {
      out.push({ x: rollX(c.n.note), y: rollY(ROLL_KEY_ROW - 1 - c.row), unit: OVERLORD, color: colorOf(c.n as RunNote) });
    }
    for (const c of [...rollCells(fast, f, { rows: STAGE_ROWS, step: 1, direction: look }), ...rollCells(slow, f, { rows: STAGE_ROWS, step: 2, direction: look })]) {
      const x = stageX(c.n.note), y = VIEW_Y + FALL_Y0 - c.row * ROW_GAP;
      if (out.some((p) => overlap(p, x, y)) || before.some((p) => overlap(p, x, y))) continue;
      out.push({ x, y, unit: FLAG, color: colorOf(c.n as RunNote) });
    }
  }
  // The lamp: white on a frame a note starts (or a click), else black.
  if (f >= SETUP + 2) out.push({ x: VIEW_X + LAMP_X, y: VIEW_Y + LAMP_Y, unit: RING, color: clicks.has(f) || close.some((n) => n.on === f) ? WHITE : BLACK });
  // One pixel a place: where two are drawn, the last.
  return [...new Map(out.map((p) => [`${p.unit} ${p.x} ${p.y}`, p])).values()];
}

/** Every frame's picture, worked out once, in order (each depends on the one before). */
const PICTURES: Pixel[][] = [];
export function pictureAt(f: number): Pixel[] {
  while (PICTURES.length <= f) PICTURES.push(draw(PICTURES.length, PICTURES.length ? PICTURES[PICTURES.length - 1] : []));
  return PICTURES[f];
}

// The storm's effects: a Disruption Web over each C-a downbeat's chord for 8 frames; in C-b an explosion on each downbeat
// over its highest note, and Battlecruisers across the stage on the last two chords.
for (const n of runNotes) {
  if (!n.downbeat || n.hand !== 0) continue;
  const top = runNotes.filter((m) => m.on === n.on && m.hand === 0).every((m) => m.note <= n.note);
  if (!top) continue;
  const x = stageX(n.note), y = VIEW_Y + 120;
  if (n.look.webs) { fxList.push({ frame: n.on, kind: 3, x, y }); fxList.push({ frame: n.on + 8, kind: 4, x, y }); }
  if (n.look.boom) {
    if (n.on >= C_START + Math.round(STORM_BARS[12] / FRAME) - 1) for (const dx of [-240, 0, 240]) fxList.push({ frame: n.on, kind: 2, x: CAM_X + 40 + dx, y: VIEW_Y + 110 });
    else fxList.push({ frame: n.on, kind: 1, x, y });
  }
}
fxList.sort((a, b) => a.frame - b.frame);

/* ── The tables the program plays back ── */

export const CHANGES = changesOver(TOTAL, pictureAt);
/** Where each frame's changes start in the lists below; one more at the end. */
export const STARTS: number[] = [];
export const CX: number[] = [], CY: number[] = [], CKIND: number[] = [], CTO: number[] = [];
CHANGES.forEach((cs) => {
  STARTS.push(CX.length);
  for (const c of cs) { CX.push(c.x); CY.push(c.y); CKIND.push(c.unit * 8 + c.from); CTO.push(c.to); }
});
STARTS.push(CX.length);
export const SOUND_F: number[] = plays.map((s) => s.frame), SOUND_K: number[] = plays.map((s) => s.clip);
export const LABEL_F: number[] = captions.map((l) => l.frame), LABEL_TEXT: string[] = captions.map((l) => l.text);
export const FX_F: number[] = fxList.map((e) => e.frame), FX_K: number[] = fxList.map((e) => e.kind), FX_X: number[] = fxList.map((e) => e.x), FX_Y: number[] = fxList.map((e) => e.y);
/** The most changes in a frame, and where: for the cost. */
export const BUSIEST = CHANGES.reduce((best, cs, f) => (cs.length > best.n ? { f, n: cs.length } : best), { f: 0, n: 0 });

