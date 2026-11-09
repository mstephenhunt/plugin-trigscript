// A performance's notes turned into what a map shows frame by frame (the Für Elise visualizer, TrigScript 4's third
// Showcase). Everything here runs when the script is built: the notes are known then, with their times to the sample,
// so the picture of every frame can be worked out beforehand and the game only has to play the changes back.
//
//   - `frameNotes`: each note's first frame and how many frames it lasts, from its time in seconds;
//   - `keyRange`, `isBlack`, `whiteKeys`: the keyboard a set of notes needs, from a white key to a white key;
//   - `rollCells`: the cells of a piano roll at a frame, notes falling onto the keyboard (or rising from it);
//   - `changesOver`: pictures, frame by frame, turned into the cells that change from one frame to the next.
//
// Plain functions of plain data, so they are tested on their own (tests/note-timeline.test.ts) as well as used by a
// script.

/** Seconds a frame lasts on Fastest, the speed a map is played at. */
export const FRAME = 0.042;

/** A note as a performance plays it: when it starts and how long it is written, in seconds; its number (60 is C4). */
export interface TimedNote {
  readonly time: number;
  readonly seconds: number;
  readonly note: number;
  /** Which hand, or part: 0 the right hand, 1 the left, anything else a part of its own. */
  readonly hand: number;
  readonly velocity: number;
}

/** A note on the game's clock: the frame it starts on and the frames it lasts (at least one). */
export interface FramedNote<T extends TimedNote = TimedNote> {
  /** The note as it was played. */
  readonly source: T;
  readonly on: number;
  readonly len: number;
  readonly note: number;
  readonly hand: number;
  readonly velocity: number;
  /** Whether it starts with two or more other notes of its hand: a chord. */
  readonly chord: boolean;
}

/**
 * Each note on the game's clock, from a performance that starts on frame `start`: its first frame is the one nearest its
 * time (a frame is 42 ms; a sound the game starts lands within 21 ms of its frame anyway), its length the frames its
 * written length covers, at least `least`. In the order they start.
 */
export function frameNotes<T extends TimedNote>(notes: readonly T[], start: number = 0, least: number = 1): FramedNote<T>[] {
  const on = (n: TimedNote) => start + Math.round(n.time / FRAME);
  const framed = notes.map((n) => {
    const first = on(n);
    const last = start + Math.round((n.time + n.seconds) / FRAME);
    return { source: n, on: first, len: Math.max(least, last - first), note: n.note, hand: n.hand, velocity: n.velocity, chord: false };
  });
  framed.sort((a, b) => a.on - b.on || a.note - b.note);
  // A chord: three notes or more of one hand starting on the same frame.
  const count = new Map<string, number>();
  for (const n of framed) count.set(`${n.on} ${n.hand}`, (count.get(`${n.on} ${n.hand}`) ?? 0) + 1);
  return framed.map((n) => ({ ...n, chord: (count.get(`${n.on} ${n.hand}`) ?? 0) >= 3 }));
}

/** Whether a key is black: C#, D#, F#, G#, A#. */
export function isBlack(note: number): boolean {
  return [1, 3, 6, 8, 10].includes(((note % 12) + 12) % 12);
}

/** The keyboard the notes need: from the lowest to the highest, each end moved out to a white key. */
export function keyRange(notes: readonly { readonly note: number }[]): { lo: number; hi: number } {
  if (!notes.length) throw new Error("keyRange: no notes.");
  let lo = Math.min(...notes.map((n) => n.note));
  let hi = Math.max(...notes.map((n) => n.note));
  if (isBlack(lo)) lo--;
  if (isBlack(hi)) hi++;
  return { lo, hi };
}

/** The white keys from lo to hi, in order. */
export function whiteKeys(lo: number, hi: number): number[] {
  const keys: number[] = [];
  for (let n = lo; n <= hi; n++) if (!isBlack(n)) keys.push(n);
  return keys;
}

/**
 * Where a key sits along a keyboard of white keys `pitch` apart, the first white key's middle at 0: a black key halfway
 * between the white keys either side of it.
 */
export function keyX(note: number, lo: number, pitch: number): number {
  let whites = 0;
  for (let n = lo; n < note; n++) if (!isBlack(n)) whites++;
  return isBlack(note) ? (whites - 0.5) * pitch : whites * pitch;
}

/** How a roll shows the notes: `rows` cells above the keyboard, each `step` frames of music. */
export interface RollOptions {
  readonly rows: number;
  readonly step: number;
  /** "falling": the notes to come, reaching the keyboard as they sound; "rising": the notes played, leaving it. */
  readonly direction: "falling" | "rising";
}

/** A cell of a roll: the note, its row counted up from the keyboard (0 the row next to it), and the note itself. */
export interface RollCell { readonly row: number; readonly n: FramedNote }

