// Which soundtrack the Für Elise showcase plays and draws (probes/fur-elise-showcase.ts): the one switch. "remix" (the
// trance remix, probes/lib/fur-elise-remix.ts, the default), "cinematic" (the cinematic arrangement,
// probes/lib/fur-elise-cinematic.ts) or "straight" (the piece as written, probes/lib/fur-elise-soundtrack.ts). Built
// under Node, FUR_ELISE=cinematic or FUR_ELISE=straight picks another without an edit:
//
//   FUR_ELISE=straight MAP_NAME="Für Elise" NO_BASES=1 npx tsx scripts/build-fixture.mts probes/fur-elise-showcase.ts …
//
// (In the editor there is no environment: the constant below decides.)
import * as remix from "./fur-elise-remix-timeline";
import * as cinematic from "./fur-elise-cinematic-timeline";
import * as straight from "./fur-elise-timeline";

export type Soundtrack = "remix" | "cinematic" | "straight";
/** The soundtrack when nothing says otherwise. */
const DEFAULT: Soundtrack = "remix";
const asked = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.FUR_ELISE;
export const SOUNDTRACK: Soundtrack = asked === "remix" || asked === "cinematic" || asked === "straight" ? asked : DEFAULT;

/** The chosen soundtrack's timeline: the same shape each way (probes/lib/fur-elise-timeline-gen.mts makes them). */
export const TIMELINE = SOUNDTRACK === "straight" ? straight : SOUNDTRACK === "cinematic" ? cinematic : remix;

/**
 * What a timeline does not say and the picture needs, by soundtrack:
 * - `storm`: the section that gets the red chords and the white keys flashing red (the user's choice for the storm).
 *   The remix's storm is its second drop (probes/lib/fur-elise-remix-score.ts: "drop 2, the storm, the biggest").
 * - `big`: the sections where the rest of the band falls on the minimap in violet; the others show the piano alone.
 * - `stage`: roles drawn on the main screen besides the piano's two hands, in the big sections only (the remix's stabs,
 *   which carry its storm's chords).
 */
export const LOOK: { readonly storm: string; readonly big: readonly string[]; readonly stage: readonly string[] } =
  SOUNDTRACK === "remix"
    ? { storm: "drop 2", big: remix.SECTIONS.filter((s) => s.kind === "drop" || s.kind === "build").map((s) => s.name), stage: ["synth"] }
    : SOUNDTRACK === "cinematic" ? { storm: "storm", big: ["storm", "final"], stage: [] } : { storm: "storm", big: ["storm"], stage: [] };
