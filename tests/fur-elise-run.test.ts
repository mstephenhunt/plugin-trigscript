/**
 * The Für Elise visualizer probe's run (probes/lib/fur-elise-run.ts), as the build works it out: the clips start on the
 * frames their first notes are drawn, the lamp is lit exactly on onsets, the picture never asks the game for two Flags
 * it would not make, and the changes the program plays back rebuild every frame's picture.
 */
import { describe, expect, it } from "vitest";
import { FRAME, type Pixel } from "../probes/lib/note-timeline";
import { CELL, VIEW_X, VIEW_Y, LAMP_X, LAMP_Y } from "../probes/lib/fur-elise-layout";
import {
  BAR_FRAME, CHANGES, CLICKS, CLIP_A, CLIP_BAR0, CLIP_STORM, CLIP_THEME, C_START, FLAG, FX_F, LABEL_F, OVERLORD, RING, S1_START, S2_START,
  SOUND_F, SOUND_K, STARTS, TOTAL, WHITE, clicks, pictureAt, plays, runNotes,
} from "../probes/lib/fur-elise-run";

const onsets = new Set(runNotes.map((n) => n.on));

describe("the run", () => {
  it("lasts about 100 seconds, its lists in the order the program reads them", () => {
    expect(TOTAL * FRAME).toBeGreaterThan(90);
    expect(TOTAL * FRAME).toBeLessThan(115);
    for (const list of [SOUND_F, LABEL_F, FX_F, STARTS]) expect(list.every((f, k) => k === 0 || list[k - 1] <= f)).toBe(true);
    expect(STARTS.length).toBe(TOTAL + 1);
  });

  it("starts each part's clip on the frame its first note is drawn", () => {
    const firstFrom = (from: number) => Math.min(...runNotes.filter((n) => n.on >= from).map((n) => n.on));
    const at = (clip: number) => plays.filter((p) => p.clip === clip).map((p) => p.frame);
    // The A section, the storm, and the theme as one clip (S1, and V after it).
    for (const f of [...at(CLIP_A), ...at(CLIP_STORM), ...at(CLIP_THEME)]) expect(firstFrom(f)).toBe(f);
    expect(at(CLIP_THEME)[0]).toBe(S1_START);
    expect(at(CLIP_STORM)[0]).toBe(C_START);
    // S2: a clip a bar, from the frame each bar starts in; the bar's first note is drawn on that frame or the next.
    BAR_FRAME.slice(0, -1).forEach((b, k) => {
      const f = at(CLIP_BAR0 + k)[0];
      expect(f).toBe(S2_START + b);
      expect(firstFrom(f) - f).toBeLessThanOrEqual(1);
    });
  });

  it("lights the lamp on the frames a note starts, and on the clicks, and on no other", () => {
    expect(clicks.size).toBe(CLICKS);
    for (let f = 0; f < TOTAL; f++) {
      const lamp = pictureAt(f).find((p) => p.unit === RING);
      if (!lamp) continue;
      expect(lamp.x === VIEW_X + LAMP_X && lamp.y === VIEW_Y + LAMP_Y).toBe(true);
      expect(lamp.color === WHITE).toBe(onsets.has(f) || clicks.has(f));
    }
  });

  it("never asks for a Flag overlapping another of its frame or of the frame before", () => {
    // A Spider Mine is 15 pixels square: the game puts one made overlapping another beside its place, and one taken away
    // stands until its frame ends.
    const close = (a: Pixel, b: Pixel) => Math.abs(a.x - b.x) < 16 && Math.abs(a.y - b.y) < 16 && (a.x !== b.x || a.y !== b.y);
    let before: Pixel[] = [];
    for (let f = 0; f < TOTAL; f++) {
      const flags = pictureAt(f).filter((p) => p.unit !== OVERLORD);
      for (const p of flags) {
        const bad = flags.find((q) => close(p, q)) ?? before.find((q) => close(p, q));
        if (bad) throw new Error(`frame ${f}: ${p.x},${p.y} beside ${bad.x},${bad.y}`);
      }
      before = flags;
    }
  });

  it("plays back changes that rebuild every frame's picture, a unit a pixel", () => {
    const shown = new Map<string, number>();
    let most = 0;
    CHANGES.forEach((cs, f) => {
      for (const c of cs) {
        const k = `${c.unit} ${c.x} ${c.y}`;
        expect(shown.get(k) ?? 0).toBe(c.from);
        if (c.to) shown.set(k, c.to);
        else shown.delete(k);
      }
      const want = pictureAt(f);
      expect(shown.size).toBe(want.length);
      for (const p of want) expect(shown.get(`${p.unit} ${p.x} ${p.y}`)).toBe(p.color);
      most = Math.max(most, shown.size);
    });
    // Units for the pictures at the most, of the game's 1,700.
    expect(most).toBeLessThan(600);
  });

  it("keeps the minimap's Overlords on cells two tiles apart, and the stage's Flags on the stage", () => {
    for (let f = 0; f < TOTAL; f += 7) {
      for (const p of pictureAt(f)) {
        if (p.unit === OVERLORD) expect((p.x - CELL / 2) % CELL === 0 && (p.y - CELL / 2) % CELL === 0 && p.y < 92 * 32).toBe(true);
        if (p.unit === FLAG) expect(p.x >= VIEW_X + 240 && p.x <= VIEW_X + 852 && p.y >= VIEW_Y + 16 && p.y <= VIEW_Y + 300).toBe(true);
      }
    }
  });

  it("names the clips it plays in the probe's order", () => {
    expect(Math.max(...SOUND_K)).toBe(CLIP_BAR0 + BAR_FRAME.length - 2);
  });
});
