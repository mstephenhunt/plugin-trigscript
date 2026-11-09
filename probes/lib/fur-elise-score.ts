// Für Elise (Beethoven, WoO 59, "Clavierstück in A moll"): the notes, ours, written from the public-domain score —
// Beethoven's Werke, Serie 25 No. 298 (Breitkopf & Härtel, 1888), the scan on Wikimedia Commons — in the notation
// `music.perform` reads. Never from anyone's MIDI file or arrangement. A text a bar; [0] is the pickup where there is
// one. The orchestra's parts in the stormy section (C) are our arrangement.
//
// Bar numbers here: A section — 0 the pickup, 1 … 7, 8 the second ending (into the middle part), 9 … 21 as printed
// (12 … 14 the passage back to the theme), 22 the theme's last A, held. B — the F major episode, B0 (the second ending
// of the middle part's repeat) … B15. C section — C1 … C17, the D minor storm over the drumming A (printed bars 77 … 93
// in the usual count), to the E chord; P1 … P5 the pp arpeggios and the chromatic run down to the theme. `piece()` puts
// them in the order the score plays them, every repeat taken.

/** `n` sixteenths of one note or chord: a bar of the drumming bass. */
export const sixteenths = (note: string, n = 6) => [`${note}/16`, ...Array.from({ length: n - 1 }, () => note)].join(" ");
/** Bars of rest, 3/8 each. */
export const rests = (n: number): string[] => Array.from({ length: n }, () => "r/4.");

/* ── The A section ── */

// The right hand: the melody a little over its own arpeggio (the C4 E4 A4 that answers the left hand quieter), the
// turn's D#5 under its E5s.
export const A_RIGHT = [
  /* 0 */ "p E5/16@+2 D#5@-3",
  /* 1 */ "E5/16@+3 D#5@-3 E5@+1 B4@-4 D5@-2 C5@-3",
  /* 2 */ "A4/8 r/16 C4@-12 E4@-9 A4@-5",
  /* 3 */ "B4/8@+2 r/16 E4@-12 G#4@-8 B4@-4",
  /* 4 */ "C5/8@+5 r/16 E4@-10 E5@-1 D#5@-4",
  /* 5 */ "E5/16@+2 D#5@-4 E5 B4@-5 D5@-3 C5@-4",
  /* 6 */ "A4/8 r/16 C4@-12 E4@-9 A4@-5",
  /* 7 */ "B4/8 r/16 E4@-12 C5@-4 B4@-6",
  /* 8 */ "A4/8@-2 r/16 B4@-8 C5@-5 D5@-2",
  /* 9 */ "p < E5/8.@+2 G4/16@-12 F5@-1 E5@-4",
  /* 10 */ "D5/8.@+5 F4/16@-12 E5@-1 D5@-4",
  /* 11 */ "p > C5/8.@+8 E4/16@-12 D5@-2 C5@-4",
  /* 12 */ "B4/8 r/16 E4@-12 E5@-6 r",
  /* 13 */ "pp r/16 E5@-2 E6@-8 r r D#5@-4",
  /* 14 */ "E5/8 r/16 D#5@-4 E5@-2 D#5@-4",
  /* 15 */ "E5/16@+2 D#5@-4 E5 B4@-5 D5@-3 C5@-4",
  /* 16 */ "A4/8 r/16 C4@-12 E4@-9 A4@-5",
  /* 17 */ "B4/8@+2 r/16 E4@-12 G#4@-8 B4@-4",
  /* 18 */ "C5/8@+5 r/16 E4@-10 E5@-1 D#5@-4",
  /* 19 */ "E5/16@+2 D#5@-4 E5 B4@-5 D5@-3 C5@-4",
  /* 20 */ "A4/8 r/16 C4@-12 E4@-9 A4@-5",
  /* 21 */ "> B4/8 r/16 E4@-12 C5@-5 B4@-7",
  /* 22 */ "ppp A4/4.@+8",
];

