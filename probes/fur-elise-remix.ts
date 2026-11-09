// Für Elise, the trance remix (S7, 2026-11-09): plays the whole piece; keys 1 … 9 play a section's clip on its own;
// M and R the melody and the rest apart (what scripts/lead-check.mts measures). The render is probes/lib/
// fur-elise-remix.ts; the timeline, probes/lib/fur-elise-remix-timeline.ts (probes/lib/fur-elise-timeline-gen.mts --remix).
//
//   npx tsx scripts/sound-dump.mts probes/fur-elise-remix.ts <folder>
import { whole, sectionClips, melodyStem, restStem } from "./lib/fur-elise-remix";

program(async () => {
  displayText("\x04Für Elise, the remix: the whole piece. Keys 1-9 play a section on its own.");
  playWav(whole, 0);
  while (true) {
    if (keyPressed(P1, "1")) playWav(sectionClips[0], 0);
    if (keyPressed(P1, "2")) playWav(sectionClips[1], 0);
    if (keyPressed(P1, "3")) playWav(sectionClips[2], 0);
    if (keyPressed(P1, "4")) playWav(sectionClips[3], 0);
    if (keyPressed(P1, "5")) playWav(sectionClips[4], 0);
    if (keyPressed(P1, "6")) playWav(sectionClips[5], 0);
    if (keyPressed(P1, "7")) playWav(sectionClips[6], 0);
    if (keyPressed(P1, "8")) playWav(sectionClips[7], 0);
    if (keyPressed(P1, "9")) playWav(sectionClips[8], 0);
    if (keyPressed(P1, "M")) playWav(melodyStem, 0);
    if (keyPressed(P1, "R")) playWav(restStem, 0);
    await nextFrame();
  }
});
