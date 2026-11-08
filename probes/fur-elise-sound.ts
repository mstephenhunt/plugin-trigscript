// TrigScript Showcase #3, Für Elise: the sound probe (S7 in docs/v4-plan.md). Five items, each announced on the screen
// and played as one clip mixed when the map is built (so every note is where it was written: played note by note, a
// sound starts on the game's 42 ms frame and the mixer's 21 ms grid, which a lone piano would show), a few seconds apart:
//
//   1  The old way: one recording of the piano's middle C, sped up or slowed for every key (`music.sampler`), on the grid
//   2  The sampled piano (`music.sampled`): the recording nearest each key, at each note's strength — still on the grid
//   3  Played (`music.perform`): its own tempo and dynamics, the pedal and the strings ringing with it, a hall
//   4  The storm (the D minor section over the drumming A): piano and orchestra
//   5  From the theme's last bars into the storm, as the Showcase would go
//
// Host it as a multiplayer game, alone, the game's music off. The notes are ours, from the public-domain score
// (probes/lib/fur-elise-score.ts). Piano: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0). Orchestra: VSCO 2
// Community Edition by Versilian Studios (CC0). The instruments are made from the libraries, which stay outside the
// repository, by probes/lib/fur-elise-sound-gen.mts.
//
//   npx tsx probes/lib/fur-elise-sound-gen.mts                     # the instruments, into probes/ (ignored)
//   MAP_NAME="Für Elise sound probe" MAP_DESCRIPTION="…" npx tsx probes/lib/raycaster-map.mts fixtures/eud/fur-elise-sound-base.scx
//   npx tsx scripts/build-fixture.mts probes/fur-elise-sound.ts fixtures/eud/fur-elise-sound.scx fixtures/eud/fur-elise-sound-base.scx
import { music, type Instrument } from "trigscript/music";
import piano from "./salamander-grand.samples";
import middleC from "./salamander-c4.sound";
import violinsSet from "./vsco-violins.samples";
import violasSet from "./vsco-violas.samples";
import celliSet from "./vsco-celli-spic.samples";
import bassesSet from "./vsco-bass-spic.samples";
import hornsSet from "./vsco-horns.samples";
import tromboneSet from "./vsco-trombone.samples";
import tubaSet from "./vsco-tuba.samples";
import timpaniSet from "./vsco-timpani.samples";
import rollsSet from "./vsco-timpani-rolls.samples";
import {
  A_RIGHT, A_LEFT, A_TEMPO, A_HOLDS, plain, rests, sixteenths,
  C_RIGHT, C_LEFT, C_TEMPO, C_VIOLINS, C_VIOLAS, C_CELLI, C_BASSES, C_HORNS, C_TROMBONES, C_TUBA, C_TIMPANI,
} from "./lib/fur-elise-score";

/**
 * How loud the piano items are made: a solo piano's loudest notes stand 19 … 20 dB over its loudness, so at −17 LUFS the
 * limiter takes at most a few dB off the one or two loudest (at −16 it took 5.7 dB off the middle part's top).
 */
const PIANO_LUFS = -17;
/** The storm, louder: the arc's climax, a gentle compressor holding the orchestra together and the limiter its peaks. */
const STORM_LUFS = -15;
/** A concert hall: a long, darkening tail after 32 ms. The plate's decay 0.84 rings about 7 s to silence. */
const HALL = { decay: 0.84, damping: 0.5, predelay: 0.032 };
/** A smaller room, for the theme played close. */
const ROOM = { decay: 0.7, damping: 0.55, predelay: 0.018 };
/** What every item goes through last, before the loudness and the limiter: nothing under 28 Hz. */
const MASTER = (c: Clip) => c.filter("highpass", 28);
/** Ogg Vorbis quality: 6, about 190 kbit/s for two channels, so the solo piano's quiet tails keep their grain. */
const QUALITY = 6;

/* ── 1 and 2: on the grid ── */

const GRID = { meter: "3/8", bpm: 126, pickup: "1/8" };
const onTheGrid = (instrument: Instrument) => music.perform(GRID, { right: { instrument, notes: plain(A_RIGHT) }, left: { instrument, notes: plain(A_LEFT) } });
const oldPiano = music.sampler(middleC, "C4", { release: 0.08 });
const item1 = music.render(onTheGrid(oldPiano), { master: MASTER, loudness: PIANO_LUFS }).ogg(QUALITY);
const item2 = music.render(onTheGrid(music.sampled(piano)), { master: MASTER, loudness: PIANO_LUFS }).ogg(QUALITY);

/* ── 3: played ── */

// The strings in sympathy about 11 dB under the notes as a whole (0.2 made them 7 under: more ring than a piano has).
const grand = music.sampled(piano, { resonance: 0.07 });
const PLAYED = { meter: "3/8", bpm: 120, pickup: "1/8", tempo: A_TEMPO, holds: A_HOLDS, humanize: { time: 0.004, velocity: 3, seed: 7 } };
export const theme = music.perform(PLAYED, {
  right: { instrument: grand, notes: A_RIGHT, lead: 0.008, reverb: 0.24 },
  left: { instrument: grand, notes: A_LEFT, velocity: 0.92 },
});
const item3 = music.render(theme, { reverb: HALL, master: MASTER, loudness: PIANO_LUFS }).ogg(QUALITY);

/* ── 4: the storm ── */

const strings = {
  violins: music.sampled(violinsSet), violas: music.sampled(violasSet), celli: music.sampled(celliSet), basses: music.sampled(bassesSet),
};
const brass = { horns: music.sampled(hornsSet), trombones: music.sampled(tromboneSet), tuba: music.sampled(tubaSet) };
const timpani = music.sampled(timpaniSet), rolls = music.sampled(rollsSet);
const stormPiano = music.sampled(piano, { resonance: 0.04 });

