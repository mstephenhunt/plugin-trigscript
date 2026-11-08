// Falling blocks on the minimap, and Korobeiniki that follows the game (TrigScript 4's second showcase). The well is
// "trigscript/screen": a cell an Overlord, owned by the player whose colour its piece has (StarCraft's own player
// colours), so the minimap shows the board; the well's walls are the map's own Platform (probes/lib/blocks-map.mts).
// The music is probes/lib/korobeiniki.ts cut into half bars ("trigscript/music" stems), and the game is its conductor:
//
//   - the pieces fall on the beat (143 bpm, ten frames a beat): a row every beat and a half at level 1, every eighth
//     of a beat at the last, so a piece lands, and its lines go, on the music;
//   - the intro plays at the title; once a game starts the song goes its own way, verse and break by turns, the drums
//     coming in at level 2;
//   - each new level (every four lines) brings the build (the riser, the snare roll) and the drop after it;
//   - a stack past two thirds of the well brings the build too, again and again until it is dug down, then the drop;
//   - four lines at once set off the drop straight away;
//   - from level 4 the last verse, a tone up, takes the verse's place; the outro when the game is over;
//   - one, two or three lines ring a chime of as many notes on the next beat.
// A ghost shows where the piece would land: four grey Overlords of Player 2's, the computer. Remastered's minimap shows
// no units of Players 9 to 12 (plays 2 and 3, 2026-11-08), and the computer is the one slot that owns no piece; it
// moves its own units, and an air unit on the move pushes the pieces' Overlords off their cells (play 4), so the
// ghost is taken away and made again every few frames, all of the computer's Overlords on the screen with it.
//
// A D move (hold to slide), W turns clockwise, Q the other way, S drops (hold to keep dropping), Space all the way,
// E holds the piece for later. Host it as a multiplayer game, alone, with the game's music off.
// Remastered will not start a game without a computer, and a computer moves its own units, so Player 2 is a computer
// that owns no cell; P3 … P8 and you own them, each given a colour (your own units are green on the minimap anyway).
// probe-players: {"0":{"rgb":[16,252,24]},"1":{"rgb":[120,120,120]},"2":{"rgb":[244,4,4]},"3":{"rgb":[204,224,208]},"4":{"rgb":[12,72,204]},"5":{"rgb":[252,252,56]},"6":{"rgb":[44,180,148]},"7":{"rgb":[136,64,156]}}
// Built with
//   npx tsx probes/lib/blocks-map.mts fixtures/eud/blocks-base.scx
//   NO_BASES=1 MAP_NAME=Korobeiniki npx tsx scripts/build-fixture.mts probes/blocks.tsx fixtures/eud/blocks.scx fixtures/eud/blocks-base.scx
import { program, P1, players, keyPressed, keyHeld, random, nextFrame, memory, ui, start, createUnit, removeUnitAt, centerLocation, reserveLocation, units, test, expect } from "trigscript";
import { music, Band } from "trigscript/music";
import { Screen } from "trigscript/screen";
import { Panel, thousands } from "trigscript/ui";
import { korobeiniki, crash, ROOM } from "./lib/korobeiniki";
import { WELL_X, WELL_Y, WELL_W, WELL_H, NEXT_X, NEXT_Y, HOLD_X, HOLD_Y, VIS_X, VIS_Y, VIS_H, SCREEN_W, SCREEN_H } from "./lib/blocks-layout";

/* ── The music ── */

