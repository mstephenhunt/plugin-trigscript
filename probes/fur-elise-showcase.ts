// Für Elise, TrigScript Showcase #3: the whole piece as one clip — the trance remix (probes/lib/fur-elise-remix.ts),
// the cinematic arrangement (probes/lib/fur-elise-cinematic.ts) or the straight piece (probes/lib/fur-elise-soundtrack.ts),
// as probes/lib/fur-elise-showcase-choice.ts says (FUR_ELISE=cinematic or straight when built under Node) — drawn as it
// plays: notes falling onto a keyboard on the minimap (Overlords over Space; the rest of the band in violet in the big
// sections) and on the main screen (Flag-looking Spider Mines, a row every other frame), the melody gold on top, the
// left hand cyan, the storm's chords red with the white keys flashing red on each, explosions on the biggest moments.
//
// Every frame's picture is worked out when the script is built (probes/lib/fur-elise-showcase-run.ts, from the
// chosen soundtrack's timeline, made by probes/lib/fur-elise-timeline-gen.mts; the run takes its parts, sections, range
// and big moments from it); the program plays the changes back. The clip starts two frames before the
// picture's frame 0: the visualizer probe measured the picture ~95 ms ahead of a long clip's sound.
//
// Host it as multiplayer, alone, with the game's music off (sound effects on). Check sheet:
// probes/answers/fur-elise-showcase.txt.
//
//   MAP_NAME="Für Elise" MAP_DESCRIPTION="…" npx tsx probes/lib/fur-elise-map.mts fixtures/eud/fur-elise-showcase-base.scx   (the description: below)
//   MAP_NAME="Für Elise" NO_BASES=1 npx tsx scripts/build-fixture.mts probes/fur-elise-showcase.ts fixtures/eud/fur-elise-showcase-remix.scx fixtures/eud/fur-elise-showcase-base.scx
//   FUR_ELISE=cinematic MAP_NAME="Für Elise" NO_BASES=1 npx tsx scripts/build-fixture.mts probes/fur-elise-showcase.ts fixtures/eud/fur-elise-showcase-cinematic.scx fixtures/eud/fur-elise-showcase-base.scx
//   FUR_ELISE=straight MAP_NAME="Für Elise" NO_BASES=1 npx tsx scripts/build-fixture.mts probes/fur-elise-showcase.ts fixtures/eud/fur-elise-showcase-straight.scx fixtures/eud/fur-elise-showcase-base.scx
//   SCM_SIM_DIR=~/github/scm-sim-eud npx tsx scripts/test-game.mts probes/fur-elise-showcase.ts fixtures/eud/fur-elise-showcase-base.scx
//
// The piano, orchestra and percussion .samples files must be in probes/ (made by probes/lib/fur-elise-sound-gen.mts; never committed).
//
// Players: P1 you (green, owns only the placed Map Revealers), P2 the computer Remastered needs to start a game (owns
// nothing: a computer moves its own units), P3 … P8 own the pixels — P3 white keys, P4 indigo black keys, P5 gold right
// hand, P6 cyan left hand, P7 red storm, P8 violet band.
// probe-players: {"0":{"rgb":[16,252,24]},"1":{"rgb":[120,120,120]},"2":{"rgb":[240,240,240]},"3":{"rgb":[72,56,200]},"4":{"rgb":[255,190,0]},"5":{"rgb":[0,200,255]},"6":{"rgb":[235,20,50]},"7":{"rgb":[170,80,255]}}
import { program, nextFrame, print, playWav, centerView, centerLocation, reserveLocation, createUnit, removeUnitAt, killUnitAt, giveUnits, setMemory, units, P3, P4, P5, P6, P7, P8, test, expect } from "trigscript";
import { whole as straightWhole } from "./lib/fur-elise-soundtrack";
import { whole as cinematicWhole } from "./lib/fur-elise-cinematic";
import { whole as remixWhole } from "./lib/fur-elise-remix";
import { SOUNDTRACK } from "./lib/fur-elise-showcase-choice";
import { CAM_X, CAM_Y, CELL } from "./lib/fur-elise-layout";
import { START, TOTAL, LAST_OFF, STARTS, CX, CY, CKIND, CTO, LABEL_F, LABEL_TEXT, FX_F, FX_K, FX_X, FX_Y, OVERLORD, pictureAt, explosions } from "./lib/fur-elise-showcase-run";

/** The piece, one clip: the soundtrack the switch picks (only the clip played goes in the map). */
const WHOLE = SOUNDTRACK === "straight" ? straightWhole : SOUNDTRACK === "cinematic" ? cinematicWhole : remixWhole;

/** units.dat's flingy bytes of types 12 … 15 (Battlecruiser, Spider Mine, Nuclear Missile, Civilian), one dword. */
const LOOKS = 0x664504;
const looks = (flingy: number) => 70 + flingy * 256 + 109 * 65536 + 71 * 16777216;
/** A Spider Mine made with a Flag's looks (flingy 126), and its own put back after (89). */
const FLAG_LOOK = looks(126), MINE_LOOK = looks(89);
const OWNERS = [P3, P4, P5, P6, P7, P8];
const AT = reserveLocation("fur elise: where a pixel is made");
const FX = reserveLocation("fur elise: where an explosion is made");
const VIEW = reserveLocation("fur elise: the camera");

/**
 * One pixel changed (kind: unit · 8 + its old colour, 0 none): made, taken away, or handed to the player of its new
 * colour with Give Units, which recolours a unit where it stands (made again where one was taken away in the same frame,
 * a Spider Mine would be put beside its place).
 */
