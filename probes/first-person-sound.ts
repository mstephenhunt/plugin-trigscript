// The third showcase's sound probe: does a sound the game makes at a place on the map come from that side, and
// fainter further away, in StarCraft: Remastered? The screen is held still on the middle of the map; a unit of yours is
// made at a place and killed a second later, so the game plays its death sound there — then the same sound is played
// by a trigger (Play WAV, which has no place), to hold the first against. From the recording's two channels (48 kHz
// stereo) the left-right balance and the loudness of each pair say how the game places a sound.
//
// Each step is printed as it starts. The places, from the middle of the screen: the middle; the left and right edges
// (8 tiles — inside the screen in Classic and in Remastered's wide one); a screen and a half off to the left and to the
// right (24 tiles); three screens off to the right (48 tiles); 6 tiles up the screen and 6 down. A Marine first, then a
// Zergling. The run goes round twice.
//
// Single player; leave the mouse in the middle of the screen. Classic or Remastered graphics alike.
//
//   SOUND=1 MAP_NAME="TrigScript sound places" npx tsx probes/lib/first-person-map.mts fixtures/eud/first-person-sound-base.scx
//   NO_BASES=1 MAP_NAME="TrigScript sound places" npx tsx scripts/build-fixture.mts probes/first-person-sound.ts fixtures/eud/first-person-sound.scx fixtures/eud/first-person-sound-base.scx

import { test, expect } from "trigscript";

/** The middle of the screen, a tile. */
const MID_X = 64, MID_Y = 64;
const PLACES_X = [0, -8, 8, -24, 24, 48, 0, 0];
const PLACES_Y = [0, 0, 0, 0, 0, 0, -6, 6];
const PLACES = [
  "the MIDDLE of the screen",
  "the LEFT edge of the screen (8 tiles left)",
  "the RIGHT edge of the screen (8 tiles right)",
  "FAR LEFT, off the screen (24 tiles left)",
  "FAR RIGHT, off the screen (24 tiles right)",
  "VERY FAR RIGHT, off the screen (48 tiles right)",
  "UP the screen (6 tiles up)",
  "DOWN the screen (6 tiles down)",
];
const KINDS = ["A Marine", "A Zergling"];
/** The same sounds as files of the game's, for Play WAV: what the units' deaths play (one of two, picked by the game). */
const MARINE_DEATH = "sound\\Terran\\MARINE\\TMaDth00.WAV";
const ZERGLING_DEATH = "sound\\Zerg\\Zergling\\ZZeDth00.WAV";

const CAMERA = reserveLocation("sound places: the middle of the screen");
const AT = reserveLocation("sound places: where the sound is made");

program(async () => {
  removeUnit(P1, units.AnyUnit);
  removeUnit(P2, units.AnyUnit);
  centerLocation(CAMERA, MID_X * 32 + 16, MID_Y * 32 + 16, 32, 32);
  centerView(CAMERA);
  displayText("\x04Where sounds come from. Turn the game's MUSIC off (Options > Sound), keep RECORDING, and leave the mouse and screen alone.");
  displayText("\x04Each step: a unit dies at a place (its own sound), then the SAME sound with no place (a trigger's Play WAV).");
  await sleep(seconds(6));
  let round = 1;
  while (round <= 2) {
    displayText(`\x07Round ${round} of 2`);
    await sleep(seconds(2));
    let kind = 0;
    while (kind < 2) {
      let p = 0;
      while (p < PLACES_X.length) {
        centerView(CAMERA);
        displayText(`\x04${KINDS[kind]} dies at ${PLACES[p]} ... then the same sound with no place.`);
        centerLocation(AT, (MID_X + PLACES_X[p]) * 32 + 16, (MID_Y + PLACES_Y[p]) * 32 + 16, 32, 32);
        if (kind == 0) createUnit(P1, units.TerranMarine, 1, AT);
        else createUnit(P1, units.ZergZergling, 1, AT);
        await sleep(seconds(1));
        if (kind == 0) killUnitAt(P1, units.TerranMarine, 1, AT);
        else killUnitAt(P1, units.ZergZergling, 1, AT);
        await sleep(frames(36));
        if (kind == 0) playWav(MARINE_DEATH, 0);
        else playWav(ZERGLING_DEATH, 0);
        await sleep(frames(48));
        p++;
      }
      kind++;
    }
    round++;
  }
  displayText("\x07Done. You can quit.");
});

// The screen held on the middle, every frame: whatever the mouse does at the edges.
program(async () => {
  centerLocation(CAMERA, MID_X * 32 + 16, MID_Y * 32 + 16, 32, 32);
  while (true) {
    centerView(CAMERA);
    await nextFrame();
  }
});

test("each step makes a unit at its place, and it is gone (killed) before the next", (sim) => {
  // Where the Marine stands in each of the first five steps, in the second it lives; a step is 108 frames.
  const xs: number[] = [];
  sim.frames(216);
  let i = 0;
  while (i < 5) {
    const here = sim.units({ owner: P1 });
    xs.push(here.length == 1 ? here[0].x : -1);
    sim.frames(48);
    xs.push(sim.units({ owner: P1 }).length);
    sim.frames(60);
    i++;
  }
  expect(xs).toEqual([2064, 0, 1808, 0, 2320, 0, 1296, 0, 2832, 0]);
});
