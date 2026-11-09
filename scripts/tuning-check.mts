/**
 * Whether a render is in tune, note by note: for each pitch a timeline says is struck, the frequency of its
 * fundamental and its second harmonic just after each onset (an FFT over up to 0.2 s, the peak within a semitone of
 * where it should be, refined by a parabola), the median over every time it is struck, in cents against equal
 * temperament at A4 = 440 — judged by the fundamental, or under 200 Hz by the second harmonic. A pitch more than 25 cents off is flagged — above C6 a piano is tuned wider (its octaves
 * stretched), so there it may be sharp by 1.5 cents a semitone more.
 *
 *   npx tsx scripts/tuning-check.mts <render.ogg|wav> <timeline.ts> [--offset=seconds] [--parts=0,1] [--all]
 *
 * The timeline is a module as probes/lib/fur-elise-timeline-gen.mts writes one: NOTES rows [at, end, pitch, velocity,
 * part, …], and ROLES when it has them (parts whose role is a drum, a cymbal, an impact or a riser are not pitched and
 * are left out). `--offset`: where the render begins in the timeline (a section's clip). `--parts`: only these parts.
 * `--all`: print every pitch, not only the ones off. Exits 1 when a pitch is off. Needs ffmpeg.
 *
 * Found its first use on the straight soundtrack (2026-11-09): B3, C4 and C#4 a semitone sharp — an SFZ region with no
 * pitch_keycenter taken from its lowest key (make-samples, since fixed).
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [audio, timeline] = args.filter((a) => !a.startsWith("--"));
if (!audio || !timeline) { console.error("usage: tuning-check <render> <timeline.ts> [--offset=s] [--parts=0,1] [--all]"); process.exit(2); }
const RATE = 48000, N = 32768, LIMIT = 25;
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", resolve(audio), "-ac", "1", "-ar", String(RATE), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const mod = await import(pathToFileURL(resolve(timeline)).href) as { NOTES: readonly (readonly number[])[]; PARTS?: readonly string[]; ROLES?: readonly string[] };
const offset = Number(flag("offset") ?? 0);
const only = flag("parts")?.split(",").map(Number);
const UNPITCHED = /^(drum|cymbal|impact|riser)/;

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
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const name = (p: number) => NAMES[p % 12] + (Math.floor(p / 12) - 1);
const per = new Map<number, { c: number[]; c2: number[] }>();
for (const n of mod.NOTES) {
  const [at, end, pitch, , part] = n;
  if (only && !only.includes(part)) continue;
  if (mod.ROLES && UNPITCHED.test(mod.ROLES[part] ?? "")) continue;
  const t0 = at - offset + 0.04, L = Math.round(Math.min(0.2, end - at - 0.04) * RATE), i0 = Math.round(t0 * RATE);
  if (L < 4000 || i0 < 0 || i0 + L > x.length) continue;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < L; i++) re[i] = x[i0 + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / L));
  fft(re, im);
  const mag = (k: number) => Math.hypot(re[k], im[k]);
  const out = per.get(pitch) ?? { c: [], c2: [] };
  for (const h of [1, 2]) {
    const f = 440 * 2 ** ((pitch - 69) / 12) * h;
    if (f < 70 || f > 4000) continue;
    const lo = Math.floor((f * 2 ** (-0.9 / 12) * N) / RATE), hi = Math.ceil((f * 2 ** (0.9 / 12) * N) / RATE);
    let bk = lo;
    for (let k = lo; k <= hi; k++) if (mag(k) > mag(bk)) bk = k;
    const y0 = Math.log(mag(bk - 1) + 1e-12), y1 = Math.log(mag(bk) + 1e-12), y2 = Math.log(mag(bk + 1) + 1e-12);
    const fm = ((bk + (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2)) * RATE) / N;
    (h === 1 ? out.c : out.c2).push(1200 * Math.log2(fm / f));
  }
  per.set(pitch, out);
}
const median = (xs: number[]) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
let off = 0, checked = 0;
for (const p of [...per.keys()].sort((a, b) => a - b)) {
  const v = per.get(p)!, c = median(v.c), c2 = median(v.c2), n = Math.max(v.c.length, v.c2.length);
  // The value to judge: the fundamental — but under 200 Hz the second harmonic, since 0.2 s cannot place a low
  // fundamental within 25 cents and a piano's lowest are weak (F3's read −53 where its harmonic said −2).
  const low = 440 * 2 ** ((p - 69) / 12) < 200;
  const cents = low && Number.isFinite(c2) ? c2 : Number.isFinite(c) ? c : c2;
  if (!Number.isFinite(cents)) continue;
  checked++;
  // Off when the judged value is, and the other one (where there is one) agrees: a wrong note moves both.
  const stretch = Math.max(0, p - 84) * 1.5, outside = (v: number) => v > LIMIT + stretch || v < -LIMIT;
  const other = cents === c ? c2 : c, bad = outside(cents) && (!Number.isFinite(other) || outside(other) || !low);
  if (bad) off++;
  if (bad || args.includes("--all")) console.log(`${bad ? "OFF " : "    "}${name(p).padEnd(4)} ${String(p).padEnd(3)} ×${String(n).padEnd(4)} fundamental ${Number.isFinite(c) ? c.toFixed(0).padStart(4) : "   –"} cents, 2nd harmonic ${Number.isFinite(c2) ? c2.toFixed(0).padStart(4) : "   –"}`);
}
console.log(`${checked} pitches checked, ${off} off by more than ${LIMIT} cents (above C6, ${LIMIT} plus 1.5 a semitone sharp allowed).`);
process.exitCode = off ? 1 : 0;
