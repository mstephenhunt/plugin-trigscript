// Für Elise as a trance remix (asked 2026-11-09): the theme's first phrase on the piano alone (3/8, free in time), then
// a remix in 4/4 at 128 beats a minute, then the last bars on the piano alone again. The theme reshaped into 4/4 as
// dance covers do — each 3/8 bar of the score half a bar of 4/4: the E–D# turn as running sixteenths (its pickup folded
// in: E D# E D# E B D C), the long notes longer — so it sits on 4- and 8-bar phrases. Every note from the public-domain
// score (probes/lib/fur-elise-score.ts); the reshaping and every other part ours.
//
// The remix, by bar (4/4):
//   drop 1       0 … 15   the theme on the lead, the piano with it: twice, the middle part, the theme again
//   breakdown 1  16 … 19  the F major episode's tune on the piano over pads
//   build 1      20 … 23  the E–D# over E, a snare roll, a riser and a sweep, a bar's silence before …
//   drop 2       24 … 39  the storm: the drumming A as the bass, its diminished chords as stabs, its line on the lead
//   breakdown 2  40 … 43  the arpeggios on the piano over a pad
//   build 2      44 … 47  the chromatic run, the E–D# again, a riser
//   drop 3       48 … 63  the theme in full, its last bar the band's last hit
// Written as steps, a sixteenth each: a note ("E5", a chord "A3+C4+E4", "@96" its velocity), "-" holds it, "." rests.
import { A_RIGHT, A_LEFT, A_TEMPO } from "./fur-elise-score";

export type Role = "lead" | "lead-synth" | "accomp" | "arp" | "pluck" | "strings" | "brass" | "bass" | "synth" | "pad" | "drum-low" | "drum-high" | "cymbal" | "impact" | "riser";

/** The remix's parts and their roles; the melody's parts ("lead") are what the rest makes room for. */
export const REMIX_ROLES = {
  piano: "lead", pianoLH: "accomp", lead: "lead", leadLow: "lead-synth",
  arp: "arp", stabs: "synth", pad: "pad", strings: "strings", bass: "bass", sub: "bass",
  kick: "drum-low", timpani: "drum-low", clap: "drum-high", hats: "drum-high", snare: "drum-high", openHats: "cymbal", crash: "cymbal",
  impacts: "impact", risers: "riser",
} as const satisfies Record<string, Role>;
export type RemixPart = keyof typeof REMIX_ROLES;
/** What the melody is: the parts mixed apart, ducking the rest. */
export const MELODY: readonly RemixPart[] = ["piano", "lead", "leadLow"];
/** What is harmony under it: ducked by it, its range dipped. */
export const HARMONY: readonly RemixPart[] = ["pianoLH", "arp", "stabs", "pad", "strings"];
/** The effects and the drums in its range (crash, impacts, risers, clap, snare, open hats): ducked a little, dipped. */
export const EFFECTS: readonly RemixPart[] = ["crash", "impacts", "risers", "clap", "snare", "openHats"];

/* ── Steps to the notation `perform` reads ── */

