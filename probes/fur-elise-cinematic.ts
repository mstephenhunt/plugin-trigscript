// Für Elise, the cinematic arrangement (S7, 2026-11-09): plays the whole piece; keys 1 … 7 play a section's clip on
// its own. The render is probes/lib/fur-elise-cinematic.ts; the timeline for a picture, probes/lib/
// fur-elise-cinematic-timeline.ts (probes/lib/fur-elise-timeline-gen.mts --cinematic).
//
//   npx tsx scripts/sound-dump.mts probes/fur-elise-cinematic.ts <folder>
import { whole, sectionClips } from "./lib/fur-elise-cinematic";

program(async () => {
  displayText("\x04Für Elise, cinematic: the whole piece. Keys 1-7 play a section on its own.");
  playWav(whole, 0);
  while (true) {
    if (keyPressed(P1, "1")) playWav(sectionClips[0], 0);
    if (keyPressed(P1, "2")) playWav(sectionClips[1], 0);
    if (keyPressed(P1, "3")) playWav(sectionClips[2], 0);
    if (keyPressed(P1, "4")) playWav(sectionClips[3], 0);
    if (keyPressed(P1, "5")) playWav(sectionClips[4], 0);
    if (keyPressed(P1, "6")) playWav(sectionClips[5], 0);
    if (keyPressed(P1, "7")) playWav(sectionClips[6], 0);
    await nextFrame();
  }
});
