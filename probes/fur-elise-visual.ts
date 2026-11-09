// The Für Elise visualizer probe (TrigScript 4, Showcase #3, S7): does a piano roll drawn by the game look good, and
// does it stay with the music? The piano is rendered when the script is built (an FM electric piano stands in for the
// sound probe's grand), so every note's time is known to the sample; the picture of every frame is worked out then too
// (probes/lib/note-timeline.ts), and the program only plays the changes back, a frame at a time, starting each clip on
// the frame its first note is drawn.
//
// Two screens (probes/lib/fur-elise-layout.ts):
//   - the minimap: notes falling onto a keyboard row that lights as each key sounds; a cell an Overlord two tiles
//     square over Space (Korobeiniki's board), coloured by hand — right gold, left cyan, the storm's chords red;
//   - the main screen: the same as Flags (Spider Mines given a Flag's looks, the main-screen spike's pixel), a keyboard
//     of 30 white keys with the black ones above, notes falling a row a frame; a sync lamp at the top left, a start
//     location's ring that is white on each frame a note starts and black otherwise.
//
// The parts, each named in the text lines as it starts (seconds from the start of the game, about):
//   T    2  six clicks 24 frames apart, the lamp white on each: the plain delay between a sound and a picture
//   A1   9  the A section (bars 1–22 with repeats, 34 s): falling notes on both screens, a row a frame on the main one
//   A2  22  the same from bar 9: the main screen's notes fall half as fast (a row every other frame)
//   C-a 45  a stormy passage in D minor: the white keys flash red on the chords, Disruption Webs on the downbeats
//   C-b 50  explosions on the downbeats (Wraiths and Battlecruisers killed: their own explosion sounds will be heard)
//   S1  57  the theme twice (12 s) as one clip
//   S2  72  the same, a clip a bar, each started on its frame: drift and jitter against S1
//   V1  86  the same again, notes rising from the keys; V2 (93) the keys alone
//   the end at 102
//
// Host it as multiplayer, alone, Remastered graphics, the game's music off; record the whole run. Answer sheet:
// probes/answers/fur-elise-visual.txt.
//
//   MAP_NAME="Für Elise visual probe" npx tsx probes/lib/fur-elise-map.mts fixtures/eud/fur-elise-visual-base.scx
//   MAP_NAME="Für Elise visual probe" NO_BASES=1 npx tsx scripts/build-fixture.mts probes/fur-elise-visual.ts fixtures/eud/fur-elise-visual.scx fixtures/eud/fur-elise-visual-base.scx
//   SCM_SIM_DIR=~/github/scm-sim-eud npx tsx scripts/test-game.mts probes/fur-elise-visual.ts fixtures/eud/fur-elise-visual-base.scx
//
// Remastered will not start a game without a computer, and a computer moves its own units, so Player 2 is a computer
// that owns nothing; P3 … P8 own the pixels, each given a colour: P3 white (white keys, the lamp lit), P4 indigo (black
// keys), P5 gold (right hand), P6 cyan (left hand), P7 red (the storm), P8 black (the lamp dark).
// probe-players: {"0":{"rgb":[16,252,24]},"1":{"rgb":[120,120,120]},"2":{"rgb":[240,240,240]},"3":{"rgb":[72,56,200]},"4":{"rgb":[255,190,0]},"5":{"rgb":[0,200,255]},"6":{"rgb":[235,20,50]},"7":{"rgb":[16,16,16]}}
import { program, nextFrame, print, playWav, centerView, centerLocation, reserveLocation, createUnit, removeUnitAt, killUnitAt, giveUnits, setMemory, units, mixdown, tone, P3, P4, P5, P6, P7, P8, test, expect, type Clip } from "trigscript";
import { music } from "trigscript/music";
import { FRAME } from "./lib/note-timeline";
import type { PlayedNote } from "./lib/fur-elise-probe-score";
import { CAM_X, CAM_Y, CELL } from "./lib/fur-elise-layout";
import {
  A_NOTES, STORM_NOTES, THEME_NOTES, A_LONG, STORM_LONG, THEME_LONG, BAR_AT, BAR_FRAME, CLICK_EVERY, CLICKS, OVERLORD,
  TOTAL, C_START, STARTS, CX, CY, CKIND, CTO, SOUND_F, SOUND_K, LABEL_F, LABEL_TEXT, FX_F, FX_K, FX_X, FX_Y, pictureAt,
} from "./lib/fur-elise-run";

/* ── The sound (a stand-in) ── */

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (n: number) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const RATE = 44100;
const piano = music.presets.keys({ volume: 0.3 });
const strings = music.presets.pad({ volume: 0.05 });
/** How long a note rings: the left hand held as under the pedal, the right a little past its length. */
const ringing = (n: PlayedNote) => (n.hand === 1 ? Math.max(n.seconds, 0.7) : n.seconds + 0.08);
const hall = (c: Clip) => c.reverb({ decay: 0.75, damping: 0.45, mix: 0.22 });
/** Notes mixed at their times, from `from` seconds, `seconds` long (tails ring past it); the storm's with the pad under it. */
function mixNotes(notes: readonly PlayedNote[], from: number, seconds: number, pad: boolean): Clip {
  const parts = notes.map((n) => ({ clip: piano.note(nameOf(n.note), ringing(n), RATE).gain(n.velocity), at: n.time - from }));
  if (pad) for (const n of notes) parts.push({ clip: strings.note(nameOf(n.note), n.seconds + 0.2, RATE).gain(n.velocity), at: n.time - from });
  return hall(mixdown(parts, seconds + 1.5, RATE));
}