/**
 * The cells a roll shows at frame `f`. The roll moves a row every `step` frames (on the frames that are a multiple of
 * it), so a cell stands for `step` frames of music: falling, row r the frames r·step + 1 … (r + 1)·step after the last
 * step — a note's first cell reaches the row next to the keyboard the step before it sounds; rising, row r the frames
 * just played, r·step + 1 … (r + 1)·step before.
 */
export function rollCells(notes: readonly FramedNote[], f: number, options: RollOptions): RollCell[] {
  const { rows, step, direction } = options;
  const at = Math.floor(f / step) * step;
  const cells: RollCell[] = [];
  for (const n of notes) {
    const end = n.on + n.len - 1;
    // Rows the note's frames fall in, if any are on the roll.
    let first: number, last: number;
    if (direction === "falling") {
      // Row r holds the frames at + r·step + 1 … at + (r + 1)·step.
      first = Math.ceil((n.on - at) / step) - 1;
      last = Math.ceil((end - at) / step) - 1;
    } else {
      // Row r holds the frames at − (r + 1)·step + 1 … at − r·step.
      first = Math.ceil((at - end + 1) / step) - 1;
      last = Math.floor((at - n.on) / step);
    }
    for (let r = Math.max(0, first); r <= Math.min(rows - 1, last); r++) cells.push({ row: r, n });
  }
  return cells;
}

/** A unit standing for a pixel: where it is on the map, in pixels, what it is (a number the script gives) and its colour. */
export interface Pixel { readonly x: number; readonly y: number; readonly unit: number; readonly color: number }

/** One cell that changes: where, which kind of unit, the colour it had (0 none) and the colour it takes (0 none). */
export interface Change { readonly x: number; readonly y: number; readonly unit: number; readonly from: number; readonly to: number }

/**
 * Pictures frame by frame, from frame 0 to `frames` − 1, turned into what changes: for each frame, the cells whose
 * colour differs from the frame before (frame 0 against an empty map). A picture is its pixels; two at one place and
 * of one kind, the last given wins.
 */
export function changesOver(frames: number, picture: (f: number) => readonly Pixel[]): Change[][] {
  const out: Change[][] = [];
  let shown = new Map<string, Pixel>();
  for (let f = 0; f < frames; f++) {
    const now = new Map<string, Pixel>();
    for (const p of picture(f)) now.set(`${p.unit} ${p.x} ${p.y}`, p);
    const changes: Change[] = [];
    for (const [k, p] of now) {
      const was = shown.get(k);
      if (!was || was.color !== p.color) changes.push({ x: p.x, y: p.y, unit: p.unit, from: was?.color ?? 0, to: p.color });
    }
    for (const [k, was] of shown) if (!now.has(k)) changes.push({ x: was.x, y: was.y, unit: was.unit, from: was.color, to: 0 });
    out.push(changes);
    shown = now;
  }
  return out;
}

/** A keyboard fitted to notes: its lowest and highest key, and where a note outside it is shown (an octave in). */
export interface FittedKeys { readonly lo: number; readonly hi: number; fold(note: number): number }

/**
 * The keyboard that shows the most of `pitches` in at most `most` keys (`count: "keys"`) or white keys (`"whites"`),
 * from a white key to a white key: every note when they fit; else the window holding the most of them, and each note
 * outside it moved by octaves to the nearest it can be inside (a keyboard on a map has only so many columns).
 */
export function fitKeys(pitches: readonly number[], most: number, count: "keys" | "whites" = "keys"): FittedKeys {
  if (!pitches.length) throw new Error("fitKeys: no notes.");
  const size = (lo: number, hi: number) => (count === "keys" ? hi - lo + 1 : whiteKeys(lo, hi).length);
  const all = keyRange(pitches.map((note) => ({ note })));
  let lo = all.lo, hi = all.hi;
  if (size(lo, hi) > most) {
    // Every window from a white key, as wide as allowed: the one holding the most notes (the lower on a tie).
    let best = -1;
    for (let a = all.lo; a <= all.hi; a++) {
      if (isBlack(a)) continue;
      let b = a;
      while (b + 1 <= all.hi && size(a, b + 1) <= most) b++;
      if (isBlack(b)) b--;
      const held = pitches.filter((p) => p >= a && p <= b).length;
      if (held > best) { best = held; lo = a; hi = b; }
    }
    if (hi - lo < 11) throw new Error(`fitKeys: ${most} ${count} cannot hold an octave.`);
  }
  const fold = (note: number) => {
    let n = note;
    while (n < lo) n += 12;
    while (n > hi) n -= 12;
    return n;
  };
  return { lo, hi, fold };
}
