/**
 * The Für Elise showcase's run (probes/lib/fur-elise-showcase-run.ts), from the soundtrack's timeline: the keyboards
 * hold every note (folded by octaves where they must), the hands and the loud section are found from the data, the
 * explosions land on the strongest downbeats, the picture never asks the game for two Flags it would not make, and the
 * changes the program plays back rebuild every frame's picture.
 */
import { describe, expect, it } from "vitest";
import { isBlack, whiteKeys, type Pixel } from "../probes/lib/note-timeline";
import { NOTES, PARTS, SECTIONS, BAR, BEAT, VELOCITY } from "../probes/lib/fur-elise-timeline";
import { CELL, VIEW_X, VIEW_Y } from "../probes/lib/fur-elise-layout";
import {
  BOOM_BARS, CHANGES, FLAG, FX_F, LABEL_F, LAST_OFF, LEAD, LEAD_PART, LOUD, OTHER_PART, OVERLORD, ROLL_COL, ROLL_HI, ROLL_KEYS, ROLL_LO,
  STAGE_HI, STAGE_KEYS, STAGE_LO, STAGE_PITCH, STAGE_X0, STARTS, START, TOTAL, ZERO, explosions, flashes, notes, piano, pictureAt,
} from "../probes/lib/fur-elise-showcase-run";

describe("the showcase's run", () => {
  it("starts the clip LEAD frames before the picture's frame 0, and runs past the last note", () => {
    expect(ZERO - START).toBe(LEAD);
    expect(LEAD).toBe(2);
    expect(TOTAL).toBeGreaterThan(LAST_OFF);
    for (const list of [LABEL_F, FX_F, STARTS]) expect(list.every((f, k) => k === 0 || list[k - 1] <= f)).toBe(true);
    expect(STARTS.length).toBe(TOTAL + 1);
    // Every note on the timeline's own frame, from ZERO.
    expect(notes.every((n) => NOTES.some((m) => m[8] + ZERO === n.on))).toBe(true);
  });

  it("finds the hands and the loud section in the data", () => {
    expect([PARTS[LEAD_PART], PARTS[OTHER_PART]]).toEqual(["right", "left"]);
    expect(LOUD).toEqual(["storm"]);
    expect(piano.every((n) => n.part === LEAD_PART || n.part === OTHER_PART)).toBe(true);
  });

  it("fits both keyboards: the main screen every key the hands play, 40 white keys 16 apart inside the view", () => {
    expect([STAGE_LO, STAGE_HI]).toEqual([33, 100]);
    expect(whiteKeys(STAGE_LO, STAGE_HI).length).toBe(40);
    expect(STAGE_PITCH).toBe(16);
    expect(STAGE_X0 + 39 * STAGE_PITCH).toBe(830);
    for (const n of piano) expect(STAGE_KEYS.fold(n.note)).toBe(n.note);
    // The minimap: 64 columns, every note on one of them.
    expect(ROLL_HI - ROLL_LO + 1).toBeLessThanOrEqual(64);
    expect(ROLL_COL).toBeGreaterThanOrEqual(0);
    for (const n of notes) { const k = ROLL_KEYS.fold(n.note); expect(k >= ROLL_LO && k <= ROLL_HI && k % 12 === n.note % 12).toBe(true); }
    expect(isBlack(ROLL_LO) || isBlack(ROLL_HI)).toBe(false);
  });

  it("explodes on the three strongest downbeats of the loud section, the strongest with Battlecruisers", () => {
    const storm = SECTIONS.find((s) => s.name === "storm")!;
    const weight = (bar: number) => NOTES.filter((n) => n[BAR] === bar && n[BEAT] === 0).reduce((s, n) => s + n[VELOCITY], 0);
    expect(BOOM_BARS.length).toBe(3);
    expect(BOOM_BARS.every((b) => b > storm.bar)).toBe(true);
    expect(weight(BOOM_BARS[0])).toBeGreaterThanOrEqual(Math.max(weight(BOOM_BARS[1]), weight(BOOM_BARS[2])));
    // For Für Elise these are the bars the score marks with an accent: C1, C9 and C16.
    expect([...BOOM_BARS].sort((a, b) => a - b)).toEqual([storm.bar + 1, storm.bar + 9, storm.bar + 16]);
    expect(explosions.filter((e) => e.kind === 2).length).toBe(3);
  });

  it("flashes the white keys red only in the loud section, on the lead's chords", () => {
    const storm = SECTIONS.find((s) => s.name === "storm")!, closing = SECTIONS.find((s) => s.name === "closing")!;
    expect(flashes.size).toBeGreaterThan(20);
    for (const f of flashes) expect(f >= ZERO + storm.frame && f < ZERO + closing.frame + 2).toBe(true);
  });

  it("never asks for a Flag overlapping another of its frame or of the frame before", () => {
    const close = (a: Pixel, b: Pixel) => Math.abs(a.x - b.x) < 16 && Math.abs(a.y - b.y) < 16 && (a.x !== b.x || a.y !== b.y);
    let before: Pixel[] = [];
    for (let f = 0; f < TOTAL; f++) {
      const flags = pictureAt(f).filter((p) => p.unit === FLAG);
      for (const p of flags) {
        const bad = flags.find((q) => close(p, q)) ?? before.find((q) => close(p, q));
        if (bad) throw new Error(`frame ${f}: ${p.x},${p.y} beside ${bad.x},${bad.y}`);
      }
      before = flags;
    }
  });

  it("plays back changes that rebuild every frame's picture, the units on the map well under the game's 1,700", () => {
    const shown = new Map<string, number>();
    let most = 0;
    CHANGES.forEach((cs, f) => {
      for (const c of cs) {
        const k = `${c.unit} ${c.x} ${c.y}`;
        expect(shown.get(k) ?? 0).toBe(c.from);
        if (c.to) shown.set(k, c.to);
        else shown.delete(k);
      }
      if (f % 50 === 0) {
        const want = pictureAt(f);
        expect(shown.size).toBe(want.length);
        for (const p of want) expect(shown.get(`${p.unit} ${p.x} ${p.y}`)).toBe(p.color);
      }
      most = Math.max(most, shown.size);
    });
    expect(most).toBeLessThan(700);
  });

  it("keeps the Overlords on the minimap's cells and the Flags in the view, right of the text", () => {
    for (let f = 0; f < TOTAL; f += 11) {
      for (const p of pictureAt(f)) {
        if (p.unit === OVERLORD) expect((p.x - CELL / 2) % CELL === 0 && (p.y - CELL / 2) % CELL === 0 && p.y < 92 * 32).toBe(true);
        else expect(p.x >= VIEW_X + 200 && p.x <= VIEW_X + 836 && p.y >= VIEW_Y + 16 && p.y <= VIEW_Y + 300).toBe(true);
      }
    }
  });
});
