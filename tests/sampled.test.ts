/**
 * Sampled instruments and performances (S7, Für Elise's sound): the `.samples` file and its coding without loss; an
 * instrument that plays each note from the recording nearest its key and strength, holds it with its pedal, plays the
 * sound of a key let go; a performance read from a score's notation — lengths, dynamics, the pedal, bar lines checked,
 * a tempo that moves; loudness as BS.1770 measures it; strings that ring in sympathy while the pedal is down.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { compileScript, type CompileResult } from "../compiler/compiler";
import { defaultScriptNames } from "../compiler/names";
import { defaultLib } from "../bundle/lib.mjs";
import { clipChannels, decodeAdpcm, makeClip, tone } from "../compiler/sound";
import { describeSamples, readSamples, writeSamples, type ZoneData } from "../compiler/samples";

const LIB = defaultLib();
const errors = (r: CompileResult) => r.diagnostics.map((d) => `${d.file}:${d.line}: ${d.message}`);
const RATE = 22050;

/** A sine `hz` for `seconds`, dying away, at `level`: a stand-in for a recording. */
function ring(hz: number, seconds: number, level: number, channels = 1): Float32Array[] {
  const n = Math.round(seconds * RATE), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = level * Math.sin((2 * Math.PI * hz * i) / RATE) * Math.exp(-i / (RATE * 0.8));
  return Array.from({ length: channels }, () => x.slice());
}

/**
 * An instrument of four recordings: A3 (220 Hz) and A4 (440 Hz), each soft (a quiet sine) and loud (a loud one, a fifth
 * up from where it says — so which was played can be heard in its pitch); a key's release, a click; the pedal's thump.
 */
function instrument(): string {
  const zones: ZoneData[] = [
    { sample: 0, key: 57, lo: 50, hi: 62, vlo: 1, vhi: 63, release: 0.1, veltrack: 0 },
    { sample: 1, key: 57, lo: 50, hi: 62, vlo: 64, vhi: 127, release: 0.1, veltrack: 0 },
    { sample: 2, key: 69, lo: 63, hi: 75, vlo: 1, vhi: 63, release: 0.1, veltrack: 0 },
    { sample: 3, key: 69, lo: 63, hi: 75, vlo: 64, vhi: 127, release: 0.1, veltrack: 0 },
    { sample: 4, key: 60, lo: 50, hi: 75, vlo: 1, vhi: 127, trigger: "release", pitched: false, volume: -6 },
    { sample: 5, key: 60, lo: 0, hi: 127, vlo: 1, vhi: 127, trigger: "pedal-down", pitched: false },
  ];
  const click = new Float32Array(Math.round(0.05 * RATE)).map((_, i) => (i < 20 ? 0.5 : 0));
  return writeSamples({
    rate: RATE, name: "Test", credit: "Ours (CC0)",
    samples: [
      { name: "A3 soft", channels: ring(220, 2, 0.2) }, { name: "A3 loud", channels: ring(330, 2, 0.8) },
      { name: "A4 soft", channels: ring(440, 2, 0.2) }, { name: "A4 loud", channels: ring(660, 2, 0.8) },
      { name: "release", channels: [click] }, { name: "pedal", channels: [click.slice()] },
    ],
    zones,
  });
}

/** A WAV the build wrote — IMA ADPCM or 16-bit — read back. */
function wavSamples(b: Uint8Array): { rate: number; channels: Float32Array[] } {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength), text = (at: number) => String.fromCharCode(...b.subarray(at, at + 4));
  let at = 12, format = 0, count = 0, rate = 0, frames = 0, data: Uint8Array | null = null;
  while (at + 8 <= b.length) {
    const id = text(at), size = v.getUint32(at + 4, true);
    if (id === "fmt ") { format = v.getUint16(at + 8, true); count = v.getUint16(at + 10, true); rate = v.getUint32(at + 12, true); }
    if (id === "fact") frames = v.getUint32(at + 8, true);
    if (id === "data") data = b.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size & 1);
  }
  if (format === 0x11) return { rate, channels: [decodeAdpcm(data!, rate, frames)] };
  const n = data!.length / 2 / count, d = new DataView(data!.buffer, data!.byteOffset, data!.byteLength);
  const channels = Array.from({ length: count }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < count; c++) channels[c][i] = d.getInt16(2 * (i * count + c), true) / 32768;
  return { rate, channels };
}