const LENGTHS: readonly [number, string][] = [[16, "1"], [12, "2."], [8, "2"], [6, "4."], [4, "4"], [3, "8."], [2, "8"], [1, "16"]];
/** A run of `n` sixteenths as lengths, longest first. */
const pieces = (n: number) => { const out: string[] = []; for (const [k, l] of LENGTHS) while (n >= k) { out.push(l); n -= k; } return out; };
const NOTE = /^([A-G][#b]?-?\d)$/;
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const SEMI: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const num = (n: string) => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(n)!; return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); };
const nm = (k: number) => NAMES[((k % 12) + 12) % 12] + (Math.floor(k / 12) - 1);
/** A bar of steps (16, a sixteenth each) as notation, every pitch moved `by` semitones; a held note tied across lengths. */
export function steps(bar: string, by = 0): string {
  // A dynamic before the first step passes through as it is.
  const all = bar.split(/\s+/).filter((w) => w && w !== "|"), mark = /^(ppp|pp|p|mp|mf|f|ff|fff)$/.test(all[0]) ? `${all.shift()} ` : "";
  const words = all;
  if (words.length !== 16) throw new Error(`a bar of 4/4 is 16 steps, not ${words.length}: ${bar}`);
  const out: string[] = [];
  for (let i = 0; i < 16;) {
    const w = words[i];
    let n = 1;
    while (i + n < 16 && words[i + n] === "-") n++;
    if (w === "." || w === "-") {
      let r = n; // a rest (or a hold with nothing before it in the bar: a rest too)
      while (i + r < 16 && words[i + r] === ".") r++;
      for (const l of pieces(r)) out.push(`r/${l}`);
      i += r;
      continue;
    }
    const [body, vel] = w.split("@");
    const notes = body.split("+").map((x) => { if (!NOTE.test(x)) throw new Error(`no note ${x} in ${bar}`); return nm(num(x) + by); }).join("+");
    pieces(n).forEach((l, k, all) => out.push(`${notes}/${l}${k === 0 && vel ? `@${vel}` : ""}${k < all.length - 1 ? "~" : ""}`));
    i += n;
  }
  return mark + out.join(" ");
}

/* ── Harmony ── */

