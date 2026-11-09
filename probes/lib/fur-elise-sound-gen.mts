// The Für Elise sound probe's instruments (probes/fur-elise-sound.ts), made from sample libraries kept outside the
// repository (never committed: they are their makers', and large) — SAMPLES_DIR, ~/github/samples by default:
//
//   salamander-grand-v3/   Salamander Grand Piano V3, 44.1 kHz 16-bit (Alexander Holm, CC BY 3.0), from
//                          freepats.zenvoid.org: SalamanderGrandPianoV3+20161209_44khz16bit.tar.xz, unpacked into extracted/
//   vsco2-ce/              VSCO 2 Community Edition (Versilian Studios, CC0), from github.com/sgossner/VSCO-2-CE: the
//                          string sections' sustains and spiccati, tenor trombone, tuba, horn, timpani; for the
//                          cinematic arrangement its percussion too (bass drums, tenor drums, snare, cymbals, gong)
//
// and one .sound: the piano's middle C at one strength, imported the old way (22 050 Hz, one channel, IMA ADPCM), for
// the probe's first item. Everything lands in probes/ (ignored by git).
//
//   npx tsx probes/lib/fur-elise-sound-gen.mts
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { clipSamples, makeClip, mixdown, writeSound } from "../../compiler/sound";

const root = join(import.meta.dirname, "..", ".."), out = join(root, "probes");
const S = process.env.SAMPLES_DIR ?? join(homedir(), "github", "samples");
const SAL = join(S, "salamander-grand-v3", "extracted", "SalamanderGrandPianoV3_44.1khz16bit"), V = join(S, "vsco2-ce");
const make = (...args: string[]) => execFileSync("npx", ["tsx", join(root, "scripts", "make-samples.mts"), ...args], { stdio: "inherit" });
const VSCO = "VSCO 2 Community Edition by Versilian Studios (CC0)";

make(join(SAL, "SalamanderGrandPianoV3.sfz"), join(out, "salamander-grand.samples"), "--keys", "28-101", "--seconds", "10", "--name", "Salamander Grand Piano V3", "--credit", "Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0)");
const vsco = (folder: string, file: string, name: string, ...more: string[]) => make("--names", join(V, folder), join(out, `${file}.samples`), "--name", name, "--credit", VSCO, ...more);
vsco("Strings/Violin Section/susVib", "vsco-violins", "Violins (VSCO 2 CE)", "--octave", "1", "--seconds", "6", "--release", "0.35");
vsco("Strings/Violin Section/Spic", "vsco-violins-spic", "Violins spiccato (VSCO 2 CE)", "--octave", "1", "--release", "0.15");
vsco("Strings/Viola Section/susvib", "vsco-violas", "Violas (VSCO 2 CE)", "--octave", "1", "--seconds", "6", "--release", "0.35");
vsco("Strings/Viola Section/spic", "vsco-violas-spic", "Violas spiccato (VSCO 2 CE)", "--octave", "1", "--release", "0.15");
vsco("Strings/Cello Section/susvib", "vsco-celli", "Celli (VSCO 2 CE)", "--octave", "1", "--seconds", "6", "--release", "0.35");
vsco("Strings/Cello Section/spic", "vsco-celli-spic", "Celli spiccato (VSCO 2 CE)", "--octave", "1", "--release", "0.15");
vsco("Strings/Solo Contrabass/SusVib", "vsco-bass", "Contrabass (VSCO 2 CE)", "--octave", "1", "--seconds", "6", "--release", "0.35");
vsco("Strings/Solo Contrabass/Spic", "vsco-bass-spic", "Contrabass spiccato (VSCO 2 CE)", "--octave", "1", "--release", "0.15");
vsco("Brass/Tenor Trombone/sus", "vsco-trombone", "Tenor trombone (VSCO 2 CE)", "--octave", "1", "--seconds", "6", "--release", "0.25");
vsco("Brass/Tuba/sus", "vsco-tuba", "Tuba (VSCO 2 CE)", "--octave", "1", "--seconds", "6", "--release", "0.25");
vsco("Brass/F Horn/sus", "vsco-horns", "French horn (VSCO 2 CE)", "--octave", "1", "--seconds", "6", "--release", "0.3");
// The timpani's names carry no note: each drum's pitch is its principal tone, read from its spectrum (the (2,1) mode a
// fifth above it beside it in every drum).
vsco("Percussion/Timpani", "vsco-timpani", "Timpani (VSCO 2 CE)", "--pitch", "Timpani1=41.45,Timpani2=46.75,Timpani3=49.5,Timpani4=52.45,Timpani5=54.6", "--seconds", "6", "--release", "2");
vsco("Percussion/Timpani/Rolls", "vsco-timpani-rolls", "Timpani rolls (VSCO 2 CE)", "--pitch", "Timpani1=42,Timpani2=47,Timpani3=49.5,Timpani4=52.5,Timpani5=55", "--seconds", "12", "--release", "1");

// The cinematic arrangement's percussion: a kit, a key a drum (probes/lib/vsco-percussion.kit.json).
make("--kit", join(import.meta.dirname, "vsco-percussion.kit.json"), join(out, "vsco-percussion.samples"), "--name", "Percussion (VSCO 2 CE)", "--credit", VSCO, "--seconds", "12");

// Middle C, one strength (the 10th of 16), as Import Video… would have made it: one channel, 22 050 Hz, the first 8 s.
const wav = readFileSync(join(SAL, "44.1khz16bit", "C4v10.wav"));
const data = wav.indexOf("data"), n = Math.min(wav.readUInt32LE(data + 4) / 4, 8 * 44100);
const mono = new Float32Array(n);
for (let i = 0; i < n; i++) mono[i] = (wav.readInt16LE(data + 8 + 4 * i) + wav.readInt16LE(data + 10 + 4 * i)) / 65536;
for (let i = 0; i < 22050; i++) mono[n - 1 - i] *= i / 22050;
const at22 = clipSamples(mixdown([{ clip: makeClip(mono, 44100), at: 0 }], undefined, 22050));
writeFileSync(join(out, "salamander-c4.sound"), writeSound({ rate: 22050, samples: at22, source: "C4v10.wav (Salamander Grand Piano V3)" }));
console.log("probes/salamander-c4.sound");
