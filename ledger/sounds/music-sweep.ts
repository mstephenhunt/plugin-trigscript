// ledger: step 5, takes
// A noise sweep into a drop (`music.sweep`), a lead on the trance preset, and the pad under it ducked by the lead
// (`Clip.duck`), the two rendered apart (`render`'s `parts`).
import { music } from "trigscript/music";
const take = music.perform({ meter: "4/4", bpm: 128 }, {
  lead: { instrument: music.presets.trance(), notes: "E5/8 D#5 E5 D#5 E5 B4 D5 C5" },
  pad: { instrument: music.presets.pad(), notes: "A3+C4+E4/1" },
});
const lead = music.render(take, { parts: ["lead"], limit: false });
const under = music.render(take, { parts: ["pad"], limit: false }).duck(lead, { depth: 5 });
const drop = music.sweep(2).then(mixdown([{ clip: lead, at: 0 }, { clip: under, at: 0 }]).limit());
program(async () => {
  playWav(drop, 0);
});