// The left hand: each arpeggio under its pedal, as printed ("Ped." on the bar, "*" at its end); the turn in bars 12 … 14
// handed across to it (bar 12 ends on E4, bar 13 starts an octave up on E5 — slurred, not tied — then D#5 E5 in the
// treble, the right hand's E5 E6 between). The last A is held in the pedal for two bars more, so it rings out before
// the dampers fall.
export const A_LEFT = [
  /* 0 */ "p r/8",
  /* 1 */ "r/4.",
  /* 2 */ "ped A2/16 E3 A3 r r/8 *",
  /* 3 */ "ped E2/16 E3 G#3 r r/8 *",
  /* 4 */ "ped A2/16 E3 A3 r r/8 *",
  /* 5 */ "r/4.",
  /* 6 */ "ped A2/16 E3 A3 r r/8 *",
  /* 7 */ "ped E2/16 E3 G#3 r r/8 *",
  /* 8 */ "ped A2/16 E3 A3 r r/8 *",
  /* 9 */ "p ped C3/16 G3 C4 r r/8 *",
  /* 10 */ "ped G2/16 G3 B3 r r/8 *",
  /* 11 */ "p > ped A2/16 E3 A3 r r/8 *",
  /* 12 */ "ped E2/16 E3 E4 r r E4@-4",
  /* 13 */ "pp E5/16@-4 r r * D#5@-6 E5@-6 r",
  /* 14 */ "r/16 D#5@-6 E5@-6 r r/8",
  /* 15 */ "r/4.",
  /* 16 */ "ped A2/16 E3 A3 r r/8 *",
  /* 17 */ "ped E2/16 E3 G#3 r r/8 *",
  /* 18 */ "ped A2/16 E3 A3 r r/8 *",
  /* 19 */ "r/4.",
  /* 20 */ "ped A2/16 E3 A3 r r/8 *",
  /* 21 */ "> ped E2/16 E3 G#3 r r/8 *",
  /* 22 */ "ppp ped A2/16@+4 E3@+2 A3@+2 r r/8 | r/4. | r/4. *",
];

/**
 * The A section's tempo, in eighths a minute: poco moto, the first phrase leaning on bar 4 and slowing into bar 8, the
 * middle part moving on, the turn back to the theme (12 … 14) held back and let go, and the last bars slowing to the
 * held A. [bar, bpm]: 0.5 is inside the pickup.
 */
export const A_TEMPO: readonly (readonly [number, number])[] = [
  [0.4, 112], [1, 120], [3, 124], [4, 118], [4.6, 110], [5, 120], [7, 120], [8, 104], [8.67, 112], [9, 124], [10.6, 128], [11.5, 118],
  [12.5, 106], [13.4, 94], [14.2, 106], [14.9, 118], [15, 122], [18, 124], [19, 118], [20, 120], [21, 110], [21.7, 90], [22, 84],
];
/** Breaths: before the middle part, on the high E, before the theme comes back, before the last A. */
export const A_HOLDS: readonly (readonly [number, number])[] = [[9, 0.1], [13.33, 0.12], [15, 0.06], [22, 0.16]];

/** A part without its expression: no dynamics, no "@", no pedal — every note as a sequencer's grid plays it. */
export const plain = (bars: readonly string[]): string[] => bars.map((b) =>
  b.split(/\s+/).filter((w) => w && !/^(ppp|pp|p|mp|mf|f|ff|fff|<|>|ped|\*)$/.test(w)).map((w) => w.replace(/@[+-]?\d+/, "")).join(" "));

/* ── The C section: the storm over the drumming A ── */

