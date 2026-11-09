/**
 * The Für Elise visualizer's build-time helpers (probes/lib/note-timeline.ts, probes/lib/fur-elise-probe-score.ts): notes on
 * the game's clock, the keyboard they need, a piano roll's cells frame by frame, pictures turned into changes, and the
 * transcription played on a tempo that moves.
 */
import { describe, expect, it } from "vitest";
import { FRAME, changesOver, fitKeys, frameNotes, isBlack, keyRange, keyX, rollCells, whiteKeys, type FramedNote, type Pixel } from "../probes/lib/note-timeline";
import { A_PLAYING, A_SECTION, STORM, STORM_PLAYING, THEME_TWICE, barStarts, length, noteNumber, perform } from "../probes/lib/fur-elise-probe-score";

const note = (time: number, seconds: number, n: number, hand = 0) => ({ time, seconds, note: n, hand, velocity: 1 });
const framed = (on: number, len: number, n = 60): FramedNote => ({ source: note(0, 0, n), on, len, note: n, hand: 0, velocity: 1, chord: false });

describe("notes on the game's clock", () => {
  it("starts a note on the frame nearest its time and lasts the frames its length covers, at least one", () => {
    const fs = frameNotes([note(0, 0.125, 64), note(0.125, 0.125, 63), note(1.0, 0.01, 60)], 10);
    expect(fs.map((n) => [n.on, n.len])).toEqual([[10, 3], [13, 3], [34, 1]]);
    expect(Math.round(1.0 / FRAME)).toBe(24);
  });

  it("marks a chord: three notes or more of one hand starting together", () => {
    const fs = frameNotes([note(0, 0.2, 57), note(0, 0.2, 62), note(0, 0.2, 65), note(0, 0.2, 38, 1), note(0, 0.2, 50, 1)]);
    expect(fs.filter((n) => n.chord).map((n) => n.note)).toEqual([57, 62, 65]);
  });

  it("orders the notes by their first frame, each keeping the note it was made from", () => {
    const later = note(0.5, 0.1, 70), first = note(0, 0.1, 60);
    const fs = frameNotes([later, first]);
    expect(fs.map((n) => n.note)).toEqual([60, 70]);
    expect(fs[1].source).toBe(later);
  });
});

describe("the keyboard", () => {
  it("knows the black keys", () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlack)).toEqual([false, true, false, true, false, false, true]);
  });

  it("reaches from a white key to a white key", () => {
    expect(keyRange([{ note: 63 }, { note: 70 }])).toEqual({ lo: 62, hi: 71 });
    expect(keyRange([{ note: 40 }, { note: 88 }])).toEqual({ lo: 40, hi: 88 });
  });

  it("puts a black key halfway between its white neighbours", () => {
    expect(whiteKeys(60, 64)).toEqual([60, 62, 64]);
    expect(keyX(60, 60, 20)).toBe(0);
    expect(keyX(61, 60, 20)).toBe(10);
    expect(keyX(62, 60, 20)).toBe(20);
    expect(keyX(65, 60, 20)).toBe(60);
  });
});

