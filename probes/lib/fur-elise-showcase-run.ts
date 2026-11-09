// The Für Elise showcase's run (probes/fur-elise-showcase.ts), worked out when the script is built from the soundtrack's
// timeline (probes/lib/fur-elise-timeline.ts): when the one clip starts, the text, and the picture of every frame on
// both screens, flattened into the changes the program plays back. Plain data and functions, so the same run is what
// the showcase plays, what tests/fur-elise-showcase-run.test.ts checks and what pictures of it are drawn from
// (probes/lib/fur-elise-frames.mts --showcase).
//
// It is generic over the timeline (the soundtrack may change: a new arrangement brings new parts, sections and range):
// the parts each screen shows, both keyboards, the loud sections and the explosions are all worked out from the data.
// The looks are the ones the user chose after the visualizer probe (2026-11-09): notes falling onto a keyboard on both
// screens, the main screen's a row every other frame; the lead part (the right hand) gold, the other (the left) cyan;
// in a loud section the lead's chords red and the white keys flashing red on each, and explosions on its strongest
// downbeats. The probe measured the picture ~95 ms ahead of a long clip's sound: the clip starts LEAD frames early.
import { FRAME, changesOver, fitKeys, isBlack, keyX, rollCells, whiteKeys, type FramedNote, type Pixel, type TimedNote } from "./note-timeline";
import { NOTES, PARTS, SECTIONS, SECONDS, AT, END, PITCH, VELOCITY, PART, BAR, BEAT, FRAME as FRAME_COL } from "./fur-elise-timeline";
import { CELL, VIEW_X, VIEW_Y, CAM_X, BLACK_Y, WHITE_Y, ROW_GAP, FALL_Y0, STAGE_ROWS, MAP_W } from "./fur-elise-layout";

/* ── The parts ── */

/** A part of drums: its notes are drums, not keys, and no roll shows them (they still count towards a downbeat's weight). */
export const isDrums = (name: string) => /drum|kit|perc|kick|snare|hat|cymbal|clap/i.test(name);
const PITCHED = PARTS.map((_, k) => k).filter((k) => !isDrums(PARTS[k]));
const count = (k: number) => NOTES.filter((n) => n[PART] === k).length;
const meanPitch = (k: number) => NOTES.filter((n) => n[PART] === k).reduce((sum, n, _, all) => sum + n[PITCH] / all.length, 0);
/**
 * The two parts the main screen shows as hands: "right" and "left" when the timeline has them (the piano), else the two
 * pitched parts with the most notes, the higher of them the lead. The lead is gold, the other cyan.
 */
export const [LEAD_PART, OTHER_PART] = ((): [number, number] => {
  const r = PARTS.indexOf("right" as never), l = PARTS.indexOf("left" as never);
  if (r >= 0 && l >= 0) return [r, l];
  const [a, b] = [...PITCHED].sort((x, y) => count(y) - count(x));
  return meanPitch(a) >= meanPitch(b ?? a) ? [a, b ?? a] : [b, a];
})();
const onStage = (part: number) => part === LEAD_PART || part === OTHER_PART;

/* ── The keyboards ── */

/** The main screen's keyboard: the hands' notes, at most 40 white keys (16 pixels apart fill the view); outliers by octaves. */
export const STAGE_KEYS = fitKeys(NOTES.filter((n) => onStage(n[PART])).map((n) => n[PITCH]), 40, "whites");
export const STAGE_LO = STAGE_KEYS.lo, STAGE_HI = STAGE_KEYS.hi;
/**
 * White keys 16 to 20 pixels apart, the last at view x 830 (inside the 852 the widescreen view shows). A Spider Mine is
 * 15 pixels square, so neighbours 16 apart never overlap; text lines show over view x 0 … 233, so the fewer keys, the
 * fewer under the title. (Für Elise: A1 … E7, 40 white keys 16 apart from x 206; only A1 and B1 under the text.)
 */
export const STAGE_PITCH = Math.max(16, Math.min(20, Math.floor(624 / Math.max(1, whiteKeys(STAGE_LO, STAGE_HI).length - 1))));
export const STAGE_X0 = 830 - (whiteKeys(STAGE_LO, STAGE_HI).length - 1) * STAGE_PITCH;
/** The minimap's keyboard: every pitched part's notes in the map's 64 columns of cells; outliers by octaves. (Für Elise: D2 … E7, A1 up an octave.) */
export const ROLL_KEYS = fitKeys(NOTES.filter((n) => !isDrums(PARTS[n[PART]])).map((n) => n[PITCH]), MAP_W / 2, "keys");
export const ROLL_LO = ROLL_KEYS.lo, ROLL_HI = ROLL_KEYS.hi;
export const ROLL_COL = Math.floor((MAP_W / 2 - (ROLL_HI - ROLL_LO + 1)) / 2);
/** The minimap roll's keyboard rows, and rows of falling notes above them, a row every ROLL_STEP frames. */
export const ROLL_KEY_ROW = 42, ROLL_ROWS = 40, ROLL_STEP = 2;
/** The main screen's notes fall a row every other frame (the probe's A2, the user's choice). */
export const STAGE_STEP = 2;

