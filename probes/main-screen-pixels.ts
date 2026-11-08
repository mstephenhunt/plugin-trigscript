// The main-screen spike (TrigScript 4, the third Showcase): can a map draw a colour picture on Remastered's main game
// screen, many pixels changed every frame, with the game's own units? A pixel here is a Spider Mine — the one unit a
// trigger makes exactly where asked, 16 pixels apart or closer, since mines never collide — given another unit's looks
// by a write to units.dat before it is made (Magenta's unit.graphics), and coloured every frame by `u.drawAs(p)`: one
// masked write of its sprite's owner byte, which is the colour the game draws a unit in. The unit's real owner stays
// Player 1, so the board keeps its own vision. Remastered's emulator takes that byte into the game for 0 … 11 (the R0
// tool, 2026-11-08); whether its graphics then draw the new colour, in Classic and in HD, is what this probe asks.
//
// What to look for, by the second (each step says so in the text lines; press F5 when it says, to see both graphics):
//   A   1  two rows. Top: 12 pixels drawn as P1 … P12. Below: real Flags made by P1 … P8 and P12. Same colours?
//   B  12  a 20 × 12 board of Flag-looking pixels, 32 apart, a rainbow moving across it every frame
//   C  28  the same board as Zerg Eggs, then 37 as start-location rings 64 apart, then 46 as plain Spider Mines
//   D  55  a filled square turning, white and yellow on blue, on the Flag board
//   E  71  the dense board: 40 × 24 Flag pixels 16 apart, 960 written every frame, the rainbow again
// Single player; nothing reads the keys.
//   npx tsx probes/lib/main-screen-map.mts fixtures/eud/main-screen-pixels-base.scx
//   MAP_NAME="Main Screen Pixels" NO_BASES=1 npx tsx scripts/build-fixture.mts probes/main-screen-pixels.ts fixtures/eud/main-screen-pixels.scx fixtures/eud/main-screen-pixels-base.scx
//   npx tsx scripts/test-game.mts probes/main-screen-pixels.ts fixtures/eud/main-screen-pixels-base.scx
// Answer sheet: probes/answers/main-screen-pixels.txt.
// probe-players: {"0":{"rgb":[230,30,30]},"1":{"rgb":[255,140,0]},"2":{"rgb":[250,230,40]},"3":{"rgb":[40,200,60]},"4":{"rgb":[0,220,220]},"5":{"rgb":[30,70,240]},"6":{"rgb":[160,60,220]},"7":{"rgb":[255,255,255]}}
import { test, expect, type Unit, type UnitType } from "trigscript";

const MINE = 13 as UnitType, FLAG = 215 as UnitType;
/** units.dat's flingy bytes of types 12 … 15, one dword: the Spider Mine's (13) is the second. */
const LOOKS = 0x664504;
const looks = (flingy: number) => 70 + flingy * 256 + 109 * 65536 + 71 * 16777216;
/** The flingies whose sprites the pixels borrow: a Flag, a Zerg Egg, a start location, the Spider Mine's own. */
const FLAG_LOOK = 126, EGG_LOOK = 6, RING_LOOK = 140, MINE_LOOK = 89;

/** The board: 640 × 384 pixels of the map, at the same place for every pitch. */
const OX = 1024, OY = 1024, BW = 640, BH = 384;
const AT = reserveLocation("main-screen pixels: where each pixel is made");
const VIEW = reserveLocation("main-screen pixels: the camera");

/** cos and sin × 256 of 64 angles round the circle. */
const COS = Array.from({ length: 64 }, (_, i) => Math.round(256 * Math.cos((i * Math.PI) / 32)));
const SIN = Array.from({ length: 64 }, (_, i) => Math.round(256 * Math.sin((i * Math.PI) / 32)));
const cosOf = game((a: number): number => COS[a]);
const sinOf = game((a: number): number => SIN[a]);