const A_CLIP = mixNotes(A_NOTES, 0, A_LONG, false).normalize(0.8);
const STORM_CLIP = mixNotes(STORM_NOTES, 0, STORM_LONG, true).normalize(0.8);
const THEME_MIX = mixNotes(THEME_NOTES, 0, THEME_LONG, false);
const THEME_GAIN = 0.8 / THEME_MIX.peak;
const THEME_CLIP = THEME_MIX.gain(THEME_GAIN);
/** The theme a bar a clip: each bar's notes from the frame the bar starts in, so that played on that frame each lands where the whole clip has it. */
const BAR_CLIPS: Clip[] = BAR_AT.slice(0, -1).map((t, k) => {
  const notes = THEME_NOTES.filter((n) => n.time >= t - 1e-9 && n.time < BAR_AT[k + 1] - 1e-9);
  return mixNotes(notes, BAR_FRAME[k] * FRAME, BAR_AT[k + 1] - BAR_FRAME[k] * FRAME, false).gain(THEME_GAIN).ogg(5);
});
/** The clicks as one clip: the lamp's calibration. */
const CLICK_CLIP = mixdown(Array.from({ length: CLICKS }, (_, k) => ({ clip: tone(1760, 0.03, { volume: 0.7, rate: RATE }).fade(0, 0.01), at: k * CLICK_EVERY * FRAME })), CLICKS * CLICK_EVERY * FRAME + 0.5, RATE);
/** In the order the run numbers them (CLIP_CLICKS, CLIP_A, …). */
const CLIPS: Clip[] = [CLICK_CLIP, A_CLIP, STORM_CLIP, THEME_CLIP, ...BAR_CLIPS];

/* ── The game side ── */

/** units.dat's flingy bytes of types 12 … 15 (Battlecruiser, Spider Mine, Nuclear Missile, Civilian), one dword. */
const LOOKS = 0x664504;
const looks = (flingy: number) => 70 + flingy * 256 + 109 * 65536 + 71 * 16777216;
/** The flingies a Spider Mine is made with: a Flag's, a start location's ring, its own. */
const FLAG_LOOK = looks(126), RING_LOOK = looks(140), MINE_LOOK = looks(89);
const OWNERS = [P3, P4, P5, P6, P7, P8];
const AT = reserveLocation("fur elise: where a pixel is made");
const FX = reserveLocation("fur elise: where an effect is made");
const VIEW = reserveLocation("fur elise: the camera");

/**
 * One pixel changed (kind: unit · 8 + its old colour, 0 none): made, taken away, or handed to the player of its new
 * colour — a unit's colour is its owner's, and Give Units changes it where it stands (making one again where one was
 * taken away in the same frame would not do: the old one still stands there until the frame ends, and a Spider Mine
 * would be put beside it).
 */
function change(x: number, y: number, kind: number, to: number) {
  if (kind < 8) {
    centerLocation(AT, x, y, 32, 32);
    if (kind === 0) OWNERS.forEach((p, k) => { if (to === k + 1) createUnit(p, units.ZergOverlord, 1, AT); });
    else if (to === 0) OWNERS.forEach((p, k) => { if (kind === k + 1) removeUnitAt(p, units.ZergOverlord, 1, AT); });
    else OWNERS.forEach((p, a) => { if (kind === a + 1) OWNERS.forEach((q, b) => { if (to === b + 1) giveUnits(p, q, units.ZergOverlord, 1, AT); }); });
  } else {
    centerLocation(AT, x, y, 4, 4);
    const from = kind & 7;
    if (from === 0) {
      if (kind === 16) setMemory(LOOKS, "set", RING_LOOK);
      OWNERS.forEach((p, k) => { if (to === k + 1) createUnit(p, units.SpiderMine, 1, AT); });
      if (kind === 16) setMemory(LOOKS, "set", FLAG_LOOK);
    } else if (to === 0) OWNERS.forEach((p, k) => { if (from === k + 1) removeUnitAt(p, units.SpiderMine, 1, AT); });
    else OWNERS.forEach((p, a) => { if (from === a + 1) OWNERS.forEach((q, b) => { if (to === b + 1) giveUnits(p, q, units.SpiderMine, 1, AT); }); });
  }
}

function effect(kind: number, x: number, y: number) {
  centerLocation(FX, x, y, 64, 64);
  if (kind === 1) { createUnit(P7, units.TerranWraith, 1, FX); killUnitAt(P7, units.TerranWraith, 1, FX); }
  else if (kind === 2) { createUnit(P7, units.TerranBattlecruiser, 1, FX); killUnitAt(P7, units.TerranBattlecruiser, 1, FX); }
  else if (kind === 3) createUnit(P7, units.DisruptionWeb, 1, FX);
  else removeUnitAt(P7, units.DisruptionWeb, 1, FX);
}

