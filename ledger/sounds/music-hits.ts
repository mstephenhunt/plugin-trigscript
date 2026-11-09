// ledger: step 5, takes
// One-shots as a part of a performance (`music.hits`): a clip a key, played whole and unpitched, beside a braam
// (`music.presets.braam`), rendered into one clip.
import { music } from "trigscript/music";
const fx = music.hits({ C2: music.impact({ seconds: 1 }), D2: music.riser(1) });
const take = music.perform({ meter: "3/8", bpm: 120 }, {
  fx: { instrument: fx, notes: "D2/8 r C2@110" },
  braam: { instrument: music.presets.braam(), notes: "r/8 r A1" },
});
program(async () => {
  playWav(music.render(take), 0);
});