/** Hertz of a clip's start, by its crossings of zero (a sine's). */
function pitchOf(x: Float32Array, rate: number, from = 0.05, to = 0.4): number {
  let n = 0;
  const a = Math.round(from * rate), b = Math.round(to * rate);
  for (let i = a + 1; i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) n++;
  return n / (to - from);
}
const rms = (x: Float32Array, from: number, to: number, rate: number) => {
  let s = 0;
  const a = Math.round(from * rate), b = Math.min(x.length, Math.round(to * rate));
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, b - a));
};

/** A script with the instrument beside it, which checks its own results and throws (a build error) when they are wrong. */
const run = (body: string) => compileScript(ts, { "main.ts": `import { music } from "trigscript/music";\nimport inst from "./inst.samples";\nconst fail = (what: string) => { throw new Error(what); };\n${body}\n`, "inst.samples": instrument() }, defaultScriptNames(), { lib: LIB });

describe("the .samples file", () => {
  it("keeps every sample: coded without loss, and smaller than 16-bit for a sound that dies away", () => {
    const rec = ring(440, 2, 0.7, 2);
    const text = writeSamples({ rate: RATE, samples: [{ name: "a", channels: rec }], zones: [{ sample: 0, key: 69, lo: 0, hi: 127, vlo: 1, vhi: 127 }] });
    const back = clipChannels(readSamples(text).zones[0].clip);
    for (let c = 0; c < 2; c++) for (let i = 0; i < rec[c].length; i += 97) expect(Math.abs(back[c][i] - Math.round(rec[c][i] * 32768) / 32768)).toBeLessThan(1e-6);
    // 16-bit in base64 would be 4/3 of 4 bytes a frame.
    expect(text.length).toBeLessThan(rec[0].length * 4 * (4 / 3) * 0.6);
  });

  it("names every clip made from an instrument by the instrument too: change one recording, every name changes", () => {
    const one = (level: number) => writeSamples({ rate: RATE, samples: [{ name: "a", channels: ring(220, 0.5, 0.5) }, { name: "b", channels: ring(440, 0.5, level) }], zones: [
      { sample: 0, key: 57, lo: 0, hi: 62, vlo: 1, vhi: 127 }, { sample: 1, key: 69, lo: 63, hi: 127, vlo: 1, vhi: 127 },
    ] });
    // Only recording b differs; the clip played is made from recording a.
    const names = (text: string) => compileScript(ts, { "main.ts": `import inst from "./inst.samples";\nprogram(async () => { playWav(inst.zones[0].clip.gain(0.5), 0); });`, "inst.samples": text }, defaultScriptNames(), { lib: LIB, sounds: false }).sounds.map((x) => x.path);
    const [a, b] = [names(one(0.5)), names(one(0.4))];
    expect(a.length).toBe(1);
    expect(a).not.toEqual(b);
    expect(names(one(0.5))).toEqual(a);
  });

  it("refuses a zone that names no recording, and says what it holds on the hover", () => {
    expect(() => writeSamples({ rate: RATE, samples: [], zones: [{ sample: 0, key: 60, lo: 0, hi: 127, vlo: 1, vhi: 127 }] })).toThrow(/names recording 0/);
    expect(describeSamples(instrument())).toMatch(/^A sampled instrument, Test: 6 recordings .* 6 zones at 22,050 Hz\. Ours \(CC0\)\.$/);
  });

  it("names a clip without decoding it, so a check makes no samples", () => {
    const r = compileScript(ts, { "main.ts": `import inst from "./inst.samples";\nprogram(async () => { playWav(inst.zones[0].clip.gain(0.5), 0); });`, "inst.samples": instrument() }, defaultScriptNames(), { lib: LIB, sounds: false });
    expect(errors(r)).toEqual([]);
    expect(r.sounds.length).toBe(1);
    expect(r.sounds[0].bytes).toBeUndefined();
  });
});

