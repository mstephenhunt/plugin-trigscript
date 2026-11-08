/**
 * A script's map played in the lifted game with nothing drawn, and the fog of war it makes read back a frame at a time
 * into pictures (TrigScript 4, S5): what a fog renderer looks like before anyone plays it. Keys can be held over spans
 * of frames, as a player would; each frame's cost is said.
 *
 *   npx tsx scripts/fog-frames.mts <script.ts> <map.scx> [--frames=120] [--keys=20-60:W,60-90:D] [--every=10]
 *     [--area=0,0,128,96] [--player=0] [--out=dir] [--mouse=20-60:200,0] [--units] [--from=1] [--changes=0,0,128,78] [--shots-from=N]
 *     [--orders="20:992,3040;120:1824,3040"] [--sprites=13]
 *
 * Writes <out>/frame-NNNN.png (a tile 4 pixels: white lit, grey fog, black never seen) for every `every`-th frame and
 * <out>/sheet.png of them side by side. --mouse holds the mouse over spans of frames at a place on the screen, from
 * its middle (320, 200) — a hand kept still while the screen moves. --units draws the units on the pictures too, a
 * square each in its owner's colour (the minimap's dots): P1 green, P2 red, P6 orange, the rest grey. Each frame's
 * cost is said in records and in Remastered's milliseconds (compiler/remasteredCost.ts), with the units made in it
 * (Create Unit actions: the fog's brushes and the rest); the summary counts from --from on. --changes reads that part
 * of the fog every frame and says how often the picture changed — the frames between changes, and how much of it
 * changed each time (a picture's cadence and its steps). --orders sends the player's Marines, at each frame named, to
 * a point of the map in pixels, as a right-click does (GameSim.order, the Order action). --sprites=T draws, above the
 * fog's picture, a board of the units of type T as the main screen colours them: each one a square, in the colour of its
 * sprite's owner byte (u.drawAs), as the script's `// probe-players:` line sets the players' colours. Needs a scm-sim checkout
 * (SCM_SIM_DIR) and a scm-js one beside this repository (its PNG encoder, for the pictures).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { GameSim, readLocations, type GameHandle } from "../compiler/gameSim";
import { RemasteredWeigh } from "../compiler/remasteredCost";
import { ActionType } from "../vendor/triggers";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [script, baseMap] = args.filter((a) => !a.startsWith("--"));
if (!script || !baseMap) { console.error("usage: fog-frames.mts <script.ts> <map.scx> [--frames=N] [--keys=a-b:K,…] [--every=N] [--area=x,y,w,h] [--out=dir]"); process.exit(2); }
const frames = Number(flag("frames") ?? 120), every = Number(flag("every") ?? 10), player = Number(flag("player") ?? 0);
const [ax, ay, aw, ah] = (flag("area") ?? "0,0,128,96").split(",").map(Number);
const out = resolve(flag("out") ?? join(root, "fixtures", "fog-frames"));
const keys = (flag("keys") ?? "").split(",").filter(Boolean).map((k) => { const [span, key] = k.split(":"); const [from, to] = span.split("-").map(Number); return { from, to, key }; });
const mice = (flag("mouse") ?? "").split(";").filter(Boolean).map((k) => { const [span, at] = k.split(":"); const [from, to] = span.split("-").map(Number); const [x, y] = at.split(",").map(Number); return { from, to, x, y }; });
const showUnits = args.includes("--units"), countFrom = Number(flag("from") ?? 1);
const spriteType = flag("sprites") === undefined ? null : Number(flag("sprites"));
/** The players' colours for --sprites: the script's probe-players line, else the game's own, roughly; P9 … P12 fixed. */
const PALETTE: [number, number, number][] = [[244, 4, 4], [12, 72, 204], [44, 180, 148], [136, 64, 156], [248, 140, 20], [112, 48, 20], [204, 224, 208], [252, 252, 56], [8, 128, 8], [252, 252, 124], [236, 196, 176], [64, 104, 212]];
{
  const line = /^\/\/ probe-players: (.+)$/m.exec(readFileSync(script, "utf8"));
  if (line) for (const [slot, p] of Object.entries(JSON.parse(line[1]) as Record<string, { rgb?: [number, number, number] }>)) if (p.rgb) PALETTE[Number(slot)] = p.rgb;
}
const changes = flag("changes")?.split(",").map(Number);
/** Pictures only from this frame on (--shots-from): a run of consecutive frames at its end. */
const shotsFrom = Number(flag("shots-from") ?? 0);
const orders = (flag("orders") ?? "").split(";").filter(Boolean).map((o) => { const [f, at] = o.split(":"); const [x, y] = at.split(",").map(Number); return { frame: Number(f), x, y }; });
const sim = resolve(process.env.SCM_SIM_DIR ?? join(root, "..", "scm-sim"));
const from = (p: string) => import(pathToFileURL(join(sim, p)).href);
const { encodePng } = await import(pathToFileURL(join(root, "..", "scm-js", "cli", "src", "png.ts")).href) as { encodePng(rgba: Uint8Array, width: number, height: number): Uint8Array };
/** The unit owners' colours on the pictures. */
const OWNER_RGB: Record<number, [number, number, number]> = { 0: [40, 230, 40], 1: [235, 30, 30], 5: [255, 140, 20] };

