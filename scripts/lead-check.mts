/**
 * Whether a melody stands out: the melody and everything else rendered apart (the same mix, the same places), and for
 * each bar where the melody plays, how much louder it is than the rest in its own range — from just under the
 * melody's fundamental (its median note's, at 0.85) to 5 kHz, where its notes and their presence are. The energy of
 * each over the bar (Hann-windowed FFT frames of 4096, half overlapping), as a ratio in dB.
 *
 *   npx tsx scripts/lead-check.mts <melody.ogg|wav> <rest.ogg|wav> <timeline.ts> [--want=6] [--floor=4] [--all]
 *
 * The timeline is a module as probes/lib/fur-elise-timeline-gen.mts writes one: NOTES, ROLES (the melody's parts
 * are "lead" and "lead-synth"), BARS and SECTIONS. Prints each section's lowest and median ratio and every bar under
 * `want`; exits 1 when a bar is under `want` (6 dB) or any is under `floor` (4). Needs ffmpeg.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [melodyFile, restFile, timeline] = args.filter((a) => !a.startsWith("--"));
if (!melodyFile || !restFile || !timeline) { console.error("usage: lead-check <melody> <rest> <timeline.ts> [--want=6] [--floor=4] [--all]"); process.exit(2); }
const WANT = Number(flag("want") ?? 6), FLOOR = Number(flag("floor") ?? 4), RATE = 48000, N = 4096, TOP = 5000;
const read = (f: string) => { const b = execFileSync("ffmpeg", ["-v", "error", "-i", resolve(f), "-ac", "1", "-ar", String(RATE), "-f", "f32le", "-"], { maxBuffer: 1 << 30 }); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const melody = read(melodyFile), rest = read(restFile);
const t = await import(pathToFileURL(resolve(timeline)).href) as { NOTES: readonly (readonly number[])[]; ROLES: readonly string[]; BARS: readonly number[]; SECTIONS: readonly { name: string; bar: number }[] };
const isMelody = (part: number) => t.ROLES[part] === "lead" || t.ROLES[part] === "lead-synth";

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2, vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi; re[a] += vr; im[a] += vi;
        const q = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = q;
      }
    }
  }
}
/** Energy of `x` between `lo` and `hi` Hz over [a, b) seconds. */
function band(x: Float32Array, a: number, b: number, lo: number, hi: number): number {
  const kl = Math.max(1, Math.floor((lo * N) / RATE)), kh = Math.min(N / 2, Math.ceil((hi * N) / RATE));
  let e = 0;
  for (let s = Math.round(a * RATE); s + N <= Math.round(b * RATE) && s + N <= x.length; s += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    fft(re, im);
    for (let k = kl; k <= kh; k++) e += re[k] * re[k] + im[k] * im[k];
  }
  return e;
}

const sectionOf = (bar: number) => { let s = t.SECTIONS[0]; for (const x of t.SECTIONS) if (x.bar <= bar) s = x; return s.name; };
const rows: { bar: number; section: string; db: number; lo: number }[] = [];
for (let bar = 0; bar + 1 < t.BARS.length; bar++) {
  const a = t.BARS[bar], b = t.BARS[bar + 1];
  const notes = t.NOTES.filter((n) => isMelody(n[4]) && n[0] < b && n[1] > a);
  if (!notes.length || b - a < (N / RATE) * 1.5) continue;
  const f0 = notes.map((n) => 440 * 2 ** ((n[2] - 69) / 12)).sort((x, y) => x - y), lo = 0.85 * f0[Math.floor(f0.length / 2)];
  const em = band(melody, a, b, lo, TOP), er = band(rest, a, b, lo, TOP);
  rows.push({ bar, section: sectionOf(bar), db: 10 * Math.log10((em + 1e-12) / (er + 1e-12)), lo });
}
const median = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
let fails = 0;
for (const name of [...new Set(rows.map((r) => r.section))]) {
  const r = rows.filter((x) => x.section === name), dbs = r.map((x) => x.db), under = r.filter((x) => x.db < WANT);
  fails += under.length;
  console.log(`${name.padEnd(12)} ${String(r.length).padStart(3)} bars: lowest ${Math.min(...dbs).toFixed(1).padStart(5)} dB, median ${median(dbs).toFixed(1).padStart(5)} dB${under.length ? `, under ${WANT}: ${under.map((x) => `bar ${x.bar} ${x.db.toFixed(1)}`).join(", ")}` : ""}`);
  if (args.includes("--all")) for (const x of r) console.log(`    bar ${x.bar}: ${x.db.toFixed(1)} dB (from ${x.lo.toFixed(0)} Hz)`);
}
const all = rows.map((r) => r.db);
console.log(`${rows.length} bars with the melody: lowest ${Math.min(...all).toFixed(1)} dB, median ${median(all).toFixed(1)} dB; ${fails} under ${WANT} dB, ${rows.filter((r) => r.db < FLOOR).length} under ${FLOOR}.`);
process.exitCode = fails ? 1 : 0;
