/**
 * Whether a sampled instrument's zones say the right key for their recordings: each pitched attack zone's recording
 * measured (an FFT over 0.1 … 0.5 s of it, the peak within a semitone of the key it claims, its fundamental and its
 * second harmonic) against the zone's key and tune. A zone is flagged when both are more than 25 cents off (above C6,
 * 1.5 cents a semitone sharper allowed: a piano's stretch) — a wrong root makes every note the zone plays off by as
 * much (the Salamander's C4 regions, 2026-11-09), and moves both.
 *
 *   npx tsx scripts/samples-tuning.mts <instrument.samples>… [--all]
 *
 * Exits 1 when a zone is off. Unpitched zones (pitched: false) and release and pedal zones are not measured.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { readSamples } from "../compiler/samples";
import { clipChannels } from "../compiler/sound";

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length) { console.error("usage: samples-tuning <instrument.samples>… [--all]"); process.exit(2); }
const N = 32768, LIMIT = 25;

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

/** Cents of harmonic `h` of `key` in `x` (at `rate`), or NaN when there is too little of it. */
function cents(x: Float32Array, rate: number, key: number, h: number): number {
  const a = Math.round(0.1 * rate), L = Math.min(Math.round(0.4 * rate), x.length - a, N);
  if (L < 2048) return NaN;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < L; i++) re[i] = x[a + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / L));
  fft(re, im);
  const mag = (k: number) => Math.hypot(re[k], im[k]);
  const f = 440 * 2 ** ((key - 69) / 12) * h;
  if (f > rate / 2.5) return NaN;
  const lo = Math.floor((f * 2 ** (-0.9 / 12) * N) / rate), hi = Math.ceil((f * 2 ** (0.9 / 12) * N) / rate);
  let bk = lo;
  for (let k = lo; k <= hi; k++) if (mag(k) > mag(bk)) bk = k;
  const y0 = Math.log(mag(bk - 1) + 1e-12), y1 = Math.log(mag(bk) + 1e-12), y2 = Math.log(mag(bk + 1) + 1e-12);
  return 1200 * Math.log2((((bk + (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2)) * rate) / N) / f);
}

let off = 0;
for (const file of files) {
  const set = readSamples(readFileSync(file, "utf8"));
  const seen = new Map<unknown, boolean>();
  let checked = 0, bad = 0;
  for (const z of set.zones) {
    if ((z.trigger ?? "attack") !== "attack" || z.pitched === false || seen.has(z.clip)) continue;
    seen.set(z.clip, true);
    const ch = clipChannels(z.clip), x = ch.length === 1 ? ch[0] : ch[0].map((v, i) => (v + ch[1][i]) / 2);
    const actual = z.key + (z.tune ?? 0) / 100, base = Math.round(actual), shift = (actual - base) * 100;
    // Off when the fundamental and the second harmonic both say so (either alone can mislead: a low fundamental is
    // weak, a drum's partials are not harmonics) — a wrong root moves both; above C6 a piano is tuned sharp (stretch).
    const c1 = cents(x, set.rate, base, 1) - shift, c2 = cents(x, set.rate, base, 2) - shift;
    const found = [c1, c2].filter(Number.isFinite);
    if (!found.length) continue;
    checked++;
    const stretch = Math.max(0, base - 84) * 1.5, outside = (v: number) => v > LIMIT + stretch || v < -LIMIT;
    const wrong = found.every(outside), c = Math.abs(c1) <= Math.abs(c2) || !Number.isFinite(c2) ? c1 : c2;
    if (wrong) { bad++; off++; }
    if (wrong || args.includes("--all")) console.log(`${wrong ? "OFF " : "    "}${basename(file)} key ${z.key}${z.tune ? ` ${z.tune > 0 ? "+" : ""}${z.tune}¢` : ""} v${z.vlo}-${z.vhi}: ${c.toFixed(0)} cents (fundamental ${Number.isFinite(c1) ? c1.toFixed(0) : "–"}, 2nd harmonic ${Number.isFinite(c2) ? c2.toFixed(0) : "–"})`);
  }
  console.log(`${basename(file)}: ${checked} recordings measured, ${bad} off by more than ${LIMIT} cents.`);
}
process.exitCode = off ? 1 : 0;