/* ── The run's clock ── */

/** The title at frame 4, the keyboards from SETUP, the clip at START. */
export const SETUP = 8, START = 84;
/** The picture runs this many frames behind the clip: the probe measured the picture ~95 ms ahead of the sound. */
export const LEAD = 2;
/** Picture frame 0 of the soundtrack: a note's frame in the timeline plus this. */
export const ZERO = START + LEAD;
export const LAST_OFF = ZERO + Math.round(Math.max(...NOTES.map((n) => n[END])) / FRAME);
/** The end's text a little after the last note is let go; the tables run 15 s past it, for the clip's ring and tail. */
export const END_TEXT = LAST_OFF + 48;
export const TOTAL = ZERO + Math.ceil((SECONDS + 15) / FRAME);
export const TITLE = "Für Elise", END_LINE = "Für Elise — Ludwig van Beethoven";
export const captions: readonly { frame: number; text: string }[] = [{ frame: 4, text: TITLE }, { frame: END_TEXT, text: END_LINE }];

/* ── The notes ── */

/** Colours, as the players who own them: 1 white (P3), 2 indigo (P4), 3 gold (P5), 4 cyan (P6), 5 red (P7), 6 violet (P8). */
export const WHITE = 1, INDIGO = 2, GOLD = 3, CYAN = 4, RED = 5, VIOLET = 6;
/** Kinds of pixel: an Overlord on the minimap, a Flag on the stage. */
export const OVERLORD = 0, FLAG = 1;

/** A note of the run: on the picture's clock, its part, bar and beat, and whether a chord of the lead in a loud section. */
export interface ShowNote extends FramedNote<TimedNote> { readonly part: number; readonly bar: number; readonly beat: number; readonly stormChord: boolean }

/** Each section's first bar, and the bar after the last. */
const sectionEnd = (k: number) => SECTIONS[k + 1]?.bar ?? Infinity;
const meanVelocity = (ns: readonly (readonly number[])[]) => ns.reduce((sum, n) => sum + n[VELOCITY], 0) / Math.max(1, ns.length);
const pitchedNotes = NOTES.filter((n) => !isDrums(PARTS[n[PART]]));
/** The loud sections: played at a quarter or more over the piece's mean velocity (Für Elise: the storm, at 1.9 times). */
export const LOUD = SECTIONS.filter((s, k) => meanVelocity(pitchedNotes.filter((n) => n[BAR] >= s.bar && n[BAR] < sectionEnd(k))) >= 1.25 * meanVelocity(pitchedNotes)).map((s) => s.name);
const loudBar = (bar: number) => SECTIONS.some((s, k) => LOUD.includes(s.name) && bar >= s.bar && bar < sectionEnd(k));
/** The lead's notes struck together in a loud section (by bar and beat: the performance spreads a chord by a few ms). */
const struckWith = new Map<string, number>();
for (const n of NOTES) if (n[PART] === LEAD_PART && loudBar(n[BAR])) struckWith.set(`${n[BAR]} ${n[BEAT]}`, (struckWith.get(`${n[BAR]} ${n[BEAT]}`) ?? 0) + 1);

export const notes: readonly ShowNote[] = NOTES.filter((n) => !isDrums(PARTS[n[PART]])).map((n) => {
  // The timeline's own frame for the strike (the soundtrack's), and the frames its key is held.
  const on = ZERO + n[FRAME_COL], off = ZERO + Math.round(n[END] / FRAME);
  const source: TimedNote = { time: n[AT], seconds: n[END] - n[AT], note: n[PITCH], hand: n[PART], velocity: n[VELOCITY] };
  const stormChord = n[PART] === LEAD_PART && loudBar(n[BAR]) && (struckWith.get(`${n[BAR]} ${n[BEAT]}`) ?? 0) >= 2;
  return { source, on, len: Math.max(2, off - on), note: n[PITCH], hand: n[PART], velocity: n[VELOCITY], chord: stormChord, part: n[PART], bar: n[BAR], beat: n[BEAT], stormChord };
});
/** The hands, on both screens; the rest (the orchestra, …), on the minimap only. */
export const piano = notes.filter((n) => onStage(n.part));
const orchestra = notes.filter((n) => !onStage(n.part));

