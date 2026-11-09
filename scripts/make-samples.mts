/**
 * A sampled instrument for a script (`.samples`, compiler/samples.ts) from recordings on disk: an SFZ instrument's
 * regions, or a folder of recordings named by their note ("VlnEns_susVib_A3_v1.wav": A3, the first strength).
 *
 *   npx tsx scripts/make-samples.mts <instrument.sfz> <out.samples> [options]
 *   npx tsx scripts/make-samples.mts --names <folder> <out.samples> [options]
 *   npx tsx scripts/make-samples.mts --kit <kit.json> <out.samples> [options]
 *
 *   --keys 40-90         only the zones of these keys (MIDI numbers, or names: E2-C7); the pedal's are kept
 *   --layers 2,4,6       only these strengths of the notes, by number from the softest (1); the ones kept widen to cover the rest
 *   --seconds 10         each recording cut to this long at most, faded out over its last --fade seconds (1.5)
 *   --release 0.3        a note's release, seconds, where the instrument says none (--names: 0.3)
 *   --volume -6          dB on every zone
 *   --detect             --names: each recording's note found from its sound, for names that carry none (timpani)
 *   --octave 1           --names: the names' octaves moved by this many (VSCO 2 names middle C "C3": --octave 1)
 *   --pitch T1=41.5,T2=46.8   --names: the pitch (a MIDI number, a fraction for cents) of the recordings whose names hold
 *                        each text — a drum measured by ear or by its spectrum, where --detect is unsure
 *   --name "…" --credit "…"   what the file says it is, and whom to credit
 *
 * A kit (--kit) is percussion, a key a drum: { "root": "<folder>", "release": 2, "drums": { "C2": ["Percussion/
 * BDrumNewhit_*"], … } } — each key's recordings by pattern (* any text), unpitched, its strengths from the names
 * ("v3", or ppp … fff), the rest of a name telling recordings of one strength apart (played in turn).
 *
 * The recordings stay where they are (never in a repository: a sample library is its makers' and is large); the file
 * made holds what the build needs, coded without loss.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { writeSamples, type ZoneData } from "../compiler/samples";

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name: string) => args.includes(name);
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["--detect", "--names", "--kit"].includes(args[i - 1])));
const byNames = flag("--names"), byKit = flag("--kit");
const [source, out] = positional;
if (!source || !out) { console.error("usage: make-samples <instrument.sfz> <out.samples> [--keys lo-hi] [--layers 1,3,…] [--seconds s] | --names <folder> <out.samples> [--detect]"); process.exit(2); }

/* ── WAV ── */

interface Wav { rate: number; channels: Float32Array[] }
function readWav(path: string): Wav {
  const b = readFileSync(path), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WAVE") throw new Error(`${path} is not a WAV file.`);
  let at = 12, format = 0, channels = 0, rate = 0, bits = 0, data: [number, number] | null = null;
  while (at + 8 <= b.length) {
    const id = b.toString("latin1", at, at + 4), size = v.getUint32(at + 4, true);
    if (id === "fmt ") { format = v.getUint16(at + 8, true); channels = v.getUint16(at + 10, true); rate = v.getUint32(at + 12, true); bits = v.getUint16(at + 22, true); if (format === 0xfffe) format = v.getUint16(at + 32, true); }
    if (id === "data") data = [at + 8, Math.min(size, b.length - at - 8)];
    at += 8 + size + (size & 1);
  }
  if (!data || !channels) throw new Error(`${path}: no format or no data.`);
  const width = bits / 8, frames = Math.floor(data[1] / (width * channels));
  const out = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) {
    const p = data[0] + (i * channels + c) * width;
    out[c][i] = format === 3 ? (bits === 32 ? v.getFloat32(p, true) : v.getFloat64(p, true))
      : bits === 16 ? v.getInt16(p, true) / 32768
      : bits === 24 ? ((b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) << 8 >> 8) / 8388608
      : bits === 32 ? v.getInt32(p, true) / 2147483648 : (b[p] - 128) / 128;
  }
  return { rate, channels: out.slice(0, 2) };
}