describe("music.sampled", () => {
  it("chooses by strength, moves a note only from the recording nearest it, and dies away after it is let go", () => {
    const r = run(`
      const piano = music.sampled(inst);
      for (const c of [piano.strike!("A4", 0.5, 0.3), piano.strike!("B4", 0.5, 1.2)]) if (Math.abs(c.seconds - 0.6) > 0.01) fail(\`\${c.seconds} seconds\`);
      program(async () => { playWav(piano.strike!("A4", 0.5, 0.3).wav(), 0); playWav(piano.strike!("B4", 0.5, 1.2).wav(), 0); playWav(piano.strike!("C4", 0.5, 0.3).wav(), 0); });`);
    expect(errors(r)).toEqual([]);
    const [a4, b4, c4] = r.sounds.map((s) => wavSamples(s.bytes!).channels[0]);
    expect(pitchOf(a4, RATE)).toBeCloseTo(440, -1);
    expect(pitchOf(b4, RATE)).toBeCloseTo(660 * 2 ** (2 / 12), -1);
    // C4 (60) is in A3's zone (50 … 62): A3's soft recording, three semitones up.
    expect(pitchOf(c4, RATE)).toBeCloseTo(220 * 2 ** (3 / 12), -1);
    // Let go at 0.5 s: down 60 dB over the 0.1 s release.
    expect(rms(a4, 0.57, 0.6, RATE)).toBeLessThan(rms(a4, 0.4, 0.45, RATE) / 30);
  });
});

describe("music.perform", () => {
  const take = `
    const piano = music.sampled(inst);
    const take = music.perform({ meter: "3/8", bpm: 120, pickup: "1/8" }, {
      right: { instrument: piano, notes: ["pp A4/16 B4", "A4/8 r/16 A4 A4 A4", "f A4/4."] },
      left: { instrument: piano, notes: ["r/8", "ped A3/8 r/4 *", "A3/4."] },
    });`;

  it("places each note at its time: lengths as written, the pickup before bar 1, the parts together", () => {
    const r = run(`${take}
      const at = take.notes.map((n) => \`\${n.part[0]}\${n.note}@\${n.at.toFixed(3)}\`).join(" ");
      if (at !== "rA4@0.000 rB4@0.250 lA3@0.500 rA4@0.500 rA4@1.250 rA4@1.500 rA4@1.750 lA3@2.000 rA4@2.000") fail(at);
      if (take.bars.map((b) => b.toFixed(2)).join() !== "0.00,0.50,2.00,3.50") fail(take.bars.join());
      const n = take.notes[3];
      if (n.bar !== 1 || n.beat !== 0 || n.frame !== Math.round(0.5 / 0.042) || Math.abs(n.end - 1.0) > 1e-9) fail(JSON.stringify(n));
      if (take.pedal.length !== 1 || Math.abs(take.pedal[0][0] - 0.5) > 1e-9 || Math.abs(take.pedal[0][1] - 2) > 1e-9) fail(JSON.stringify(take.pedal));`);
    expect(errors(r)).toEqual([]);
  });

  it("strikes as the dynamics say, and moves between them where a hairpin says", () => {
    const r = run(`
      const piano = music.sampled(inst);
      const take = music.perform({ meter: "4/4", bpm: 60 }, { a: { instrument: piano, notes: "p A4/4 < A4 A4 A4 | f A4/4 A4@+10 A4@64 A4! " } });
      const v = take.notes.map((n) => n.velocity).join();
      // The hairpin from the second note's p to bar 2's f, over the three notes before it.
      if (v !== "46,46,61,75,90,100,64,102") fail(v);`);
    expect(errors(r)).toEqual([]);
  });

  it("checks the bar lines, and says which bar is too long", () => {
    const r = run(`const take = music.perform({ meter: "3/8", bpm: 120 }, { right: { instrument: music.sampled(inst), notes: "A4/8 A4 A4 | A4/4 A4 | A4/4." } });`);
    expect(errors(r).join("\n")).toMatch(/right, bar 2 is 8 sixteenths long; a bar of 3\/8 is 6/);
  });

  it("slows where the tempo says and waits where a hold says; a tie strikes once", () => {
    const r = run(`
      const piano = music.sampled(inst);
      const take = music.perform({ meter: "4/4", bpm: 60, tempo: [[1, 60], [2, 60], [3, 30]], holds: [[3, 0.5]] }, { a: { instrument: piano, notes: "A4/1 | A4/2~ A4/4 A4/4 | A4/1" } });
      const at = take.notes.map((n) => n.at.toFixed(3)).join() + " / " + take.bars.map((b) => b.toFixed(3)).join();
      // Bar 2 slows from 60 to 30 evenly over its four beats: the seconds to beat b are 8 ln(60 / (60 − 7.5 b)).
      if (take.notes.length !== 4 || Math.abs(take.notes[1].at - 4) > 1e-6 || Math.abs(take.notes[1].end - (4 + 8 * Math.log(60 / 37.5))) > 0.01) fail(at);
      if (Math.abs(take.notes[2].at - (4 + 8 * Math.log(60 / 37.5))) > 0.01) fail(at);
      if (Math.abs(take.bars[3] - take.bars[2] - (8 * Math.log(2) + 0.5)) > 0.01 || Math.abs(take.notes[3].at - take.bars[3]) > 1e-9) fail(at);`);
    expect(errors(r)).toEqual([]);
  });

  it("renders: the pedal holds what is let go, its sound plays, and the same humanized take comes out every build", () => {
    const body = `${take}
      const dry = music.render(music.perform({ meter: "3/8", bpm: 120, pickup: "1/8" }, { right: { instrument: music.sampled(inst, { releases: false }), notes: ["r/8", "A4/16 r/16 r/4"] } }), { limit: false });
      const held = music.render(music.perform({ meter: "3/8", bpm: 120, pickup: "1/8" }, { right: { instrument: music.sampled(inst, { releases: false }), notes: ["r/8", "ped A4/16 r/16 r/4", "r/4. *"] } }), { limit: false });
      const human = music.perform({ meter: "3/8", bpm: 120, humanize: { time: 0.01, velocity: 6, seed: 3 } }, { right: { instrument: music.sampled(inst), notes: "A4/16 A4 A4 A4 A4 A4" } });
      export const times = human.notes.map((n) => n.at.toFixed(4) + "/" + n.velocity).join(" ");
      program(async () => { playWav(dry.wav(), 0); playWav(held.wav(), 0); playWav(music.render(take).ogg(5), 0); });`;
    const a = run(body), b = run(body);
    expect(errors(a)).toEqual([]);
    // (The build lists its sounds in its own order: the dry one is the shorter.)
    const [dry, held] = a.sounds.filter((s) => s.bytes).map((s) => wavSamples(s.bytes!).channels[0]).sort((x, y) => x.length - y.length);
    const rate = 44100;
    // A sixteenth at 120 eighths a minute is 0.25 s: let go at 0.75 s and gone 0.1 s later, dry; held by the pedal,
    // the recording rings to its end (2 s from 0.5).
    expect(dry.length / rate).toBeCloseTo(0.85, 2);
    expect(rms(dry, 0.84, 0.85, rate)).toBeLessThan(rms(dry, 0.6, 0.7, rate) / 100);
    expect(held.length / rate).toBeCloseTo(2.5, 2);
    expect(rms(held, 1.5, 2.0, rate)).toBeGreaterThan(0.05);
    expect(a.sounds.find((s) => s.vorbis)).toBeDefined();
    expect(a.sounds.map((s) => s.path)).toEqual(b.sounds.map((s) => s.path));
  });
});