function change(x: number, y: number, kind: number, to: number) {
  if (kind < 8) {
    centerLocation(AT, x, y, 32, 32);
    if (kind === 0) OWNERS.forEach((p, k) => { if (to === k + 1) createUnit(p, units.ZergOverlord, 1, AT); });
    else if (to === 0) OWNERS.forEach((p, k) => { if (kind === k + 1) removeUnitAt(p, units.ZergOverlord, 1, AT); });
    else OWNERS.forEach((p, a) => { if (kind === a + 1) OWNERS.forEach((q, b) => { if (to === b + 1) giveUnits(p, q, units.ZergOverlord, 1, AT); }); });
  } else {
    centerLocation(AT, x, y, 4, 4);
    if (kind === 8) OWNERS.forEach((p, k) => { if (to === k + 1) createUnit(p, units.SpiderMine, 1, AT); });
    else if (to === 0) OWNERS.forEach((p, k) => { if (kind === k + 9) removeUnitAt(p, units.SpiderMine, 1, AT); });
    else OWNERS.forEach((p, a) => { if (kind === a + 9) OWNERS.forEach((q, b) => { if (to === b + 1) giveUnits(p, q, units.SpiderMine, 1, AT); }); });
  }
}

/** An explosion: a Wraith (1) or a Battlecruiser (2) made and killed in one pass, its death on the stage. */
function explode(kind: number, x: number, y: number) {
  centerLocation(FX, x, y, 64, 64);
  if (kind === 1) { createUnit(P7, units.TerranWraith, 1, FX); killUnitAt(P7, units.TerranWraith, 1, FX); }
  else { createUnit(P7, units.TerranBattlecruiser, 1, FX); killUnitAt(P7, units.TerranBattlecruiser, 1, FX); }
}

program(async () => {
  centerLocation(VIEW, CAM_X, CAM_Y, 32, 32);
  centerView(VIEW);
  let g = 0, i = 0, l = 0, e = 0, camera = 0;
  while (g < TOTAL) {
    // The piece, one clip, two frames before its picture begins.
    if (g === START) playWav(WHOLE, 0);
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
    while (e < FX_F.length && FX_F[e] === g) { explode(FX_K[e], FX_X[e], FX_Y[e]); e++; }
    // The camera kept on the stage.
    camera++;
    if (camera >= 96) { camera = 0; centerView(VIEW); }
    await nextFrame();
    g++;
  }
  // The piece is over: the keyboard stays, the game waits.
});

/* ── Tests: the picture the game holds is the one worked out ── */

/** The pixels a frame shows, as text to compare: "unit owner x y" each, sorted. */
function expected(f: number): string[] {
  return pictureAt(f).map((p) => `${p.unit === OVERLORD ? "o" : "m"} ${p.color + 1} ${p.x} ${p.y}`).sort();
}

/** What the game holds: Overlords (snapped to their cell's centre: made a few pixels off it) and Spider Mines of P3 … P8. */
function held(sim: { units(q: { type: number }): readonly { x: number; y: number; owner: number; alive: boolean }[] }): string[] {
  const snap = (v: number) => Math.round((v - CELL / 2) / CELL) * CELL + CELL / 2;
  const out: string[] = [];
  for (const u of sim.units({ type: units.ZergOverlord })) if (u.alive && u.owner >= 2 && u.owner <= 7) out.push(`o ${u.owner} ${snap(u.x)} ${snap(u.y)}`);
  for (const u of sim.units({ type: units.SpiderMine })) if (u.alive && u.owner >= 2 && u.owner <= 7) out.push(`m ${u.owner} ${u.x} ${u.y}`);
  return out.sort();
}

/** "" when what the game holds after `frames` is the picture of one of the frames just before (the program starts a frame or two in). */
function matches(sim: Parameters<typeof held>[0], frames: number): string {
  const got = held(sim);
  for (let f = frames - 4; f <= frames; f++) if (expected(f).join("|") === got.join("|")) return "";
  const want = expected(frames - 2);
  const missing = want.filter((w) => !got.includes(w)), extra = got.filter((w) => !want.includes(w));
  return `frame ${frames}: ${missing.length} missing (${missing.slice(0, 4).join(", ")}), ${extra.length} extra (${extra.slice(0, 4).join(", ")})`;
}

test("every frame of the piece shows the picture worked out, and the end is said", (sim) => {
  sim.frames(20);
  let wrong = "", most = 0;
  for (let f = 21; f < TOTAL && !wrong; f++) {
    sim.frames(1);
    wrong = matches(sim, f);
    if (f % 8 === 0) most = Math.max(most, sim.units({}).filter((u) => u.alive).length);
  }
  expect(wrong).toBe("");
  // Of the game's 1,700 units, with the Map Revealers.
  expect(most < 1000 ? "fewer than 1000" : `${most}`).toBe("fewer than 1000");
  // (The end's line by its ASCII part: the lifted game reads the map's UTF-8 text as Latin-1; Remastered shows the ü.)
  expect(sim).toHavePrinted("Ludwig van Beethoven");
});

test("the storm's explosions leave nothing behind", (sim) => {
  // Each is a Wraith or a Battlecruiser made and killed in one pass: none is ever seen alive.
  const alive = () => sim.units({ type: units.TerranWraith }).filter((u) => u.alive).length + sim.units({ type: units.TerranBattlecruiser }).filter((u) => u.alive).length;
  const first = explosions[0].frame, last = explosions[explosions.length - 1].frame;
  sim.frames(first - 10);
  let most = 0;
  for (let f = first - 10; f < last + 20; f++) { sim.frames(1); most = Math.max(most, alive()); }
  expect(most).toBe(0);
  expect(LAST_OFF < TOTAL).toBe(true);
});
