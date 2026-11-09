// Für Elise, the cinematic arrangement, rendered when the script is built (probes/lib/fur-elise-cinematic-score.ts is
// the notes). Importing this starts nothing: probes/fur-elise-cinematic.ts plays it, and a showcase program imports
// `whole` (one clip for the whole piece: one long clip keeps time with the game) or the sections' clips (the fallback).
//
// Rendered a section at a time (`music.excerpt`), each with the hall and its tail under the next, the band's sections
// through a bus compressor; all of them turned by one gain so the whole is at −14 LUFS with the intro quiet and the
// storm the loudest, as played; the whole limited once.
//
// Piano: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0). Orchestra and percussion: VSCO 2 Community Edition
// by Versilian Studios (CC0). Synths, risers and impacts: made in the script. Instruments: probes/lib/fur-elise-sound-gen.mts.
import { music, type Instrument } from "trigscript/music";
import piano from "../salamander-grand.samples";
import violinsSet from "../vsco-violins.samples";
import violasSet from "../vsco-violas.samples";
import violasSpicSet from "../vsco-violas-spic.samples";
import celliSpicSet from "../vsco-celli-spic.samples";
import bassSpicSet from "../vsco-bass-spic.samples";
import hornsSet from "../vsco-horns.samples";
import tromboneSet from "../vsco-trombone.samples";
import tubaSet from "../vsco-tuba.samples";
import timpaniSet from "../vsco-timpani.samples";
import percussionSet from "../vsco-percussion.samples";
import { cinematic, PART_ROLES, type PartName } from "./fur-elise-cinematic-score";

export const LUFS = -14;
const HALL = { decay: 0.84, damping: 0.5, predelay: 0.032 };
const MASTER = (c: Clip) => c.filter("highpass", 26);
/** The band's bus: 2:1 above −18 dB, slow enough to let the hits through, glue for the rest. */
const BUS = (c: Clip) => MASTER(c).compress({ threshold: -18, ratio: 2, attack: 0.025, release: 0.3, knee: 6 });
const QUALITY = 6;
/** Seconds a bar lasts at the band's 144 eighths a minute. */
const BAR = (3 * 60) / 144;

export const arrangement = cinematic();
const grand = music.sampled(piano, { resonance: 0.07 });
const percussion = music.sampled(percussionSet, { releases: false });
/** One-shots: impacts, the sub drop, the kick, the crash reversed, risers. The intro's riser is made to its length below. */
const kit = music.drums({ volume: 0.9 });
const impact = music.impact({ seconds: 3, volume: 0.9 }).mix(music.impact({ seconds: 2.2, volume: 0.5 }).pitch(-5));
const subDrop = tone([[0, 70], [1.6, 28]], 2.2, { volume: 0.9, rate: 44100 }).envelope([0, 0], [0.01, 1], [2.2, 0]);
const crashBack = (percussionSet.zones.find((z) => z.key === 49 && z.vhi === 127) ?? percussionSet.zones[0]).clip.trim(0, 2 * BAR).reverse().fade(0.6, 0.004);
const fx = (intro: number) => music.hits({
  C2: impact, D2: subDrop, E2: kit.hits.k, F2: crashBack,
  G2: music.riser(4 * BAR, { volume: 0.45 }), A2: music.riser(3 * BAR, { volume: 0.4 }), B2: music.riser(intro, { volume: 0.4 }),
});

/**
 * How each part is heard: its instrument, where, how loud, how much hall. Volumes set by measuring each alone in the
 * storm (2026-11-09) against the piano's right hand at −13 LUFS: the taiko −15, the braam −17, the toms −19, the
 * strings −20 … −22, the brass −22 … −24, the synths −21 … −24, the kick −20, the sub −22.
 */
