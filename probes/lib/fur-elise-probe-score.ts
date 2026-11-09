// Für Elise (Beethoven, Bagatelle in A minor, WoO 59), the notes the visualizer probe plays (probes/fur-elise-visual.ts),
// kept as that probe was played; the Showcase's score is the sound probe's (probes/lib/fur-elise-score.ts).
// Our own transcription, written from the public-domain score — never from a MIDI file or anyone's arrangement — of the
// A section, and a passage of our own in the manner of the stormy D-minor C section (not a transcription of it), so that
// the probe has something dense, with chords and repeated low notes, to show the "big" look on.
//
// Bars 12–14 (the octave E's before the theme comes back) are written from memory of the score and still have to be
// checked against an edition; the rest of the A section is the theme as every edition has it. The probe's sound is a
// stand-in (an FM electric piano); the Showcase's own transcription and performance come from the sound probe.
//
// A bar is a text a hand, a sixteenth a word (3/8: six a bar): a note's name starts it ("E5", "D#5"), several with + sound
// together, "-" holds what sounds a sixteenth longer, "." rests, "|" is for the eye. `perform` turns bars into notes with
// times, on a tempo that moves: each downbeat a little long, a bar marked `rit` slowing to its end.

/** A bar: what each hand plays, and how it is played. */
export interface Bar {
  readonly rh: string;
  readonly lh: string;
  /** How much slower the bar's last sixteenth is than its first (0.3: 30%), slowing evenly across the bar. */
  readonly rit?: number;
  /** How loud, 0 … 1 (the section's when left out). */
  readonly velocity?: number;
}

/** A note of a performance: start and written length in seconds, its number (60 is C4), hand (0 right, 1 left), loudness. */
export interface PlayedNote { readonly time: number; readonly seconds: number; readonly note: number; readonly hand: number; readonly velocity: number }

const SEMITONE: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A note's number from its name: "C4" is 60, "D#5" 75, "Bb3" 58. */
export function noteNumber(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Not a note: ${JSON.stringify(name)}.`);
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

/** A hand's text as words: a sixteenth each. */
const words = (text: string) => text.split(/\s+/).filter((w) => w && w !== "|");

/** Sixteenths a bar of the given bars has (they must agree hand with hand). */
function slotsOf(bar: Bar): number {
  const r = words(bar.rh).length, l = words(bar.lh).length;
  if (r !== l) throw new Error(`A bar's hands differ in length: ${r} and ${l} sixteenths ("${bar.rh}" / "${bar.lh}").`);
  return r;
}

/** How a performance moves: seconds a sixteenth, how much longer a downbeat's sixteenth is, how loud by default. */
export interface Performance { readonly sixteenth: number; readonly downbeat?: number; readonly velocity?: number }

/**
 * The bars played: each note's time and written length in seconds. A sixteenth lasts `sixteenth`, a downbeat's
 * `downbeat` more (0.06: 6%); a bar with `rit` slows evenly to its last sixteenth, `rit` longer.
 */
export function perform(bars: readonly Bar[], how: Performance): PlayedNote[] {
  const notes: PlayedNote[] = [];
  let now = 0;
  for (const bar of bars) {
    const n = slotsOf(bar);
    // When each sixteenth of the bar starts, and the bar's end.
    const starts: number[] = [];
    for (let s = 0; s < n; s++) {
      starts.push(now);
      const rit = bar.rit ? 1 + (bar.rit * s) / Math.max(1, n - 1) : 1;
      // (A bar shorter than six sixteenths is an upbeat: no downbeat in it.)
      now += how.sixteenth * rit * (s === 0 && n === 6 ? 1 + (how.downbeat ?? 0) : 1);
    }
    starts.push(now);
    const velocity = bar.velocity ?? how.velocity ?? 0.7;
    for (const [hand, text] of [[0, bar.rh], [1, bar.lh]] as const) {
      const ws = words(text);
      ws.forEach((w, s) => {
        if (w === "-" || w === ".") return;
        let len = 1;
        while (s + len < ws.length && ws[s + len] === "-") len++;
        const [body, at] = w.split("@");
        for (const name of body.split("+")) {
          notes.push({ time: starts[s], seconds: starts[s + len] - starts[s], note: noteNumber(name), hand, velocity: at ? velocity * Number(at) : velocity });
        }
      });
    }
  }
  notes.sort((a, b) => a.time - b.time || a.note - b.note);
  return notes;
}

/** Seconds the bars last as `perform` plays them. */
export function length(bars: readonly Bar[], how: Performance): number {
  let now = 0;
  for (const bar of bars) {
    const n = slotsOf(bar);
    for (let s = 0; s < n; s++) now += how.sixteenth * (bar.rit ? 1 + (bar.rit * s) / Math.max(1, n - 1) : 1) * (s === 0 && n === 6 ? 1 + (how.downbeat ?? 0) : 1);
  }
  return now;
}

/** When each bar starts, in seconds from the first, as `perform` plays them; one more at the end. */
export function barStarts(bars: readonly Bar[], how: Performance): number[] {
  const at = [0];
  bars.forEach((_, k) => at.push(length(bars.slice(0, k + 1), how)));
  return at;
}

/* ── The A section ── */