export const C_RIGHT = [
  /* C1 */ "f E4+G4+Bb4+C#5/4.!",
  /* C2 */ "F4+A4+D5/4 C#5+E5/16 D5+F5",
  /* C3 */ "G#4+D5+F5/4@+4 G#4+D5+F5/8",
  /* C4 */ "A4+C5+E5/4.",
  /* C5 */ "mf F4+D5/4 E4+C5/16 D4+B4",
  /* C6 */ "C4+F#4+A4/4@+4 C4+A4/8",
  /* C7 */ "C4+A4/8 E4+C5 D4+B4",
  /* C8 */ "C4+A4/4.",
  /* C9 */ "f E4+G4+Bb4+C#5/4.!",
  /* C10 */ "F4+A4+D5/4 C#5+E5/16 D5+F5",
  /* C11 */ "D5+F5/4@+4 D5+F5/8",
  /* C12 */ "< D5+F5/4.",
  /* C13 */ "G4+Eb5/4 F4+D5/16 Eb4+C5",
  /* C14 */ "D4+F4+Bb4/4 D4+F4+A4/8",
  /* C15 */ "D4+F4+G#4/4 D4+F4+G#4/8",
  /* C16 */ "ff C4+E4+A4/4! r/8",
  /* C17 */ "p E4+B4/8 r r",
];
export const C_LEFT = [
  /* C1 */ `f ${sixteenths("A2")}`,
  /* C2 */ sixteenths("A2"),
  /* C3 */ sixteenths("A2"),
  /* C4 */ sixteenths("A2"),
  /* C5 */ `mf ${sixteenths("D2+A2")}`,
  /* C6 */ sixteenths("D#2+A2"),
  /* C7 */ "E2+A2/16 E2+A2 E2+A2 E2+A2 E2+G#2 E2+G#2",
  /* C8 */ "A1+A2/16 A2 A2 A2 A2 A2",
  /* C9 */ `f ${sixteenths("A2")}`,
  /* C10 */ sixteenths("A2"),
  /* C11 */ sixteenths("A2"),
  /* C12 */ `< ${sixteenths("Bb2")}`,
  /* C13 */ sixteenths("Bb2"),
  /* C14 */ sixteenths("Bb2"),
  /* C15 */ sixteenths("B2"),
  /* C16 */ "ff A2/4! r/8",
  /* C17 */ "p E3+G#3/8 r r",
];

/** The storm's tempo: driven, a little faster than the theme, broadening into its last chords. */
export const C_TEMPO: readonly (readonly [number, number])[] = [[1, 134], [8, 134], [8.7, 124], [9, 134], [15, 132], [16, 116], [17, 100]];

