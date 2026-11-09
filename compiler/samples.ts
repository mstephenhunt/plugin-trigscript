/**
 * Sampled instruments a script imports: `import piano from "./piano.samples"`. A `.samples` file is one of the
 * script's files: the recordings of an instrument — a note every few keys, each at several strengths, and the sounds
 * of its keys let go and its pedal — and which key and which strength each one is for (its zones), as a sampler's
 * SFZ file says it. `music.sampled(piano)` (`stdlib/music.ts`) plays it: each note from the recording nearest its key
 * and the one made at its strength, so a soft note sounds soft, not only quieter.
 *
 * The file is text, one line of JSON: the zones, and the recordings in base64, 16-bit, coded without loss — each
 * sample predicted from the three before it, the best of four fixed predictors a block (as FLAC's), and what is left
 * Rice-coded — about half of plain 16-bit for a piano's notes, which ring down to near silence. A recording is
 * decoded when a build first needs its samples; a check as the user types decodes none.
 *
 * `scripts/make-samples.mts` makes one from an SFZ instrument (the Salamander Grand Piano's, VSCO 2's) — choosing
 * keys, strengths and the longest a recording may be, since a whole concert grand is half a gigabyte.
 */
import { fromBase64, toBase64 } from "./rangeCoder";
import { hertz, isClip, storedClip, type Clip } from "./sound";

/** The extension of a sampled instrument among a script's files. */
export const SAMPLES_EXTENSION = ".samples";
/** The format's version, in the file. */
const VERSION = 1;

/** What starts a zone's recording: a key struck, a key let go, the sustain pedal pressed or lifted. */
export type ZoneTrigger = "attack" | "release" | "pedal-down" | "pedal-up";

/** A zone as the file holds it: which recording, for which keys and strengths, and how it is played. */
export interface ZoneData {
  /** The recording, by its place in the file's list. */
  readonly sample: number;
  /** The key the recording was made at (MIDI number, 60 is C4); the keys it plays, `lo` … `hi`. */
  readonly key: number;
  readonly lo: number;
  readonly hi: number;
  /** The strengths it plays (MIDI velocity, 1 … 127). */
  readonly vlo: number;
  readonly vhi: number;
  readonly trigger?: ZoneTrigger;
  /** dB, 0 as recorded. */
  readonly volume?: number;
  /** How much the strength changes its loudness, 0 … 1 (SFZ's amp_veltrack / 100; 1 when left out). */
  readonly veltrack?: number;
  /** Seconds a note takes to die away after it is let go (SFZ's ampeg_release). */
  readonly release?: number;
  /** For a release zone: dB quieter each second the key was held (SFZ's rt_decay). */
  readonly decay?: number;
  /** Cents the recording is tuned up (or down). */
  readonly tune?: number;
  /** false: played at its own pitch whatever the key (a key's thump, the pedal). */
  readonly pitched?: boolean;
  /** Round robin: the zone's turn, 1 … `turns`, among zones of the same keys and strengths played in turn. */
  readonly turn?: number;
  readonly turns?: number;
  /** A choice by chance, `[from, to)` of 0 … 1, among zones of the same keys (SFZ's lorand/hirand). */
  readonly chance?: readonly [number, number];
}

/** A recording as the file lists it. */
interface SampleEntry { readonly name: string; readonly channels: 1 | 2; readonly frames: number; readonly bytes: number }

interface SamplesHeader {
  trigscript: "samples";
  version: number;
  rate: number;
  name?: string;
  credit?: string;
  source?: string;
  samples: SampleEntry[];
  zones: ZoneData[];
  data: string;
}

/** A recording to put in a file: its name (for the person), and one or two channels of samples (−1 … 1). */
export interface SampleInput { readonly name: string; readonly channels: readonly Float32Array[] }

/** What `writeSamples` takes: the recordings at one rate, the zones over them, and who made them. */
export interface SamplesInput {
  readonly rate: number;
  readonly name?: string;
  /** Who made the recordings and under what licence: what a map that plays them should say. */
  readonly credit?: string;
  readonly source?: string;
  readonly samples: readonly SampleInput[];
  readonly zones: readonly ZoneData[];
}

/* ── The coding: fixed prediction and Rice codes, a block at a time ── */

const BLOCK = 4096;
/** Past this many ones a residual is written whole, 20 bits, after them. */
const ESCAPE = 24;