/* ── Notes ── */

const SEMI: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
/** A key: a MIDI number, or a name ("c4", "F#3", "Bb2"; 60 is C4). */
function keyOf(text: string): number {
  if (/^-?\d+$/.test(text)) return Number(text);
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(text);
  if (!m) throw new Error(`Not a key: ${text}`);
  return 12 * (Number(m[3]) + 1) + SEMI[m[1].toLowerCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

/* ── An SFZ instrument's regions ── */

interface Region { sample: string; opcodes: Record<string, string> }
function readSfz(path: string): Region[] {
  const text = readFileSync(path, "utf8").replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const regions: Region[] = [];
  let global: Record<string, string> = {}, group: Record<string, string> = {}, current: Record<string, string> | null = null, control: Record<string, string> = {};
  let header = "";
  const flush = () => { if (header === "region" && current) regions.push({ sample: current.sample ?? "", opcodes: current }); };
  // Headers and opcodes; a sample's path may hold spaces, up to the next opcode.
  const tokens = text.split(/(<\w+>)/);
  for (const part of tokens) {
    const h = /^<(\w+)>$/.exec(part);
    if (h) {
      flush();
      header = h[1];
      if (header === "global") global = {};
      if (header === "group" || header === "master") group = {};
      if (header === "control") control = {};
      current = header === "region" ? { ...global, ...group } : null;
      continue;
    }
    const target = header === "region" ? current! : header === "group" || header === "master" ? group : header === "global" ? global : header === "control" ? control : null;
    if (!target) continue;
    for (const m of part.matchAll(/(\w+)=([\s\S]*?)(?=\s+\w+=|$)/g)) target[m[1]] = m[2].trim();
  }
  flush();
  const base = control.default_path ?? "";
  return regions.filter((r) => r.sample).map((r) => ({ ...r, sample: (base + r.sample).replace(/\\/g, "/") }));
}

function zonesFromSfz(path: string): { files: string[]; zones: ZoneData[] } {
  const regions = readSfz(path), files: string[] = [], zones: ZoneData[] = [];
  const release = Number(option("--release") ?? 0.3);
  for (const r of regions) {
    const o = r.opcodes, num = (k: string, d: number) => (o[k] !== undefined ? Number(o[k]) : d);
    let trigger: ZoneData["trigger"] = o.trigger === "release" ? "release" : "attack";
    if (o.on_locc64 !== undefined || o.on_hicc64 !== undefined) trigger = Number(o.on_hicc64 ?? 127) >= 64 ? "pedal-down" : "pedal-up";
    const key = o.key !== undefined ? keyOf(o.key) : undefined;
    const lo = key ?? (o.lokey !== undefined ? keyOf(o.lokey) : 0), hi = key ?? (o.hikey !== undefined ? keyOf(o.hikey) : 127);
    if (trigger === "attack" || trigger === "release") if (lo < 0 || hi < 0) continue;
    // SFZ: `key` sets the root too; with neither, the root is middle C (60), whatever the zone's keys. Salamander's C4
    // regions say no root: taken as their lowest key (B3) they played a semitone sharp on B3, C4 and C#4.
    const centre = o.pitch_keycenter !== undefined ? keyOf(o.pitch_keycenter) : key ?? 60;
    let k = files.indexOf(r.sample);
    if (k < 0) { files.push(r.sample); k = files.length - 1; }
    const zone: ZoneData = {
      sample: k, key: Math.max(0, Math.min(127, centre)), lo: Math.max(0, lo), hi: Math.max(0, Math.min(127, hi)), vlo: Math.max(1, num("lovel", 1)), vhi: Math.min(127, num("hivel", 127)),
      ...(trigger !== "attack" ? { trigger } : {}),
      ...(o.volume !== undefined ? { volume: Number(o.volume) } : {}),
      ...(o.amp_veltrack !== undefined ? { veltrack: Number(o.amp_veltrack) / 100 } : {}),
      release: o.ampeg_release !== undefined ? Number(o.ampeg_release) : release,
      ...(o.rt_decay !== undefined ? { decay: Number(o.rt_decay) } : {}),
      ...(o.tune !== undefined ? { tune: Number(o.tune) } : {}),
      ...(o.pitch_keytrack !== undefined && Number(o.pitch_keytrack) === 0 ? { pitched: false } : {}),
      ...(o.seq_length !== undefined ? { turns: Number(o.seq_length), turn: num("seq_position", 1) } : {}),
      ...(o.lorand !== undefined || o.hirand !== undefined ? { chance: [num("lorand", 0), num("hirand", 1)] as const } : {}),
    };
    if (trigger === "pedal-down" || trigger === "pedal-up") zones.push({ ...zone, key: 60, lo: 0, hi: 127, pitched: false });
    else zones.push(zone);
  }
  return { files: files.map((f) => resolve(dirname(path), f)), zones };
}

/* ── A folder of recordings named by note ── */

/** The note a recording plays, by autocorrelation over 0.1 … 0.6 s of it, its fundamental 40 … 1000 Hz: [key, cents]. */
function detect(w: Wav): [number, number] {
  const x = w.channels[0], from = Math.round(0.1 * w.rate), n = Math.min(Math.round(0.5 * w.rate), x.length - from - 2048);
  const lo = Math.floor(w.rate / 1000), hi = Math.ceil(w.rate / 40);
  let best = 0, lag = lo;
  const r = new Float64Array(hi + 2);
  for (let l = lo; l <= hi + 1; l++) {
    let s = 0, e1 = 0, e2 = 0;
    for (let i = from; i < from + n; i++) { s += x[i] * x[i + l]; e1 += x[i] * x[i]; e2 += x[i + l] * x[i + l]; }
    r[l] = s / Math.sqrt(e1 * e2 || 1);
  }
  // The first lag that comes near the best, so an octave below is not taken for the note.
  for (let l = lo; l <= hi; l++) if (r[l] > best) best = r[l];
  for (let l = lo + 1; l <= hi; l++) if (r[l] >= 0.9 * best && r[l] >= r[l - 1] && r[l] >= r[l + 1]) { lag = l; break; }
  // Between samples, by the parabola through the peak.
  const a = r[lag - 1], b = r[lag], c = r[lag + 1], shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  const hz = w.rate / (lag + shift), midi = 69 + 12 * Math.log2(hz / 440), key = Math.round(midi);
  return [key, Math.round((midi - key) * 100)];
}

function zonesFromNames(folder: string): { files: string[]; zones: ZoneData[] } {
  const list = readdirSync(folder).filter((f) => /\.wav$/i.test(f) && statSync(join(folder, f)).isFile()).sort();
  const release = Number(option("--release") ?? 0.3);
  type Rec = { file: string; key: number; tune: number; layer: number; turn: number };
  const recs: Rec[] = list.map((f) => {
    const stem = f.replace(/\.wav$/i, "");
    const note = /(?:^|[_\s-])([A-G]#?-?\d)(?=[_\s-]|$)/.exec(stem);
    const layer = Number(/(?:^|_)v(\d+)(?:_|$)/i.exec(stem)?.[1] ?? 1);
    const turn = Number(/(?:^|_)rr(\d+)(?:_|$)/i.exec(stem)?.[1] ?? /_(\d+)$/.exec(stem)?.[1] ?? 1);
    let key: number, tune = 0;
    const given = (option("--pitch") ?? "").split(",").filter(Boolean).map((p) => p.split("=")).find(([name]) => stem.includes(name));
    if (given) { const midi = Number(given[1]); key = Math.round(midi); tune = Math.round((midi - key) * 100); }
    else if (flag("--detect") || !note) { [key, tune] = detect(readWav(join(folder, f))); console.log(`${f}: ${key} ${tune >= 0 ? "+" : ""}${tune} cents`); }
    else key = keyOf(note[1]) + 12 * Number(option("--octave") ?? 0);
    return { file: join(folder, f), key, tune, layer, turn };
  });
  const keys = [...new Set(recs.map((r) => r.key))].sort((a, b) => a - b);
  const zones: ZoneData[] = [];
  recs.forEach((r, k) => {
    const i = keys.indexOf(r.key);
    const lo = i === 0 ? Math.max(0, r.key - 12) : Math.floor((keys[i - 1] + r.key) / 2) + 1, hi = i === keys.length - 1 ? Math.min(127, r.key + 12) : Math.floor((r.key + keys[i + 1]) / 2);
    const layers = [...new Set(recs.filter((x) => x.key === r.key).map((x) => x.layer))].sort((a, b) => a - b), li = layers.indexOf(r.layer);
    const turns = new Set(recs.filter((x) => x.key === r.key && x.layer === r.layer).map((x) => x.turn)).size;
    zones.push({
      sample: k, key: r.key, lo, hi, vlo: li === 0 ? 1 : Math.floor((127 * li) / layers.length) + 1, vhi: Math.floor((127 * (li + 1)) / layers.length), release,
      ...(r.tune ? { tune: r.tune } : {}),
      ...(turns > 1 ? { turns, turn: [...new Set(recs.filter((x) => x.key === r.key && x.layer === r.layer).map((x) => x.turn))].sort((a, b) => a - b).indexOf(r.turn) + 1 } : {}),
    });
  });
  return { files: recs.map((r) => r.file), zones };
}

/* ── A kit: a key a drum ── */

const DYNAMICS = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"];
/** A recording's strength from its name: "v3", or a dynamic as a word of it; -1 when it says none. */
function strengthOf(stem: string): number {
  const v = /(?:^|[_-])v(\d+)(?=[_.-]|$)/i.exec(stem);
  if (v) return Number(v[1]);
  const words = stem.toLowerCase().replace(/\.wav$/, "").split(/[_\-\s]+/);
  for (let k = DYNAMICS.length - 1; k >= 0; k--) if (words.includes(DYNAMICS[k])) return k + 1;
  return -1;
}

function zonesFromKit(path: string): { files: string[]; zones: ZoneData[] } {
  const spec = JSON.parse(readFileSync(path, "utf8")) as { root?: string; release?: number; drums: Record<string, string[]> };
  const root = resolve(dirname(path), spec.root ?? ".");
  const files: string[] = [], zones: ZoneData[] = [];
  for (const [name, patterns] of Object.entries(spec.drums)) {
    const key = keyOf(name);
    const found = patterns.flatMap((pat) => {
      const dir = join(root, dirname(pat)), re = new RegExp(`^${basename(pat).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
      return readdirSync(dir).filter((f) => re.test(f) && /\.wav$/i.test(f)).sort().map((f) => join(dir, f));
    });
    if (!found.length) throw new Error(`${name}: no recording matches ${patterns.join(", ")}.`);
    const strengths = [...new Set(found.map((f) => strengthOf(basename(f))))].sort((a, b) => a - b);
    found.forEach((f) => {
      const st = strengthOf(basename(f)), li = strengths.indexOf(st), same = found.filter((g) => strengthOf(basename(g)) === st);
      files.push(f);
      zones.push({
        sample: files.length - 1, key, lo: key, hi: key, vlo: li === 0 ? 1 : Math.floor((127 * li) / strengths.length) + 1, vhi: Math.floor((127 * (li + 1)) / strengths.length),
        pitched: false, release: spec.release ?? 2, ...(same.length > 1 ? { turns: same.length, turn: same.indexOf(f) + 1 } : {}),
      });
    });
  }
  return { files, zones };
}

/* ── Choosing, cutting, writing ── */

let { files, zones } = byKit ? zonesFromKit(source) : byNames ? zonesFromNames(source) : zonesFromSfz(source);
const keys = option("--keys");
if (keys) {
  const [lo, hi] = keys.split("-").map(keyOf);
  zones = zones.filter((z) => z.trigger === "pedal-down" || z.trigger === "pedal-up" || (z.hi >= lo && z.lo <= hi));
}
const layers = option("--layers");
if (layers) {
  const keep = new Set(layers.split(",").map(Number));
  // A layer's number among the strengths of its keys and trigger, from the softest.
  const groupOf = (z: ZoneData) => `${z.trigger ?? "attack"}|${z.lo}|${z.hi}`;
  const groups = new Map<string, ZoneData[]>();
  for (const z of zones) { const g = groups.get(groupOf(z)); if (g) g.push(z); else groups.set(groupOf(z), [z]); }
  const kept: ZoneData[] = [];
  for (const g of groups.values()) {
    const levels = [...new Set(g.map((z) => z.vlo))].sort((a, b) => a - b);
    // Only the notes' strengths are chosen: the sounds of keys let go and of the pedal stay as they are.
    if (levels.length < 2 || (g[0].trigger ?? "attack") !== "attack") { kept.push(...g); continue; }
    const chosen = g.filter((z) => keep.has(levels.indexOf(z.vlo) + 1)).sort((a, b) => a.vlo - b.vlo);
    // Each kept layer reaches down to the one kept below it; the top one to 127.
    const tops = [...new Set(chosen.map((z) => z.vhi))].sort((a, b) => a - b);
    for (const z of chosen) {
      const t = tops.indexOf(z.vhi);
      kept.push({ ...z, vlo: t === 0 ? 1 : tops[t - 1] + 1, vhi: t === tops.length - 1 ? 127 : z.vhi });
    }
  }
  zones = kept;
}
const volume = Number(option("--volume") ?? 0);
if (volume) zones = zones.map((z) => ({ ...z, volume: (z.volume ?? 0) + volume }));
// Only the recordings the zones kept, renumbered.
const used = [...new Set(zones.map((z) => z.sample))].sort((a, b) => a - b);
zones = zones.map((z) => ({ ...z, sample: used.indexOf(z.sample) }));
const seconds = Number(option("--seconds") ?? 0), fade = Number(option("--fade") ?? 1.5);
let rate = 0;
const samples = used.map((k) => {
  const w = readWav(files[k]);
  if (rate && w.rate !== rate) throw new Error(`${files[k]} is at ${w.rate} Hz; the others at ${rate}.`);
  rate = w.rate;
  let chans = w.channels;
  if (seconds > 0 && chans[0].length > seconds * rate) {
    const n = Math.round(seconds * rate), f = Math.round(Math.min(fade, seconds / 2) * rate);
    chans = chans.map((c) => { const o = c.slice(0, n); for (let i = 0; i < f; i++) o[n - f + i] *= Math.cos(((i / f) * Math.PI) / 2) ** 2; return o; });
  }
  return { name: basename(files[k]), channels: chans };
});
const text = writeSamples({ rate, samples, zones, ...(option("--name") ? { name: option("--name") } : {}), ...(option("--credit") ? { credit: option("--credit") } : {}), source: basename(source) });
writeFileSync(out, text);
const raw = samples.reduce((n, s) => n + s.channels.length * s.channels[0].length * 2, 0);
console.log(`${out}: ${samples.length} recordings, ${zones.length} zones, ${(samples.reduce((n, s) => n + s.channels[0].length, 0) / rate / 60).toFixed(1)} minutes; ${(text.length / 1048576).toFixed(1)} MB (16-bit would be ${(raw / 1048576).toFixed(1)} MB, in base64 ${((raw * 4) / 3 / 1048576).toFixed(1)}).`);
