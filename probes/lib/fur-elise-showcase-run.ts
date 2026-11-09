// The Für Elise showcase's run (probes/fur-elise-showcase.ts), worked out when the script is built from the soundtrack's
// timeline (the chosen one's: probes/lib/fur-elise-showcase-choice.ts): when the one clip starts, the text, and the picture of every frame on
// both screens, flattened into the changes the program plays back. Plain data and functions, so the same run is what
// the showcase plays, what tests/fur-elise-showcase-run.test.ts checks and what pictures of it are drawn from
// (probes/lib/fur-elise-frames.mts --showcase).
//
// It is generic over the timeline (probes/lib/fur-elise-showcase-choice.ts picks the cinematic arrangement or the
// straight piece): the parts each screen shows (by ROLES), both keyboards, the storm and the big sections, the
// explosions (from HITS) are all worked out from the data.
//
// The looks are the ones the user chose after the visualizer probe (2026-11-09): notes falling onto a keyboard on both
// screens, the main screen's a row every other frame; the lead (the right hand) gold, the accompaniment (the left)
// cyan; in the storm the lead's chords red and the white keys flashing red on each; explosions on the strongest
// moments; the rest of the band on the minimap in violet in the big sections only, so the intro and ending are calm. The probe measured the picture ~95 ms ahead of a long clip's sound: the clip starts LEAD frames early.
import { FRAME, changesOver, fitKeys, isBlack, keyX, rollCells, whiteKeys, type FramedNote, type Pixel, type TimedNote } from "./note-timeline";
import { TIMELINE, LOOK } from "./fur-elise-showcase-choice";
import { AT, END, PITCH, VELOCITY, PART, BAR, BEAT, FRAME as FRAME_COL, HIT_FRAME, HIT_STRENGTH, HIT_PART } from "./fur-elise-timeline";
import { CELL, VIEW_X, VIEW_Y, CAM_X, BLACK_Y, WHITE_Y, ROW_GAP, FALL_Y0, STAGE_ROWS, MAP_W } from "./fur-elise-layout";

const { NOTES, ROLES, SECTIONS, SECONDS, HITS } = TIMELINE;
/** The drops' downbeats, [at, frame], where a timeline has them (the remix's): the biggest moments. */
const DROPS: readonly (readonly [number, number])[] = (TIMELINE as { DROPS?: readonly (readonly [number, number])[] }).DROPS ?? [];

/* ── The parts, by their roles ── */

/** A part of these roles is drums, an impact or a riser: its "pitch" is a kit's key, and no roll shows it. */
const UNPITCHED = ["drum-low", "drum-high", "cymbal", "impact", "riser"];
const roleOf = (part: number): string => ROLES[part];
export const isPitched = (part: number) => !UNPITCHED.includes(roleOf(part));
/**
 * On both keyboards: the melody (role "lead": the piano's right hand, and in the remix the trance lead that doubles it)
 * gold, drawn on top of everything; the piano's left hand ("accomp") cyan. LEAD_PART and OTHER_PART are the first of each.
 */
const partsOf = (role: string) => ROLES.map((r, k) => (r === role ? k : -1)).filter((k) => k >= 0);
export const LEAD_PARTS = partsOf("lead"), OTHER_PARTS = partsOf("accomp");
export const LEAD_PART = LEAD_PARTS[0] ?? -1, OTHER_PART = OTHER_PARTS[0] ?? -1;
if (LEAD_PART < 0 || OTHER_PART < 0) throw new Error("The timeline's ROLES name no lead or no accomp.");
const isLead = (part: number) => LEAD_PARTS.includes(part), isAccomp = (part: number) => OTHER_PARTS.includes(part);
const onStage = (part: number) => isLead(part) || isAccomp(part);
/** Parts the main screen shows too, in the big sections only (LOOK.stage: the remix's stabs). */
const isExtra = (part: number) => LOOK.stage.includes(roleOf(part));

/* ── The keyboards ── */

/** The main screen's keyboard: the hands' notes, at most 40 white keys (16 pixels apart fill the view); outliers by octaves. */
export const STAGE_KEYS = fitKeys(NOTES.filter((n) => onStage(n[PART]) || isExtra(n[PART])).map((n) => n[PITCH]), 40, "whites");
export const STAGE_LO = STAGE_KEYS.lo, STAGE_HI = STAGE_KEYS.hi;
/**
 * White keys 16 to 20 pixels apart, the last at view x 830 (inside the 852 the widescreen view shows). A Spider Mine is
 * 15 pixels square, so neighbours 16 apart never overlap; text lines show over view x 0 … 233, so the fewer keys, the
 * fewer under the title. (Für Elise: A1 … E7, 40 white keys 16 apart from x 206; only A1 and B1 under the text.)
 */
