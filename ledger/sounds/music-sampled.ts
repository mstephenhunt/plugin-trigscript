// ledger: step 5, takes
// A sampled instrument (`music.sampled`) from clips the script makes (`samples()`): each note from the zone nearest
// its key, struck at the strength "@" says; a song rendered.
import { music } from "trigscript/music";
const low = tone("C3", 1, { volume: 0.4 }).fade(0, 0.5), high = tone("C5", 1, { volume: 0.2 }).fade(0, 0.5);
const keys = music.sampled(samples([{ clip: low, key: "C3" }, { clip: high, key: "C5" }], { name: "Two tones" }));
const tune = music.song({ bpm: 120 }, music.track(keys, "C3 E3@0.5 G4 C5@1.2"));
program(async () => {
  playWav(music.render(tune), 0);
});