const chimes = music.presets.bell({ volume: 0.16 });
/** Notes rung one after another, a sixteenth apart. */
const chime = (notes: readonly string[]) => notes.map((n, i) => chimes.note(n, 1.6).gain(0.85 + i * 0.1)).reduce((all, c, i) => all.mix(c, i * 0.1));
const st = music.stems(korobeiniki, {
  layers: { drums: ["kit", "hats", "fx"], bass: ["bass"], harmony: ["pad", "strum", "keys"], melody: ["lead", "saw", "bell", "acid"] },
  reverb: ROOM,
  master: (c) => c.filter("highshelf", 9000, { gain: 1.5 }),
  // By their place: 1, 2 and 3 for that many lines.
  stingers: { crash: crash.gain(0.7), one: chime(["E6"]), two: chime(["C6", "E6"]), three: chime(["A5", "C6", "E6"]) },
  every: 2,
});
/** The sections, in the song's order. */
const INTRO = 0, VERSE = 1, BUILD = 2, DROP = 3, BREAK = 4, LAST = 5, OUTRO = 6;
const MUSIC = ["intro", "verse", "build", "drop", "break", "last verse, a tone up", "outro"];
/** The layers, in the order of `layers` above. */
const DRUMS = 0;
/** Frames a beat (ten at 143 on Fastest). */
const BEAT_FRAMES = st.barFrames / st.beats;

/* ── The visualizer: a bar a layer, right of the well ── */

/** Where each section's first piece is in PLAYS; whether a layer begins a note in a piece, four numbers a piece. */
const FIRST: number[] = st.pieces.map((_, k) => st.pieces.slice(0, k).reduce((n, sec) => n + sec.length, 0));
const PLAYS: number[] = st.pieces.flatMap((sec) => sec.flatMap((piece) => [0, 1, 2, 3].map((l) => (piece[l] ? 1 : 0))));
/** How high the bars jump on a beat, by section (the build climbs piece by piece); how low they settle between. */
const PEAK = [6, 9, 7, 13, 6, 13, 5];
const FLOOR = 2;
/** Each bar's colour (drums red, bass blue, harmony teal, melody yellow), and the frames it takes to fall a pixel. */
const BAR_COLOR = [1, 3, 6, 5];
const BAR_FALL = [1, 2, 3, 2];

/* ── The pieces ── */

