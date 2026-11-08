// Für Elise (Beethoven, WoO 59, "Clavierstück in A moll"): the notes, ours, written from the public-domain score —
// Beethoven's Werke, Serie 25 No. 298 (Breitkopf & Härtel, 1888), the scan on Wikimedia Commons — in the notation
// `music.perform` reads. Never from anyone's MIDI file or arrangement. A text a bar; [0] is the pickup where there is
// one. The orchestra's parts in the stormy section (C) are our arrangement.
//
// Bar numbers here: A section — 0 the pickup, 1 … 7, 8 the second ending (into the middle part), 9 … 21 as printed
// (12 … 14 the passage back to the theme), 22 the theme's last A, held. C section — C1 … C17, the D minor storm over
// the drumming A (printed bars 77 … 93 in the usual count), to the E chord before the pp arpeggios.

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
// handed across to it (its E4 tied over the bar line, then D#5 E5 in the treble). The last A is held in the pedal for two
// bars more, so it rings out before the dampers fall.
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
  /* 12 */ "ped E2/16 E3 E4 r r E4~",
  /* 13 */ "pp E4/16 r r * D#5@-6 E5@-6 r",
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
