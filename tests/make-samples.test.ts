import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** A mono 16-bit WAV of `seconds` of a quiet sine. */
function wav(seconds: number, rate = 44100): Buffer {
  const n = Math.round(seconds * rate), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / rate)), 44 + i * 2);
  return b;
}

describe("make-samples: an SFZ's root keys", () => {
  it("takes pitch_keycenter, then key, then middle C — never the zone's lowest key", () => {
    const dir = mkdtempSync(join(tmpdir(), "make-samples-"));
    try {
      for (const f of ["a.wav", "b.wav", "c.wav"]) writeFileSync(join(dir, f), wav(0.1));
      writeFileSync(join(dir, "x.sfz"), [
        "<group> amp_veltrack=73",
        "<region> sample=a.wav lokey=56 hikey=58 pitch_keycenter=57",
        // Salamander's C4 regions are written like this one: no root at all, which SFZ reads as 60.
        "<region> sample=b.wav lokey=59 hikey=61",
        "<region> sample=c.wav key=64",
      ].join("\n"));
      const out = join(dir, "x.samples");
      execFileSync("npx", ["tsx", join(__dirname, "..", "scripts", "make-samples.mts"), join(dir, "x.sfz"), out], { stdio: "pipe" });
      const zones = (JSON.parse(readFileSync(out, "utf8")) as { zones: { key: number; lo: number; hi: number }[] }).zones;
      expect(zones.map((z) => [z.lo, z.hi, z.key])).toEqual([[56, 58, 57], [59, 61, 60], [64, 64, 64]]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe("make-samples: a kit", () => {
  it("makes a key a drum, its strengths from the names (v3, or pp … fff), the rest played in turn", () => {
    const dir = mkdtempSync(join(tmpdir(), "make-kit-"));
    try {
      mkdirSync(join(dir, "drums"));
      for (const f of ["boom_v1_rr1.wav", "boom_v1_rr2.wav", "boom_v2_rr1.wav", "gong_p.wav", "gong_fff.wav", "gong_mf.wav"]) writeFileSync(join(dir, "drums", f), wav(0.1));
      writeFileSync(join(dir, "kit.json"), JSON.stringify({ release: 2, drums: { C2: ["drums/boom_*"], G3: ["drums/gong_*"] } }));
      const out = join(dir, "kit.samples");
      execFileSync("npx", ["tsx", join(__dirname, "..", "scripts", "make-samples.mts"), "--kit", join(dir, "kit.json"), out], { stdio: "pipe" });
      const zones = (JSON.parse(readFileSync(out, "utf8")) as { zones: { key: number; vlo: number; vhi: number; pitched?: boolean; turn?: number; turns?: number; release?: number }[] }).zones;
      expect(zones.map((z) => [z.key, z.vlo, z.vhi, z.turn ?? 0, z.turns ?? 0])).toEqual([
        [36, 1, 63, 1, 2], [36, 1, 63, 2, 2], [36, 64, 127, 0, 0],
        [55, 85, 127, 0, 0], [55, 43, 84, 0, 0], [55, 1, 42, 0, 0],
      ]);
      expect(zones.every((z) => z.pitched === false && z.release === 2)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