describe("a piano roll", () => {
  const falling = { rows: 10, step: 1, direction: "falling" } as const;

  it("brings a falling note's first cell next to the keyboard the frame before it sounds", () => {
    const n = framed(20, 3);
    expect(rollCells([n], 19, falling).map((c) => c.row)).toEqual([0, 1, 2]);
    // Ten frames before, its first cell enters the top row; earlier, it is not on the roll.
    expect(rollCells([n], 10, falling).map((c) => c.row)).toEqual([9]);
    expect(rollCells([n], 9, falling)).toEqual([]);
    // Sounding, it has left the roll from the bottom.
    expect(rollCells([n], 20, falling).map((c) => c.row)).toEqual([0, 1]);
    expect(rollCells([n], 22, falling)).toEqual([]);
  });

  it("moves a row every step, a cell standing for step frames", () => {
    const opts = { rows: 10, step: 2, direction: "falling" } as const;
    const n = framed(20, 1);
    // Frames 18 and 19 are the same step (18): the note, two to four frames away, in row 0.
    expect(rollCells([n], 18, opts).map((c) => c.row)).toEqual([0]);
    expect(rollCells([n], 19, opts).map((c) => c.row)).toEqual([0]);
    expect(rollCells([n], 16, opts).map((c) => c.row)).toEqual([1]);
    // A note of six frames covers three cells.
    expect(rollCells([framed(21, 6)], 18, opts).map((c) => c.row)).toEqual([1, 2, 3]);
  });

  it("lets a rising note leave the keyboard as it sounds", () => {
    const rising = { rows: 10, step: 1, direction: "rising" } as const;
    const n = framed(20, 3);
    expect(rollCells([n], 19, rising)).toEqual([]);
    expect(rollCells([n], 20, rising).map((c) => c.row)).toEqual([0]);
    expect(rollCells([n], 22, rising).map((c) => c.row)).toEqual([0, 1, 2]);
    expect(rollCells([n], 25, rising).map((c) => c.row)).toEqual([3, 4, 5]);
    expect(rollCells([n], 31, rising).map((c) => c.row)).toEqual([9]);
    expect(rollCells([n], 32, rising)).toEqual([]);
  });

  it("shows a note in a row once for each step its frames touch", () => {
    // Row 4's cell stands for the frames k·step + 1 … (k + 1)·step as the roll moves: the note is in it for as many
    // steps as there are such blocks among its frames.
    for (const step of [1, 2, 3]) {
      for (const [on, len] of [[50, 5], [51, 1], [52, 7]]) {
        let shown = 0;
        for (let f = 0; f < 90; f += step) shown += rollCells([framed(on, len)], f, { rows: 20, step, direction: "falling" }).filter((c) => c.row === 4).length;
        const end = on + len - 1;
        expect(shown).toBe(Math.floor((end - 1) / step) - Math.floor((on - 1) / step) + 1);
      }
    }
  });
});

describe("pictures turned into changes", () => {
  const p = (x: number, color: number, unit = 0): Pixel => ({ x, y: 0, unit, color });

  it("makes, recolours and takes away only what differs from the frame before", () => {
    const pictures: Pixel[][] = [[p(0, 1), p(10, 2)], [p(0, 1), p(10, 3)], [p(10, 3), p(20, 1, 1)], []];
    const cs = changesOver(4, (f) => pictures[f]);
    expect(cs[0]).toEqual([{ x: 0, y: 0, unit: 0, from: 0, to: 1 }, { x: 10, y: 0, unit: 0, from: 0, to: 2 }]);
    expect(cs[1]).toEqual([{ x: 10, y: 0, unit: 0, from: 2, to: 3 }]);
    expect(cs[2]).toEqual([{ x: 20, y: 0, unit: 1, from: 0, to: 1 }, { x: 0, y: 0, unit: 0, from: 1, to: 0 }]);
    expect(cs[3].map((c) => [c.x, c.from, c.to])).toEqual([[10, 3, 0], [20, 1, 0]]);
  });

  it("keeps the last of two pixels at one place, and a still picture costs nothing", () => {
    const cs = changesOver(3, () => [p(0, 1), p(0, 2)]);
    expect(cs.map((c) => c.length)).toEqual([1, 0, 0]);
    expect(cs[0][0].to).toBe(2);
  });
});