/**
 * The orchestra's parts, each `before` bars of rest first, then the storm's. Their volumes set by measuring each alone
 * (`lufs`, 2026-11-08) against the storm's piano at −16: violins −22, violas −24, celli −23, basses −25, horns −24,
 * trombones −25, tuba −26, timpani −22 — the piano on top, the strings next.
 */
const orchestra = (before: number) => {
  const lead = rests(before);
  return {
    violins: { instrument: strings.violins, notes: [...lead, ...C_VIOLINS], pan: -0.45, volume: 2.8, reverb: 0.32 },
    violas: { instrument: strings.violas, notes: [...lead, ...C_VIOLAS], pan: 0.2, volume: 0.85, reverb: 0.32 },
    celli: { instrument: strings.celli, notes: [...lead, ...C_CELLI], pan: 0.4, volume: 1.35, reverb: 0.25 },
    basses: { instrument: strings.basses, notes: [...lead, ...C_BASSES], pan: 0.55, volume: 1.55, reverb: 0.25 },
    horns: { instrument: brass.horns, notes: [...lead, ...C_HORNS], pan: -0.2, volume: 0.8, reverb: 0.4 },
    trombones: { instrument: brass.trombones, notes: [...lead, ...C_TROMBONES], pan: 0.25, volume: 2.8, reverb: 0.35 },
    tuba: { instrument: brass.tuba, notes: [...lead, ...C_TUBA], pan: 0.3, volume: 2.0, reverb: 0.3 },
    timpani: { instrument: timpani, notes: [...lead, ...C_TIMPANI], pan: -0.1, volume: 1.9, reverb: 0.45 },
  };
};

export const storm = music.perform({ meter: "3/8", bpm: 134, tempo: C_TEMPO, humanize: { time: 0.004, velocity: 3, seed: 11 } }, {
  right: { instrument: stormPiano, notes: C_RIGHT, reverb: 0.2 },
  left: { instrument: stormPiano, notes: C_LEFT, velocity: 0.82 },
  ...orchestra(0),
});
/** The storm's bus: the low cut, and 2:1 above −20 dB, slow enough to let each chord's attack through. */
const BUS = (c: Clip) => MASTER(c).compress({ threshold: -20, ratio: 2, attack: 0.02, release: 0.25, knee: 6 });
const item4 = music.render(storm, { reverb: HALL, master: BUS, loudness: STORM_LUFS }).ogg(QUALITY);

/* ── 5: into the storm ── */

// The theme's last bars (15 … 21) as item 3 plays them, a bar of the drumming A alone (the printed bar before the
// storm), and the storm's first phrase (C1 … C8): the orchestra comes in under a timpani roll.
const INTO = { meter: "3/8", bpm: 120, tempo: [[1, 122], [4, 124], [5, 118], [6, 120], [7, 112], [8, 120], [8.8, 130], [9, 134], [16, 134], [16.5, 124], [17, 110]] as const, humanize: { time: 0.004, velocity: 3, seed: 5 } };
export const into = music.perform(INTO, {
  right: { instrument: stormPiano, notes: [...A_RIGHT.slice(15, 22).map((b, k) => (k === 0 ? `pp ${b}` : b)), "A4/8 r r", ...C_RIGHT.slice(0, 8)], lead: 0.008, reverb: 0.2 },
  left: { instrument: stormPiano, notes: [`pp ${A_LEFT[15]}`, ...A_LEFT.slice(16, 22), `p < ${sixteenths("A2")}`, ...C_LEFT.slice(0, 8)], velocity: 0.85 },
  ...orchestra(8),
  roll: { instrument: rolls, notes: [...rests(7), "pp A2/4.", ...rests(8)], volume: 0.9, reverb: 0.45 },
});
const item5 = music.render(into, { reverb: HALL, master: BUS, loudness: STORM_LUFS }).ogg(QUALITY);

/* ── The program: each item announced, played, and a few seconds after it ends ── */

const GAP = 3;
const waitFor = (c: Clip) => Math.ceil((c.seconds + GAP) / 0.042);
const PARK = reserveLocation("fur elise: the camera");

program(async () => {
  removeUnit(P1, units.AnyUnit);
  removeUnit(P2, units.AnyUnit);
  centerLocation(PARK, 64 * 32, 112 * 32);
  centerView(PARK);
  displayText("\x04Für Elise, the sound probe: five items, each announced before it plays. Game music off; record one run.");
  await sleep(frames(96));
  displayText("\x031 of 5 \x04— the old way: one recording (middle C) sped up or slowed for every key, on the grid");
  await sleep(frames(60));
  playWav(item1, 0);
  await sleep(frames(waitFor(item1)));
  displayText("\x032 of 5 \x04— the sampled piano: the recording nearest each key, at each note's strength; still on the grid");
  await sleep(frames(60));
  playWav(item2, 0);
  await sleep(frames(waitFor(item2)));
  displayText("\x033 of 5 \x04— played: its own tempo and dynamics, the pedal, the strings ringing with it, a hall");
  await sleep(frames(60));
  playWav(item3, 0);
  await sleep(frames(waitFor(item3)));
  displayText("\x034 of 5 \x04— the storm (D minor, over the drumming A): piano and orchestra");
  await sleep(frames(60));
  playWav(item4, 0);
  await sleep(frames(waitFor(item4)));
  displayText("\x035 of 5 \x04— from the theme's last bars into the storm, as the Showcase would go");
  await sleep(frames(60));
  playWav(item5, 0);
  await sleep(frames(waitFor(item5)));
  displayText("\x04That is all: the five items are also in Maps/TrigScript/fur-elise-sound-preview/ to play outside the game.");
});
