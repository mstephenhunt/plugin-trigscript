// TrigScript Showcase #3, Für Elise: the soundtrack. The whole piece, every repeat the score has (probes/lib/
// fur-elise-score.ts, ours from the public-domain score), played as the sound probe's item 3 was played and extended in
// its spirit, in the arc the user chose (2026-11-08): the A section and the F major episode on the solo piano in a
// smaller room, the theme again into the storm, the storm with the orchestra in the hall, and the closing theme on the
// piano in the hall, ending on the held A.
//
// Rendered when the script is built, a section at a time (`music.excerpt`), each in its room with its tail, and added
// up into one clip for the whole piece — the showcase's sound: one long clip keeps time with the game (the visualizer
// probe, 2026-11-09: a steady ~95 ms, no drift over 35 s). Each section's clip, tail and all, is the fallback.
// The timeline for the picture is probes/lib/fur-elise-timeline.ts (probes/lib/fur-elise-timeline-gen.mts).
//
// Piano: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0). Orchestra: VSCO 2 Community Edition by Versilian
// Studios (CC0). Instruments made by probes/lib/fur-elise-sound-gen.mts. The sound itself is worked out in
// probes/lib/fur-elise-soundtrack.ts, which a showcase imports without this program.
//
//   npx tsx scripts/sound-dump.mts probes/fur-elise.ts <folder>
import { take, sections, whole, A, B, again, storm, closing } from "./lib/fur-elise-soundtrack";
export { take, sections, whole, A, B, again, storm, closing };

program(async () => {
  displayText("\x04Für Elise: the whole piece. Keys 1-5 play a section on its own.");
  playWav(whole, 0);
  while (true) {
    if (keyPressed(P1, "1")) playWav(A, 0);
    if (keyPressed(P1, "2")) playWav(B, 0);
    if (keyPressed(P1, "3")) playWav(again, 0);
    if (keyPressed(P1, "4")) playWav(storm, 0);
    if (keyPressed(P1, "5")) playWav(closing, 0);
    await nextFrame();
  }
});