class BitWriter {
  bytes = new Uint8Array(1 << 16);
  length = 0;
  private acc = 0;
  private count = 0;
  private push(byte: number) {
    if (this.length === this.bytes.length) { const b = new Uint8Array(this.bytes.length * 2); b.set(this.bytes); this.bytes = b; }
    this.bytes[this.length++] = byte;
  }
  write(value: number, bits: number) {
    for (let k = bits - 1; k >= 0; k--) {
      this.acc = (this.acc << 1) | ((value >>> k) & 1);
      if (++this.count === 8) { this.push(this.acc); this.acc = 0; this.count = 0; }
    }
  }
  ones(n: number) { for (let k = 0; k < n; k++) this.write(1, 1); }
  finish(): Uint8Array {
    if (this.count) this.push(this.acc << (8 - this.count));
    this.acc = 0; this.count = 0;
    return this.bytes.subarray(0, this.length);
  }
}

class BitReader {
  private at = 0;
  private bit = 0;
  private readonly bytes: Uint8Array;
  constructor(bytes: Uint8Array) { this.bytes = bytes; }
  one(): number {
    if (this.at >= this.bytes.length) throw new Error("A recording in this .samples file ends too soon: the file is cut short.");
    const b = (this.bytes[this.at] >> (7 - this.bit)) & 1;
    if (++this.bit === 8) { this.bit = 0; this.at++; }
    return b;
  }
  read(bits: number): number { let v = 0; for (let k = 0; k < bits; k++) v = (v << 1) | this.one(); return v >>> 0; }
}

/** The four fixed predictions of x[n] from the samples before it (0 before the start). */
const predict = (order: number, a: number, b: number, c: number): number => (order === 0 ? 0 : order === 1 ? a : order === 2 ? 2 * a - b : 3 * a - 3 * b + c);

/** One channel, as 16-bit integers, coded. */
function encodeChannel(s: Int16Array, w: BitWriter): void {
  for (let from = 0; from < s.length; from += BLOCK) {
    const to = Math.min(s.length, from + BLOCK);
    const at = (i: number) => (i >= 0 ? s[i] : 0);
    // The order whose residuals are smallest.
    let order = 0, least = Infinity;
    for (let o = 0; o < 4; o++) {
      let sum = 0;
      for (let i = from; i < to; i++) sum += Math.abs(s[i] - predict(o, at(i - 1), at(i - 2), at(i - 3)));
      if (sum < least) { least = sum; order = o; }
    }
    const u = new Uint32Array(to - from);
    for (let i = from; i < to; i++) { const r = s[i] - predict(order, at(i - 1), at(i - 2), at(i - 3)); u[i - from] = r >= 0 ? 2 * r : -2 * r - 1; }
    // The Rice parameter that writes the block in the fewest bits.
    let k = 0, best = Infinity;
    for (let kk = 0; kk < 20; kk++) {
      let bits = 0;
      for (let j = 0; j < u.length; j++) { const q = u[j] >>> kk; bits += q >= ESCAPE ? ESCAPE + 20 : q + 1 + kk; }
      if (bits < best) { best = bits; k = kk; }
    }
    w.write(order, 2);
    w.write(k, 5);
    for (let j = 0; j < u.length; j++) {
      const q = u[j] >>> k;
      if (q >= ESCAPE) { w.ones(ESCAPE); w.write(u[j], 20); }
      else { w.ones(q); w.write(0, 1); if (k) w.write(u[j] & ((1 << k) - 1), k); }
    }
  }
}

function decodeChannel(r: BitReader, frames: number): Float32Array {
  const out = new Float32Array(frames), s = new Int32Array(frames);
  for (let from = 0; from < frames; from += BLOCK) {
    const to = Math.min(frames, from + BLOCK), order = r.read(2), k = r.read(5);
    for (let i = from; i < to; i++) {
      let q = 0;
      while (q < ESCAPE && r.one()) q++;
      const u = q >= ESCAPE ? r.read(20) : ((q << k) | (k ? r.read(k) : 0)) >>> 0;
      const res = u & 1 ? -((u + 1) >>> 1) : u >>> 1;
      const a = i > 0 ? s[i - 1] : 0, b = i > 1 ? s[i - 2] : 0, c = i > 2 ? s[i - 3] : 0;
      s[i] = res + predict(order, a, b, c);
      out[i] = s[i] / 32768;
    }
  }
  return out;
}

const toInt16 = (x: Float32Array): Int16Array => {
  const out = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32768)));
  return out;
};

/* ── The file ── */