/** The frames the white keys flash red: two from each loud chord's first strike. */
export const flashes = new Set<number>();
{
  const first = new Map<string, number>();
  for (const n of piano) if (n.stormChord) {
    const k = `${n.bar} ${n.beat}`;
    first.set(k, Math.min(first.get(k) ?? Infinity, n.on));
  }
  for (const f of first.values()) { flashes.add(f); flashes.add(f + 1); }
}

/* ── What each frame shows ── */

const colorOf = (n: ShowNote) => (!onStage(n.part) ? VIOLET : n.part === OTHER_PART ? CYAN : n.stormChord ? RED : GOLD);
/** A key's place on each screen (a note outside a keyboard moved in by octaves). */
export const stageX = (note: number) => VIEW_X + STAGE_X0 + keyX(STAGE_KEYS.fold(note), STAGE_LO, STAGE_PITCH);
const rollKey = (note: number) => ROLL_KEYS.fold(note);
export const rollX = (note: number) => (ROLL_COL + rollKey(note) - ROLL_LO) * CELL + CELL / 2;
export const rollY = (row: number) => row * CELL + CELL / 2;
const STAGE_LIST = Array.from({ length: STAGE_HI - STAGE_LO + 1 }, (_, k) => STAGE_LO + k);
const ROLL_LIST = Array.from({ length: ROLL_HI - ROLL_LO + 1 }, (_, k) => ROLL_LO + k);

/** The notes a frame may show, found by a window over the notes in the order they start. */
const SPAN = Math.max(ROLL_ROWS * ROLL_STEP, STAGE_ROWS * STAGE_STEP) + 4;
function near(list: readonly ShowNote[], f: number): ShowNote[] {
  const out: ShowNote[] = [];
  for (const n of list) {
    if (n.on > f + SPAN) break;
    if (n.on + n.len + SPAN >= f) out.push(n);
  }
  return out;
}
/** A roll's notes a row short, so that a key struck again shows as two. */
const short = (ns: readonly ShowNote[], by: number) => ns.map((n) => ({ ...n, len: Math.max(1, n.len - by) }));
/** Whether a Flag at (x, y) would overlap another: a Spider Mine is 15 pixels square. */
const overlap = (a: Pixel, x: number, y: number) => a.unit === FLAG && Math.abs(a.x - x) < 16 && Math.abs(a.y - y) < 16 && (a.x !== x || a.y !== y);

/**
 * The picture of frame f, given the frame before's. A trigger cannot make a Spider Mine overlapping another (it is put
 * beside its place), and one taken away stands until its frame ends: a falling Flag that would overlap one of this frame
 * or the last waits a frame (the probe, in the lifted game).
 */
function draw(f: number, before: readonly Pixel[]): Pixel[] {
  const out: Pixel[] = [];
  if (f < SETUP) return out;
  const ps = near(piano, f), os = near(orchestra, f);
  const flash = flashes.has(f);
  // A key lit by the last note to strike it that is still held; `key` maps a note to the keyboard's key.
  const keyColor = (k: number, idle: number, key: (note: number) => number) => {
    const lit = ps.filter((n) => key(n.note) === k && n.on <= f && f < n.on + n.len);
    return lit.length ? colorOf(lit[lit.length - 1]) : idle;
  };
  // The minimap: the upper keyboard row every key, the lower the white keys' fronts (a note below D2 lights its octave).
  for (const key of ROLL_LIST) {
    const idle = isBlack(key) ? INDIGO : flash ? RED : WHITE;
    const color = keyColor(key, idle, rollKey);
    out.push({ x: rollX(key), y: rollY(ROLL_KEY_ROW), unit: OVERLORD, color });
    if (!isBlack(key)) out.push({ x: rollX(key), y: rollY(ROLL_KEY_ROW + 1), unit: OVERLORD, color });
  }
  // The main screen's keyboard, from the frame after.
  if (f >= SETUP + 1) for (const key of STAGE_LIST) {
    const idle = isBlack(key) ? INDIGO : flash ? RED : WHITE;
    out.push({ x: stageX(key), y: VIEW_Y + (isBlack(key) ? BLACK_Y : WHITE_Y), unit: FLAG, color: keyColor(key, idle, STAGE_KEYS.fold) });
  }
  // The minimap roll: the orchestra first, the piano over it.
  for (const c of rollCells(short([...os, ...ps], ROLL_STEP), f, { rows: ROLL_ROWS, step: ROLL_STEP, direction: "falling" })) {
    out.push({ x: rollX(c.n.note), y: rollY(ROLL_KEY_ROW - 1 - c.row), unit: OVERLORD, color: colorOf(c.n as ShowNote) });
  }
  // The main screen's roll: the piano.
  for (const c of rollCells(short(ps, STAGE_STEP), f, { rows: STAGE_ROWS, step: STAGE_STEP, direction: "falling" })) {
    const x = stageX(c.n.note), y = VIEW_Y + FALL_Y0 - c.row * ROW_GAP;
    if (out.some((p) => overlap(p, x, y)) || before.some((p) => overlap(p, x, y))) continue;
    out.push({ x, y, unit: FLAG, color: colorOf(c.n as ShowNote) });
  }
  return [...new Map(out.map((p) => [`${p.unit} ${p.x} ${p.y}`, p])).values()];
}