program(async () => {
  centerLocation(VIEW, CAM_X, CAM_Y, 32, 32);
  centerView(VIEW);
  let g = 0, i = 0, s = 0, l = 0, e = 0, camera = 0;
  while (g < TOTAL) {
    // The sounds of this frame first, then its picture: both reach the game in the same pass of its triggers.
    while (s < SOUND_F.length && SOUND_F[s] === g) {
      const k = SOUND_K[s];
      CLIPS.forEach((c, j) => { if (k === j) playWav(c, 0); });
      s++;
    }
    while (l < LABEL_F.length && LABEL_F[l] === g) {
      const k = l;
      LABEL_TEXT.forEach((t, j) => { if (k === j) print(t); });
      l++;
    }
    const end = STARTS[g + 1];
    if (i < end) {
      setMemory(LOOKS, "set", FLAG_LOOK);
      while (i < end) { change(CX[i], CY[i], CKIND[i], CTO[i]); i++; }
      setMemory(LOOKS, "set", MINE_LOOK);
    }
    while (e < FX_F.length && FX_F[e] === g) { effect(FX_K[e], FX_X[e], FX_Y[e]); e++; }
    // The camera put back on the stage now and then, in case it was moved.
    camera++;
    if (camera >= 96) { camera = 0; centerView(VIEW); }
    await nextFrame();
    g++;
  }
});

/* ── Tests: the picture the game holds is the one worked out ── */

/** The pixels a frame shows, as text to compare: "unit owner x y" each, sorted. */
function expected(f: number): string[] {
  return pictureAt(f).map((p) => `${p.unit === OVERLORD ? "o" : "m"} ${p.color + 1} ${p.x} ${p.y}`).sort();
}

/** What the game holds: Overlords and Spider Mines of P3 … P8 where the board is, as the same text. */
function held(sim: { units(q: { type: number }): readonly { x: number; y: number; owner: number; alive: boolean }[] }, snap: (v: number) => number): string[] {
  const out: string[] = [];
  for (const u of sim.units({ type: units.ZergOverlord })) if (u.alive && u.owner >= 2 && u.owner <= 7) out.push(`o ${u.owner} ${snap(u.x)} ${snap(u.y)}`);
  for (const u of sim.units({ type: units.SpiderMine })) if (u.alive && u.owner >= 2 && u.owner <= 7) out.push(`m ${u.owner} ${u.x} ${u.y}`);
  return out.sort();
}

/** Whether what the game holds after `frames` is the picture of one of the frames around then (the program starts a frame or two in). */
function matches(sim: Parameters<typeof held>[0], frames: number): string {
  // An Overlord is made a few pixels off its cell's centre: snapped back to it.
  const got = held(sim, (v) => Math.round((v - CELL / 2) / CELL) * CELL + CELL / 2);
  for (let f = frames - 4; f <= frames; f++) if (expected(f).join("|") === got.join("|")) return "";
  const want = expected(frames - 2);
  const missing = want.filter((w) => !got.includes(w)), extra = got.filter((w) => !want.includes(w));
  return `frame ${frames}: ${missing.length} missing (${missing.slice(0, 4).join(", ")}), ${extra.length} extra (${extra.slice(0, 4).join(", ")})`;
}

test("every frame of the run shows the picture worked out, and the end is said", (sim) => {
  sim.frames(20);
  let wrong = "", most = 0;
  for (let f = 21; f < TOTAL && !wrong; f++) {
    sim.frames(1);
    wrong = matches(sim, f);
    most = Math.max(most, sim.units({}).filter((u) => u.alive).length);
  }
  expect(wrong).toBe("");
  // Of the game's 1,700 units, with the Map Revealers.
  expect(most < 1000 ? "fewer than 1000" : `${most}`).toBe("fewer than 1000");
  sim.frames(20);
  expect(sim).toHavePrinted("The end. Thank you.");
});

test("the storm's effects: the explosions leave nothing behind, and no Disruption Web stays", (sim) => {
  // Each explosion is a Wraith or a Battlecruiser made and killed in one pass: none is ever seen alive. (Made and not
  // killed, all five Wraiths stood there, in the game and the simulator; a Disruption Web made by a trigger is refused
  // by 1.16.1, the lifted game — whether Remastered makes it is for the play.)
  const alive = () => sim.units({ type: units.TerranWraith }).filter((u) => u.alive).length + sim.units({ type: units.TerranBattlecruiser }).filter((u) => u.alive).length;
  sim.frames(C_START);
  let most = 0;
  for (let f = 0; f < Math.round(STORM_LONG / FRAME) + 20; f++) { sim.frames(1); most = Math.max(most, alive()); }
  expect(most).toBe(0);
  expect(sim.units({ type: units.DisruptionWeb }).filter((u) => u.alive).length).toBe(0);
});