// Each piece's four cells in its box, as it first appears: I O T S Z J L.
const PIECES: [number, number][][] = [
  [[0, 1], [1, 1], [2, 1], [3, 1]],
  [[1, 0], [2, 0], [1, 1], [2, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[2, 0], [0, 1], [1, 1], [2, 1]],
];
const BOX = [4, 4, 3, 3, 3, 3, 3];
/**
 * Each piece's colour, as "trigscript/screen" numbers them — 1 to 7 are the units of P3, P4, P5, P1, P6, P7, P8,
 * coloured above red, white, blue, green (yours), yellow, teal and purple: I red, O white, T green, S blue, Z yellow,
 * J teal, L purple.
 */
const COLOR = [1, 2, 4, 3, 5, 6, 7];
/** The cells of piece p turned r times, one after another as x, y: eight numbers a turn, thirty-two a piece. */
const SHAPES: number[] = PIECES.flatMap((cells, p) =>
  [0, 1, 2, 3].flatMap((r) => {
    let turned = cells;
    // The O stays as it is; the others turn a quarter clockwise in their box.
    for (let i = 0; i < r && p !== 1; i++) turned = turned.map(([x, y]) => [BOX[p] - 1 - y, x] as [number, number]);
    return turned.flat();
  }),
);
/** Where a turn that does not fit is tried next, one after another: a step either way, two for the I, then a row up. */
const KICK_X = [0, -1, 1, -2, 2, 0];
const KICK_Y = [0, 0, 0, 0, 0, -1];

/* ── The rules ── */

/** A row falls every so many eighths of a beat, by level: a beat and a half at level 1, an eighth at level 10. */
const SPEED = [12, 10, 8, 6, 5, 4, 3, 2, 2, 1];
const LINES_A_LEVEL = 4;
/** The level (from 0) the last verse, a tone up, takes over from the verse: level 4 on the screen. */
const TONE_UP = 3;
const POINTS = [0, 100, 300, 500, 800];
/** Held, A or D slides after this many frames, then a column every SLIDE frames; S held drops a row every DROP frames. */
const DELAY = 7, SLIDE = 2, DROP_EVERY = 2;
/** The stack is high when it reaches this row of the well, and low again below LOW. */
const HIGH = 7, LOW = 10;
const TITLE = 0, PLAYING = 1, OVER = 2;
/** Where the ghost's Overlords are made and taken away: a cell, or the whole well. */
const GHOST = reserveLocation("blocks: the ghost piece");
/** How often the ghost is made again, in frames. */
const GHOST_EVERY = 1;


program(async () => {
  const screen = new Screen(0, 0, SCREEN_W, SCREEN_H);
  screen.reveal(P1);
  const board: number[] = new Array(WELL_W * WELL_H).fill(0);
  const band = new Band();
  band.loop = true;
  start(music.conduct(st, band));

  // (mode TITLE, music INTRO: written as numbers, which is what an object of the program starts from.)
  const hud = { score: 0, lines: 0, level: 0, best: 0, mode: 0, music: 0 };
  ui.lines(P1, () => (
    <>
      <Panel title="KOROBEINIKI">
        <span color="yellow">{thousands(hud.score)}</span>   lines {hud.lines}   level {hud.level + 1}   best {thousands(hud.best)}
      </Panel>
      <line color="sage">
        music: {MUSIC.map((name, k) => hud.music === k && <span color="white">{name}</span>)}
      </line>
      {hud.mode === TITLE && <line color="yellow">Space to play</line>}
      {hud.mode === OVER && <line color="red">Game over. Space to play again</line>}
      <line color="grey">A D move   W Q turn   S down   Space drop   E hold</line>
    </>
  ));

  let piece = 0, next = 0, held = -1, turn = 0, px = 0, py = 0;
  /** Whether a piece was held since the last one landed: once a piece. */
  let swapped = false;
  let high = false;
  /** A level was reached, or four lines went at once, since the band was last told. */
  let leveled = false, tetris = false;
  // The ghost: where the piece would land, four of the computer's Overlords; drawn again when the piece moves or turns.
  const ghostX = [0, 0, 0, 0];
  const ghostY = [0, 0, 0, 0];
  const ghostOn = [0, 0, 0, 0];
  let ghostKey = -1;
  /** Frames since the ghost was made: it is made again every GHOST_EVERY, before the computer can move it far. */
  let ghostAge = 0;

  /** A cell of the well, on the board and on the screen. */
  function cell(x: number, y: number, color: number) {
    board[y * WELL_W + x] = color;
    screen.set(WELL_X + x, WELL_Y + y, color);
  }

  /** A piece as it first appears, in a box of four by two at (x, y); −1 an empty box. */
  function showBox(x: number, y: number, p: number) {
    screen.rect(x, y, 4, 2, 0);
    if (p >= 0) {
      const at = p * 32;
      for (let k = 0; k < 4; k++) screen.set(x + SHAPES[at + k * 2], y + SHAPES[at + k * 2 + 1], COLOR[p]);
    }
  }

  /** Whether piece p, turned r times, fits with its box's corner at (x, y): inside the walls, on empty cells. */
  function fits(p: number, r: number, x: number, y: number): boolean {
    const at = (p * 4 + r) * 8;
    for (let k = 0; k < 4; k++) {
      const cx = x + SHAPES[at + k * 2];
      const cy = y + SHAPES[at + k * 2 + 1];
      if (cx < 0 || cx >= WELL_W || cy >= WELL_H) return false;
      if (cy >= 0 && board[cy * WELL_W + cx] !== 0) return false;
    }
    return true;
  }

  /** The falling piece drawn into the well in a colour (0 takes it out again). */
  function place(color: number) {
    const at = (piece * 4 + turn) * 8;
    for (let k = 0; k < 4; k++) {
      const cy = py + SHAPES[at + k * 2 + 1];
      if (cy >= 0) cell(px + SHAPES[at + k * 2], cy, color);
    }
  }

  /** The piece moved and turned, if it fits there. */
  function move(dx: number, dy: number, dr: number): boolean {
    place(0);
    const r = (turn + dr) % 4;
    const ok = fits(piece, r, px + dx, py + dy);
    if (ok) { px += dx; py += dy; turn = r; }
    place(COLOR[piece]);
    return ok;
  }

  /** A turn, where it fits: in place, else at the first of the kicks that fits. */
  function rotate(dr: number) {
    place(0);
    const r = (turn + dr) % 4;
    for (let k = 0; k < KICK_X.length; k++) {
      if (fits(piece, r, px + KICK_X[k], py + KICK_Y[k])) { px += KICK_X[k]; py += KICK_Y[k]; turn = r; break; }
    }
    place(COLOR[piece]);
  }

  /** Full rows taken out, the rows above them moved down, in one pass from the floor up. How many there were. */
  function clearRows(): number {
    // `to`: the row the next row that stays is moved to. (Rows by a while: a for over the well's 22 would be unrolled,
    // a copy of the twelve cells' copy for each.)
    let to = WELL_H - 1;
    let y = WELL_H - 1;
    while (y >= 0) {
      let full = true;
      for (let x = 0; x < WELL_W; x++) if (board[y * WELL_W + x] === 0) full = false;
      if (!full) {
        if (to !== y) for (let x = 0; x < WELL_W; x++) cell(x, to, board[y * WELL_W + x]);
        to--;
      }
      y--;
    }
    const cleared = to + 1;
    while (to >= 0) { for (let x = 0; x < WELL_W; x++) cell(x, to, 0); to--; }
    return cleared;
  }

  /** The highest row with anything in it; the well's height when empty. */
  function top(): number {
    let y = 0;
    while (y < WELL_H) {
      for (let x = 0; x < WELL_W; x++) if (board[y * WELL_W + x] !== 0) return y;
      y++;
    }
    return WELL_H;
  }

  /** A piece at the top of the well: the game is over when it does not fit there. */
  function enter(p: number) {
    ghostKey = -1;
    piece = p;
    turn = 0;
    px = WELL_W / 2 - 2;
    py = 0;
    if (fits(piece, turn, px, py)) place(COLOR[piece]);
    else {
      hud.mode = OVER;
      if (hud.score > hud.best) hud.best = hud.score;
      band.go(OUTRO);
    }
  }

  /** The next piece in, a new one in the box: never the same piece three times running. */
  function spawn() {
    const p = next;
    next = random(7);
    if (next === p) next = random(7);
    showBox(NEXT_X, NEXT_Y, next);
    swapped = false;
    enter(p);
  }

  /** The piece stays where it is; full rows go, score and ring. */
  function land() {
    const n = clearRows();
    if (n > 0) {
      hud.lines += n;
      hud.score += POINTS[n] * (hud.level + 1);
      const level = Math.min(SPEED.length - 1, Math.floor(hud.lines / LINES_A_LEVEL));
      if (level > hud.level) leveled = true;
      hud.level = level;
      if (n === 4) tetris = true;
      else band.sting(n);
    }
    const t = top();
    if (t < HIGH) high = true;
    if (t >= LOW) high = false;
    spawn();
  }

  /** The piece put by for later, the one put by before (or the next) in its place. */
  function hold() {
    if (swapped) return;
    place(0);
    const was = held;
    held = piece;
    showBox(HOLD_X, HOLD_Y, held);
    if (was < 0) spawn();
    else enter(was);
    swapped = true;
  }

  /** The music the game wants, told to the band every frame (see the top of the file). */
  function direct() {
    const s = band.section;
    const base = hud.level >= TONE_UP ? LAST : VERSE;
    if (hud.mode !== PLAYING) {
      // The outro rings out, then the intro, again and again.
      band.loop = s === INTRO;
      if (s === OUTRO) band.queue(INTRO);
      else if (s !== INTRO && band.next !== OUTRO && band.next !== INTRO) band.go(INTRO);
    } else {
      // What the game did, at the next half bar: four lines, the drop; a level, or a stack grown high, the build (and
      // after it, as the song goes, the drop). Neither cuts into a drop.
      if (tetris && s !== DROP) band.go(DROP);
      else if ((leveled || (high && s !== BUILD)) && s !== DROP && s !== BUILD && band.next !== DROP) band.go(BUILD);
      tetris = false;
      leveled = false;
      // While the stack stays high the build plays again; else each section goes on to the one after it.
      band.loop = s === BUILD && high;
      if (!(band.now && band.next >= 0)) {
        if (s === INTRO || s === OUTRO) band.go(base);
        else if (s === VERSE || s === LAST || s === DROP) band.queue(BREAK);
        else if (s === BUILD) band.queue(DROP);
        else band.queue(base);
      }
    }
    band.on[DRUMS] = !(hud.mode === PLAYING && hud.level === 0 && s === VERSE);
    hud.music = s;
  }

  /** Every Overlord of the computer's on the screen taken away, wherever it has wandered to. */
  function clearGhost() {
    centerLocation(GHOST, SCREEN_W * 32, SCREEN_H * 32, SCREEN_W * 64, SCREEN_H * 64);
    removeUnitAt(players.P2, units.ZergOverlord, "All", GHOST);
    ghostOn[0] = 0; ghostOn[1] = 0; ghostOn[2] = 0; ghostOn[3] = 0;
  }

  /** The ghost where the piece would land now; taken away when no game is on. */
  function ghost() {
    // A ghost cell the piece (or the stack) has come into goes before the piece's Overlord is made there: two air units
    // on one spot push each other apart, and the piece's would stay off its cell (play 4, 2026-11-08).
    let j = 0;
    while (j < 4) {
      if (ghostOn[j] === 1 && board[ghostY[j] * WELL_W + ghostX[j]] !== 0) {
        centerLocation(GHOST, (WELL_X + ghostX[j]) * 64 + 32, (WELL_Y + ghostY[j]) * 64 + 32, 32, 32);
        removeUnitAt(players.P2, units.ZergOverlord, 1, GHOST);
        ghostOn[j] = 0;
      }
      j++;
    }
    // (Not its row: falling does not move the ghost.)
    const key = hud.mode === PLAYING ? (piece * 4 + turn) * 32 + px + 4 : -2;
    ghostAge++;
    if (key === ghostKey && ghostAge < GHOST_EVERY) return;
    ghostKey = key;
    ghostAge = 0;
    clearGhost();
    if (hud.mode !== PLAYING) return;
    // Down as far as the piece would go, with the piece itself out of the way.
    place(0);
    let gy = py;
    while (fits(piece, turn, px, gy + 1)) gy++;
    place(COLOR[piece]);
    const at = (piece * 4 + turn) * 8;
    let k = 0;
    while (k < 4) {
      const cx = px + SHAPES[at + k * 2], cy = gy + SHAPES[at + k * 2 + 1];
      // Not where the piece is already.
      if (cy >= 0 && board[cy * WELL_W + cx] === 0) {
        centerLocation(GHOST, (WELL_X + cx) * 64 + 32, (WELL_Y + cy) * 64 + 32, 32, 32);
        createUnit(players.P2, units.ZergOverlord, 1, GHOST);
        ghostX[k] = cx;
        ghostY[k] = cy;
        ghostOn[k] = 1;
      }
      k++;
    }
  }

  // The bars: how high each is, and how high it is drawn.
  const bars = [0, 0, 0, 0];
  const drawn = [0, 0, 0, 0];
  let lastBeat = -1;
  /** The bars a frame on: on a new beat each layer that begins notes jumps up, then falls back towards the floor. */
  function visualize(beat: number) {
    const s = band.section;
    const kick = beat !== lastBeat;
    lastBeat = beat;
    const peak = s === BUILD ? PEAK[BUILD] + (band.piece >> 1) : PEAK[s];
    // (A while, not a for over four: a loop over a length known when the script is built is unrolled, four copies.)
    let l = 0;
    while (l < 4) {
      // A note begun in this piece: a jump on each of its beats. Still ringing from the piece before: falling.
      const at = (FIRST[s] + band.piece) * 4 + l;
      const starts = PLAYS[at] === 1;
      if (!band.on[l] || (!starts && (at < 4 || PLAYS[at - 4] === 0))) bars[l] = 0;
      else if (kick && starts) bars[l] = peak;
      else if (bars[l] > FLOOR && memory.game.frame % BAR_FALL[l] === 0) bars[l]--;
      // Two pixels wide, from the bottom up; only the rows that changed are drawn.
      const x = VIS_X + 1 + l * 3, bottom = VIS_Y + VIS_H - 1, color = BAR_COLOR[l];
      while (drawn[l] < bars[l]) { screen.set(x, bottom - drawn[l], color); screen.set(x + 1, bottom - drawn[l], color); drawn[l]++; }
      while (drawn[l] > bars[l]) { drawn[l]--; screen.set(x, bottom - drawn[l], 0); screen.set(x + 1, bottom - drawn[l], 0); }
      l++;
    }
  }

  // Frames A, D and S have been held; the fall of the piece by the beat.
  let left = 0, right = 0, down = 0;
  let fallen = 0;
  while (true) {
    direct();
    // The band's clock: eighths of a beat played. (From the frame its beat began: a program that runs before the band
    // in a frame sees the beat before as ten frames old, eight eighths — the same count as the new beat's first.)
    const eighths = (band.count * st.every + band.beat) * 8 + Math.floor(((memory.game.frame - band.at) * 8) / BEAT_FRAMES);
    const fall = Math.floor(eighths / SPEED[hud.level]);
    visualize(eighths >> 3);

    if (hud.mode !== PLAYING) {
      if (keyPressed(P1, "Space")) {
        board.fill(0);
        screen.rect(WELL_X, WELL_Y, WELL_W, WELL_H, 0);
        showBox(HOLD_X, HOLD_Y, -1);
        hud.score = 0; hud.lines = 0; hud.level = 0; hud.mode = PLAYING;
        held = -1;
        high = false;
        tetris = false;
        leveled = false;
        next = random(7);
        spawn();
        fallen = fall;
      }
    } else {
      // A press moves at once; held, the piece slides after a moment.
      left = keyHeld(P1, "A") ? left + 1 : 0;
      right = keyHeld(P1, "D") ? right + 1 : 0;
      down = keyHeld(P1, "S") ? down + 1 : 0;
      if (keyPressed(P1, "A") || (left > DELAY && left % SLIDE === 0)) move(-1, 0, 0);
      if (keyPressed(P1, "D") || (right > DELAY && right % SLIDE === 0)) move(1, 0, 0);
      if (keyPressed(P1, "W")) rotate(1);
      if (keyPressed(P1, "Q")) rotate(3);
      if (keyPressed(P1, "E")) hold();
      if (keyPressed(P1, "Space")) {
        let rows = 0;
        while (move(0, 1, 0)) rows++;
        hud.score += rows * 2;
        land();
      } else {
        // Dropping by hand moves the piece down; it lands only on the beat, as falling does.
        if (keyPressed(P1, "S") || (down > 0 && down % DROP_EVERY === 0)) if (move(0, 1, 0)) hud.score++;
        if (fall !== fallen) {
          fallen = fall;
          if (!move(0, 1, 0)) land();
        }
      }
    }
    ghost();
    screen.present();
    await nextFrame();
  }
});

test("the title, a game, and the music it asks for", (sim) => {
  sim.frames(10);
  expect(sim).toHavePrinted("KOROBEINIKI");
  expect(sim).toHavePrinted("Space to play");
  expect(sim).toHavePrinted("music: intro");
  sim.press("Space").frames(60);
  expect(sim).toHavePrinted("music: verse");
  // Pieces dropped straight down pile up in the middle until the well is full.
  for (let i = 0; i < 40; i++) sim.press("Space").frames(4);
  sim.frames(200);
  expect(sim).toHavePrinted("Game over. Space to play again");
});


test("every Overlord stays on its cell, the ghost's too", (sim) => {
  sim.frames(10).press("Space").frames(20);
  // Pieces left to fall onto their ghosts, then dropped all the way.
  sim.frames(900);
  for (let i = 0; i < 8; i++) sim.press("Space").frames(40);
  sim.frames(100);
  // A cell's centre is 32 past a multiple of 64; the game puts a made unit a few pixels off it, never half a cell.
  const away = (v: number) => { const d = (((v - 32) % 64) + 64) % 64; return d > 12 && d < 52; };
  const off = sim.units({ type: units.ZergOverlord }).filter((u) => u.alive && (away(u.x) || away(u.y)));
  expect(off.map((u) => `P${u.owner + 1} at ${u.x},${u.y}`).join(", ")).toBe("");
});
