// TrigScript Showcase #3, Für Elise: the soundtrack. The whole piece, every repeat the score has (probes/lib/
// fur-elise-score.ts, ours from the public-domain score), played as the sound probe's item 3 was played and extended in
// its spirit, in the arc the user chose (2026-11-08): the A section and the F major episode on the solo piano in a
// smaller room, the theme again into the storm, the storm with the orchestra in the hall, and the closing theme on the
// piano in the hall, ending on the held A.
//
// Rendered when the script is built, a section at a time (`music.excerpt`), each in its room with its tail, and added
// up into one clip for the whole piece — the showcase's sound: one long clip keeps time with the game (the visualizer
// probe, 2026-11-09: a steady ~95 ms, no drift over 35 s). Each section's clip, tail and all, is the fallback.
// The timeline for the picture is probes/lib/fur-elise-timeline.ts (probes/lib/fur-elise-timeline-gen.mts).
//
// Piano: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0). Orchestra: VSCO 2 Community Edition by Versilian
// Studios (CC0). Instruments made by probes/lib/fur-elise-sound-gen.mts.
//
//   npx tsx scripts/sound-dump.mts probes/fur-elise.ts <folder>
import { music, type Instrument } from "trigscript/music";
import piano from "./salamander-grand.samples";
import violinsSet from "./vsco-violins.samples";
import violasSet from "./vsco-violas.samples";
import celliSet from "./vsco-celli-spic.samples";
import bassesSet from "./vsco-bass-spic.samples";
import hornsSet from "./vsco-horns.samples";
import tromboneSet from "./vsco-trombone.samples";
import tubaSet from "./vsco-tuba.samples";
import timpaniSet from "./vsco-timpani.samples";
import rollsSet from "./vsco-timpani-rolls.samples";
import { piece } from "./lib/fur-elise-score";

/** The solo piano at −17 LUFS (the probe's choice), the storm at −15. */
const PIANO_LUFS = -17;
const STORM_LUFS = -15;
/** The smaller room for the first half, and the hall (the probe's) for the storm and the end. */
const ROOM = { decay: 0.7, damping: 0.55, predelay: 0.018 };
const HALL = { decay: 0.84, damping: 0.5, predelay: 0.032 };
const MASTER = (c: Clip) => c.filter("highpass", 28);
const BUS = (c: Clip) => MASTER(c).compress({ threshold: -20, ratio: 2, attack: 0.02, release: 0.25, knee: 6 });
const QUALITY = 6;

const written = piece();
const grand = music.sampled(piano, { resonance: 0.07 });
const orchestra = (name: string, instrument: Instrument, pan: number, volume: number, reverb: number) =>
  ({ instrument, notes: (written.orchestra as Record<string, string[]>)[name], pan, volume, reverb });

/** The piece as played: one performance, so every note has its time in the whole. */
export const take = music.perform({ meter: "3/8", bpm: 120, pickup: "1/8", tempo: written.tempo, holds: written.holds, humanize: { time: 0.004, velocity: 3, seed: 7 } }, {
  right: { instrument: grand, notes: written.right, lead: 0.008, reverb: 0.24 },
  left: { instrument: grand, notes: written.left, velocity: 0.92 },
  violins: orchestra("violins", music.sampled(violinsSet), -0.45, 2.8, 0.32),
  violas: orchestra("violas", music.sampled(violasSet), 0.2, 0.85, 0.32),
  celli: orchestra("celli", music.sampled(celliSet), 0.4, 1.35, 0.25),
  basses: orchestra("basses", music.sampled(bassesSet), 0.55, 1.55, 0.25),
  horns: orchestra("horns", music.sampled(hornsSet), -0.2, 0.8, 0.4),
  trombones: orchestra("trombones", music.sampled(tromboneSet), 0.25, 2.8, 0.35),
  tuba: orchestra("tuba", music.sampled(tubaSet), 0.3, 2.0, 0.3),
  timpani: orchestra("timpani", music.sampled(timpaniSet), -0.1, 1.9, 0.45),
  roll: orchestra("roll", music.sampled(rollsSet), -0.1, 0.9, 0.45),
});

/** The sections, where each begins in seconds and frames, and its bars. */
export const sections = written.sections.map((s) => ({ name: s.name, from: s.from, to: s.to, at: take.bars[s.from], frame: Math.round(take.bars[s.from] / 0.042) }));

/* ── Rendered a section at a time ── */

const raw = written.sections.map((s) => {
  const hall = s.name === "storm" || s.name === "closing";
  return music.render(music.excerpt(take, s.from, s.to < take.bars.length - 1 ? s.to : undefined), { reverb: hall ? HALL : ROOM, master: s.name === "storm" ? BUS : MASTER, limit: false });
});
const piano4 = [0, 1, 2, 4];
// The piano's sections turned by one gain, so they keep the levels they were played at; the storm on its own.
const pianoLevel = together(piano4.map((k) => ({ clip: raw[k], at: sections[k].at })), { lufs: PIANO_LUFS });
const level = raw.map((c, k) => (k === 3 ? c.loudness(STORM_LUFS) : pianoLevel[piano4.indexOf(k)]));

/** The whole piece, one clip: the sections added up at their times, tails under what follows, limited once. */
export const whole = mixdown(level.map((c, k) => ({ clip: c, at: sections[k].at }))).limit().ogg(QUALITY);
/** Each section with its tail, for a showcase that restarts the sound a section at a time. */
export const A = level[0].limit().ogg(QUALITY);
export const B = level[1].limit().ogg(QUALITY);
export const again = level[2].limit().ogg(QUALITY);
export const storm = level[3].limit().ogg(QUALITY);
export const closing = level[4].limit().ogg(QUALITY);

program(async () => {
  displayText("\x04Für Elise: the whole piece. Keys 1-5 play a section on its own.");
  playWav(whole, 0);
  while (true) {
    if (keyPressed(P1, "1")) playWav(A, 0);
    if (keyPressed(P1, "2")) playWav(B, 0);
    if (keyPressed(P1, "3")) playWav(again, 0);
    if (keyPressed(P1, "4")) playWav(storm, 0);
    if (keyPressed(P1, "5")) playWav(closing, 0);
    await nextFrame();
  }
});