describe("music.excerpt", () => {
  it("takes the bars asked for, from 0, with the pedal down already where it went down before them", () => {
    const r = run(`
      const piano = music.sampled(inst, { releases: false });
      const take = music.perform({ meter: "3/8", bpm: 120, pickup: "1/8" }, {
        right: { instrument: piano, notes: ["A4/8", "A4/8 B4 C5", "ped A4/4.", "B4/8 C5 D5 *"] },
      });
      const part = music.excerpt(take, 3);
      const opening = music.excerpt(take, 0, 3);
      const show = (p: typeof part) => p.notes.map((n) => \`\${n.note}@\${n.at.toFixed(2)}/\${n.bar}\`).join(" ");
      if (Math.abs(part.at - 3.5) > 1e-6) fail(\`at \${part.at}\`);
      if (show(part) !== "B4@0.00/3 C5@0.50/3 D5@1.00/3") fail(show(part));
      if (show(opening) !== "A4@0.00/0 A4@0.50/1 B4@1.00/1 C5@1.50/1 A4@2.00/2") fail(show(opening));
      if (part.pedal.length !== 1 || Math.abs(part.pedal[0][0] + 1.5) > 1e-6 || Math.abs(part.pedal[0][1] - 1.5) > 1e-6) fail(JSON.stringify(part.pedal));
      if (part.bars.length !== 2 || part.bars[0] !== 0) fail(part.bars.join());
      // The pedal down before the excerpt holds its B4 to the pedal's lift (1.5 s), and makes no sound of its own.
      const held = music.render(part, { limit: false });
      if (Math.abs(held.seconds - Math.max(1.5 + 0.1, 1.0 + 0.5 + 0.1)) > 0.05) fail(\`\${held.seconds}\`);
      program(async () => { playWav(held.wav(), 0); });`);
    expect(errors(r)).toEqual([]);
  });

  it("brings sections made apart to one loudness with one gain, as loud against one another as they were", () => {
    const r = run(`
      const loud = tone("A4", 2, { volume: 0.5 }), soft = tone("A4", 2, { volume: 0.05 });
      const [a, b] = together([{ clip: loud, at: 0 }, { clip: soft, at: 2 }], { lufs: -20 });
      const sum = mixdown([{ clip: a, at: 0 }, { clip: b, at: 2 }]);
      if (Math.abs(sum.lufs + 20) > 0.2) fail(\`\${sum.lufs}\`);
      if (Math.abs(a.peak / b.peak - 10) > 0.01) fail(\`\${a.peak / b.peak}\`);`);
    expect(errors(r)).toEqual([]);
  });
});

