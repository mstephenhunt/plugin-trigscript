// Für Elise as a cinematic hybrid (asked 2026-11-09): piano, orchestra, big percussion and synths, a trailer score's
// shape. The piano's notes are the score's (probes/lib/fur-elise-score.ts, ours from the public-domain score); every
// other part is our arrangement, written here bar by bar from the harmony of each bar, in the notation `music.perform`
// reads. 3/8 throughout, felt as 6/8 once the band is in (a pulse every three eighths, patterns over two bars).
//
// The form, by bar of the whole:
//   intro       0 … 8     the theme's first phrase on the piano alone, free in time; a low drone creeping in; a riser
//   band        9 … 37    the band in on bar 1's downbeat at 144 eighths a minute: the theme, its repeat, the middle part
//   lift        38 … 53   the F major episode as a breath, its thirty-seconds over pulses, the E–D# turned into a build
//   storm       54 … 71   the drumming A as a taiko pulse, the storm with everything: the climax
//   breakdown   72 … 76   the arpeggios and the run over a pumping pad, a riser
//   final       77 … 102  the theme big, its repeat, the middle part, to bar 18
//   ending      103 … 106 the band gone: bars 19 … 21 and the last A on the piano alone, slowing, held in the pedal
import {
  A_RIGHT, A_LEFT, A_TEMPO, B_RIGHT, B_LEFT, C_RIGHT, C_LEFT, P_RIGHT, P_LEFT, C_VIOLINS, C_VIOLAS, C_HORNS, C_TROMBONES, C_TUBA, C_TIMPANI, sixteenths,
} from "./fur-elise-score";

/** What a part is to the picture: the timeline gives each part one. */
export type Role = "lead" | "accomp" | "strings" | "brass" | "bass" | "synth" | "pad" | "drum-low" | "drum-high" | "cymbal" | "impact" | "riser";

/** The parts, in the order the timeline numbers them, with their roles. */
export const PART_ROLES = {
  right: "lead", left: "accomp",
  violins: "strings", violas: "strings", ostinato: "strings", celli: "strings", basses: "bass",
  horns: "brass", trombones: "brass", tuba: "brass", braam: "brass",
  sub: "bass", drone: "pad", pad: "pad", pulse: "synth", supersaw: "synth",
  taiko: "drum-low", kick: "drum-low", timpani: "drum-low", toms: "drum-high", snare: "drum-high",
  cymbals: "cymbal", impacts: "impact", risers: "riser",
} as const satisfies Record<string, Role>;
export type PartName = keyof typeof PART_ROLES;

/* ── Harmony, a chord a bar ── */