// The orchestra, our arrangement: the violins on the chords' top line, the violas under them, the celli spiccato on the
// drumming bass and the basses on its eighths an octave down, horns and trombones holding the harmony where it is
// loudest, the tuba on the bass, the timpani on A and E.
export const C_VIOLINS = [
  "f C#5/4.", "D5/4 E5/16 F5", "F5/4 F5/8", "E5/4.",
  "mf D5/4 C5/16 B4", "A4/4 A4/8", "A4/8 C5 B4", "A4/4.",
  "f C#5/4.", "D5/4 E5/16 F5", "F5/4 F5/8", "< F5/4.",
  "Eb5/4 D5/16 C5", "Bb4/4 A4/8", "G#4/4 G#4/8", "ff A4/4 r/8", "p B4/8 r r",
];
export const C_VIOLAS = [
  "f Bb4/4.", "A4/4 C#5/16 D5", "D5/4 D5/8", "C5/4.",
  "mf F4/4 E4/16 D4", "F#4/4 C4/8", "C4/8 E4 D4", "C4/4.",
  "f Bb4/4.", "A4/4 C#5/16 D5", "D5/4 D5/8", "< D5/4.",
  "G4/4 F4/16 Eb4", "F4/4 F4/8", "F4/4 F4/8", "ff E4/4 r/8", "p E4/8 r r",
];
export const C_CELLI = [
  `f ${sixteenths("A2")}`, sixteenths("A2"), sixteenths("A2"), sixteenths("A2"),
  `mf ${sixteenths("D3")}`, sixteenths("D#3"), "E3/16 E3 E3 E3 E3 E3", sixteenths("A2"),
  `f ${sixteenths("A2")}`, sixteenths("A2"), sixteenths("A2"), `< ${sixteenths("Bb2")}`,
  sixteenths("Bb2"), sixteenths("Bb2"), sixteenths("B2"), "ff A2/4! r/8", "p E3/8 r r",
];
export const C_BASSES = [
  "f A1/8 A1 A1", "A1/8 A1 A1", "A1/8 A1 A1", "A1/8 A1 A1",
  "mf D2/8 D2 D2", "D#2/8 D#2 D#2", "E2/8 E2 E2", "A1/8 A1 A1",
  "f A1/8 A1 A1", "A1/8 A1 A1", "A1/8 A1 A1", "< Bb1/8 Bb1 Bb1",
  "Bb1/8 Bb1 Bb1", "Bb1/8 Bb1 Bb1", "B1/8 B1 B1", "ff A1/4! r/8", "p E2/8 r r",
];
export const C_HORNS = [
  "f E4+G4/4.", "D4+F4/4.", "D4+F4/4.", "C4+E4/4.",
  "mf D4+F4/4.", "C4+F#4/4.", "C4+E4/4 B3+D4/8", "A3+C4/4.",
  "f E4+G4/4.", "D4+F4/4.", "D4+F4/4.", "< D4+F4/4.",
  "Eb4+G4/4.", "D4+F4/4.", "D4+F4/4.", "ff C4+E4/4! r/8", "r/4.",
];
export const C_TROMBONES = [
  "f C#3+G3/4.!", "D3+F3/4.", "D3+G#3/4.", "C3+E3/4.",
  ...rests(3), "mf C3+E3/4.",
  "f C#3+G3/4.!", "D3+F3/4.", "D3+F3/4.", "< D3+F3/4.",
  "Eb3+G3/4.", "D3+F3/4.", "D3+F3/4.", "ff C3+E3/4! r/8", "r/4.",
];
export const C_TUBA = [
  "f A1/4.", "r/4.", "A1/4.", "r/4.",
  "mf D2/4.", "D#2/4.", "E2/4.", "A1/4.",
  "f A1/4.", "r/4.", "A1/4.", "< Bb1/4.",
  "Bb1/4.", "Bb1/4.", "B1/4.", "ff A1/4! r/8", "p E2/8 r r",
];
export const C_TIMPANI = [
  "f A2/4.!", "A2/8 r r", "A2/4.", "A2/8 A2/16 A2 A2/8",
  ...rests(2), "E3/8 r E3", "A2/4.",
  "ff A2/4.!", "A2/8 r r", "A2/8 A2/16 A2 A2/8", ...rests(3),
  "E3/8 E3/16 E3 E3/8", "ff A2/4! r/8", "mf E3/8 r r",
];

/* ── The F major episode (B) ── */