const PICTURES: Pixel[][] = [];
/** Every frame's picture, worked out once and in order (each depends on the one before). */
export function pictureAt(f: number): Pixel[] {
  while (PICTURES.length <= f) PICTURES.push(draw(PICTURES.length, PICTURES.length ? PICTURES[PICTURES.length - 1] : []));
  return PICTURES[f];
}

/* ── The explosions: the strongest downbeats ── */

/**
 * The downbeats that get an explosion: in the loud sections (the whole piece when none is), each bar's first beat
 * weighed by the velocities of every note struck on it, drums too; the three heaviest at least four bars apart. (Für
 * Elise: C16, the ff chord the storm ends on, then C9 and C1 — the three bars the score marks with an accent.)
 */
export const BOOM_BARS: readonly number[] = (() => {
  const weight = new Map<number, number>();
  for (const n of NOTES) if (n[BEAT] === 0 && (!LOUD.length || loudBar(n[BAR]))) weight.set(n[BAR], (weight.get(n[BAR]) ?? 0) + n[VELOCITY]);
  const chosen: number[] = [];
  for (const [bar] of [...weight].sort((x, y) => y[1] - x[1] || x[0] - y[0])) {
    if (chosen.length < 3 && chosen.every((b) => Math.abs(b - bar) >= 4)) chosen.push(bar);
  }
  return chosen;
})();
/**
 * Each explosion: a frame, a kind (1 a Wraith's, 2 a Battlecruiser's), where. The heaviest downbeat gets three
 * Battlecruisers across the stage; the others a Wraith over each note the lead strikes on it (one in the middle if it
 * strikes none). Their own explosion sounds are heard (the user's choice).
 */
export const explosions: readonly { frame: number; kind: number; x: number; y: number }[] = (() => {
  const list: { frame: number; kind: number; x: number; y: number }[] = [];
  BOOM_BARS.forEach((bar, k) => {
    const struck = notes.filter((n) => n.bar === bar && n.beat === 0);
    const lead = struck.filter((n) => n.part === LEAD_PART);
    const frame = Math.min(...struck.map((n) => n.on));
    if (k === 0) for (const dx of [-240, 0, 240]) list.push({ frame, kind: 2, x: CAM_X + 40 + dx, y: VIEW_Y + 110 });
    else if (lead.length) for (const n of lead) list.push({ frame, kind: 1, x: stageX(n.note), y: VIEW_Y + 120 });
    else list.push({ frame, kind: 1, x: CAM_X + 40, y: VIEW_Y + 120 });
  });
  return list.sort((a, b) => a.frame - b.frame);
})();

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
export const LABEL_F: number[] = captions.map((l) => l.frame), LABEL_TEXT: string[] = captions.map((l) => l.text);
export const FX_F: number[] = explosions.map((e) => e.frame), FX_K: number[] = explosions.map((e) => e.kind), FX_X: number[] = explosions.map((e) => e.x), FX_Y: number[] = explosions.map((e) => e.y);

/** The colours of P3 … P8 as the map gives them (the showcase's probe-players line), by colour number. */
export const RGB: readonly (readonly [number, number, number])[] = [[0, 0, 0], [240, 240, 240], [72, 56, 200], [255, 190, 0], [0, 200, 255], [235, 20, 50], [170, 80, 255]];
/** Frames worth a look before a play: two in each section, each explosion, the end. */
export const PREVIEW_FRAMES: readonly number[] = [
  ...SECTIONS.flatMap((s, k) => {
    const to = (SECTIONS[k + 1]?.frame ?? LAST_OFF - ZERO);
    return [s.frame + Math.round((to - s.frame) / 3), s.frame + Math.round(((to - s.frame) * 2) / 3)].map((f) => ZERO + f);
  }),
  ...new Set(explosions.map((e) => e.frame)), LAST_OFF - 20,
].sort((a, b) => a - b);