const PC: Readonly<Record<string, number>> = { C: 0, "C#": 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, Bb: 10, B: 11 };
const KINDS: Readonly<Record<string, readonly number[]>> = { "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], dim: [0, 3, 6, 9] };
function chord(sym: string, octave: number): number[] {
  const m = /^([A-G][#b]?)(m|7|dim)?$/.exec(sym);
  if (!m) throw new Error(`no chord ${sym}`);
  const root = 12 * (octave + 1) + PC[m[1]];
  return KINDS[m[2] ?? ""].map((i) => root + i);
}

/* ── The theme in 4/4 ── */

const T1 = "E5 D#5 E5 D#5 E5 B4 D5 C5 A4 - - C4 E4 A4 - -";
const T2 = "B4 - - E4 G#4 B4 - - C5 - - E4 E5 - - -";
const T4A = "B4 - - E4 C5 B4 - - A4 - - - - - - -";
const T4B = "B4 - - E4 C5 B4 - - A4 - - B4 C5 D5 - -";
const M5 = "E5 - - G4 F5 E5 - - D5 - - F4 E5 D5 - -";
const M6 = "C5 - - E4 D5 C5 - - B4 - - E4 E5 - E5 E6";
const M7 = "E6 - - - D#5 E5 D#5 E5 D#5 E5 D#5 E5 D#5 E5 D#5 -";
const T_H: readonly (readonly [string, string])[] = [["E", "Am"], ["E", "Am"], ["E", "Am"], ["E", "Am"]];
/** The drop's sixteen bars of melody and their chords, a chord a half bar; the last bar left for a fill. */
const DROP = [T1, T2, T1, T4A, T1, T2, T1, T4B, M5, M6, M7, T1, T2, T1, T4A, "A4 - - - - - - - . . . . . . . ."];
const DROP_H: readonly (readonly [string, string])[] = [...T_H, ...T_H, ["C", "G"], ["Am", "E"], ["E", "E"], ...T_H, ["Am", "Am"]];

/** The episode's tune (B1 … B7) in 4/4, and its chords. */
const EPISODE = [
  "C5 - - - F5 - E5 - E5 - D5 - Bb5 - A5 -",
  "A5 G5 F5 E5 D5 C5 - - Bb4 - A4 - A4 G4 A4 Bb4",
  "C5 - - - D5 - D#5 - E5 - - E5 F5 - A4 -",
  "C5 - - - D5 - B4 - C5 - - - - - - -",
];
const EPISODE_H: readonly (readonly [string, string])[] = [["F", "Bb"], ["C7", "F"], ["F", "Am"], ["G7", "C"]];
/** The build: the E–D# over E, the last bar silence before the drop. */
const BUILD = [
  "E5 F5 E5 D#5 E5 B4 E5 D#5 E5 B4 E5 D#5 E5 F5 E5 D#5",
  "E5 F5 E5 D#5 E5 B4 E5 D#5 E5 B4 E5 D#5 E5 F5 E5 D#5",
  "E5 D#5 E5 D#5 E5 D#5 E5 D#5 E5 D#5 E5 D#5 E5 D#5 E5 D#5",
  "E5 - - - . . . . . . . . . . . .",
];
/** The storm in 4/4: a chord a bar (C1 … C16), its line for the lead, its bass. */
const STORM_H = ["A", "Dm", "E", "Am", "Dm", "D#dim", "E", "Am", "A", "Dm", "Dm", "Bb", "Eb", "Bb", "E", "Am"];
const STORM_CHORDS = ["E4+G4+Bb4+C#5", "F4+A4+D5", "G#4+D5+F5", "A4+C5+E5", "F4+D5", "C4+F#4+A4", "C4+E4+A4", "C4+A4", "E4+G4+Bb4+C#5", "F4+A4+D5", "D5+F5", "D5+F5", "G4+Eb5", "D4+F4+Bb4", "D4+F4+G#4", "C4+E4+A4"];
const STORM_LINE = [
  "C#5 - - - - - - - - - - - - - - -", "D5 - - - - - - - - - - - E5 - F5 -", "F5 - - - - - - - F5 - - - - - - -", "E5 - - - - - - - - - - - - - - -",
  "D5 - - - - - - - - - - - C5 - B4 -", "A4 - - - - - - - A4 - - - - - - -", "A4 - - - - C5 - - - - B4 - - - - -", "A4 - - - - - - - - - - - - - - -",
  "C#5 - - - - - - - - - - - - - - -", "D5 - - - - - - - - - - - E5 - F5 -", "F5 - - - - - - - F5 - - - - - - -", "F5 - - - - - - - - - - - - - - -",
  "Eb5 - - - - - - - - - - - D5 - C5 -", "Bb4 - - - - - - - A4 - - - - - - -", "G#4 - - - - - - - G#4 - - - - - - -", "A4 - - - - - - - - - - - - - - -",
];
const STORM_BASS = ["A1", "A1", "A1", "A1", "D2", "D#2", "E2", "A1", "A1", "A1", "A1", "Bb1", "Bb1", "Bb1", "B1", "A1"];
/** The arpeggios (P1 … P3) in 4/4 sixteenths, then the run down and the E–D# into the final drop. */
const ARPS = [
  "A3 C4 E4 A4 C5 E5 A5 E5 C5 A4 E4 C4 A3 C4 E4 A4",
  "A4 C5 E5 A5 C6 E6 A6 E6 C6 A5 E5 C5 A4 C5 E5 A5",
  "F3 A3 C4 F4 A4 C5 F5 C5 A4 F4 C4 A3 F3 A3 C4 F4",
  "E3 G#3 B3 E4 G#4 B4 E5 B4 G#4 E4 B3 G#3 E3 G#3 B3 E4",
];
const ARPS_H: readonly (readonly [string, string])[] = [["Am", "Am"], ["Am", "Am"], ["F", "F"], ["E", "E"]];
const RUN = [
  "Bb5 A5 G#5 G5 F#5 F5 E5 D#5 D5 C#5 C5 B4 Bb4 A4 G#4 G4",
  "F#4 F4 E4 F4 F#4 G4 G#4 A4 Bb4 B4 C5 C#5 D5 D#5 E5 F5",
  "E5 D#5 E5 D#5 E5 D#5 E5 D#5 E5 D#5 E5 D#5 E5 D#5 E5 D#5",
  "E5 - - - . . . . . . . . . . . .",
];

/* ── Generated parts, a bar of 16 steps from a bar's two chords ── */

const v = (x: number) => `@${Math.max(1, Math.min(127, Math.round(x)))}`;
/** Rolling bass: off the beat, three sixteenths of each beat on the root (the kick takes the first). */
const rolling = ([a, b]: readonly [string, string], loud = 0) => {
  const r = (s: string) => nm(chord(s, 2)[0]);
  return [a, a, b, b].map((c) => `. ${r(c)}${v(96 + loud)} ${r(c)}${v(82 + loud)} ${r(c)}${v(88 + loud)}`).join(" ");
};
/** The plucked arpeggio: up and down the chord in sixteenths, octave 4 and 5 — under the lead, a register it leaves room in. */
const arpBar = ([a, b]: readonly [string, string], loud = 0) => [a, b].map((c) => {
  const n = chord(c, 3), up = [n[0], n[1], n[2], n[0] + 12, n[1] + 12, n[2] + 12, n[0] + 12, n[2]];
  return up.map((x, k) => `${nm(x)}${v((k % 4 === 0 ? 92 : 72) + loud)}`).join(" ");
}).join(" ");
/** Chords held a half bar each (pads), or struck on the dance's 3-3-2 (stabs). */
const padBar = ([a, b]: readonly [string, string], octave = 3, loud = 0) => [a, b].map((c) => `${chord(c, octave).slice(0, 3).map(nm).join("+")}${v(86 + loud)} - - - - - - -`).join(" ");
const stabBar = ([a, b]: readonly [string, string], loud = 0) => [a, b].map((c) => { const n = chord(c, 3).slice(0, 3).map(nm).join("+"); return `${n}${v(100 + loud)} - . ${n}${v(84 + loud)} - . ${n}${v(92 + loud)} -`; }).join(" ");
const subBar = ([a, b]: readonly [string, string]) => [a, b].map((c) => `${nm(chord(c, 1)[0])}@90 - - - - - - -`).join(" ");
const REST = ". . . . . . . . . . . . . . . .";

/* ── The dance kit (hits: C2 kick, D2 snare, D#2 clap, F#2 closed hat, A#2 open hat), and the crash (VSCO C#3) ── */
const KICKS = "C2@112 . . . C2@108 . . . C2@110 . . . C2@108 . . .";
const KICKS_HALF = "C2@105 . . . . . . . C2@100 . . . . . . .";
const CLAPS = ". . . . D#2@100 . . . . . . . D#2@104 . . .";
const OPEN = ". . A#2@88 . . . A#2@84 . . . A#2@88 . . . A#2@84 .";
const HATS = "F#2@70 F#2@40 . F#2@48 F#2@64 F#2@40 . F#2@46 F#2@70 F#2@40 . F#2@48 F#2@64 F#2@40 . F#2@52";
const FILL = "D2@70 D2@74 D2@78 D2@82 D2@86 D2@90 D2@94 D2@98 D2@102 D2@106 D2@110 D2@114 D2@118 D2@122 D2@124 D2@127";
/** A snare roll over four bars, quarters to sixteenths, louder bar by bar. */
const ROLL = [
  "D2@60 . . . D2@64 . . . D2@68 . . . D2@72 . . .",
  "D2@74 . D2@76 . D2@78 . D2@80 . D2@82 . D2@84 . D2@86 . D2@88 .",
  "D2@88 D2@90 D2@92 D2@94 D2@96 D2@98 D2@100 D2@102 D2@104 D2@106 D2@108 D2@110 D2@112 D2@114 D2@116 D2@118",
  ". . . . . . . . . . . . . . . .",
];

export interface RemixSection { readonly name: string; readonly from: number; readonly to: number }

export function remix() {
  const parts = Object.fromEntries(Object.keys(REMIX_ROLES).map((k) => [k, [] as string[]])) as Record<RemixPart, string[]>;
  const sections: RemixSection[] = [];
  let bars = 0;
  const add = (name: string, n: number, given: Partial<Record<RemixPart, readonly string[]>>) => {
    for (const k of Object.keys(REMIX_ROLES) as RemixPart[]) {
      const list = given[k] ?? Array.from({ length: n }, () => REST);
      if (list.length !== n) throw new Error(`${name}: ${k} has ${list.length} bars, not ${n}.`);
      parts[k].push(...list.map((b) => steps(b, k === "lead" ? 12 : 0)));
    }
    sections.push({ name, from: bars, to: bars + n });
    bars += n;
  };
  const each = (h: readonly (readonly [string, string])[], f: (c: readonly [string, string], k: number) => string) => h.map((c, k) => f(c, k));
  const bar1 = (n: number, f: (k: number) => string) => Array.from({ length: n }, (_, k) => f(k));
  const phraseCrash = (n: number, at: readonly number[]) => bar1(n, (k) => (at.includes(k) ? "C#3@115 . . . . . . . . . . . . . . ." : REST));

  // Drop 1: the theme on the lead (an octave up) and the piano (as written), the full groove; the middle part (bars
  // 8 … 10) with the stabs out; bar 15 a fill and a sweep down.
  add("drop 1", 16, {
    piano: DROP.map((b, k) => (k === 0 ? `f ${b}` : b)),
    lead: DROP.map((b, k) => (k === 0 ? `f ${b}` : b)),
    arp: each(DROP_H, (c, k) => (k === 15 ? REST : arpBar(c, k >= 8 && k < 11 ? -10 : 0))),
    stabs: each(DROP_H, (c, k) => (k >= 8 && k < 11 || k === 15 ? REST : stabBar(c))),
    pad: each(DROP_H, (c) => padBar(c)),
    bass: each(DROP_H, (c, k) => (k === 15 ? REST : rolling(c))),
    sub: each(DROP_H, (c) => subBar(c)),
    kick: bar1(16, (k) => (k === 15 ? KICKS_HALF : KICKS)), clap: bar1(16, (k) => (k === 15 ? REST : CLAPS)),
    openHats: bar1(16, (k) => (k === 15 ? REST : OPEN)), hats: bar1(16, (k) => (k < 8 ? REST : HATS)),
    snare: bar1(16, (k) => (k === 15 ? FILL : REST)),
    crash: phraseCrash(16, [0, 8, 11]),
    impacts: bar1(16, (k) => (k === 0 ? "C2@127 . . . . . . . . . . . . . . ." : REST)),
    risers: bar1(16, (k) => (k === 15 ? "E2@100 . . . . . . . . . . . . . . ." : REST)),
  });
  // Breakdown: the episode's tune on the piano, the left hand's chords, pads; no drums.
  add("breakdown 1", 4, {
    piano: EPISODE.map((b, k) => (k === 0 ? `mf ${b}` : b)),
    pianoLH: each(EPISODE_H, ([a, b]) => [a, b].map((c) => { const n = chord(c, 3); return `${nm(n[0] - 12)}@64 ${nm(n[0])}@52 ${nm(n[1])}@50 ${nm(n[2])}@52 ${nm(n[1])}@48 ${nm(n[2])}@50 ${nm(n[0] + 12)}@52 ${nm(n[2])}@48`; }).join(" ")),
    pad: each(EPISODE_H, (c) => padBar(c, 3, -8)), sub: each(EPISODE_H, (c) => subBar(c)),
    crash: ["C#3@80 . . . . . . . . . . . . . . .", REST, REST, REST],
  });
  // Build: the E–D# on the lead over E, a snare roll, the kick doubling up, a riser and a sweep; the last bar silent
  // but for the riser's top and a crash reversed (the suck-in) into the drop.
  const E: readonly [string, string] = ["E", "E"];
  add("build 1", 4, {
    lead: BUILD.map((b, k) => (k === 0 ? `mf ${b}` : k === 2 ? `f ${b}` : b)), piano: BUILD.map((b, k) => (k === 0 ? `mf ${b}` : k === 2 ? `f ${b}` : b)),
    arp: [arpBar(E, -14), arpBar(E, -8), arpBar(E, -2), REST], pad: [padBar(E, 3, -6), padBar(E, 3, -2), padBar(E, 3, 2), REST],
    strings: [REST, "E3+B3+E4@60 - - - - - - - - - - - - - - -", "E3+G#3+B3+E4@90 - - - - - - - - - - - - - - -", REST],
    bass: [rolling(E, -14), rolling(E, -8), REST, REST], sub: [subBar(E), subBar(E), subBar(E), REST],
    kick: [KICKS_HALF, KICKS, "C2@110 . C2@100 . C2@110 . C2@100 . C2@112 . C2@104 . C2@115 . C2@108 .", REST],
    snare: ROLL,
    risers: ["G2@100 . . . . . . . . . . . . . . .", REST, REST, "F2@110 . . . . . . . . . . . . . . ."],
  });
  // Drop 2, the storm, the biggest: the drumming A as a sixteenth bass, the diminished chords as stabs, its line on
  // the lead and the piano, timpani on its strong bars.
  const SH = STORM_H.map((c) => [c, c] as const);
  add("drop 2", 16, {
    lead: STORM_LINE.map((b, k) => (k === 0 ? `ff ${b}` : b)), piano: STORM_LINE.map((b, k) => (k === 0 ? `mf ${b}` : b)),
    leadLow: STORM_LINE.map((b, k) => (k === 8 ? `f ${b}` : k > 8 ? b : REST)),
    stabs: STORM_CHORDS.map((n) => `${n}@96 - . ${n}@80 - . ${n}@88 - ${n}@94 - . ${n}@80 - . ${n}@88 -`),
    pad: each(SH, (c) => padBar(c, 3, -6)),
    bass: STORM_BASS.map((r) => { const hi = nm(num(r) + 12); return Array.from({ length: 16 }, (_, k) => `${k % 2 ? hi : r}${v(k % 4 === 2 ? 96 : k % 4 === 0 ? 70 : 84)}`).join(" "); }),
    sub: STORM_BASS.map((r) => `${nm(num(r) - 12 + 12)}@95 - - - - - - - - - - - - - - -`),
    kick: bar1(16, () => KICKS), clap: bar1(16, () => CLAPS), openHats: bar1(16, () => OPEN), hats: bar1(16, () => HATS),
    snare: bar1(16, (k) => (k === 7 || k === 15 ? FILL : REST)),
    timpani: bar1(16, (k) => (k === 0 || k === 8 ? "A2@118 . . . . . . . . . . . . . . ." : k === 15 ? "E3@110 . . . . . . . A2@120 . . . . . . ." : REST)),
    crash: phraseCrash(16, [0, 4, 8, 12]),
    impacts: bar1(16, (k) => (k === 0 ? "C2@127 . . . . . . . . . . . . . . ." : k === 8 ? "C2@115 . . . . . . . . . . . . . . ." : REST)),
    risers: bar1(16, (k) => (k === 15 ? "E2@100 . . . . . . . . . . . . . . ." : REST)),
  });
  // Breakdown 2: the arpeggios on the piano over a pumping pad and a half-time kick.
  add("breakdown 2", 4, {
    piano: ARPS.map((b, k) => (k === 0 ? `mp ${b}` : b)),
    pad: each(ARPS_H, (c) => padBar(c, 3, -6)), sub: each(ARPS_H, (c) => subBar(c)),
    kick: bar1(4, () => KICKS_HALF), crash: ["C#3@70 . . . . . . . . . . . . . . .", REST, REST, REST],
  });
  // Build 2: the run down and up on the lead and the piano, then the E–D#; the roll, a riser, the suck-in.
  add("build 2", 4, {
    lead: RUN.map((b, k) => (k === 0 ? `mf ${b}` : k === 2 ? `f ${b}` : b)), piano: RUN.map((b, k) => (k === 0 ? `mf ${b}` : k === 2 ? `f ${b}` : b)),
    arp: [arpBar(E, -10), arpBar(E, -6), arpBar(E, -2), REST], pad: [padBar(["Am", "Am"], 3, -6), padBar(E, 3, -2), padBar(E, 3, 2), REST],
    strings: ["A3+C4+E4@50 - - - - - - - - - - - - - - -", "E3+B3+E4@70 - - - - - - - - - - - - - - -", "E3+G#3+B3+E4@95 - - - - - - - - - - - - - - -", REST],
    bass: [rolling(["Am", "Am"], -10), rolling(E, -6), REST, REST], sub: [subBar(["Am", "Am"]), subBar(E), subBar(E), REST],
    kick: [KICKS_HALF, KICKS, "C2@110 . C2@100 . C2@110 . C2@100 . C2@112 . C2@104 . C2@115 . C2@108 .", REST],
    snare: ROLL,
    risers: ["G2@100 . . . . . . . . . . . . . . .", REST, REST, "F2@110 . . . . . . . . . . . . . . ."],
  });
  // The final drop: the theme in full — the lead doubled an octave down from its middle part on — its last bar the
  // band's last hit.
  const FINAL = [...DROP.slice(0, 15), "A4@110 - - - . . . . . . . . . . . ."];
  add("drop 3", 16, {
    piano: FINAL.map((b, k) => (k === 0 ? `f ${b}` : b)), lead: FINAL.map((b, k) => (k === 0 ? `ff ${b}` : b)), leadLow: FINAL.map((b, k) => (k === 8 ? `f ${b}` : k > 8 ? b : REST)),
    arp: each(DROP_H, (c, k) => (k === 15 ? REST : arpBar(c, 2))),
    stabs: each(DROP_H, (c, k) => (k === 15 ? `${chord("Am", 3).slice(0, 3).map(nm).join("+")}@115 - - - . . . . . . . . . . . .` : stabBar(c, 4))),
    pad: each(DROP_H, (c, k) => (k === 15 ? REST : padBar(c))), strings: each(DROP_H, (c, k) => (k >= 8 && k < 15 ? padBar(c, 3, -10) : REST)),
    bass: each(DROP_H, (c, k) => (k === 15 ? "A1@115 - - - . . . . . . . . . . . ." : rolling(c, 4))),
    sub: each(DROP_H, (c, k) => (k === 15 ? "A1@100 - - - - - - - . . . . . . . ." : subBar(c))),
    kick: bar1(16, (k) => (k === 15 ? "C2@120 . . . . . . . . . . . . . . ." : KICKS)), clap: bar1(16, (k) => (k === 15 ? REST : CLAPS)),
    openHats: bar1(16, (k) => (k === 15 ? REST : OPEN)), hats: bar1(16, (k) => (k === 15 ? REST : HATS)),
    snare: bar1(16, (k) => (k === 7 || k === 14 ? FILL : REST)),
    timpani: bar1(16, (k) => (k === 15 ? "A2@120 . . . . . . . . . . . . . . ." : REST)),
    crash: phraseCrash(16, [0, 8, 11]),
    impacts: bar1(16, (k) => (k === 0 || k === 15 ? "C2@125 . . . . . . . . . . . . . . ." : REST)),
  });
  return { parts, sections, bars, bpm: 128 };
}

/* ── The piano alone, before and after (3/8) ── */

/** The intro: the pickup and bars 1 … 7, then the A held (no second pickup: the drop's first bar is the turn). */
export const INTRO_RIGHT = [...A_RIGHT.slice(0, 8), "A4/4.@+10"];
export const INTRO_LEFT = [...A_LEFT.slice(0, 8), "ped A2/16@-10 E3@-14 A3@-14 r r/8"];
export const INTRO_TEMPO: readonly (readonly [number, number])[] = [...A_TEMPO.filter(([x]) => x < 8), [8, 100], [8.67, 92]];
/** The ending: bars 19 … 21 and the last A, held in the pedal, slowing. */
export const OUTRO_RIGHT = ["mp " + A_RIGHT[19], A_RIGHT[20], "> " + A_RIGHT[21].replace(/^> /, ""), "ppp A4/4.@+8"];
export const OUTRO_LEFT = ["p " + A_LEFT[19], A_LEFT[20], A_LEFT[21].replace(/^> /, ""), "ppp ped A1+A2/4. | r/4. | r/4. *"];
export const OUTRO_TEMPO: readonly (readonly [number, number])[] = [[1, 120], [2, 112], [3, 98], [3.7, 80], [4, 70]];