describe("music.hits and the trailer presets", () => {
  it("plays each key's clip whole, unpitched, as loud as its velocity, in a performance beside a note instrument", () => {
    const r = run(`
      const boom = tone(50, 2, { volume: 0.5 }), tick = noise(0.05, { volume: 0.3 });
      const fx = music.hits({ C2: boom, D2: tick });
      if (fx.note("C2", 0.1) !== boom) fail("note");
      if (Math.abs(fx.strike!("C2", 0.1, 0.5).peak - boom.peak * 0.5) > 1e-6) fail("strike");
      const take = music.perform({ meter: "3/8", bpm: 120 }, { fx: { instrument: fx, notes: "C2/16@100 r D2 r/4" } });
      const mix = music.render(take, { limit: false });
      // The boom whole, two seconds, though the note is a sixteenth.
      if (Math.abs(mix.seconds - 2) > 0.05) fail(\`\${mix.seconds}\`);
      const both = music.render(music.perform({ meter: "3/8", bpm: 120 }, { fx: { instrument: fx, notes: "C2/16@100 r D2 r/4" }, pad: { instrument: music.presets.braam(), notes: "A1/4." } }), { limit: false });
      if (!(both.seconds >= 2)) fail(\`\${both.seconds}\`);
      for (const p of [music.presets.braam(), music.presets.pulse(), music.presets.sub()]) if (!(p.note("A2", 0.5).seconds >= 0.49)) fail("preset");
      let refused = "";
      try { fx.note("E2", 1); } catch (e) { refused = String(e); }
      if (!/no clip for E2/.test(refused)) fail(refused);`);
    expect(errors(r)).toEqual([]);
  });
});

describe("loudness and sympathy", () => {
  it("measures a full-scale 997 Hz sine at −3.01 LUFS on one side, 0 from both (as the game plays one channel), and brings a clip to a loudness", () => {
    const sine = tone(997, 3, { volume: 1, rate: 48000 });
    expect(sine.pan(-1).lufs).toBeCloseTo(-3.01, 1);
    expect(sine.lufs).toBeCloseTo(0, 1);
    expect(sine.gain(0.1).loudness(-20).lufs).toBeCloseTo(-20, 1);
    expect(makeClip(new Float32Array(48000), 48000).lufs).toBe(-Infinity);
  });

  it("rings the strings while the pedal is down and stops them when it comes up", () => {
    // A held A3 (220 Hz) for a second: with the pedal down until 2 s, A2's and A3's strings answer and ring after it.
    const note = tone(220, 1, { volume: 0.5, rate: 22050 });
    const rung = clipChannels(note.resonance({ pedal: [[0, 2]], amount: 0.5, decay: 3 }));
    const left = rung[0], right = rung[1];
    const after = rms(left, 1.2, 1.8, 22050) + rms(right, 1.2, 1.8, 22050);
    const stopped = rms(left, 2.4, 2.9, 22050) + rms(right, 2.4, 2.9, 22050);
    expect(after).toBeGreaterThan(0.005);
    expect(stopped).toBeLessThan(after / 100);
    // Without the pedal nothing is added.
    const none = clipChannels(note.resonance({ pedal: [], amount: 0.5 }));
    expect(rms(none[0], 1.2, 1.8, 22050)).toBe(0);
  });
});