// B0 is the middle part's second ending: A, then the C7 that turns to F. B1 … B7 the episode's tune over the left
// hand's broken chords; B8 … B11 the thirty-seconds over C and G7; B12 … B15 the E–D# that leads back to the theme
// (its last D#5 the theme's pickup). Grace notes are written as sixty-fourths taken from the note after them.
export const B_RIGHT = [
  /* B0 */ "p A4/8@-2 r/16 E4+C5@-8 F4+C5@-6 E4+G4+C5@-4",
  /* B1 */ "p F4/64@-16 A4/64@-14 C5/8..@+4 F5/16.@+6 E5/32@-2",
  /* B2 */ "E5/8@+2 D5@-3 Bb5/16.@+6 A5/32@-2",
  /* B3 */ "A5/16@+3 G5@-1 F5@-2 E5@-3 D5@-4 C5@-5",
  /* B4 */ "Bb4/8@-2 A4/16..@-4 Bb4/64@-12 A4/32@-6 G4@-8 A4@-6 Bb4@-4",
  /* B5 */ "< C5/4 D5/16@-2 D#5",
  /* B6 */ "p E5/8.@+8 E5/16@+2 F5@+4 A4@-6",
  /* B7 */ "C5/4@+2 D5/16.@+2 B4/32@-6",
  /* B8 */ "p C5/32@+2 G5@-6 G4@-10 G5@-6 A4@-8 G5@-6 B4@-6 G5@-6 C5@-3 G5@-6 D5@-2 G5@-6",
  /* B9 */ "E5/32@+2 G5@-6 C6@+4 B5@-2 A5@-4 G5@-5 F5@-5 E5@-6 D5@-7 G5@-5 F5@-6 D5@-8",
  /* B10 */ "pp C5/32@+4 G5@-6 G4@-10 G5@-6 A4@-8 G5@-6 B4@-6 G5@-6 C5@-3 G5@-6 D5@-2 G5@-6",
  /* B11 */ "E5/32@+2 G5@-6 C6@+4 B5@-2 A5@-4 G5@-5 F5@-5 E5@-6 D5@-7 G5@-5 F5@-6 D5@-8",
  /* B12 */ "pp E5/32@-2 F5@-4 E5 D#5@-3 E5 B4@-5 E5 D#5@-3 E5 B4@-5 E5 D#5@-3",
  /* B13 */ "E5/8.@+2 B4/32@-6 E5@-2 D#5/8@-2",
  /* B14 */ "E5/8.@+1 B4/32@-7 E5@-3 D#5/8@-3",
  /* B15 */ "> E5/8 D#5/32@-4 E5@-3 D#5@-4 E5@-3 D#5/8@-2",
];
export const B_LEFT = [
  /* B0 */ "p ped A2/16@-6 E3@-8 A3@-8 Bb3+C4@-8 A3+C4@-8 G3+Bb3+C4@-6",
  /* B1 */ "p * ped F3/16@-8 A3@-12 C4@-12 A3@-14 C4@-12 A3@-14",
  /* B2 */ "* ped F3/16@-8 Bb3@-12 D4@-12 Bb3@-14 D4@-12 Bb3@-14",
  /* B3 */ "* F3/16@-8 E4@-10 G3+Bb3@-12 E4@-10 G3+Bb3@-12 E4@-12",
  /* B4 */ "F3/16@-8 A3@-12 C4@-12 A3@-14 C4@-12 A3@-14",
  /* B5 */ "< F3/16@-8 A3@-12 C4@-12 A3@-14 C4@-12 A3@-14",
  /* B6 */ "p E3/16@-8 A3@-12 C4@-12 A3@-14 D3+D4@-10 F3@-12",
  /* B7 */ "G3/16@-8 E4@-12 G3@-12 F4@-12 G3@-12 F4@-12",
  /* B8 */ "p C4+E4/8@-8 r/16 F4+G4@-14 E4+G4@-14 D4+F4+G4@-12",
  /* B9 */ "C4+E4+G4/8@-8 G3+B3@-14 G3+B3@-16",
  /* B10 */ "pp C4+E4/8@-6 r/16 F4+G4@-14 E4+G4@-14 D4+F4+G4@-12",
  /* B11 */ "C4+E4+G4/8@-8 G3+B3@-14 G3+B3@-16",
  /* B12 */ "pp G#3+B3/8@-6 r r",
  /* B13 */ "r/4.",
  /* B14 */ "r/4.",
  /* B15 */ "r/4.",
];

/* ── The pp arpeggios and the chromatic run (P), after the storm ── */

// Sixteenth triplets: the A minor arpeggio climbing over three bars (P3 an octave up, as the score's 8va has it), then
// down by semitones from B-flat to F, into the theme. The pedal held through the arpeggios, lifted for the run.
export const P_RIGHT = [
  /* P1 */ "pp A3/16t@-6 C4@-6 E4@-4 A4@-4 C5@-2 E5 D5@-2 C5@-3 B4@-4",
  /* P2 */ "A4/16t@-6 C5@-5 E5@-3 A5@-2 C6@-1 E6@+1 D6@-1 C6@-2 B5@-3",
  /* P3 */ "A5/16t@-6 C6@-5 E6@-3 A6@-2 C7@-1 E7 D7@-2 C7@-3 B6@-4",
  /* P4 */ "> Bb6/16t@-4 A6@-5 G#6@-5 G6@-6 F#6@-6 F6@-7 E6@-7 D#6@-8 D6@-8",
  /* P5 */ "C#6/16t@-8 C6@-9 B5@-9 Bb5@-10 A5@-10 G#5@-10 G5@-10 F#5@-10 F5@-10",
];
export const P_LEFT = [
  /* P1 */ "pp ped A1/8@+4 r A3+C4+E4@-10",
  /* P2 */ "A3+C4+E4/8@-10 r A3+C4+E4@-12",
  /* P3 */ "A3+C4+E4/8@-12 r A3+C4+E4@-14",
  /* P4 */ "* A3+C4+E4/8@-14 r r",
  /* P5 */ "r/4.",
];