program(async () => {
  const px: Unit[] = [];
  /** Each pixel's diagonal band, and where it is from the board's middle, in pixels. */
  const band: number[] = [];
  const rx: number[] = [];
  const ry: number[] = [];

  function setLooks(which: number) {
    if (which === FLAG_LOOK) setMemory(LOOKS, "set", looks(FLAG_LOOK));
    else if (which === EGG_LOOK) setMemory(LOOKS, "set", looks(EGG_LOOK));
    else if (which === RING_LOOK) setMemory(LOOKS, "set", looks(RING_LOOK));
    else setMemory(LOOKS, "set", looks(MINE_LOOK));
  }

  function clear() {
    for (const u of allUnits()) if (u.type == MINE) u.remove();
    px.length = 0;
    band.length = 0;
    rx.length = 0;
    ry.length = 0;
  }

  /** A board of pixels `pitch` apart with the looks of `which`, a row a frame. */
  async function board(pitch: number, which: number) {
    clear();
    await nextFrame();
    setLooks(which);
    let y = 0;
    while (y < BH / pitch) {
      let x = 0;
      while (x < BW / pitch) {
        centerLocation(AT, OX + x * pitch + pitch / 2, OY + y * pitch + pitch / 2);
        createUnit(P1, MINE, 1, AT);
        x++;
      }
      await nextFrame();
      y++;
    }
    setLooks(MINE_LOOK);
    for (const u of allUnits()) {
      if (u.type == MINE) {
        px.push(u);
        band.push(Math.floor((u.x - OX + u.y - OY) / 32));
        rx.push(u.x - OX - BW / 2);
        ry.push(u.y - OY - BH / 2);
      }
    }
  }

  centerLocation(VIEW, OX + BW / 2, OY + BH / 2 + 40);
  centerView(VIEW);
  await sleep(seconds(1));

  // A: the colours.
  print("A: top row, 12 pixels drawn as P1 ... P12. Below, real Flags of P1 ... P8 and P12. Do the colours match?");
  setLooks(FLAG_LOOK);
  for (let i = 0; i < 12; i++) { centerLocation(AT, OX + 64 + i * 48, OY + 128); createUnit(P1, MINE, 1, AT); }
  setLooks(MINE_LOOK);
  for (const u of allUnits()) if (u.type == MINE) u.drawAs(Math.floor((u.x - OX - 64) / 48));
  const owners = [P1, P2, P3, P4, P5, P6, P7, P8];
  owners.forEach((p, i) => { centerLocation(AT, OX + 64 + i * 48, OY + 224); createUnit(p, FLAG, 1, AT); });
  centerLocation(AT, OX + 64 + 11 * 48, OY + 224);
  createUnit(players.P12, FLAG, 1, AT);
  await sleep(seconds(5));
  print("Press F5 now (the other graphics).");
  await sleep(seconds(5));
  for (const u of allUnits()) if (u.type == FLAG) u.remove();

  // B … E, one board each: its pitch, its looks, how long, and what is drawn (0 the rainbow, 1 the turning square).
  let step = 0;
  while (step < 6) {
    let pitch = 32, which = FLAG_LOOK, frames = 16 * 24, square = 0;
    if (step === 0) print("B: 20 x 12 Flag pixels, a rainbow moving every frame. Does every pixel change? Smooth or jumpy?");
    else if (step === 1) { print("C1: the same as Zerg Eggs."); which = EGG_LOOK; frames = 8 * 24; }
    else if (step === 2) { print("C2: start-location rings, 64 apart."); which = RING_LOOK; pitch = 64; frames = 8 * 24; }
    else if (step === 3) { print("C3: plain Spider Mines (they burrow)."); which = MINE_LOOK; frames = 8 * 24; }
    else if (step === 4) { print("D: a filled square turning, white and yellow on blue. Does it read as a square?"); square = 1; }
    else { print("E: 40 x 24 Flag pixels 16 apart, all 960 written every frame. Smooth? Does the game slow down?"); pitch = 16; }
    await board(pitch, which);
    let t = 0;
    while (t < frames) {
      if (square === 1) {
        const a = (t >> 1) & 63;
        const c = cosOf(a), s = sinOf(a);
        for (let k = 0; k < px.length; k++) {
          const u = rx[k] * c + ry[k] * s, v = ry[k] * c - rx[k] * s;
          if (Math.abs(u) < 150 * 256 && Math.abs(v) < 150 * 256) px[k].drawAs(u > 0 ? 7 : 2);
          else px[k].drawAs(5);
        }
      } else {
        // The rainbow: bands of 64 pixels across the diagonal, moving 16 pixels every other frame.
        for (let k = 0; k < px.length; k++) px[k].drawAs(((band[k] + (t >> 1)) >> 1) & 7);
      }
      if (t === frames >> 1) print("Press F5 now (the other graphics).");
      await nextFrame();
      t++;
    }
    step++;
  }

  clear();
  print("That is the end of the main-screen probe. Thank you.");
}, { owner: P1 });

/** A spider mine's sprite owner byte, read through the deaths table: the unit's +0x0C, then the sprite's +0x0A. */
function spriteOwners(sim: { deaths(p: number, t: number): number }): { x: number; y: number; owner: number }[] {
  const mem = (a: number) => { const e = (a - 0x58a364) / 4; return sim.deaths(e % 12, Math.floor(e / 12)) >>> 0; };
  const out: { x: number; y: number; owner: number }[] = [];
  for (let slot = 0; slot < 1700; slot++) {
    const u = 0x59cca8 + slot * 336;
    if ((mem(u + 0x64) & 0xffff) !== 13 || mem(u + 0x0c) === 0) continue;
    const pos = mem(u + 0x28);
    out.push({ x: pos & 0xffff, y: pos >>> 16, owner: (mem(mem(u + 0x0c) + 8) >>> 16) & 255 });
  }
  return out;
}

// The sprites' bytes are read from the game's memory, which the simulator does not keep: there the tests hold the
// units alone (where they stand, who owns them), and the colours in the lifted game.
test("A: the top row is drawn as P1 … P12, the units still Player 1's", (sim) => {
  sim.seconds(3);
  expect(sim.units({ type: 13 }).length).toBe(12);
  expect(sim.units({ type: 13 }).every((u) => u.owner === 0)).toBe(true);
  const row = spriteOwners(sim).sort((a, b) => a.x - b.x);
  if (row.length) expect(row.map((p) => p.owner).join(",")).toBe("0,1,2,3,4,5,6,7,8,9,10,11");
});

test("B: 240 pixels on their cells, the rainbow's bands", (sim) => {
  sim.seconds(20);
  const mines = sim.units({ type: 13 });
  expect(mines.length).toBe(240);
  expect(mines.every((u) => (u.x - 1040) % 32 === 0 && (u.y - 1040) % 32 === 0)).toBe(true);
  const all = spriteOwners(sim);
  if (all.length) {
    // Every pixel's colour is its band's, one moment of the rainbow: neighbours along a diagonal agree.
    const at = new Map(all.map((p) => [`${p.x},${p.y}`, p.owner]));
    expect(all.every((p) => !at.has(`${p.x + 32},${p.y - 32}`) || at.get(`${p.x + 32},${p.y - 32}`) === p.owner)).toBe(true);
    expect(new Set(all.map((p) => p.owner)).size).toBe(8);
  }
});

test("E: 960 pixels 16 apart", (sim) => {
  sim.seconds(80);
  const mines = sim.units({ type: 13 });
  expect(mines.length).toBe(960);
  expect(mines.every((u) => (u.x - 1032) % 16 === 0 && (u.y - 1032) % 16 === 0)).toBe(true);
});