function heard(fxInstrument: Instrument): Record<PartName, { instrument: Instrument; pan?: number; volume?: number; reverb?: number; fx?: (c: Clip) => Clip; lead?: number; velocity?: number }> {
  return {
    // (The piano's ff chords in the storm stood 6 dB over everything else's peaks: a quick compressor on the piano.)
    right: { instrument: grand, lead: 0.008, reverb: 0.2, volume: 1.4, fx: (c) => c.compress({ threshold: -20, ratio: 3, attack: 0.002, release: 0.12, knee: 6, makeup: 3 }) },
    left: { instrument: grand, velocity: 0.92 },
    violins: { instrument: music.sampled(violinsSet), pan: -0.45, volume: 4.2, reverb: 0.35 },
    violas: { instrument: music.sampled(violasSet), pan: 0.25, volume: 1.1, reverb: 0.35 },
    ostinato: { instrument: music.sampled(violasSpicSet), pan: -0.25, volume: 2.8, reverb: 0.25 },
    celli: { instrument: music.sampled(celliSpicSet), pan: 0.35, volume: 1.45, reverb: 0.25 },
    basses: { instrument: music.sampled(bassSpicSet), pan: 0.5, volume: 2.0, reverb: 0.2 },
    horns: { instrument: music.sampled(hornsSet), pan: -0.15, volume: 1.0, reverb: 0.4 },
    trombones: { instrument: music.sampled(tromboneSet), pan: 0.2, volume: 4.0, reverb: 0.35 },
    tuba: { instrument: music.sampled(tubaSet), pan: 0.25, volume: 2.7, reverb: 0.3 },
    braam: { instrument: music.presets.braam(), volume: 0.9, reverb: 0.3 },
    sub: { instrument: music.presets.sub(), volume: 0.45 },
    drone: { instrument: music.presets.pad({ volume: 0.08 }), reverb: 0.5 },
    pad: { instrument: music.presets.pad({ volume: 0.095 }), reverb: 0.4, fx: music.pump(BAR, 0.55) },
    pulse: { instrument: music.presets.pulse(), pan: 0.3, volume: 1.4, reverb: 0.2, fx: (c) => c.delay(BAR / 3, { feedback: 0.25, mix: 0.2, pingPong: true }) },
    supersaw: { instrument: music.presets.supersaw({ volume: 0.145 }), reverb: 0.3, fx: (c) => c.chorus({ mix: 0.3 }) },
    taiko: { instrument: percussion, volume: 1.6, reverb: 0.3 },
    kick: { instrument: fxInstrument, volume: 0.42 },
    timpani: { instrument: music.sampled(timpaniSet), pan: -0.1, volume: 2.4, reverb: 0.4 },
    toms: { instrument: percussion, pan: 0.15, volume: 1.2, reverb: 0.3 },
    snare: { instrument: percussion, pan: -0.1, volume: 1.0, reverb: 0.35 },
    cymbals: { instrument: percussion, pan: 0.1, volume: 0.9, reverb: 0.35 },
    impacts: { instrument: fxInstrument, volume: 0.55, reverb: 0.3 },
    risers: { instrument: fxInstrument, volume: 0.9, reverb: 0.3 },
  };
}

const played = (fxInstrument: Instrument) => {
  const how = heard(fxInstrument), parts: Record<string, object> = {};
  for (const k of Object.keys(PART_ROLES) as PartName[]) parts[k] = { ...how[k], notes: arrangement.parts[k] };
  return music.perform({ meter: "3/8", bpm: 120, pickup: "1/8", tempo: arrangement.tempo, holds: arrangement.holds, humanize: { time: 0.003, velocity: 3, seed: 11 } }, parts as never);
};
// Played once to learn the intro's free time, then again with the intro's riser made to end on the band's downbeat
// (the instruments do not change when a note is played).
const rehearsal = played(fx(4));
/** The arrangement as played: every note's time in the whole. */
export const take = played(fx(rehearsal.bars[9] - rehearsal.bars[6]));
export const sections = arrangement.sections.map((s) => ({ name: s.name, from: s.from, to: s.to, at: take.bars[s.from], frame: Math.round(take.bars[s.from] / 0.042) }));

const raw = arrangement.sections.map((s, k) => music.render(music.excerpt(take, s.from, k + 1 < arrangement.sections.length ? s.to : undefined), {
  reverb: HALL, master: s.name === "intro" || s.name === "ending" ? MASTER : BUS, limit: false,
}));
/** Each section's fader, dB: the storm the loudest; the final statement big, but under it. */
const FADER: Readonly<Record<string, number>> = { intro: 0, band: 0, lift: 0, storm: 1, breakdown: 0, final: -2, ending: 0 };
const faded = raw.map((c, k) => { const g = FADER[arrangement.sections[k].name] ?? 0; return g === 0 ? c : c.gain(10 ** (g / 20)); });
// (A little over −14 before the limiter, which takes some of it back.)
const level = together(faded.map((c, k) => ({ clip: c, at: sections[k].at })), { lufs: LUFS + 0.4 });

/** The whole piece, one clip: the sections added up at their times, limited once. */
export const whole = mixdown(level.map((c, k) => ({ clip: c, at: sections[k].at }))).limit({ ceiling: 0.8 }).ogg(QUALITY);
/** Each section with its tail, at the level it has in the whole: the fallback. */
export const sectionClips = level.map((c) => c.limit({ ceiling: 0.8 }).ogg(QUALITY));