/* ── The whole piece ── */

/** A section of the piece: its name, and the bars [from, to) of `piece().right` it takes. */
export interface PieceSection { readonly name: string; readonly from: number; readonly to: number }

/** Theme bars `list` (by the numbers above) for one hand, the first with `mark` (a dynamic) before it. */
const theme = (hand: readonly string[], list: readonly number[], mark = "") => list.map((k, i) => (i === 0 && mark ? `${mark} ${hand[k].replace(/^(ppp|pp|p|mp|mf|f|ff) /, "")}` : hand[k]));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** Tempo points written in theme bar numbers, placed where theme bar `first` stands in the piece (`at`). */
const place = (points: readonly (readonly [number, number])[], first: number, at: number) => points.map(([x, v]) => [at + (x - first), v] as [number, number]);

/** The theme's tempo for bars 1 … 8, and for 9 … 21 (A_TEMPO's), and a closing variant: slower, more inward. */
const THEME_1_8 = A_TEMPO.filter(([x]) => x >= 1 && x < 9);
const THEME_9_21 = A_TEMPO.filter(([x]) => x >= 9 && x <= 21);
const calmer = (points: readonly (readonly [number, number])[], by: number) => points.map(([x, v]) => [x, v - by] as [number, number]);

/**
 * Für Elise as the score plays it, every repeat taken: the A section (the theme, its repeat, the middle part twice),
 * the F major episode, the theme again into the storm, the storm, the arpeggios and the run, the theme a last time and
 * the end. A text a bar for each hand and each orchestral part (rests where it does not play), [0] the pickup; its
 * sections by bar; its tempo map and holds in those bars.
 */