const dir = mkdtempSync(join(tmpdir(), "trigscript-fog-"));
try {
  const built = join(dir, basename(script).replace(/\.tsx?$/, "") + ".scx");
  const b = spawnSync("npx", ["tsx", join(root, "scripts", "build-fixture.mts"), resolve(script), built, resolve(baseMap)], { cwd: root, encoding: "utf8", maxBuffer: 256 << 20 });
  if (b.status !== 0) { console.error(b.stdout.split("\n").slice(-20).join("\n"), b.stderr); process.exit(1); }
  const { Archive } = await import(pathToFileURL(join(sim, "node_modules", "mopaq", "dist", "index.mjs")).href);
  const { startExactGame } = await from("src/exact/node.ts");
  const { classicScenario, installEud, placeStrings } = await from("src/exact/eud.ts");
  const { testGame } = await from("src/exact/testGame.ts");
  const { installCost } = await from("src/exact/cost.ts");
  const chk = Archive.open(new Uint8Array(readFileSync(built))).readFile("staredit\\scenario.chk") as Uint8Array;
  const chkPath = join(dir, "scenario.chk");
  writeFileSync(chkPath, classicScenario(chk));
  const run = await startExactGame(chkPath, { game: "ums" });
  const strings = placeStrings(run.lifted, chk);
  installEud(run.lifted, strings);
  const payloadEnd = 0x191943c8 + strings.bytes;
  const cost = installCost(run.lifted);
  cost.weigh = new RemasteredWeigh(run.lifted.m);
  const handle = testGame(run.engine, run.lifted, [{ from: strings.gameTable, to: payloadEnd }], { cost, payloadEnd }) as GameHandle;
  const world = new GameSim(handle, { locations: readLocations(handle) });

  mkdirSync(out, { recursive: true });
  const S = 4, FW = aw * S, FH = ah * S;
  /** The sprite board's picture above the fog's (--sprites): its cells, 8 pixels each, worked out from the first frame it is seen. */
  let board: { x0: number; y0: number; cols: number; rows: number; pitch: number } | null = null;
  const BS = 8;
  const boardH = () => (board ? board.rows * BS + 8 : 0);
  let PW = FW, PH = FH;
  const shots: { frame: number; rgba: Uint8Array; w: number; h: number }[] = [];
  const tone = { "#": 255, "+": 104, ".": 4 } as Record<string, number>;
  const MOUSE = 0x6cddc4;
  let lastPicture: string[] = [], lastChange = 0;
  let lastBoard = new Map<number, number>();
  const boardChanges: number[] = [];
  const gaps: number[] = [], shares: number[] = [];
  let peak = 0, total = 0, peakMs = 0, totalMs = 0, peakMade = 0, totalMade = 0, counted = 0, madeBefore = 0;
  for (let f = 1; f <= frames; f++) {
    for (const k of keys) if (f >= k.from && f < k.to) world.press(k.key);
    // (The mouse on the screen, written where the game keeps it: the map's place follows the screen, as a still hand's.)
    for (const m of mice) if (f >= m.from && f < m.to) { handle.m.setInt32(MOUSE, 320 + m.x, true); handle.m.setInt32(MOUSE + 4, 200 + m.y, true); }
    for (const o of orders) if (o.frame === f) for (const u of world.units({ owner: player, type: 0 })) { world.order(u, "move", { x: o.x, y: o.y }); if (process.env.DEBUG_ORDERS) console.log(`order at ${f}: ${u.x},${u.y} → ${o.x},${o.y}, now ${u.orderId}`); }
    world.frames(1);
    if (process.env.DEBUG_ORDERS && f % 10 === 0) console.log(`frame ${f}: ${world.units({ owner: player, type: 0 }).map((u) => `${u.x},${u.y} order ${u.orderId}`).join(" ")}`);
    const r = cost.report();
    const at = r.conditions.length - 1;
    const spent = at >= 0 ? r.conditions[at] + r.actions[at] : 0;
    const ms = at >= 0 ? r.ns[at] / 1e6 : 0;
    const made = r.byActionType[ActionType.CreateUnit] - madeBefore;
    madeBefore = r.byActionType[ActionType.CreateUnit];
    if (changes && f >= countFrom) {
      const now = world.fog(player, { x: changes[0], y: changes[1], width: changes[2], height: changes[3] }) ?? [];
      if (lastPicture.length) {
        let differ = 0;
        now.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== lastPicture[y][x]) differ++; });
        if (differ > 0) { if (lastChange > 0) gaps.push(f - lastChange); lastChange = f; shares.push(differ / (changes[2] * changes[3])); }
      }
      lastPicture = now;
    }
    if (f >= countFrom) {
      counted++;
      peak = Math.max(peak, spent); total += spent;
      peakMs = Math.max(peakMs, ms); totalMs += ms;
      peakMade = Math.max(peakMade, made); totalMade += made;
    }
    const pixels = spriteType === null ? [] : world.units({ type: spriteType }).map((u) => {
      const sp = handle.m.getUint32(0x59cca8 + 336 * (u as unknown as { slot: number }).slot + 0x0c, true);
      return { x: u.x, y: u.y, owner: sp ? handle.u8[sp + 0x0a] : 7 };
    });
    if (spriteType !== null && f >= countFrom) {
      // How many of the board's pixels changed colour this frame: the main screen's cadence and step.
      const now = new Map(pixels.map((p) => [p.x * 65536 + p.y, p.owner]));
      if (lastBoard.size) { let changed = 0; for (const [k, v] of now) if (lastBoard.get(k) !== v) changed++; boardChanges.push(changed); }
      lastBoard = now;
    }
    if (f % every !== 0 || f < shotsFrom) continue;
    const rows = world.fog(player, { x: ax, y: ay, width: aw, height: ah }) ?? [];
    if (pixels.length && !board) {
      const xs = [...new Set(pixels.map((p) => p.x))].sort((a, b) => a - b), ys = [...new Set(pixels.map((p) => p.y))].sort((a, b) => a - b);
      const pitch = xs.length > 1 ? xs[1] - xs[0] : 16;
      board = { x0: xs[0], y0: ys[0], cols: Math.round((xs[xs.length - 1] - xs[0]) / pitch) + 1, rows: Math.round((ys[ys.length - 1] - ys[0]) / pitch) + 1, pitch };
    }
    PW = Math.max(FW, board ? board.cols * BS : 0); PH = FH + boardH();
    const rgba = new Uint8Array(PW * PH * 4);
    if (board) {
      for (const p of pixels) {
        const c = Math.round((p.x - board.x0) / board.pitch), r = Math.round((p.y - board.y0) / board.pitch);
        const [cr, cg, cb] = PALETTE[p.owner] ?? [255, 0, 255];
        for (let y = r * BS; y < r * BS + BS; y++) for (let x = c * BS; x < c * BS + BS; x++) if (x < PW && y < PH) rgba.set([cr, cg, cb, 255], (y * PW + x) * 4);
      }
    }
    const fy = boardH();
    const paint = (x0: number, y0: number, w: number, h: number, [cr, cg, cb]: [number, number, number]) => {
      for (let y = Math.max(0, y0); y < Math.min(PH, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(PW, x0 + w); x++) rgba.set([cr, cg, cb, 255], (y * PW + x) * 4);
    };
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const v = tone[row[x]] ?? 0; paint(x * S, fy + y * S, S, S, [v, v, v]); } });
    if (showUnits) {
      for (const u of world.units()) {
        const tx = u.x / 32 - ax, ty = u.y / 32 - ay;
        if (tx < 0 || ty < 0 || tx >= aw || ty >= ah) continue;
        if (spriteType !== null && u.type === spriteType) continue;
        paint(Math.round(tx * S) - 2, fy + Math.round(ty * S) - 2, 5, 5, OWNER_RGB[u.owner] ?? [150, 150, 150]);
      }
    }
    writeFileSync(join(out, `frame-${String(f).padStart(4, "0")}.png`), encodePng(rgba, PW, PH));
    shots.push({ frame: f, rgba, w: PW, h: PH });
    console.log(`frame ${f}: ${spent.toLocaleString("en-US")} conditions and actions, ${ms.toFixed(2)} ms, ${made} units made${rows.length ? "" : " (no fog read)"}`);
  }
  const n = Math.max(1, counted);
  console.log(`${frames} frames (counted from ${countFrom}): ${Math.round(total / n).toLocaleString("en-US")} conditions and actions a frame on average, ${peak.toLocaleString("en-US")} at the most; ${(totalMs / n).toFixed(2)} ms a frame on average, ${peakMs.toFixed(2)} at the most; ${(totalMade / n).toFixed(0)} units made a frame on average, ${peakMade} at the most`);
  if (boardChanges.length) {
    const sorted = [...boardChanges].sort((a, b) => a - b), q = (x: number) => sorted[Math.min(sorted.length - 1, Math.floor(x * sorted.length))];
    console.log(`the board: pixels changed on ${boardChanges.filter((c) => c > 0).length} of ${boardChanges.length} frames; pixels written a frame: median ${q(0.5)}, 90th ${q(0.9)}, most ${sorted[sorted.length - 1]}, average ${(boardChanges.reduce((a, b) => a + b, 0) / boardChanges.length).toFixed(0)}`);
  }
  if (changes) {
    const by = new Map<number, number>();
    for (const g of gaps) by.set(g, (by.get(g) ?? 0) + 1);
    const sorted = [...shares].sort((a, b) => a - b), at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
    console.log(`the picture changed ${shares.length} times in ${counted} frames; frames between changes: ${[...by].sort((a, b) => a[0] - b[0]).map(([g, n]) => `${g}: ${n}`).join(", ")}; share changed: median ${(at(0.5) * 100).toFixed(1)}%, 90th ${(at(0.9) * 100).toFixed(1)}%, most ${(at(1) * 100).toFixed(1)}%`);
  }
  if (shots.length) {
    const MW = Math.max(...shots.map((s) => s.w)), MH = Math.max(...shots.map((s) => s.h));
    const cols = Math.min(4, shots.length), W = MW + 8, H = MH + 8, SW = cols * W, SH = Math.ceil(shots.length / cols) * H;
    const sheet = new Uint8Array(SW * SH * 4);
    for (let i = 0; i < SW * SH; i++) sheet.set([200, 40, 40, 255], i * 4);
    shots.forEach((s, i) => {
      const left = (i % cols) * W + 4, top = Math.floor(i / cols) * H + 4;
      for (let y = 0; y < s.h; y++) sheet.set(s.rgba.subarray(y * s.w * 4, (y + 1) * s.w * 4), ((top + y) * SW + left) * 4);
    });
    writeFileSync(join(out, "sheet.png"), encodePng(sheet, SW, SH));
    console.log(`pictures in ${out}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (!existsSync(out)) process.exit(1);
