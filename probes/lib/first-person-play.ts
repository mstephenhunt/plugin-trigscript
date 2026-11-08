// The first-person showcase's play, apart from how it is drawn: the camera (a place and a way it looks, turned with the
// mouse and walked with the keys against the arena's grid), and where a monster stands in the view. Whatever draws the
// picture — the fog of the minimap now, maybe the main screen later — takes these as they are.
//
// The arena is probes/lib/first-person-2-arena.ts, written by probes/lib/first-person-map.mts (ARENA=rooms).
import { ARENA, ARENA_X, ARENA_Y, CELL } from "./first-person-2-arena";

export const GW = ARENA[0].length;
/** Each cell of the arena: 0 floor, 1 wall. */
const CELLS = ARENA.join("").split("").map((c) => (c === "#" ? 1 : 0));
/** A cell in pixels; the arena's corner in pixels. */
export const CELL_PX = CELL * 32, AX = ARENA_X * 32, AY = ARENA_Y * 32;

/**
 * Each wall's faces as runs: for each cell, the face seen when a ray comes into it from floor on one side — all the
 * cells of one straight stretch of wall share one number — so that an outline draws a wall's corners and ends, not a
 * line at every cell. One table a side a ray can come from: from the west (stepping east), the east, the north, the south.
 */
function faceRuns(fromX: number, fromY: number, first: number): number[] {
  const out: number[] = ARENA.join("").split("").map(() => 0);
  let id = first;
  const H = ARENA.length;
  // Along y for a face seen from the west or east, along x for one seen from the north or south.
  const along = fromX != 0;
  for (let a = 0; a < (along ? GW : H); a++) {
    let open = false;
    for (let b = 0; b < (along ? H : GW); b++) {
      const x = along ? a : b, y = along ? b : a;
      const fx = x + fromX, fy = y + fromY;
      const face = ARENA[y][x] === "#" && fx >= 0 && fy >= 0 && fx < GW && fy < H && ARENA[fy][fx] === ".";
      if (face) { if (!open) id++; out[y * GW + x] = id; }
      open = face;
    }
  }
  return out;
}
const FROM_WEST = faceRuns(-1, 0, 0), FROM_EAST = faceRuns(1, 0, 10000), FROM_NORTH = faceRuns(0, -1, 20000), FROM_SOUTH = faceRuns(0, 1, 30000);

/** The face a ray met at wall cell (x, y): `side` 0 when it stepped in x (east when `step` is 1), 1 in y (south when 1). */
export const faceAt = game((x: number, y: number, side: number, step: number): number => {
  const i = y * GW + x;
  if (side == 0) return step > 0 ? FROM_WEST[i] : FROM_EAST[i];
  return step > 0 ? FROM_NORTH[i] : FROM_SOUTH[i];
});

/** Whether cell (x, y) of the arena is a wall: 1, or 0. */
export const wallAt = game((x: number, y: number): number => CELLS[y * GW + x]);
/** Whether the point (x, y) of the map, in pixels, is in a wall. */
export const wallAtPx = game((x: number, y: number): number => CELLS[Math.floor((y - AY) / CELL_PX) * GW + Math.floor((x - AX) / CELL_PX)]);

/** An angle brought back within −π … π. */
export const wrapAngle = game((a: fixed): fixed => {
  let b = a;
  if (b > Math.PI) b -= 2 * Math.PI;
  if (b < -Math.PI) b += 2 * Math.PI;
  return b;
});

/**
 * The camera: where it stands (pixels of the map, with a fraction) and the way it looks. It walks by its own grid
 * collision, not the game's pathing: nothing a unit does can block it, and it moves the same distance every frame.
 */
export class Camera {
  x: fixed = fixed(0);
  y: fixed = fixed(0);
  angle: fixed = fixed(0);
  dirX: fixed = fixed(1);
  dirY: fixed = fixed(0);

  constructor(x: number, y: number) {
    this.x = fixed(x);
    this.y = fixed(y);
  }

  /** Turn by so much (radians), and the way it looks with it. */
  turn(by: fixed) {
    this.angle = wrapAngle(this.angle + by);
    this.dirX = Math.cos(this.angle);
    this.dirY = Math.sin(this.angle);
  }

  /**
   * Turn toward an angle: a share (`ease`) of the way there each frame, never more than `most` — small, even steps, so
   * that two pictures one after the other differ little.
   */
  turnToward(target: fixed, ease: fixed, most: fixed) {
    const d = wrapAngle(target - this.angle);
    this.turn(Math.min(Math.max(d * ease, -most), most));
  }

  /**
   * Walk: `forward` (+1, 0, −1) along the way it looks and `side` (+1 right, −1 left) across it, `speed` pixels a frame
   * (the same diagonally), kept `radius` pixels off every wall, each axis on its own so that it slides along a wall.
   * Whether it moved.
   */
  walk(forward: number, side: number, speed: fixed, radius: number): boolean {
    if (forward == 0 && side == 0) return false;
    let step = speed;
    if (forward != 0 && side != 0) step = speed * 0.7071;
    const vx = (this.dirX * forward - this.dirY * side) * step;
    const vy = (this.dirY * forward + this.dirX * side) * step;
    let moved = false;
    const nx = this.x + vx;
    const ex = vx > 0 ? nx + radius : nx - radius;
    if (wallAtPx(Math.floor(ex), Math.floor(this.y - radius)) == 0 && wallAtPx(Math.floor(ex), Math.floor(this.y + radius)) == 0) { this.x = nx; moved = true; }
    const ny = this.y + vy;
    const ey = vy > 0 ? ny + radius : ny - radius;
    if (wallAtPx(Math.floor(this.x - radius), Math.floor(ey)) == 0 && wallAtPx(Math.floor(this.x + radius), Math.floor(ey)) == 0) { this.y = ny; moved = true; }
    return moved;
  }
}
