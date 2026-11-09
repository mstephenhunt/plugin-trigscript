import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ActionType, ConditionType, UnitClass } from "../vendor/triggers";
import { UNIT_NAMES } from "../vendor/units";
import { TECH_NAMES, UPGRADE_NAMES, WEAPON_NAMES } from "../vendor/gameNames";
import { generateDeclarations } from "../compiler/declarations";
import { compileScript } from "../compiler/compiler";
import { dataSetEntries, identifierOf, unusedName } from "../compiler/dataSetNames";
import { dataSetNamesOf, defaultScriptNames, entryFor, scriptNames, type DataSetNames } from "../compiler/names";
import { defaultLib } from "../bundle/lib.mjs";
import { buildOwnMap, isRefused } from "../compiler/backend/build";
import { scenario } from "./ownScenario";
import { OWN } from "./randomRun";

const LIB = defaultLib();

/** A mod in the manner of Cosmonarchy: the worker renamed, names the game gives other ids, more types than the game's. */
function modNames(): DataSetNames {
  const units = [...UNIT_NAMES] as string[];
  units[0] = "Terran Maverick";
  units[7] = "Terran Mason";
  units[15] = "Terran Shaman";
  // 228–232 are the game's None and the classes, whatever the set calls them.
  units[228] = "None"; units[229] = "Men"; units[230] = "Something"; units[231] = ""; units[232] = "";
  for (let id = 233; id < 700; id++) units[id] = "";
  units[332] = "Terran Civilian";
  units[385] = "Floor Hatch";
  units[386] = "Floor Hatch";
  units[600] = "Zerg Liiralisk";
  units[601] = "Men";
  units[602] = "Reserved";
  units[603] = "미네랄";
  return { name: "Test Mod", units, weapons: WEAPON_NAMES.map((n, id) => (id === 0 ? "Gauss Rifle (Maverick)" : n)) };
}

/** The editor's lists (`api.names.units()` …) for a set of names: an entry's place is its value, `Unit #<id>` where it has none. */
function editorLists(units: readonly string[]) {
  const label = (n: string, id: number) => n || `Unit #${id}`;
  const classes = ["Any unit", "Men", "Buildings", "Factories"];
  return {
    units: units.map((n, id) => ({ value: id, label: id === 228 ? "None" : id > 228 && id <= 232 ? classes[id - 229] : label(n, id) })),
    weapons: WEAPON_NAMES.map((label, value) => ({ value, label })),
    upgrades: UPGRADE_NAMES.map((label, value) => ({ value, label })),
    techs: TECH_NAMES.map((label, value) => ({ value, label })),
  };
}

describe("identifiers from a data set's names", () => {
  // The cases of scm-js `tests/cli-mod-header.test.ts`: the rule is `scmjs mod header`'s.
  it("makes a name an identifier as scmjs mod header does", () => {
    expect(identifierOf("Terran Mason")).toBe("Terran_Mason");
    expect(identifierOf("U-238 Shells")).toBe("U_238_Shells");
    expect(identifierOf("  Siege Tank (Tank Mode)  ")).toBe("Siege_Tank_Tank_Mode");
    expect(identifierOf("1st Battalion")).toBe("_1st_Battalion");
    expect(identifierOf("new")).toBe("_new");
    expect(identifierOf("ERROR")).toBe("_ERROR");
    expect(identifierOf("미네랄")).toBe("");
  });

  it("skips the game's placeholders", () => {
    for (const n of ["", "  ", "None", "none", "Reserved", "Unused", "Unused (Zerg)", "*"]) expect(unusedName(n), n).toBe(true);
    for (const n of ["Unused Terran Bldg", "Nonexistent", "Terran Mason"]) expect(unusedName(n), n).toBe(false);
  });

  it("keeps the first of a name and suffixes the rest with their ids; a name with no letters left is its kind and id", () => {
    expect(dataSetEntries(["Gauss Rifle", "Gauss Rifle", "", "None", "미네랄", "Gauss Rifle"], "Weapon")).toEqual([
      { id: 0, name: "Gauss Rifle", identifier: "Gauss_Rifle" },
      { id: 1, name: "Gauss Rifle", identifier: "Gauss_Rifle_1" },
      { id: 4, name: "미네랄", identifier: "Weapon_4" },
      { id: 5, name: "Gauss Rifle", identifier: "Gauss_Rifle_5" },
    ]);
  });
});

