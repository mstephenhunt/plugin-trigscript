// Which soundtrack the Für Elise showcase plays and draws (probes/fur-elise-showcase.ts): the one switch. "cinematic"
// (the arrangement, probes/lib/fur-elise-cinematic.ts, the default) or "straight" (the piece as written,
// probes/lib/fur-elise-soundtrack.ts). Built under Node, FUR_ELISE=straight picks the other without an edit:
//
//   FUR_ELISE=straight MAP_NAME="Für Elise" NO_BASES=1 npx tsx scripts/build-fixture.mts probes/fur-elise-showcase.ts …
//
// (In the editor there is no environment: the constant below decides.)
import * as cinematic from "./fur-elise-cinematic-timeline";
import * as straight from "./fur-elise-timeline";

/** The soundtrack when nothing says otherwise. */
const DEFAULT: "cinematic" | "straight" = "cinematic";
const asked = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.FUR_ELISE;
export const SOUNDTRACK: "cinematic" | "straight" = asked === "straight" || asked === "cinematic" ? asked : DEFAULT;

/** The chosen soundtrack's timeline: the same shape either way (probes/lib/fur-elise-timeline-gen.mts makes both). */
export const TIMELINE = SOUNDTRACK === "straight" ? straight : cinematic;
