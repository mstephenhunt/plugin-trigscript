/**
 * The language service (`language.ts`): what `scmjs lsp` serves to an editor. A script against a map's names, a module
 * of the standard library and a library's module, asked what the editor would ask.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { defaultLib } from "../bundle/lib.mjs";
import { scriptNames } from "../compiler/names";
import { DECLARATIONS_FILE, libraryFile, mapNameNote, ScriptLanguage, stdlibPath } from "../language";

const names = scriptNames({ locations: [{ index: 0, name: "Beacon Alpha" }, { index: 1, name: "Spawn" }], switchNames: ["Door Open"] });
const LIB = defaultLib();

const MAIN = `import { fog } from "trigscript/fog";
import { spawnWave } from "waves";
import { label } from "./texts";

/** How many waves there are. */
const WAVES = 3;

trigger(P1, [always()], [displayText(label(1))]);

program(() => {
  let wave = 1;
  while (wave <= WAVES) {
    spawnWave(P2, units.ZergZergling, wave, locations.Spawn);
    wave++;
    sleep(seconds(20));
  }
  fog.reveal(P1);
});
`;
const TEXTS = `/** The line a wave is announced with. */
export function label(n: number): string {
  return "Wave " + n;
}
`;
const WAVES_LIB = {
  "index.ts": `export { spawnWave } from "./spawn";\n`,
  "spawn.ts": `import { createUnit, type Location, type Player, type UnitType } from "trigscript";\n\n/** Make wave \`n\`. */\nexport function spawnWave(player: Player, unit: UnitType, n: number, at: Location) {\n  createUnit(player, unit, n * 2, at);\n}\n`,
};

function language() {
  const l = new ScriptLanguage(ts, { lib: LIB, names, libraries: { waves: WAVES_LIB }, places: [{ index: 1, name: "Spawn", x: 10, y: 12, w: 4, h: 3 }] });
  l.setFile("main.ts", MAIN);
  l.setFile("texts.ts", TEXTS);
  return l;
}
/** The 1-based position of the `n`th `needle` in a text, plus `skip` characters. */
const at = (text: string, needle: string, skip = 0) => {
  const i = text.indexOf(needle) + skip;
  const before = text.slice(0, i).split("\n");
  return { line: before.length, column: before[before.length - 1].length + 1 };
};

describe("the language service", () => {
  it("checks the script as a build does, the libraries and the standard library resolved", () => {
    const l = language();
    expect(l.text(stdlibPath("fog"))).toContain("export const reveal");
    const r = l.check();
    expect(r.diagnostics).toEqual([]);
    expect(r.programs.length).toBeGreaterThan(0);
  });

  it("says where the script is wrong, by file and line", () => {
    const l = language();
    l.setFile("texts.ts", TEXTS.replace(`"Wave " + n`, "n"));
    const d = l.check().diagnostics;
    expect(d.some((x) => x.file === "texts.ts" && x.line === 3 && x.source === "typescript")).toBe(true);
    l.setFile("texts.ts", TEXTS);
    expect(l.check().diagnostics.filter((x) => x.file === "texts.ts")).toEqual([]);
  });

  it("completes the map's locations after locations.", () => {
    const l = language();
    l.setFile("main.ts", MAIN.replace("locations.Spawn", "locations."));
    const items = l.completions("main.ts", at(MAIN, "locations.Spawn", "locations.".length), ".").map((c) => c.name);
    expect(items).toContain("BeaconAlpha");
    expect(items).toContain("Spawn");
    expect(items).toContain("Anywhere");
  });

  it("completes the program's own names, the library's and keywords", () => {
    const l = language();
    const items = l.completions("main.ts", at(MAIN, "  let wave")).map((c) => c.name);
    for (const name of ["WAVES", "label", "trigger", "program", "units", "switches", "const", "while"]) expect(items).toContain(name);
    const detail = l.completionDetail("main.ts", at(MAIN, "  let wave"), { name: "label" });
    expect(detail?.detail).toContain("label(n: number): string");
    expect(detail?.documentation).toContain("The line a wave is announced with.");
  });

  it("hovers a constant with its doc comment", () => {
    const h = language().hover("main.ts", at(MAIN, "WAVES = 3"))!;
    expect(h.signature).toBe("const WAVES: 3");
    expect(h.documentation).toBe("How many waves there are.");
  });

  it("hovers a location with the map's own name and box", () => {
    const h = language().hover("main.ts", at(MAIN, "locations.Spawn", "locations.".length))!;
    expect(h.signature).toContain("Spawn");
    expect(h.notes).toEqual(["**locations.Spawn** is location 2: 4 × 3 tiles at 10, 12."]);
  });

  it("hovers a program's variable with what it holds, after a check", () => {
    const l = language();
    expect(l.hover("main.ts", at(MAIN, "let wave", 4))!.notes).toEqual([]);
    const r = l.check();
    expect(r.diagnostics).toEqual([]);
    expect(l.hover("main.ts", at(MAIN, "wave++"))!.notes[0]).toMatch(/^\*\*wave\*\* is a variable of the program: a number/);
  });

  it("goes to a definition in another file, a library's module and the standard library", () => {
    const l = language();
    expect(l.definition("main.ts", at(MAIN, "label(1)"))).toEqual([{ file: "texts.ts", line: 2, column: 17, endLine: 2, endColumn: 22 }]);
    expect(l.definition("main.ts", at(MAIN, "spawnWave(P2"))[0].file).toBe(libraryFile("waves", "spawn.ts"));
    expect(l.definition("main.ts", at(MAIN, "trigscript/fog", 2))[0].file).toBe(stdlibPath("fog"));
    const trigger = l.definition("main.ts", at(MAIN, "trigger(P1"));
    expect(trigger[0].file).toBe(DECLARATIONS_FILE);
    expect(l.text(DECLARATIONS_FILE)).toContain("BeaconAlpha");
  });

  it("outlines a file", () => {
    const s = language().symbols("texts.ts");
    expect(s.map((x) => [x.name, x.kind, x.range.line, x.selection.column])).toEqual([["label", "function", 2, 17]]);
    expect(language().symbols("main.ts").map((x) => x.name)).toContain("WAVES");
  });

  it("follows the map's names when they change", () => {
    const l = language();
    l.setNames(scriptNames({ locations: [{ index: 1, name: "Gate" }] }));
    expect(l.check().diagnostics.some((d) => /Spawn/.test(d.message))).toBe(true);
  });

  it("says which of the map's things a name is", () => {
    expect(mapNameNote(names.switches, names.switches.entries[0], "DoorOpen")).toBe("**switches.DoorOpen** is switch 1, \"Switch 1\", \"Door Open\".");
    const marine = names.units.entries[0];
    expect(mapNameNote(names.units, marine, "Terran Marine")).toBe("**units[\"Terran Marine\"]** is unit type 0.");
  });
});