describe("the tables with a data set", () => {
  const n = scriptNames({ dataSet: modNames() });
  const value = (key: string) => n.units.entries.find((e) => e.keys.includes(key))?.value;

  it("names the units by the set, past the game's 228, and no longer by the game's names", () => {
    expect(entryFor(n.units, 7)!.keys).toEqual(["Terran_Mason", "Terran Mason"]);
    expect(entryFor(n.units, 0)!.keys).toEqual(["Terran_Maverick", "Terran Maverick"]);
    expect(value("Zerg_Liiralisk")).toBe(600);
    expect(value("Terran Civilian")).toBe(332);
    expect(value("Terran_Civilian")).toBe(332);
    // The game's identifiers are gone: units.TerranMarine would be another unit than its name says.
    expect(value("TerranMarine")).toBeUndefined();
    expect(value("TerranSCV")).toBeUndefined();
    // A name the game gives another id is the set's: 15 is the Shaman here.
    expect(entryFor(n.units, 15)!.keys[0]).toBe("Terran_Shaman");
    expect(entryFor(n.units, 1)!.keys).toEqual(["Terran_Ghost", "Terran Ghost"]);
  });

  it("keeps the trigger's classes at 228–232 and suffixes a type past them", () => {
    expect(entryFor(n.units, UnitClass.Any)!.keys).toEqual(["AnyUnit", "Any unit", "Any Unit"]);
    expect(entryFor(n.units, UnitClass.Men)!.keys).toEqual(["Men"]);
    expect(entryFor(n.units, 228)).toBeUndefined();
    expect(value("Something")).toBeUndefined();
    expect(entryFor(n.units, 601)!.keys[0]).toBe("Men_601");
  });

  it("suffixes a second name with its id, skips placeholders, and names one with no letters left by kind and id", () => {
    expect(entryFor(n.units, 385)!.keys).toEqual(["Floor_Hatch", "Floor Hatch"]);
    expect(entryFor(n.units, 386)!.keys).toEqual(["Floor_Hatch_386"]);
    expect(entryFor(n.units, 602)).toBeUndefined();
    expect(entryFor(n.units, 603)!.keys).toEqual(["Unit_603", "미네랄"]);
    const all = n.units.entries.flatMap((e) => e.keys);
    expect(new Set(all).size).toBe(all.length);
  });

  it("takes the map's custom names after the set's", () => {
    const custom = scriptNames({ dataSet: modNames(), unitCustomName: (id) => (id === 7 ? "Builder Bob" : null) });
    expect(entryFor(custom.units, 7)!.keys).toEqual(["Terran_Mason", "Terran Mason", "Builder_Bob", "Builder Bob"]);
  });

  it("names weapons by the set and keeps weapons.None; a table the set leaves keeps the game's", () => {
    expect(entryFor(n.weapons, 0)!.keys).toEqual(["Gauss_Rifle_Maverick", "Gauss Rifle (Maverick)"]);
    expect(entryFor(n.weapons, WEAPON_NAMES.length)!.keys).toEqual(["None"]);
    expect(n.upgrades).toEqual(defaultScriptNames().upgrades);
    expect(n.techs).toEqual(defaultScriptNames().techs);
  });

  it("declares the set's names for completion", () => {
    const d = generateDeclarations(n);
    expect(d).toContain("readonly Terran_Mason: UnitType<7>;");
    expect(d).toContain("readonly Zerg_Liiralisk: UnitType<600>;");
    expect(d).toContain("Unit types, by the names of the data set Test Mod.");
    expect(d).not.toContain("readonly TerranMarine:");
    expect(generateDeclarations(n, { compact: true })).toContain('units["Terran Maverick"]');
  });

  it("writes a trigger with the set's ids, past 232 too", () => {
    const r = compileScript(ts, { "main.ts": `trigger(P1, [bring(P1, units.Terran_Mason, locations.Anywhere, ">=", 1)], [createUnit(P1, units.Zerg_Liiralisk, 2, locations.Anywhere), killUnit(P2, units["Terran Civilian"])]);` }, n, { lib: LIB });
    expect(r.diagnostics).toEqual([]);
    const [t] = r.triggers;
    expect(t.conditions[0]).toMatchObject({ type: ConditionType.Bring, unitId: 7 });
    expect(t.actions[0]).toMatchObject({ type: ActionType.CreateUnit, unitId: 600 });
    expect(t.actions[1]).toMatchObject({ type: ActionType.KillUnit, unitId: 332 });
  });

  it("builds the standard library's modules that make units, which name them by the game's ids", () => {
    const main = `import { fog } from "trigscript/fog";\nimport { Screen } from "trigscript/screen";\nprogram(async () => { const s = new Screen(0, 0, 4, 4, "solid"); s.set(1, 1, 1); fog.light(P1, 10, 10, 3); await nextFrame(); });`;
    const mine = compileScript(ts, { "main.ts": main }, n, { lib: LIB });
    expect(mine.diagnostics.map((d) => `${d.file}: ${d.message}`)).toEqual([]);
    // The same programs as with the game's own names.
    expect(mine.ir).toEqual(compileScript(ts, { "main.ts": main }, defaultScriptNames(), { lib: LIB }).ir);
  });

  it("lets a program's filters and events name a type past the classes, up to the set's count", () => {
    expect(n.unitTypes).toBe(700);
    const main = `program(async () => {
      for (const u of allUnits({ type: 332 as UnitType })) u.hp = 1;
      for (const u of unitsOf(P1, { type: units.Zerg_Liiralisk })) u.kill();
      on.created(units.Zerg_Liiralisk, (u) => { u.energy = 50; });
      on.died({ type: units.Men }, () => {});
    });`;
    const r = compileScript(ts, { "main.ts": main }, n, { lib: LIB, own: OWN });
    expect(r.diagnostics.map((d) => d.message)).toEqual([]);
    expect(r.ownRefusal).toBeUndefined();
    const out = buildOwnMap({ chk: scenario(), compiled: r });
    expect(isRefused(out)).toBe(false);
    // Past the set's types: said, with the count.
    const past = compileScript(ts, { "main.ts": `program(async () => { on.created(700 as UnitType, (u) => { u.energy = 50; }); for (const u of allUnits({ type: 700 as UnitType })) u.hp = 1; });` }, n, { lib: LIB });
    expect(past.diagnostics.map((d) => d.message)).toEqual([
      "on.created(): there is no unit type 700: they go from 0 to 699.",
      "allUnits: there is no unit type 700: they go from 0 to 699.",
    ]);
  });

  it("lets a filter name any 16-bit type with the game's own names", () => {
    const r = compileScript(ts, { "main.ts": `program(async () => { for (const u of allUnits({ type: 332 as UnitType })) u.hp = 1; });` }, defaultScriptNames(), { lib: LIB, own: OWN });
    expect(r.diagnostics.map((d) => d.message)).toEqual([]);
    expect(r.ownRefusal).toBeUndefined();
    expect(defaultScriptNames().unitTypes).toBe(0x10000);
  });
});

