// Für Elise, the trance remix, rendered when the script is built (probes/lib/fur-elise-remix-score.ts is the notes).
// Importing this starts nothing: probes/fur-elise-remix.ts plays it; a showcase program imports `whole`.
//
// Three performances end to end: the piano's intro (3/8, free in time), the remix (4/4, 128 a minute), the piano's
// ending (3/8). The melody first, by construction and by measurement (scripts/lead-check.mts): each remix section
// mixed as three stems — the melody (the lead synth, its lower octave, the piano), the harmony under it (pads, stabs,
// arpeggios, strings, the piano's left hand) ducked by the melody's own envelope and dipped where the melody sits, and
// the rhythm (bass, sub, drums, effects) — then through a bus, each section to its loudness, the whole limited once.
//
// Piano: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0). Strings, crash, timpani: VSCO 2 Community Edition by
// Versilian Studios (CC0). Everything else made in the script.
import { music, type Instrument } from "trigscript/music";
import piano from "../salamander-grand.samples";
import violasSet from "../vsco-violas.samples";
import timpaniSet from "../vsco-timpani.samples";
import percussionSet from "../vsco-percussion.samples";
import { remix, REMIX_ROLES, MELODY, HARMONY, EFFECTS, INTRO_RIGHT, INTRO_LEFT, INTRO_TEMPO, OUTRO_RIGHT, OUTRO_LEFT, OUTRO_TEMPO, type RemixPart } from "./fur-elise-remix-score";

const BPM = 128, BEAT = 60 / BPM, BAR = 4 * BEAT;
const ROOM = { decay: 0.78, damping: 0.5, predelay: 0.02 };
const HALL = { decay: 0.84, damping: 0.5, predelay: 0.032 };
const MASTER = (c: Clip) => c.filter("highpass", 28);
const BUS = (c: Clip) => MASTER(c).compress({ threshold: -16, ratio: 2, attack: 0.02, release: 0.2, knee: 6 });
const QUALITY = 6;
/**
 * How far the harmony goes down under the melody, and the effects; where the melody's range is dipped in both. Set by
 * scripts/lead-check.mts until the melody stands 6 dB over the rest in its range in every bar it plays.
 */
const DUCK = { depth: 6, threshold: -30, attack: 0.006, release: 0.2 };
const DUCK_FX = { depth: 6, threshold: -30, attack: 0.006, release: 0.2 };
const DIP = (c: Clip) => c.filter("peak", 1800, { gain: -5, q: 0.5 }).filter("peak", 3500, { gain: -3, q: 0.8 });
/** Each section's loudness: the drops loud, the storm's the loudest, the piano's ends quiet. */
const TARGET: Readonly<Record<string, number>> = {
  intro: -20, "drop 1": -10.8, "breakdown 1": -15, "build 1": -13, "drop 2": -10.4, "breakdown 2": -15, "build 2": -13, "drop 3": -10.5, ending: -20,
};

export const arrangement = remix();
const grand = music.sampled(piano, { resonance: 0.07 });
const kit = music.drums({ volume: 0.9 });
const dance = music.hits({ C2: kit.hits.k, D2: kit.hits.s, "D#2": kit.hits.c, "F#2": kit.hits.h, "A#2": kit.hits.o });
const crashBack = (seconds: number) => (percussionSet.zones.find((z) => z.key === 49 && z.vhi === 127) ?? percussionSet.zones[0]).clip.trim(0, seconds).reverse().fade(Math.min(0.5, seconds / 2), 0.004);
const fx = music.hits({
  C2: music.impact({ seconds: 2.5, volume: 0.9 }).mix(tone([[0, 70], [1.4, 30]], 1.8, { volume: 0.8, rate: 44100 }).envelope([0, 0], [0.01, 1], [1.8, 0])),
  // (The sweeps and the crash reversed above the melody's range: they are air, not notes.)
  E2: music.sweep(BAR, { down: true, volume: 0.3 }).filter("highpass", 3500), F2: crashBack(BAR).filter("highpass", 4500),
  G2: music.riser(3 * BAR, { volume: 0.4 }).filter("highpass", 900).mix(music.sweep(3 * BAR, { volume: 0.25 }).filter("highpass", 2500)),
});