const REST = ". . . . . .";
/** The upbeat: E5 D#5. */
export const UPBEAT: Bar = { rh: "E5 D#5", lh: ". ." };
/** The theme's bars 1–7, as the A section plays them three times. */
const THEME: readonly Bar[] = [
  { rh: "E5 D#5 E5 B4 D5 C5", lh: REST },
  { rh: "A4 - . C4 E4 A4", lh: "A2 E3 A3 . . ." },
  { rh: "B4 - . E4 G#4 B4", lh: "E2 E3 G#3 . . ." },
  { rh: "C5 - . E4 E5 D#5", lh: "A2 E3 A3 . . ." },
  { rh: "E5 D#5 E5 B4 D5 C5", lh: REST },
  { rh: "A4 - . C4 E4 A4", lh: "A2 E3 A3 . . ." },
  { rh: "B4 - . E4 C5 B4", lh: "E2 E3 G#3 . . ." },
];
/** Bar 8, three ways: back to the start (the upbeat again), on to bar 9, and the end. */
const BACK: Bar = { rh: "A4 - . . E5 D#5", lh: "A2 E3 A3 . . .", rit: 0.15 };
const ON: Bar = { rh: "A4 - . B4 C5 D5", lh: "A2 E3 A3 . . ." };
const END: Bar = { rh: "A4 - - - - -", lh: "A2+E3+A3 - - - - -", rit: 0.6 };
/** Bars 9–14: C major, G, A minor, E, and the octave E's that lead back to the theme. */
const EPISODE: readonly Bar[] = [
  { rh: "E5 - . G4 F5 E5", lh: "C3 G3 C4 . . ." },
  { rh: "D5 - . F4 E5 D5", lh: "G2 G3 B3 . . ." },
  { rh: "C5 - . E4 D5 C5", lh: "A2 E3 A3 . . ." },
  { rh: "B4 - . E4 E5 .", lh: "E2 E3 . . . ." },
  { rh: ". E5 E6 . . D#5", lh: REST },
  { rh: "E5 . . D#5 E5 D#5", lh: REST, rit: 0.25 },
];

/** The A section, as the probe plays it: bars 1–8 twice, then 9–22 twice, ending on the last A (45 bars, about 34 s). */
export const A_SECTION: readonly Bar[] = [
  UPBEAT, ...THEME, BACK,
  ...THEME, ON,
  ...EPISODE, ...THEME, { ...ON, rit: 0.1 },
  ...EPISODE, ...THEME, END,
];

/** The theme once round with its repeat: bars 1–8 twice, ending on the A (17 bars, about 12 s). For the sync parts. */
export const THEME_TWICE: readonly Bar[] = [UPBEAT, ...THEME, BACK, ...THEME, END];

/** How the A section is played: Poco moto, a sixteenth 0.125 s, downbeats 6% long. */
export const A_PLAYING: Performance = { sixteenth: 0.125, downbeat: 0.06, velocity: 0.62 };

/* ── A stormy passage in D minor (ours, after the C section's manner) ── */

/** Six of the same low note: the repeated sixteenths under the C section. */
const drum = (n: string) => [n, n, n, n, n, n].join(" ");
/**
 * Fourteen bars: right-hand chords on every eighth over repeated low D's, rising; a diminished arpeggio climbing over
 * repeated A's; the chords again; a last D-minor chord, rung out.
 */
export const STORM: readonly Bar[] = [
  { rh: "A3+D4+F4 - A3+D4+F4 - A3+D4+F4 -", lh: drum("D2"), velocity: 0.7 },
  { rh: "A3+D4+F4 - A3+C#4+E4 - A3+D4+F4 -", lh: drum("D2"), velocity: 0.72 },
  { rh: "Bb3+D4+G4 - Bb3+D4+G4 - Bb3+D4+G4 -", lh: drum("D2"), velocity: 0.75 },
  { rh: "A3+D4+F4 - A3+D4+F4 - A3+C#4+E4 -", lh: drum("D2"), velocity: 0.78 },
  { rh: "A3+D4+F4 - D4+F4+A4 - F4+A4+D5 -", lh: drum("D2"), velocity: 0.82 },
  { rh: "G4+Bb4+D5 - G4+Bb4+E5 - A4+C#5+E5 -", lh: "G2 G2 G2 A2 A2 A2", velocity: 0.86 },
  { rh: "A4+D5+F5 - - - - -", lh: "D2+D3 - - D2 D2 D2", velocity: 0.95 },
  { rh: "C#4 E4 G4 Bb4 C#5 E5", lh: drum("A2"), velocity: 0.7 },
  { rh: "G5 Bb5 C#6 E6 C#6 Bb5", lh: drum("A2"), velocity: 0.8 },
  { rh: "G5 E5 C#5 Bb4 G4 E4", lh: drum("A2"), velocity: 0.75 },
  { rh: "C#4 E4 G4 A4 C#5 E5", lh: drum("A2"), velocity: 0.8 },
  { rh: "D5+F5+A5 - D5+F5+A5 - C#5+E5+A5 -", lh: "D2 D2 D2 A2 A2 A2", velocity: 0.9 },
  { rh: "D5+F5+A5 - - - - -", lh: "D2+D3 - - D2 D2 D2", velocity: 0.95, rit: 0.3 },
  { rh: "D4+F4+A4+D5 - - - - -", lh: "D2+A2+D3 - - - - -", velocity: 1, rit: 0.8 },
];

/** How the storm is played: faster, a sixteenth 0.105 s, downbeats 4% long. */
export const STORM_PLAYING: Performance = { sixteenth: 0.105, downbeat: 0.04, velocity: 0.8 };