export const STAGE_PITCH = Math.max(16, Math.min(20, Math.floor(624 / Math.max(1, whiteKeys(STAGE_LO, STAGE_HI).length - 1))));
export const STAGE_X0 = 830 - (whiteKeys(STAGE_LO, STAGE_HI).length - 1) * STAGE_PITCH;
/**
 * The minimap's keyboard: the piano's notes in the map's 64 columns of cells, outliers by octaves; the other parts are
 * folded into it. (Für Elise: A1 … C7, E7's run an octave down.)
 */
export const ROLL_KEYS = fitKeys(NOTES.filter((n) => onStage(n[PART])).map((n) => n[PITCH]), MAP_W / 2, "keys");
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
/** The storm: red chords and the white keys flashing red (the user's choice). LOOK.storm names it. */
export const LOUD = SECTIONS.some((s) => s.name === LOOK.storm) ? [LOOK.storm] : [];
/**
 * The big sections (LOOK.big): the rest of the band falls on the minimap in violet there, and the stage's extra parts
 * show. The others — the piano's intro, the breakdowns, the ending — show the piano alone.
 */
export const BIG = LOOK.big.filter((name) => SECTIONS.some((s) => s.name === name));
const inSections = (names: readonly string[]) => (bar: number) => SECTIONS.some((s, k) => names.includes(s.name) && bar >= s.bar && bar < sectionEnd(k));
const loudBar = inSections(LOUD), bigBar = inSections(BIG);
/** Notes struck together in the storm by the lead or the stage's extra parts (by part, bar and beat: a performance spreads a chord by a few ms). */
const chordKey = (n: readonly number[]) => `${isExtra(n[PART]) ? "x" : "l"} ${n[BAR]} ${n[BEAT]}`;
const struckWith = new Map<string, number>();
for (const n of NOTES) if ((isLead(n[PART]) || isExtra(n[PART])) && loudBar(n[BAR])) struckWith.set(chordKey(n), (struckWith.get(chordKey(n)) ?? 0) + 1);

export const notes: readonly ShowNote[] = NOTES.filter((n) => onStage(n[PART]) || (isPitched(n[PART]) && bigBar(n[BAR]))).map((n) => {
  // The timeline's own frame for the strike (the soundtrack's), and the frames its key is held.
  const on = ZERO + n[FRAME_COL], off = ZERO + Math.round(n[END] / FRAME);
  const source: TimedNote = { time: n[AT], seconds: n[END] - n[AT], note: n[PITCH], hand: n[PART], velocity: n[VELOCITY] };
  const stormChord = (isLead(n[PART]) || isExtra(n[PART])) && loudBar(n[BAR]) && (struckWith.get(chordKey(n)) ?? 0) >= 2;
  return { source, on, len: Math.max(2, off - on), note: n[PITCH], hand: n[PART], velocity: n[VELOCITY], chord: stormChord, part: n[PART], bar: n[BAR], beat: n[BEAT], stormChord };
});
/** The piano's hands (and the melody), on both screens; the stage's extra parts in the big sections; the rest of the band, on the minimap only. */
export const piano = notes.filter((n) => onStage(n.part));
const extras = notes.filter((n) => isExtra(n.part));
const orchestra = notes.filter((n) => !onStage(n.part) && !isExtra(n.part));

/** The impacts the timeline marks (HITS of the role "impact"), as frames of the picture with their strength. */
const IMPACTS = HITS.filter((h) => roleOf(h[HIT_PART]) === "impact").map((h) => ({ frame: ZERO + h[HIT_FRAME], strength: h[HIT_STRENGTH] }));
/** The drops' downbeats as frames of the picture: strength 1, the biggest moments. */
const DROP_FRAMES = DROPS.map(([, f]) => ({ frame: ZERO + f, strength: 1 }));

/**
 * The frames the white keys flash red: two from each storm chord's first strike; where the timeline has drops (the
 * remix), four from each drop's downbeat and each impact of strength 0.9 or more too.
 */