/** How each part of the remix is heard. Volumes balanced by measuring (see the plan's S7 remix section). */
const PUMP = music.pump(BEAT, 0.6, 0.6);
const heard: Record<RemixPart, { instrument: Instrument; pan?: number; volume?: number; reverb?: number; fx?: (c: Clip) => Clip; velocity?: number }> = {
  piano: { instrument: grand, volume: 1.2, reverb: 0.2 },
  pianoLH: { instrument: grand },
  lead: { instrument: music.presets.trance(), volume: 1.0, reverb: 0.25, fx: (c) => c.delay(BEAT * 0.75, { feedback: 0.3, mix: 0.18, pingPong: true, tone: 4500 }) },
  leadLow: { instrument: music.presets.lead({ volume: 0.12 }), volume: 0.8, reverb: 0.2 },
  arp: { instrument: music.presets.arp(), pan: 0.25, volume: 0.8, reverb: 0.2, fx: (c) => PUMP(c.delay(BEAT * 0.75, { feedback: 0.25, mix: 0.2, pingPong: true })) },
  stabs: { instrument: music.presets.stab(), volume: 0.9, reverb: 0.25, fx: PUMP },
  pad: { instrument: music.presets.pad({ volume: 0.07 }), reverb: 0.4, fx: PUMP },
  strings: { instrument: music.sampled(violasSet), volume: 1.4, reverb: 0.4 },
  bass: { instrument: music.presets.bass({ volume: 0.3 }), volume: 0.9, fx: (c) => PUMP(c.filter("lowpass", 700)) },
  sub: { instrument: music.presets.sub(), volume: 0.35, fx: PUMP },
  kick: { instrument: dance, volume: 0.7 },
  timpani: { instrument: music.sampled(timpaniSet), volume: 0.8, reverb: 0.4 },
  clap: { instrument: dance, volume: 0.55, reverb: 0.25 },
  hats: { instrument: dance, pan: 0.2, volume: 0.35 },
  snare: { instrument: dance, volume: 0.55, reverb: 0.2 },
  openHats: { instrument: dance, pan: -0.15, volume: 0.4 },
  crash: { instrument: music.sampled(percussionSet, { releases: false }), volume: 0.55, reverb: 0.3 },
  impacts: { instrument: fx, volume: 0.42, reverb: 0.3 },
  risers: { instrument: fx, volume: 0.7, reverb: 0.3 },
};
const parts: Record<string, object> = {};
for (const k of Object.keys(REMIX_ROLES) as RemixPart[]) parts[k] = { ...heard[k], notes: arrangement.parts[k] };
/** The remix as played, from its first drop's downbeat. */
export const take = music.perform({ meter: "4/4", bpm: BPM, humanize: { time: 0.002, velocity: 2, seed: 3 } }, parts as never);

/** The piano's intro, played once to learn its free time, then with its sweep and suck-in made to end on the drop. */
const introOf = (sweepSeconds: number, suck: number) => music.perform({ meter: "3/8", bpm: 120, pickup: "1/8", tempo: INTRO_TEMPO, humanize: { time: 0.004, velocity: 3, seed: 7 } }, {
  piano: { instrument: grand, notes: INTRO_RIGHT, lead: 0.008, reverb: 0.24 },
  pianoLH: { instrument: grand, notes: INTRO_LEFT, velocity: 0.82 },
  pad: { instrument: music.presets.pad({ volume: 0.035 }), reverb: 0.5, notes: ["r/8", "r/4.", "r/4.", "r/4.", "r/4.", "pp < A2+E3/4.~", "A2+E3/4.", "r/4.", "pp E3+G#3+B3/4."] },
  risers: { instrument: music.hits({ C2: music.sweep(sweepSeconds, { volume: 0.32 }).filter("highpass", 5000), D2: crashBack(suck).filter("highpass", 5500) }), volume: 0.8, notes: ["r/8", "r/4.", "r/4.", "r/4.", "r/4.", "r/4.", "C2/4.", "r/4.", "D2/4."] },
});
const rehearsal = introOf(4, 1);
export const intro = introOf(rehearsal.bars[9] - rehearsal.bars[6], rehearsal.bars[9] - rehearsal.bars[8]);
export const outro = music.perform({ meter: "3/8", bpm: 120, tempo: OUTRO_TEMPO, humanize: { time: 0.004, velocity: 3, seed: 9 } }, {
  piano: { instrument: grand, notes: OUTRO_RIGHT, lead: 0.008, reverb: 0.24 },
  pianoLH: { instrument: grand, notes: OUTRO_LEFT, velocity: 0.92 },
});

