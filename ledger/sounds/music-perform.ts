// ledger: step 5, takes
// A performance (`music.perform`): notes at their own times — lengths, dynamics, the pedal, a tempo that slows — each
// struck when its time comes, rendered into one clip; `lufs` read and `loudness` set when the script is built.
import { music } from "trigscript/music";
const keys = music.synth({ wave: "triangle", volume: 0.3 });
const take = music.perform({ meter: "3/8", bpm: 120, pickup: "1/8", tempo: [[1, 120], [2, 96]] }, {
  right: { instrument: keys, notes: ["pp E5/16 D#5", "E5 D#5 E5 B4 D5 C5", "A4/4."] },
  left: { instrument: keys, notes: ["r/8", "r/4.", "ped A2/16 E3 A3 r/8. *"] },
});
const mix = music.render(take, { loudness: -18 });
const rung = mix.resonance({ pedal: take.pedal });
program(async () => {
  playWav(mix.lufs < -17 ? rung : mix, 0);
});