export const flashes = new Set<number>();
{
  const first = new Map<string, number>();
  for (const n of notes) if (n.stormChord) {
    const k = `${isExtra(n.part) ? "x" : "l"} ${n.bar} ${n.beat}`;
    first.set(k, Math.min(first.get(k) ?? Infinity, n.on));
  }
  for (const f of first.values()) { flashes.add(f); flashes.add(f + 1); }
  if (DROP_FRAMES.length) for (const h of [...DROP_FRAMES, ...IMPACTS.filter((i) => i.strength >= 0.9)]) for (let d = 0; d < 4; d++) flashes.add(h.frame + d);
}

/**
 * The low drums' strongest strokes in the big sections (taiko, timpani: HITS of the role "drum-low", strength 0.95 or
 * more): the minimap's keyboard front row pulses red for three frames on each — the beat felt on the minimap, the main
 * screen left to the piano.
 */
export const pulses = new Set<number>();
for (const h of HITS) if (roleOf(h[HIT_PART]) === "drum-low" && h[HIT_STRENGTH] >= 0.95 && SECTIONS.some((s, k) => BIG.includes(s.name) && h[HIT_FRAME] >= s.frame && h[HIT_FRAME] < (SECTIONS[k + 1]?.frame ?? Infinity))) {
  for (let d = 0; d < 3; d++) pulses.add(ZERO + h[HIT_FRAME] + d);
}

/* ── What each frame shows ── */

const colorOf = (n: ShowNote) => (n.stormChord ? RED : isLead(n.part) ? GOLD : isAccomp(n.part) ? CYAN : VIOLET);
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
  const ps = near(piano, f), xs = near(extras, f), os = near(orchestra, f);
  const flash = flashes.has(f);
  // A key lit by the melody first, then the left hand, then the stage's extra parts: the last of them to strike it that
  // is still held. `key` maps a note to the keyboard's key.
  const keyColor = (k: number, idle: number, key: (note: number) => number) => {
    for (const group of [ps.filter((n) => isLead(n.part)), ps.filter((n) => !isLead(n.part)), xs]) {
      const lit = group.filter((n) => key(n.note) === k && n.on <= f && f < n.on + n.len);
      if (lit.length) return colorOf(lit[lit.length - 1]);
    }
    return idle;
  };
  // The minimap: the upper keyboard row every key, the lower the white keys' fronts (a note below D2 lights its octave).
  for (const key of ROLL_LIST) {
    const idle = isBlack(key) ? INDIGO : flash ? RED : WHITE;
    const color = keyColor(key, idle, rollKey);
    out.push({ x: rollX(key), y: rollY(ROLL_KEY_ROW), unit: OVERLORD, color });
    if (!isBlack(key)) out.push({ x: rollX(key), y: rollY(ROLL_KEY_ROW + 1), unit: OVERLORD, color: color === idle && pulses.has(f) ? RED : color });
  }
  // The main screen's keyboard, from the frame after.
  if (f >= SETUP + 1) for (const key of STAGE_LIST) {
    const idle = isBlack(key) ? INDIGO : flash ? RED : WHITE;
    out.push({ x: stageX(key), y: VIEW_Y + (isBlack(key) ? BLACK_Y : WHITE_Y), unit: FLAG, color: keyColor(key, idle, STAGE_KEYS.fold) });
  }
  // The minimap roll: the band first, then the stage's extra parts, the left hand, the melody last — on top.
  const accomp = ps.filter((n) => !isLead(n.part)), lead = ps.filter((n) => isLead(n.part));
  for (const c of rollCells(short([...os, ...xs, ...accomp, ...lead], ROLL_STEP), f, { rows: ROLL_ROWS, step: ROLL_STEP, direction: "falling" })) {
    out.push({ x: rollX(c.n.note), y: rollY(ROLL_KEY_ROW - 1 - c.row), unit: OVERLORD, color: colorOf(c.n as ShowNote) });
  }
  // The main screen's roll: the melody first, so that it keeps a place another part would take (a Flag waits a frame
  // where it would overlap one already there), then the left hand, then the extra parts.
  const taken = new Set<string>();
  for (const group of [lead, accomp, xs]) {
    for (const c of rollCells(short(group, STAGE_STEP), f, { rows: STAGE_ROWS, step: STAGE_STEP, direction: "falling" })) {
      const x = stageX(c.n.note), y = VIEW_Y + FALL_Y0 - c.row * ROW_GAP;
      if (taken.has(`${x} ${y}`) || out.some((p) => overlap(p, x, y)) || before.some((p) => overlap(p, x, y))) continue;
      taken.add(`${x} ${y}`);
      out.push({ x, y, unit: FLAG, color: colorOf(c.n as ShowNote) });
    }
  }
  return [...new Map(out.map((p) => [`${p.unit} ${p.x} ${p.y}`, p])).values()];
}