/** Where each performance begins in the whole: the drop on the intro's last bar line; the ending on the remix's. */
export const DROP_AT = intro.bars[9];
/** (A breath before the ending: the last hit's tail under way before the piano comes back alone.) */
export const OUTRO_AT = DROP_AT + take.bars[arrangement.bars] + 1.2;
/** The sections, in the whole: name, kind, where in seconds and frames, and the bar numbers of the whole they span. */
export const sections = [
  { name: "intro", kind: "intro", at: 0, from: 0, to: 9 },
  ...arrangement.sections.map((s) => ({ name: s.name, kind: s.name.split(" ")[0], at: DROP_AT + take.bars[s.from], from: 9 + s.from, to: 9 + s.to })),
  { name: "ending", kind: "ending", at: OUTRO_AT, from: 9 + arrangement.bars, to: 9 + arrangement.bars + 4 },
].map((s) => ({ ...s, frame: Math.round(s.at / 0.042) }));

/* ── Mixed: the melody, the harmony under it, the rhythm ── */

const ALL = Object.keys(REMIX_ROLES) as RemixPart[];
const RHYTHM = ALL.filter((k) => !MELODY.includes(k) && !HARMONY.includes(k) && !EFFECTS.includes(k));
type Stems = { melody: Clip; harmony: Clip; effects: Clip; rhythm: Clip };
type Raw = { melody: Clip; harmony: Clip; effects: Clip; rhythm: Clip; at: number };
function rawOf(p: typeof take, room: typeof ROOM, has: readonly string[], at: number): Raw {
  const pick = (list: readonly RemixPart[]) => list.filter((k) => has.includes(k));
  return {
    melody: music.render(p, { parts: pick(MELODY), reverb: room, limit: false }),
    harmony: DIP(music.render(p, { parts: pick(HARMONY), reverb: room, limit: false })),
    effects: DIP(music.render(p, { parts: pick(EFFECTS), reverb: room, limit: false })),
    rhythm: music.render(p, { parts: pick(RHYTHM), reverb: room, limit: false }), at,
  };
}
const raws: Raw[] = [
  rawOf(intro, HALL, ["piano", "pianoLH", "pad", "risers"], 0),
  ...arrangement.sections.map((s, k) => rawOf(music.excerpt(take, s.from, k + 1 < arrangement.sections.length ? s.to : undefined), ROOM, ALL, sections[k + 1].at)),
  rawOf(outro, HALL, ["piano", "pianoLH"], OUTRO_AT),
];
// The harmony and the effects ducked by the whole melody, not only their own section's: a section's tail rings under
// the next section's melody, and goes down for it too.
const melodyAll = mixdown(raws.map((r) => ({ clip: r.melody, at: r.at })));
const keyFrom = (at: number, seconds: number) => melodyAll.trim(Math.min(at, melodyAll.seconds - 0.01), Math.min(melodyAll.seconds, at + seconds));
const allStems: Stems[] = raws.map((r) => ({
  melody: r.melody, rhythm: r.rhythm,
  harmony: r.harmony.duck(keyFrom(r.at, r.harmony.seconds), DUCK),
  effects: r.effects.duck(keyFrom(r.at, r.effects.seconds), DUCK_FX),
}));

const mixes = allStems.map((st, k) => {
  const sum = mixdown([{ clip: st.melody, at: 0 }, { clip: st.harmony, at: 0 }, { clip: st.effects, at: 0 }, { clip: st.rhythm, at: 0 }]);
  const kind = sections[k].kind;
  return (kind === "intro" || kind === "ending" ? MASTER(sum) : BUS(sum)).loudness(TARGET[sections[k].name]);
});

/** The whole piece, one clip, limited once. */
export const whole = mixdown(mixes.map((c, k) => ({ clip: c, at: sections[k].at }))).limit({ ceiling: 0.8 }).ogg(QUALITY);
/** Each section with its tail, at its level: the fallback. */
export const sectionClips = mixes.map((c) => c.limit({ ceiling: 0.8 }).ogg(QUALITY));
/** The melody and everything else, apart, at the same places (before the sections' levels: the ratio is what counts). */
export const melodyStem = mixdown(allStems.map((st, k) => ({ clip: st.melody, at: sections[k].at }))).ogg(8);
export const restStem = mixdown(allStems.map((st, k) => ({ clip: mixdown([{ clip: st.harmony, at: 0 }, { clip: st.effects, at: 0 }, { clip: st.rhythm, at: 0 }]), at: sections[k].at }))).ogg(8);