describe("the transcription, played", () => {
  it("reads note names", () => {
    expect([noteNumber("C4"), noteNumber("D#5"), noteNumber("Bb3"), noteNumber("E2"), noteNumber("E6")]).toEqual([60, 75, 58, 40, 88]);
  });

  it("opens with E5 D#5 E5 B4 D5 C5, then A4 over A2 E3 A3", () => {
    const ns = perform(A_SECTION, A_PLAYING);
    const rh = ns.filter((n) => n.hand === 0).slice(0, 9).map((n) => n.note);
    expect(rh).toEqual([76, 75, 76, 75, 76, 71, 74, 72, 69]);
    const lh = ns.filter((n) => n.hand === 1).slice(0, 3).map((n) => n.note);
    expect(lh).toEqual([45, 52, 57]);
    // The A4 and the A2 under it start together, on the second bar's downbeat.
    const a4 = ns.find((n) => n.note === 69)!, a2 = ns.find((n) => n.note === 45)!;
    expect(a4.time).toBe(a2.time);
    // The A4 is an eighth: the downbeat's long sixteenth and one more.
    expect(a4.seconds).toBeCloseTo(a2.seconds + A_PLAYING.sixteenth, 6);
  });

  it("plays a sixteenth at the tempo, a downbeat a little long, and slows where a bar says", () => {
    const ns = perform([{ rh: "C4 D4 E4 F4 G4 A4", lh: ". . . . . ." }, { rh: "C5 . . . . .", lh: ". . . . . ." }], { sixteenth: 0.1, downbeat: 0.1 });
    expect(ns[1].time).toBeCloseTo(0.11, 6);
    expect(ns[2].time - ns[1].time).toBeCloseTo(0.1, 6);
    expect(ns[6].time).toBeCloseTo(0.61, 6);
    const slow = perform([{ rh: "C4 D4 E4 F4 G4 A4", lh: ". . . . . .", rit: 0.5 }], { sixteenth: 0.1 });
    expect(slow[5].seconds).toBeCloseTo(0.15, 6);
    expect(length([{ rh: "C4 D4 E4 F4 G4 A4", lh: ". . . . . .", rit: 0.5 }], { sixteenth: 0.1 })).toBeCloseTo(0.75, 6);
  });

  it("refuses a bar whose hands differ in length", () => {
    expect(() => perform([{ rh: "C4 D4", lh: "." }], { sixteenth: 0.1 })).toThrow(/differ in length/);
  });

  it("lasts about 34 s (the A section), 12 s (the theme twice) and 9 s (the storm), from E2/D2 to E6", () => {
    expect(length(A_SECTION, A_PLAYING)).toBeGreaterThan(30);
    expect(length(A_SECTION, A_PLAYING)).toBeLessThan(40);
    expect(length(THEME_TWICE, A_PLAYING)).toBeGreaterThan(11);
    expect(length(THEME_TWICE, A_PLAYING)).toBeLessThan(14);
    expect(length(STORM, STORM_PLAYING)).toBeGreaterThan(8);
    expect(length(STORM, STORM_PLAYING)).toBeLessThan(11);
    const all = [...perform(A_SECTION, A_PLAYING), ...perform(STORM, STORM_PLAYING)];
    expect(keyRange(all)).toEqual({ lo: 38, hi: 88 });
    const bars = barStarts(THEME_TWICE, A_PLAYING);
    expect(bars.length).toBe(THEME_TWICE.length + 1);
    expect(bars.at(-1)).toBeCloseTo(length(THEME_TWICE, A_PLAYING), 9);
  });
});

describe("a keyboard fitted to the notes", () => {
  it("holds every note when they fit, white key to white key", () => {
    const k = fitKeys([45, 52, 63, 76], 64);
    expect([k.lo, k.hi, k.fold(63)]).toEqual([45, 76, 63]);
    expect(fitKeys([44, 70], 64)).toMatchObject({ lo: 43, hi: 71 });
  });

  it("keeps the window with the most notes and moves the rest in by octaves", () => {
    // A1 … E7 is 68 keys; 63 hold all but the three A1s, which show an octave up.
    const pitches = [33, 33, 33, ...Array.from({ length: 63 }, (_, i) => 38 + i), 100, 100];
    const k = fitKeys(pitches, 63);
    expect([k.lo, k.hi]).toEqual([38, 100]);
    expect(k.fold(33)).toBe(45);
    expect(k.fold(101)).toBe(89);
  });

  it("counts white keys when asked", () => {
    // A1 … E7 has 40 white keys: they fit in 40, not in 30.
    const k = fitKeys([33, 100], 40, "whites");
    expect([k.lo, k.hi]).toEqual([33, 100]);
    const narrow = fitKeys([33, ...Array.from({ length: 30 }, (_, i) => 50 + i)], 30, "whites");
    expect(whiteKeys(narrow.lo, narrow.hi).length).toBeLessThanOrEqual(30);
    expect(narrow.fold(33)).toBeGreaterThanOrEqual(narrow.lo);
  });
});