const PICTURES: Pixel[][] = [];
/** Every frame's picture, worked out once and in order (each depends on the one before). */
export function pictureAt(f: number): Pixel[] {
  while (PICTURES.length <= f) PICTURES.push(draw(PICTURES.length, PICTURES.length ? PICTURES[PICTURES.length - 1] : []));
  return PICTURES[f];
}

/* ── The explosions ── */

/**
 * The moments that get an explosion. With drops or impacts in the timeline (the remix, the cinematic arrangement): the
 * drops' downbeats (strength 1) and the impacts of strength 0.9 or more, the strongest first, at least 100 frames (4 s)
 * apart — the big arrivals, not every drum stroke. Without (the straight piece): the storm's downbeats weighed by the
 * velocities struck on them, the three heaviest four bars apart — C16, C9 and C1, the bars the score accents.
 */
export const BOOMS: readonly { frame: number; strength: number }[] = (() => {
  const chosen: { frame: number; strength: number }[] = [];
  if (IMPACTS.length || DROP_FRAMES.length) {
    for (const h of [...DROP_FRAMES, ...IMPACTS].sort((x, y) => y.strength - x.strength || x.frame - y.frame)) {
      if (h.strength >= 0.9 && chosen.every((c) => Math.abs(c.frame - h.frame) >= 100)) chosen.push(h);
    }
    return chosen.sort((x, y) => x.frame - y.frame);
  }
  const weight = new Map<number, number>();
  for (const n of NOTES) if (n[BEAT] === 0 && (!LOUD.length || loudBar(n[BAR]))) weight.set(n[BAR], (weight.get(n[BAR]) ?? 0) + n[VELOCITY]);
  const bars: [number, number][] = [];
  for (const [bar, w] of [...weight].sort((x, y) => y[1] - x[1] || x[0] - y[0])) if (bars.length < 3 && bars.every(([b]) => Math.abs(b - bar) >= 4)) bars.push([bar, w]);
  const most = Math.max(...bars.map(([, w]) => w));
  for (const [bar, w] of bars) chosen.push({ frame: Math.min(...notes.filter((n) => n.bar === bar && n.beat === 0).map((n) => n.on)), strength: w === most ? 1 : 0.9 });
  return chosen.sort((x, y) => x.frame - y.frame);
})();
/** The storm's frames: an explosion there is the biggest. */
const stormSpan = (() => { const k = SECTIONS.findIndex((s) => s.name === LOOK.storm); return k < 0 ? [Infinity, -Infinity] : [ZERO + SECTIONS[k].frame, ZERO + (SECTIONS[k + 1]?.frame ?? Infinity)]; })();
/**
 * Each explosion: a frame, a kind (1 a Wraith's, 2 a Battlecruiser's), where. The strongest moments (strength 1, the
 * most a timeline gives) get three Battlecruisers across the stage — five on the storm's (the remix's second drop, the
 * biggest); the others a Wraith over each note the melody strikes then (one in the middle if it strikes none). Their own
 * explosion sounds are heard (the user's choice).
 */
export const explosions: readonly { frame: number; kind: number; x: number; y: number }[] = BOOMS.flatMap((b) => {
  const storm = b.frame >= stormSpan[0] && b.frame < stormSpan[1];
  if (b.strength >= 0.995) return (storm && DROP_FRAMES.length ? [-320, -160, 0, 160, 320] : [-240, 0, 240]).map((dx) => ({ frame: b.frame, kind: 2, x: CAM_X + 40 + dx, y: VIEW_Y + 110 }));
  const lead = piano.filter((n) => isLead(n.part) && Math.abs(n.on - b.frame) <= 2);
  const xs = [...new Set(lead.map((n) => stageX(n.note)))];
  return xs.length ? xs.map((x) => ({ frame: b.frame, kind: 1, x, y: VIEW_Y + 120 })) : [{ frame: b.frame, kind: 1, x: CAM_X + 40, y: VIEW_Y + 120 }];
}).sort((x, y) => x.frame - y.frame);

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