/** The `.samples` file's text for these recordings and zones. */
export function writeSamples(input: SamplesInput): string {
  if (!(Number.isInteger(input.rate) && input.rate >= 8000 && input.rate <= 96000)) throw new Error(`A sampled instrument's rate is 8 000 to 96 000 samples a second, not ${input.rate}.`);
  checkZones(input.zones, input.samples.length);
  const parts: Uint8Array[] = [], entries: SampleEntry[] = [];
  for (const s of input.samples) {
    if (s.channels.length !== 1 && s.channels.length !== 2) throw new Error(`The recording ${s.name} has ${s.channels.length} channels: one or two.`);
    const frames = s.channels[0].length;
    const w = new BitWriter();
    for (const c of s.channels) {
      if (c.length !== frames) throw new Error(`The recording ${s.name}'s channels are not the same length.`);
      encodeChannel(toInt16(c), w);
    }
    const bytes = w.finish().slice();
    parts.push(bytes);
    entries.push({ name: s.name, channels: s.channels.length as 1 | 2, frames, bytes: bytes.length });
  }
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  const header: SamplesHeader = {
    trigscript: "samples", version: VERSION, rate: input.rate,
    ...(input.name ? { name: input.name } : {}), ...(input.credit ? { credit: input.credit } : {}), ...(input.source ? { source: input.source } : {}),
    samples: entries, zones: input.zones.map((z) => ({ ...z })), data: toBase64(all),
  };
  return JSON.stringify(header);
}

function checkZones(zones: readonly ZoneData[], samples: number): void {
  zones.forEach((z, k) => {
    const where = `Zone ${k + 1} of the instrument`;
    if (!(Number.isInteger(z.sample) && z.sample >= 0 && z.sample < samples)) throw new Error(`${where} names recording ${z.sample}, of 0 … ${samples - 1}.`);
    for (const [name, v, lo, hi] of [["key", z.key, 0, 127], ["lo", z.lo, 0, 127], ["hi", z.hi, 0, 127], ["vlo", z.vlo, 0, 127], ["vhi", z.vhi, 0, 127]] as const) {
      if (!(Number.isInteger(v) && v >= lo && v <= hi)) throw new Error(`${where}: its ${name} is a whole number ${lo} … ${hi}, not ${v}.`);
    }
    if (z.lo > z.hi || z.vlo > z.vhi) throw new Error(`${where} plays no key or no strength: keys ${z.lo} … ${z.hi}, strengths ${z.vlo} … ${z.vhi}.`);
    if (z.trigger !== undefined && !["attack", "release", "pedal-down", "pedal-up"].includes(z.trigger)) throw new Error(`${where}: its trigger is "attack", "release", "pedal-down" or "pedal-up", not ${JSON.stringify(z.trigger)}.`);
  });
}

/** One zone of a sampled instrument, as a script gets it: the zone's numbers, and its recording as a clip. */
export interface Zone extends ZoneData {
  readonly clip: Clip;
}

/** A sampled instrument, as a script gets it (`import piano from "./piano.samples"`). */
export interface Samples {
  readonly __trigscript: "samples";
  readonly name: string;
  readonly credit: string;
  readonly rate: number;
  readonly zones: readonly Zone[];
  /** Seconds of recordings in it, every zone's once. */
  readonly seconds: number;
}

export const isSamples = (v: unknown): v is Samples => typeof v === "object" && v !== null && (v as Samples).__trigscript === "samples";

/** Two 32-bit hashes of some bytes, as 16 hex digits: what a recording's clip is named by. */
function hashBytes(b: Uint8Array): string {
  let a = 0x811c9dc5, c = 0x9747b28c;
  const words = Math.floor(b.length / 4), view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < words; i++) { const x = view.getUint32(i * 4, true); a = Math.imul(a ^ x, 0x01000193) >>> 0; c = Math.imul(c ^ x, 0x5bd1e995) >>> 0; c = (c ^ (c >>> 15)) >>> 0; }
  for (let i = words * 4; i < b.length; i++) { a = Math.imul(a ^ b[i], 0x01000193) >>> 0; c = Math.imul(c ^ b[i], 0x5bd1e995) >>> 0; }
  return a.toString(16).padStart(8, "0") + c.toString(16).padStart(8, "0");
}