describe("which names the tables take from the editor's lists", () => {
  it("takes none for the game's own names", () => {
    expect(dataSetNamesOf("Pictures Only", editorLists(UNIT_NAMES.slice()))).toBeUndefined();
  });

  it("takes the units when a name differs or there are more types, and leaves the lists that match", () => {
    const set = modNames();
    const got = dataSetNamesOf("Test Mod", editorLists(set.units!))!;
    expect(got.name).toBe("Test Mod");
    expect(got.units![7]).toBe("Terran Mason");
    expect(got.units![600]).toBe("Zerg Liiralisk");
    // An id the editor names `Unit #<id>` is unnamed.
    expect(got.units![250]).toBe("");
    expect(got.weapons).toBeUndefined();
    const wider = UNIT_NAMES.concat(["None", "Any unit", "Men", "Buildings", "Factories", "Terran Tower"]);
    expect(dataSetNamesOf("Wider", editorLists(wider))!.units![233]).toBe("Terran Tower");
  });

  it("leaves the game's tables exactly as they were without a set", () => {
    expect(scriptNames({ dataSet: undefined })).toEqual(defaultScriptNames());
    expect(entryFor(defaultScriptNames().units, 7)!.keys).toEqual(["TerranSCV", "Terran SCV"]);
  });
});