export function piece() {
  const right: string[] = [], left: string[] = [], sections: PieceSection[] = [];
  const add = (name: string, r: readonly string[], l: readonly string[]) => {
    if (r.length !== l.length) throw new Error(`${name}: ${r.length} bars for the right hand, ${l.length} for the left.`);
    sections.push({ name, from: right.length, to: right.length + r.length });
    right.push(...r); left.push(...l);
  };
  const ending8a = { r: "A4/4 E5/16@+2 D#5@-3", l: "ped A2/16 E3 A3 r * r/8" };
  const ending22a = { r: A_RIGHT[8], l: A_LEFT[8] };
  // A: pickup, 1 … 7, first ending; 1 … 7, second ending; the middle part 9 … 21 with its first ending, and again.
  add("A", [
    A_RIGHT[0], ...theme(A_RIGHT, range(1, 7)), ending8a.r, ...theme(A_RIGHT, range(1, 7), "pp"), A_RIGHT[8],
    ...theme(A_RIGHT, range(9, 21)), ending22a.r, ...theme(A_RIGHT, range(9, 21)),
  ], [
    A_LEFT[0], ...theme(A_LEFT, range(1, 7)), ending8a.l, ...theme(A_LEFT, range(1, 7), "pp"), A_LEFT[8],
    ...theme(A_LEFT, range(9, 21)), ending22a.l, ...theme(A_LEFT, range(9, 21)),
  ]);
  add("B", B_RIGHT, B_LEFT);
  // The theme again (no pickup: the episode's last D#5 is it). Its bar 14 as page 2 prints it: E5 a sixteenth.
  const again = theme(A_RIGHT, [...range(1, 8), ...range(9, 21)], "p").map((b, i) => (i === 13 ? "E5/16 r r D#5@-4 E5@-2 D#5@-4" : b));
  add("A again", again, theme(A_LEFT, [...range(1, 8), ...range(9, 21)], "p"));
  // The storm: the bar of drumming A that leads in (the theme's last A over it), then C1 … C17.
  add("storm", ["A4/8@-4 r r", ...C_RIGHT], [`p < ${sixteenths("A2")}`, ...C_LEFT]);
  // The arpeggios, the run, the theme a last time, and the last A held in the pedal (the score lets it go short).
  add("closing", [
    ...P_RIGHT, ...theme(A_RIGHT, [...range(1, 8), ...range(9, 21)], "p"), "ppp A4/4.@+8",
  ], [
    ...P_LEFT, ...theme(A_LEFT, [...range(1, 8), ...range(9, 21)], "p"), "ppp ped A1+A2/4.@+6 | r/4. | r/4. *",
  ]);
  const storm = sections.find((x) => x.name === "storm")!;
  // The orchestra rests to the storm; a timpani roll under its first bar.
  const before = ["r/8", ...rests(storm.from - 1)];
  const orchestra = {
    violins: [...before, "r/4.", ...C_VIOLINS], violas: [...before, "r/4.", ...C_VIOLAS], celli: [...before, "r/4.", ...C_CELLI],
    basses: [...before, "r/4.", ...C_BASSES], horns: [...before, "r/4.", ...C_HORNS], trombones: [...before, "r/4.", ...C_TROMBONES],
    tuba: [...before, "r/4.", ...C_TUBA], timpani: [...before, "r/4.", ...C_TIMPANI], roll: [...before, "pp A2/4."],
  };
  const at = (name: string) => sections.find((x) => x.name === name)!.from;
  const A = at("A"), B = at("B"), A2 = at("A again"), S = storm.from, C = at("closing");
  // The tempo, eighths a minute: item 3's shape for the theme every time, a little calmer on its repeat and its last
  // time; the episode lyrical, its thirty-seconds steady, slowing into the theme; the storm driven; the arpeggios
  // flowing and the run slowing into the last theme, which slows to the held A.
  const tempo: [number, number][] = [
    [A + 0.4, 112], ...place(THEME_1_8, 1, A + 1),
    ...place(calmer(THEME_1_8, 2), 1, A + 9),
    ...place(THEME_9_21, 9, A + 17), [A + 29.8, 112], [A + 30, 118], [A + 30.67, 112],
    ...place(THEME_9_21, 9, A + 31), [A + 43.7, 100],
    [B, 108], [B + 1, 112], [B + 2, 114], [B + 3, 110], [B + 4, 112], [B + 5, 116], [B + 6, 112], [B + 7, 110], [B + 7.8, 102],
    [B + 8, 118], [B + 11.8, 118], [B + 12, 114], [B + 13, 106], [B + 14, 98], [B + 15, 90], [B + 15.8, 84],
    ...place(THEME_1_8, 1, A2), ...place(THEME_9_21, 9, A2 + 8), [A2 + 20, 110], [A2 + 20.7, 104],
    [S, 118], [S + 1, 134], ...place(C_TEMPO.filter(([x]) => x > 1), 1, S + 1),
    [C, 112], [C + 2, 118], [C + 3, 120], [C + 4, 112], [C + 4.8, 94],
    ...place(calmer(THEME_1_8, 6), 1, C + 5), ...place(calmer(THEME_9_21.filter(([x]) => x < 20), 6), 9, C + 13),
    [C + 24, 108], [C + 25, 96], [C + 25.7, 78], [C + 26, 70],
  ];
  const holds: [number, number][] = [
    [A + 17, 0.1], [A + 21.33, 0.12], [A + 23, 0.06], [A + 31, 0.08], [A + 35.33, 0.12], [A + 37, 0.06],
    [B, 0.08], [B + 8, 0.06], [A2, 0.25], [A2 + 8, 0.1], [A2 + 12.33, 0.12], [A2 + 14, 0.06],
    [C, 0.6], [C + 5, 0.15], [C + 13, 0.12], [C + 17.33, 0.15], [C + 19, 0.08], [C + 26, 0.3],
  ];
  return { right, left, orchestra, sections, tempo, holds };
}