const PC: Readonly<Record<string, number>> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, Ab: 8, A: 9, Bb: 10, B: 11 };
const KINDS: Readonly<Record<string, readonly number[]>> = { "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], dim: [0, 3, 6, 9] };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const nm = (n: number) => NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
/** A chord's notes from its root in `octave`: root, third, fifth (and seventh). */
function chord(sym: string, octave: number): number[] {
  const m = /^([A-G][#b]?)(m|7|dim)?$/.exec(sym);
  if (!m) throw new Error(`no chord ${sym}`);
  const root = 12 * (octave + 1) + PC[m[1]];
  return KINDS[m[2] ?? ""].map((i) => root + i);
}

/** The harmony of the theme's bars (by the score's numbers; 8 is either ending). */
const THEME_H: Readonly<Record<number, string>> = {
  0: "E", 1: "E", 2: "Am", 3: "E", 4: "Am", 5: "E", 6: "Am", 7: "E", 8: "Am", 9: "C", 10: "G", 11: "Am", 12: "E", 13: "E", 14: "E",
  15: "E", 16: "Am", 17: "E", 18: "Am", 19: "E", 20: "Am", 21: "E", 22: "Am",
};
const B_H = ["Am", "F", "Bb", "C7", "F", "F", "Am", "G7", "C", "G", "C", "G", "E", "E", "E", "E"];
const STORM_H = ["A", "A", "Dm", "E", "Am", "Dm", "D#dim", "E", "Am", "A", "Dm", "Dm", "Bb", "Eb", "Bb", "E", "Am", "E"];
const P_H = ["Am", "Am", "Am", "E", "E"];

/* ── Generated parts: a bar's text from its chord ── */

/** Spiccato ostinato, sixteenths: root, root, fifth | root, fifth, octave — accents on the pulses. */
const ostinatoBar = (sym: string, octave: number, v = 0) => {
  const [r, , f] = chord(sym, octave);
  return `${nm(r)}/16@${100 + v} ${nm(r)}@${70 + v} ${nm(f)}@${78 + v} ${nm(r)}@${96 + v} ${nm(f)}@${72 + v} ${nm(r + 12)}@${80 + v}`;
};
/** The bass's eighths on the root, the first strong. */
const bassBar = (sym: string, octave: number, v = 0) => { const r = nm(chord(sym, octave)[0]); return `${r}/8@${105 + v} ${r}@${80 + v} ${r}@${88 + v}`; };
/** A chord held the bar (pads, strings, horns). */
const heldBar = (sym: string, octave: number, v = 0, top = 3) => `${chord(sym, octave).slice(0, top).map(nm).join("+")}/4.@${90 + v}`;
/** The sub: the root, an octave under the bass, the bar. */
const subBar = (sym: string, v = 0) => `${nm(chord(sym, 1)[0])}/4.@${95 + v}`;
/** Synth pulses: the chord's notes going up in sixteenths. */
const pulseBar = (sym: string, octave: number, v = 0) => {
  const c = chord(sym, octave), n = [c[0], c[1], c[2], c[0] + 12, c[2], c[1]];
  return n.map((x, k) => `${nm(x)}${k === 0 ? "/16" : ""}@${(k % 3 === 0 ? 96 : 76) + v}`).join(" ");
};
/** A braam: root and fifth low, root an octave up, held `bars` bars. */
const braam = (sym: string, bars = 1, v = 0) => {
  const [r, , f] = chord(sym, 1), notes = [r, f, r + 12].map(nm).join("+");
  return bars === 1 ? [`${notes}/4.@${110 + v}`] : [`${notes}/4.@${110 + v}~`, ...Array.from({ length: bars - 1 }, (_, k) => `${notes}/4.${k < bars - 2 ? "~" : ""}`)];
};

const rest = "r/4.";
const rests = (n: number) => Array.from({ length: n }, () => rest);

/* ── The percussion, a bar of 3/8 at a time (kit keys: probes/lib/vsco-percussion.kit.json) ── */
// Kit: C2 gran cassa, C#2 bass drum, D2 bass drum muted, E2 low tenor drum, F#2 high tenor drum, G2 snare, G#2 snare
// roll, C#3 crash, D#3 suspended cymbal, G3 gong. Hits (synth, music.hits): C2 impact, D2 sub drop, E2 kick, F2 a crash
// reversed (two bars), G2 riser (four bars), A2 riser (three bars), B2 riser (intro).
const TAIKO = {
  light: ["C2/8@95 r/16 D2@60 r/8", "D2/16@80 r r D2@70 r/8"],
  groove: ["C2/8@110 r/16 D2@75 E2/8@85", "D2/16@95 r E2@70 E2@60 D2/8@100"],
  full: ["C2/16@122 r D2@85 E2@95 C2@112 r", "D2/16@105 E2@75 F#2@80 C2@118 E2@85 F#2@92"],
  storm: ["C2/16@124 E2@75 E2@80 D2@110 E2@75 E2@85", "C#2/16@118 E2@75 E2@82 D2@110 E2@78 F#2@95"],
  fill: ["E2/16@80 E2@86 F#2@92 E2@98 F#2@104 F#2@110", "E2/16@105 F#2@110 E2@114 F#2@118 E2@122 F#2@127"],
  half: ["C2/8@90 r r", rest],
};
/** Bars of a pattern of two bars, `n` bars long. */
const pattern = (two: readonly string[], n: number) => Array.from({ length: n }, (_, k) => two[k % 2]);
/** The synth kick on each pulse (twice a bar of 6/8: on the first and fourth sixteenths of 3/8, the first only). */
const kicks = (n: number, v = 0) => Array.from({ length: n }, () => `E2/4.@${100 + v}`);

/* ── The whole ── */

export interface CinematicSection { readonly name: string; readonly from: number; readonly to: number }

/** Strip a bar's dynamics and hairpins; `mark` before the first. */
function marked(bars: readonly string[], mark: string, keepPedal = true): string[] {
  return bars.map((b, i) => {
    const words = b.split(/\s+/).filter((w) => w && !/^(ppp|pp|p|mp|mf|f|ff|fff|<|>)$/.test(w) && (keepPedal || !/^(ped|\*)$/.test(w)));
    return (i === 0 ? `${mark} ` : "") + words.join(" ");
  });
}
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function cinematic() {
  const parts: Record<PartName, string[]> = Object.fromEntries(Object.keys(PART_ROLES).map((k) => [k, [] as string[]])) as Record<PartName, string[]>;
  const sections: CinematicSection[] = [];
  let bars = 0;
  /** A section: `n` bars, each part given its bars (or rests). The pickup bar is 1/8 long. */
  const add = (name: string, n: number, given: Partial<Record<PartName, readonly string[]>>, pickup = false) => {
    for (const k of Object.keys(PART_ROLES) as PartName[]) {
      const list = given[k] ?? (pickup ? ["r/8", ...rests(n - 1)] : rests(n));
      if (list.length !== n) throw new Error(`${name}: ${k} has ${list.length} bars, not ${n}.`);
      parts[k].push(...list);
    }
    sections.push({ name, from: bars, to: bars + n });
    bars += n;
  };
  const harmony = (list: readonly (number | "8a" | "8b")[]) => list.map((k) => THEME_H[typeof k === "number" ? k : 8]);
  const R = (k: number | "8a" | "8b") => (k === "8a" ? "A4/4 E5/16@+2 D#5@-3" : A_RIGHT[k === "8b" ? 8 : k]);
  const L = (k: number | "8a" | "8b") => (k === "8a" ? "ped A2/16 E3 A3 r * r/8" : A_LEFT[k === "8b" ? 8 : k]);

  // Intro: pickup, 1 … 7, and the first ending (its A held, the pickup at the band's tempo). A drone: A1 and A2 from
  // bar 3, a pad on the harmony from bar 5, both creeping up; a riser into the band and a crash reversed before it.
  const introBars: (number | "8a")[] = [0, ...range(1, 7), "8a"];
  add("intro", 9, {
    right: introBars.map(R), left: introBars.map(L),
    sub: ["r/8", rest, rest, "pp A1/4.@40~", "A1/4.~", "A1/4.~", "A1/4.~", "A1/4.~", "A1/4.@60"],
    drone: ["r/8", rest, rest, rest, rest, "pp < E3+B3/4.", "A2+E3+C4/4.", "E3+G#3+B3/4.", "mp A2+E3+C4/4."],
    risers: ["r/8", rest, rest, rest, rest, rest, "B2/4.@90", rest, rest],
  }, true);

  // The band: the theme (1 … 7 and the first ending; 1 … 7 and the second), then the middle part 9 … 21. Its first time
  // lighter (ostinato, low drums, sub), its repeat full (strings held, kick, pad pumping); the middle part (9 … 14)
  // drawn back, the theme's return (15 … 21) full again with braams.
  const themeA: (number | "8a" | "8b")[] = [...range(1, 7), "8a"], themeB: (number | "8a" | "8b")[] = [...range(1, 7), "8b"], middle = range(9, 21);
  const band = [...themeA, ...themeB, ...middle], bh = harmony(band);
  const nB = band.length; // 29
  add("band", nB, {
    right: marked(band.map(R), "f"), left: marked(band.map(L), "mf"),
    ostinato: bh.map((h, k) => ostinatoBar(h, 3, k < 8 ? -10 : k >= 16 && k < 22 ? -14 : 0)),
    celli: bh.map((h, k) => (k < 8 ? rest : ostinatoBar(h, 2, k >= 16 && k < 22 ? -16 : -4))),
    basses: bh.map((h, k) => (k < 8 || (k >= 16 && k < 22) ? rest : bassBar(h, 1, -6))),
    sub: bh.map((h, k) => subBar(h, k < 8 ? -20 : -6)),
    violins: bh.map((h, k) => (k < 8 || (k >= 16 && k < 22) ? rest : heldBar(h, 4, -14))),
    pad: bh.map((h, k) => (k >= 8 ? heldBar(h, 3, k >= 16 && k < 22 ? -24 : -12) : rest)),
    horns: bh.map((h, k) => (k >= 22 ? heldBar(h, 3, -14, 2) : rest)),
    braam: bh.map((h, k) => (k === 0 || k === 8 || k === 22 ? braam(h)[0] : rest)),
    trombones: bh.map((h, k) => (k === 0 || k === 8 || k === 22 ? braam(h, 1, -10)[0] : rest)),
    tuba: bh.map((h, k) => (k === 0 || k === 8 || k === 22 ? `${nm(chord(h, 1)[0])}/4.@100` : rest)),
    taiko: [...pattern(TAIKO.light, 8), ...pattern(TAIKO.groove, 8), ...pattern(TAIKO.half, 6), ...pattern(TAIKO.full, 6), TAIKO.fill[1]],
    kick: bh.map((_, k) => (k >= 8 && !(k >= 16 && k < 22) ? `E2/4.@${k >= 22 ? 108 : 96}` : rest)),
    toms: bh.map((_, k) => (k === 15 || k === 27 ? TAIKO.fill[0] : rest)),
    cymbals: bh.map((_, k) => (k === 0 || k === 8 || k === 22 ? "C#3/4.@105" : k === 16 ? "D#3/4.@70" : rest)),
    impacts: bh.map((_, k) => (k === 0 ? "C2/4.@115" : k === 22 ? "C2/4.@100" : rest)),
    risers: bh.map((_, k) => (k === 6 || k === 20 ? "F2/4.@85" : rest)),
  });

  // The lift: the episode as a breath — piano and held strings, the pulses joining at the thirty-seconds (B8), the
  // E–D# (B12 … B15) turned into the build: a riser over four bars, the toms and the snare roll growing.
  const liftH = B_H;
  add("lift", 16, {
    right: marked(B_RIGHT, "mf"), left: marked(B_LEFT, "mp"),
    violins: liftH.map((h, k) => (k < 12 ? heldBar(h, 4, -22) : rest)),
    violas: liftH.map((h, k) => (k < 12 ? heldBar(h, 3, -24) : rest)),
    pad: liftH.map((h, k) => heldBar(h, 3, k < 8 ? -28 : -18)),
    sub: liftH.map((h, k) => subBar(h, k < 8 ? -30 : -14)),
    pulse: liftH.map((h, k) => (k >= 8 ? pulseBar(h, 4, k >= 12 ? -4 + (k - 12) * 4 : -12) : rest)),
    ostinato: liftH.map((h, k) => (k >= 12 ? ostinatoBar(h, 3, -12 + (k - 12) * 5) : rest)),
    taiko: liftH.map((_, k) => (k < 8 ? (k % 4 === 0 ? "C2/4.@70" : rest) : k < 12 ? TAIKO.half[k % 2] : TAIKO.groove[k % 2])),
    toms: liftH.map((_, k) => (k === 14 ? TAIKO.fill[0] : k === 15 ? TAIKO.fill[1] : rest)),
    snare: liftH.map((_, k) => (k >= 13 ? `G#2/4.@${70 + (k - 13) * 20}` : rest)),
    cymbals: liftH.map((_, k) => (k === 0 ? "D#3/4.@60" : k === 8 ? "D#3/4.@80" : rest)),
    risers: liftH.map((_, k) => (k === 12 ? "G2/4.@100" : rest)),
  });

  // The storm: the bar of drumming A as the taiko pulse alone with the piano, then everything — the probe's orchestra,
  // braams on the strong bars, the supersaw doubling the right hand's chords, the pulses, the pad pumping, impacts on
  // C1, C9 and the last chord, the gong on C16.
  const sh = STORM_H, strong = new Set([1, 5, 9, 12, 16]);
  add("storm", 18, {
    right: ["A4/8@-4 r r", ...C_RIGHT], left: [`f ${sixteenths("A2")}`, ...C_LEFT.map((b, k) => (k === 0 ? b.replace(/^f /, "ff ") : b))],
    violins: [rest, ...C_VIOLINS], violas: [rest, ...C_VIOLAS], horns: [rest, ...C_HORNS], trombones: [rest, ...C_TROMBONES], tuba: [rest, ...C_TUBA], timpani: [rest, ...C_TIMPANI],
    ostinato: sh.map((h) => ostinatoBar(h, 3, 4)), celli: sh.map((h, k) => (k === 0 ? rest : ostinatoBar(h, 2, 2))), basses: sh.map((h, k) => (k === 0 ? rest : bassBar(h, 1, 4))),
    sub: sh.map((h) => subBar(h, 0)),
    pad: sh.map((h, k) => (k === 0 ? rest : heldBar(h, 3, -10))),
    pulse: sh.map((h, k) => (k === 0 ? rest : pulseBar(h, 5, -8))),
    supersaw: sh.map((h, k) => (k === 0 || k === 17 ? rest : heldBar(h, 4, -4))),
    braam: sh.map((h, k) => (strong.has(k) ? braam(h, 1, 6)[0] : rest)),
    taiko: sh.map((_, k) => (k === 17 ? "C2/8@125 r r" : TAIKO.storm[k % 2])),
    kick: sh.map((_, k) => (k === 0 || k === 17 ? rest : "E2/4.@110")),
    toms: sh.map((_, k) => (k === 8 || k === 15 ? TAIKO.fill[1] : rest)),
    cymbals: sh.map((_, k) => (k === 1 || k === 9 ? "C#3/4.@120" : k === 16 ? "G3/4.@120" : k === 5 || k === 12 ? "C#3/4.@100" : rest)),
    impacts: sh.map((_, k) => (k === 1 || k === 9 ? "C2/4.@125" : k === 16 ? "C2/4.@127" : k === 17 ? "D2/4.@110" : rest)),
    risers: sh.map((_, k) => (k === 7 ? "F2/4.@90" : rest)),
  });

  // The breakdown: the arpeggios and the run over the pad, pumping, and a heartbeat; a riser over its last three bars.
  add("breakdown", 5, {
    right: marked(P_RIGHT, "mp"), left: marked(P_LEFT, "mp"),
    pad: P_H.map((h) => heldBar(h, 3, -10)), sub: P_H.map((h) => subBar(h, -16)),
    taiko: ["C2/4.@80", rest, "C2/4.@85", rest, "D2/16@90 D2@95 D2@100 D2@105 D2@112 D2@120"],
    risers: [rest, rest, "A2/4.@100", rest, rest],
  });

  // The final statement, big: everything in from bar 1, the middle part (9 … 14) full but its brass out, its return to
  // bar 18. Bar 18's chord the band's last.
  const fin: (number | "8a" | "8b")[] = [...themeA, ...themeB, ...range(9, 18)], fh = harmony(fin), nF = fin.length; // 26
  const bigBar = (k: number) => k === 0 || k === 8 || k === 16 || k === 22;
  add("final", nF, {
    right: marked(fin.map(R), "ff"), left: marked(fin.map(L), "f"),
    ostinato: fh.map((h) => ostinatoBar(h, 3, 2)), celli: fh.map((h) => ostinatoBar(h, 2, 0)), basses: fh.map((h) => bassBar(h, 1, 0)),
    violins: fh.map((h) => heldBar(h, 4, -8)), violas: fh.map((h) => heldBar(h, 3, -14)),
    horns: fh.map((h, k) => (k >= 16 && k < 22 ? rest : heldBar(h, 3, -6, 2))),
    sub: fh.map((h) => subBar(h, -2)), pad: fh.map((h) => heldBar(h, 3, -10)), pulse: fh.map((h, k) => (k >= 8 ? pulseBar(h, 5, -10) : rest)),
    supersaw: fh.map((h, k) => (k >= 22 ? heldBar(h, 4, -6) : rest)),
    braam: fh.map((h, k) => (bigBar(k) ? braam(h, 1, 4)[0] : rest)),
    trombones: fh.map((h, k) => (bigBar(k) ? braam(h, 1, -6)[0] : rest)),
    tuba: fh.map((h, k) => (bigBar(k) ? `${nm(chord(h, 1)[0])}/4.@105` : rest)),
    taiko: [...pattern(TAIKO.full, 8), ...pattern(TAIKO.full, 8), ...pattern(TAIKO.groove, 6), ...pattern(TAIKO.full, 3), "C2/8@127 r r"],
    kick: fh.map((_, k) => (k === nF - 1 ? "E2/8@115 r r" : "E2/4.@108")),
    toms: fh.map((_, k) => (k === 7 || k === 15 || k === 21 ? TAIKO.fill[1] : rest)),
    timpani: fh.map((h, k) => (bigBar(k) || k === nF - 1 ? `${h.startsWith("A") ? "A2" : "E3"}/4.@115` : rest)),
    cymbals: fh.map((_, k) => (bigBar(k) ? "C#3/4.@118" : k === nF - 1 ? "G3/4.@110" : rest)),
    impacts: fh.map((_, k) => (k === 0 ? "C2/4.@127" : k === 16 || k === 22 ? "C2/4.@112" : k === nF - 1 ? "C2/4.@120" : rest)),
    risers: fh.map((_, k) => (k === 6 || k === 14 || k === 20 ? "F2/4.@90" : rest)),
  });

  // The ending: the band gone, bars 19 … 21 and the last A on the piano alone, slowing; a low drone under the first two.
  add("ending", 4, {
    right: marked([A_RIGHT[19], A_RIGHT[20], A_RIGHT[21], "A4/4.@+8"], "mp").map((b, k) => (k === 3 ? `ppp ${b}` : k === 2 ? `> ${b}` : b)),
    left: marked([A_LEFT[19], A_LEFT[20], A_LEFT[21], "ped A1+A2/4. | r/4. | r/4. *"], "p").map((b, k) => (k === 3 ? `ppp ${b}` : b)),
    sub: ["pp A1/4.@50~", "A1/4.", rest, rest],
  });

  // The tempo: the intro free (the probe's shape for bars 1 … 8), the pickup into the band at 144, the band steady, the
  // breakdown a little slower, accelerating back into the final; the ending free again.
  const intro = A_TEMPO.filter(([x]) => x < 8.6);
  const tempo: [number, number][] = [
    ...intro.map(([x, v]) => [x, v] as [number, number]), [8.5, 100], [8.67, 144],
    [71, 144], [71.9, 120], [72, 132], [75, 132], [76.9, 144], [77, 144],
    [103, 126], [104, 116], [105, 100], [105.7, 82], [106, 70],
  ];
  const holds: [number, number][] = [[72, 0.5], [103, 0.45], [106, 0.3]];
  return { parts, sections, tempo, holds, bars };
}