/** Read a `.samples` file's text. Throws, in words for the person, when it is not one. */
export function readSamples(text: string): Samples {
  let h: Partial<SamplesHeader>;
  try { h = JSON.parse(text) as Partial<SamplesHeader>; } catch { throw new Error("This is not a sampled instrument TrigScript made: a .samples file is one line of JSON."); }
  if (h?.trigscript !== "samples" || typeof h.data !== "string" || !Array.isArray(h.samples) || !Array.isArray(h.zones)) throw new Error("This is not a sampled instrument TrigScript made.");
  if (h.version !== VERSION) throw new Error(`This instrument was written by a newer TrigScript (format ${h.version}); update the plugin to read it.`);
  const rate = Number(h.rate);
  if (!(Number.isInteger(rate) && rate >= 8000 && rate <= 96000)) throw new Error(`The instrument's rate is 8 000 to 96 000 samples a second, not ${h.rate}.`);
  checkZones(h.zones, h.samples.length);
  const data = fromBase64(h.data);
  let o = 0, seconds = 0;
  const clips = h.samples.map((s) => {
    const bytes = data.subarray(o, o + s.bytes);
    o += s.bytes;
    if (bytes.length < s.bytes) throw new Error(`The recording ${s.name} ends too soon: the file is cut short.`);
    seconds += s.frames / rate;
    return storedClip(`samples:${hashBytes(bytes)}:${s.channels}:${s.frames}:${rate}`, rate, s.frames, s.channels, () => {
      const r = new BitReader(bytes);
      return Array.from({ length: s.channels }, () => decodeChannel(r, s.frames));
    });
  });
  const zones = h.zones.map((z) => Object.freeze({ ...z, clip: clips[z.sample] }));
  return Object.freeze({
    __trigscript: "samples" as const, name: typeof h.name === "string" ? h.name : "", credit: typeof h.credit === "string" ? h.credit : "",
    rate, zones: Object.freeze(zones), seconds,
  });
}

/** The value an import of a `.samples` file gives, kept while the text is the same (a build reads the files each time). */
const values = new Map<string, Samples>();

export function samplesValue(text: string): Samples {
  const hit = values.get(text);
  if (hit) return hit;
  const v = readSamples(text);
  // Few instruments at a time, and large: the oldest goes when a fifth arrives.
  if (values.size >= 4) values.delete(values.keys().next().value!);
  values.set(text, v);
  return v;
}

/** What the hover on an import says: "A sampled instrument, Salamander Grand Piano: 241 recordings (12.3 minutes), 263 zones at 44 100 Hz." */
export function describeSamples(text: string): string {
  try {
    // The header alone, before the data: a .samples file can be large.
    const cut = text.indexOf(',"data":"');
    const h = JSON.parse(cut > 0 ? `${text.slice(0, cut)}}` : text) as Partial<SamplesHeader>;
    if (h?.trigscript !== "samples" || !Array.isArray(h.samples) || !Array.isArray(h.zones)) return "This is not a sampled instrument TrigScript made.";
    const rate = Number(h.rate), seconds = h.samples.reduce((n, s) => n + s.frames / rate, 0);
    return `A sampled instrument${h.name ? `, ${h.name}` : ""}: ${h.samples.length} recording${h.samples.length === 1 ? "" : "s"} (${(seconds / 60).toFixed(1)} minutes), ${h.zones.length} zone${h.zones.length === 1 ? "" : "s"} at ${rate.toLocaleString("en-US")} Hz${h.credit ? `. ${h.credit}` : ""}.`;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * A sampled instrument made in the script, from clips it has — imported recordings (`.sound`), or made: `samples([{
 * clip: c3, key: "C3" }, { clip: c4, key: "C4" }])`. Each zone's keys and strengths default to all of them: a note is
 * played from the zone whose key is nearest it. `options`: its name and whom to credit.
 */
export function makeSamples(zones: unknown, options?: { readonly name?: string; readonly credit?: string }): Samples {
  if (!Array.isArray(zones) || zones.length === 0) throw new Error("samples() takes zones, one at least: samples([{ clip: c4, key: \"C4\" }]).");
  const keyOf = (v: unknown, what: string): number => {
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 127) return v;
    if (typeof v === "string") return Math.round(69 + 12 * Math.log2(hertz(v) / 440));
    throw new Error(`${what} is a key: a note's name ("C4") or its number (60), not ${JSON.stringify(v)}.`);
  };
  const made = zones.map((z: Record<string, unknown>, k) => {
    const where = `samples()' zone ${k + 1}`;
    if (!z || !isClip(z.clip)) throw new Error(`${where} has no clip: { clip, key: "C4" }.`);
    const key = keyOf(z.key, `${where}'s key`);
    const data: Record<string, unknown> = { ...z, sample: k, key, lo: z.lo === undefined ? 0 : keyOf(z.lo, `${where}'s lo`), hi: z.hi === undefined ? 127 : keyOf(z.hi, `${where}'s hi`), vlo: z.vlo ?? 1, vhi: z.vhi ?? 127 };
    return data as unknown as Zone;
  });
  checkZones(made, made.length);
  return Object.freeze({
    __trigscript: "samples" as const, name: options?.name ?? "", credit: options?.credit ?? "", rate: made[0].clip.rate,
    zones: Object.freeze(made.map((z) => Object.freeze({ ...z }))), seconds: made.reduce((n, z) => n + z.clip.seconds, 0),
  });
}
