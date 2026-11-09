/**
 * The Für Elise showcase's run (probes/lib/fur-elise-showcase-run.ts), on each soundtrack the switch picks
 * (probes/lib/fur-elise-showcase-choice.ts: the trance remix, the cinematic arrangement, the straight piece): the keyboards hold every
 * note (folded by octaves where they must), the parts and sections are found by their roles and names, the explosions
 * land on the strongest moments, the picture never asks the game for two Flags it would not make, and the changes the
 * program plays back rebuild every frame's picture.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { isBlack, whiteKeys, type Pixel } from "../probes/lib/note-timeline";
import { CELL, VIEW_X, VIEW_Y } from "../probes/lib/fur-elise-layout";

type Run = typeof import("../probes/lib/fur-elise-showcase-run");
type Choice = typeof import("../probes/lib/fur-elise-showcase-choice");

describe.each(["remix", "cinematic", "straight"] as const)("the showcase's run on the %s soundtrack", (which) => {
  let r: Run, c: Choice;
  beforeAll(async () => {
    process.env.FUR_ELISE = which;
    vi.resetModules();
    c = await import("../probes/lib/fur-elise-showcase-choice");
    r = await import("../probes/lib/fur-elise-showcase-run");
    delete process.env.FUR_ELISE;
  });

  it("is the soundtrack the switch names, the clip LEAD frames before the picture, the run past the last note", () => {
    expect(c.SOUNDTRACK).toBe(which);
    expect(r.ZERO - r.START).toBe(2);
    expect(r.TOTAL).toBeGreaterThan(r.LAST_OFF);
    for (const list of [r.LABEL_F, r.FX_F, r.STARTS]) expect(list.every((f, k) => k === 0 || list[k - 1] <= f)).toBe(true);
    expect(r.STARTS.length).toBe(r.TOTAL + 1);
    const frames = new Set(c.TIMELINE.NOTES.map((m) => m[8] + r.ZERO));
    expect(r.notes.every((n) => frames.has(n.on))).toBe(true);
  });

  it("puts the piano on the keyboards by role, and no drum, impact or riser on a roll", () => {
    const { ROLES } = c.TIMELINE;
    expect(r.LEAD_PARTS.every((k) => ROLES[k] === "lead") && r.OTHER_PARTS.every((k) => ROLES[k] === "accomp")).toBe(true);
    expect(r.LEAD_PARTS.length).toBe(which === "remix" ? 2 : 1);
    expect(r.piano.every((n) => r.LEAD_PARTS.includes(n.part) || r.OTHER_PARTS.includes(n.part))).toBe(true);
    expect(r.notes.every((n) => !["drum-low", "drum-high", "cymbal", "impact", "riser"].includes(ROLES[n.part]))).toBe(true);
    expect(r.LOUD).toEqual([which === "remix" ? "drop 2" : "storm"]);
  });

  it("shows the rest of the band only in the big sections: the intro, breakdowns and ending are the piano alone", () => {
    const { SECTIONS } = c.TIMELINE;
    expect(r.BIG).toEqual(which === "remix" ? ["drop 1", "build 1", "drop 2", "build 2", "drop 3"] : which === "cinematic" ? ["storm", "final"] : ["storm"]);
    const band = r.notes.filter((n) => !r.LEAD_PARTS.includes(n.part) && !r.OTHER_PARTS.includes(n.part));
    expect(band.length).toBeGreaterThan(0);
    for (const n of band) {
      const s = [...SECTIONS].reverse().find((x) => x.bar <= n.bar)!;
      expect(r.BIG).toContain(s.name);
    }
  });

  it("fits both keyboards: the main screen every key the piano plays, 40 white keys 16 apart inside the view", () => {
    expect([r.STAGE_LO, r.STAGE_HI]).toEqual([33, 100]);
    expect(whiteKeys(r.STAGE_LO, r.STAGE_HI).length).toBe(40);
    expect(r.STAGE_PITCH).toBe(16);
    expect(r.STAGE_X0 + 39 * r.STAGE_PITCH).toBe(830);
    for (const n of r.piano) expect(r.STAGE_KEYS.fold(n.note)).toBe(n.note);
    expect(r.ROLL_HI - r.ROLL_LO + 1).toBeLessThanOrEqual(64);
    for (const n of r.notes) { const k = r.ROLL_KEYS.fold(n.note); expect(k >= r.ROLL_LO && k <= r.ROLL_HI && k % 12 === n.note % 12).toBe(true); }
    expect(isBlack(r.ROLL_LO) || isBlack(r.ROLL_HI)).toBe(false);
  });

  it("explodes on a handful of the strongest moments, Battlecruisers on the strongest", () => {
    const { SECTIONS } = c.TIMELINE;
    const section = (f: number) => [...SECTIONS].reverse().find((s) => s.frame <= f - r.ZERO)!.name;
    if (which === "remix") {
      // The three drops' downbeats (the storm's, the second, the biggest: five Battlecruisers), two impacts between.
      const drops = c.TIMELINE.SECTIONS.filter((s) => s.name.startsWith("drop")).map((s) => r.ZERO + s.frame);
      expect(r.BOOMS.length).toBe(5);
      for (const d of drops) expect(r.BOOMS.some((b) => b.frame === d && b.strength === 1)).toBe(true);
      expect(r.explosions.filter((e) => e.frame === drops[1] && e.kind === 2).length).toBe(5);
      expect(r.explosions.filter((e) => e.frame === drops[0] && e.kind === 2).length).toBe(3);
    } else if (which === "cinematic") {
      // The band's first downbeat, three in the storm, the final's first downbeat and two of its last big bars.
      expect(r.BOOMS.map((b) => section(b.frame))).toEqual(["band", "storm", "storm", "storm", "final", "final", "final"]);
      expect(r.BOOMS[0].frame).toBe(r.ZERO + SECTIONS.find((s) => s.name === "band")!.frame);
      expect(r.BOOMS[4].frame).toBe(r.ZERO + SECTIONS.find((s) => s.name === "final")!.frame);
    } else {
      // No impacts in the straight piece: the storm's three accented bars, C1, C9 and C16.
      expect(r.BOOMS.map((b) => section(b.frame))).toEqual(["storm", "storm", "storm"]);
    }
    expect(r.BOOMS.every((b, k) => k === 0 || b.frame - r.BOOMS[k - 1].frame >= 100)).toBe(true);
    for (const b of r.BOOMS) expect(r.explosions.filter((e) => e.frame === b.frame).every((e) => e.kind === (b.strength >= 0.995 ? 2 : 1))).toBe(true);
  });

  it("flashes the white keys red in the storm (and the remix's drops and impacts), and pulses the minimap's keys only in the big sections", () => {
    const { SECTIONS } = c.TIMELINE;
    const at = (name: string) => r.ZERO + SECTIONS.find((s) => s.name === name)!.frame;
    const after = (name: string) => { const k = SECTIONS.findIndex((s) => s.name === name); return r.ZERO + (SECTIONS[k + 1]?.frame ?? Infinity); };
    expect(r.flashes.size).toBeGreaterThan(20);
    for (const f of r.flashes) expect(r.BIG.some((name) => f >= at(name) && f < after(name) + 4)).toBe(true);
    if (which !== "remix") for (const f of r.flashes) expect(f >= at(r.LOUD[0]) && f < after(r.LOUD[0]) + 2).toBe(true);
    for (const f of r.pulses) expect(r.BIG.some((name) => f >= at(name) && f < after(name) + 3)).toBe(true);
  });

  it("never asks for a Flag overlapping another of its frame or of the frame before", () => {
    const close = (a: Pixel, b: Pixel) => Math.abs(a.x - b.x) < 16 && Math.abs(a.y - b.y) < 16 && (a.x !== b.x || a.y !== b.y);
    let before: Pixel[] = [];
    for (let f = 0; f < r.TOTAL; f++) {
      const flags = r.pictureAt(f).filter((p) => p.unit === r.FLAG);
      for (const p of flags) {
        const bad = flags.find((q) => close(p, q)) ?? before.find((q) => close(p, q));
        if (bad) throw new Error(`frame ${f}: ${p.x},${p.y} beside ${bad.x},${bad.y}`);
      }
      before = flags;
    }
  });

  it("plays back changes that rebuild every frame's picture, the units well under the game's 1,700", () => {
    const shown = new Map<string, number>();
    let most = 0;
    r.CHANGES.forEach((cs, f) => {
      for (const ch of cs) {
        const k = `${ch.unit} ${ch.x} ${ch.y}`;
        expect(shown.get(k) ?? 0).toBe(ch.from);
        if (ch.to) shown.set(k, ch.to);
        else shown.delete(k);
      }
      if (f % 50 === 0) {
        const want = r.pictureAt(f);
        expect(shown.size).toBe(want.length);
        for (const p of want) expect(shown.get(`${p.unit} ${p.x} ${p.y}`)).toBe(p.color);
      }
      most = Math.max(most, shown.size);
    });
    expect(most).toBeLessThan(1000);
  });

  it("keeps the Overlords on the minimap's cells and the Flags in the view, right of the text", () => {
    for (let f = 0; f < r.TOTAL; f += 11) {
      for (const p of r.pictureAt(f)) {
        if (p.unit === r.OVERLORD) expect((p.x - CELL / 2) % CELL === 0 && (p.y - CELL / 2) % CELL === 0 && p.y < 92 * 32).toBe(true);
        else expect(p.x >= VIEW_X + 200 && p.x <= VIEW_X + 836 && p.y >= VIEW_Y + 16 && p.y <= VIEW_Y + 300).toBe(true);
      }
    }
  });
});
