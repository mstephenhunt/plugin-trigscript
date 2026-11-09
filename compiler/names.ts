/**
 * The identifiers a script uses for the map's things. `scriptNames(sources)` builds the
 * tables — players, units, locations, switches, AI scripts, and the weapons, upgrades and
 * technologies `stats()` takes — each entry being a value and
 * the keys it goes by: an identifier derived from the display name (`TerranMarine`,
 * `BeaconAlpha`) first, the display name itself second (usable as `units["Terran Marine"]`),
 * then any custom name the map gives it. The declarations are generated from these tables
 * and the printer chooses the first key, so the two agree by construction; keys are unique
 * within a table (a duplicate name gets `_2`, `_3`).
 *
 * The map's part comes in as plain `NameSources` — force names, used locations, switch
 * names, custom unit names — which the plugin reads off the editor's API and the tests
 * hand in directly; nothing here touches a scenario.
 *
 * With a data set in use that names things otherwise than the game (a mod: Cosmonarchy's
 * worker is the Mason), the unit, weapon, upgrade and technology tables are the set's
 * names instead, made identifiers by `scmjs mod header`'s rule (`dataSetNames.ts`:
 * `Terran_Mason`), and the unit table reaches every type the set has. Without one, the
 * tables are the game's own, exactly as they were.
 */
import { PlayerGroup, SWITCH_COUNT } from "../vendor/triggers";
import { AI_SCRIPT_CHOICES, aiScriptCode, PLAYER_GROUP_CHOICES, UNIT_CLASS_CHOICES } from "../vendor/triggerDefs";
import { UNIT_NAMES } from "../vendor/units";
import { TECH_NAMES, UPGRADE_NAMES, WEAPON_NAMES } from "../vendor/gameNames";
import { ORDER_NAMES } from "./orders";
import { dataSetEntries, identifierOf } from "./dataSetNames";

/** The location slot the game calls Anywhere (0-based); a script names it `locations.Anywhere`, value 64. */
export const ANYWHERE_INDEX = 63;

export interface NameEntry {
  value: number;
  /** All keys, the preferred identifier first. Unique within the table. */
  keys: string[];
}

export interface NameTable {
  /** The object the script reads the entries from (`units`). */
  object: string;
  /** The branded type of its values (`Unit`). */
  type: string;
  doc: string;
  entries: NameEntry[];
}

export interface ScriptNames {
  players: NameTable;
  units: NameTable;
  locations: NameTable;
  switches: NameTable;
  aiScripts: NameTable;
  /** weapons.dat, upgrades.dat and techdata.dat ids: what `stats()` and a unit type's weapon fields take. */
  weapons: NameTable;
  upgrades: NameTable;
  techs: NameTable;
  /** orders.dat ids: what a unit is doing (`u.orderId`) and what `on.order()` listens for. */
  orders: NameTable;
  /** The map's sounds, the Sound Editor's list: each the string of its path, what Play WAV takes. */
  sounds: NameTable;
  /**
   * How many unit type ids there are, what a program's unit filter may name below: the data set's count when it names
   * its own (`NameSources.dataSet`), else 65,536 (a unit's type, and a trigger's unit field, are 16 bits). 228–232 are
   * the game's None and the trigger's unit classes whatever the count.
   */
  unitTypes: number;
}

/** Every table, in the order the declarations list them. */
export const allTables = (n: ScriptNames): NameTable[] => [n.players, n.units, n.locations, n.switches, n.aiScripts, n.weapons, n.upgrades, n.techs, n.orders, n.sounds];

/** What a map contributes to the tables; every part is optional (the fixed lists stand without a map). */
export interface NameSources {
  /** The four force names, null or blank where a force has none. */
  forceNames?: (string | null)[];
  /** The map's used location slots (0-based) with their names; Anywhere is added when it is not listed. */
  locations?: { index: number; name: string }[];
  /** A name per switch slot, when the map names it (`Switch N` and blanks add nothing). */
  switchNames?: (string | null)[];
  /** A unit type's custom name, null or blank for the default. */
  unitCustomName?: (id: number) => string | null;
  /** The map's sounds: the string each one's path is (1-based, as a trigger names it) and the path. */
  sounds?: { stringIndex: number; path: string }[];
  /** The data set in use, when it names things otherwise than the game; the game's own names without it. */
  dataSet?: DataSetNames;
}

/**
 * A data set's names, by id: each list given replaces the game's for its table, and a table without one keeps the
 * game's. A name that is empty or a placeholder ("None", "Reserved", "Unused", "*") makes no entry; the id is still
 * written as a number.
 */
export interface DataSetNames {
  /** What the editor calls the set ("Cosmonarchy BW"), for the declarations. */
  name: string;
  /**
   * Every unit type the set has, by units.dat id: past 227 too, which a trigger names as any other (the field is 16
   * bits). 228–232 are not read from here: they are the game's None and the trigger's unit classes (Any unit, Men,
   * Buildings, Factories), whatever the set calls them.
   */
  units?: readonly string[];
  /** weapons.dat, upgrades.dat and techdata.dat names by id, over the ids `stats()` reaches (130, 61 and 44). */
  weapons?: readonly string[];
  upgrades?: readonly string[];
  techs?: readonly string[];
}

/** `Terran Siege Tank (Tank Mode)` → `TerranSiegeTankTankMode`; never empty, never starts with a digit. */
export function identifier(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let id = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  if (id === "") id = "_";
  if (/^\d/.test(id)) id = `_${id}`;
  return id;
}

/** Keys for a display name: its identifier, then the name itself when that differs. */
function keysFor(...names: (string | null | undefined)[]): string[] {
  return keysBy(identifier, ...names);
}

/** `keysFor` with an identifier rule of its own: a data set's names go by `identifierOf`. */
function keysBy(rule: (name: string) => string, ...names: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    if (!n) continue;
    // (A name with nothing of an identifier in it under `identifierOf`, one in another script, goes by itself alone.)
    const id = rule(n);
    for (const k of id ? [id, n] : [n]) if (!out.includes(k)) out.push(k);
  }
  return out;
}

/** Make every key unique across the table: a later duplicate is dropped, or suffixed when it is the entry's first key. */
function table(object: string, type: string, doc: string, entries: NameEntry[]): NameTable {
  const seen = new Set<string>();
  const out: NameEntry[] = [];
  for (const e of entries) {
    const keys: string[] = [];
    e.keys.forEach((k, i) => {
      if (!seen.has(k)) { seen.add(k); keys.push(k); return; }
      if (i !== 0) return;
      let n = 2;
      while (seen.has(`${k}_${n}`)) n++;
      seen.add(`${k}_${n}`);
      keys.push(`${k}_${n}`);
    });
    out.push({ value: e.value, keys });
  }
  return { object, type, doc, entries: out };
}

const PLAYER_KEYS: Record<number, string> = {
  [PlayerGroup.None]: "None", [PlayerGroup.CurrentPlayer]: "Current", [PlayerGroup.Foes]: "Foes", [PlayerGroup.Allies]: "Allies",
  [PlayerGroup.NeutralPlayers]: "Neutral", [PlayerGroup.AllPlayers]: "All", [PlayerGroup.NonAlliedVictoryPlayers]: "NonAlliedVictory",
};

export function playerEntries(forceNames: (string | null)[] = []): NameEntry[] {
  return PLAYER_GROUP_CHOICES.map((c) => {
    const keys = c.value < 12 ? [`P${c.value + 1}`, c.label] : keysFor(PLAYER_KEYS[c.value] ?? c.label, c.label);
    const force = c.value - PlayerGroup.Force1;
    if (force >= 0 && force < 4) keys.push(...keysFor(forceNames[force]).filter((k) => !keys.includes(k)));
    return { value: c.value, keys };
  });
}

export function unitEntries(customName: (id: number) => string | null = () => null): NameEntry[] {
  const out: NameEntry[] = UNIT_NAMES.map((name, id) => ({ value: id, keys: keysFor(name, customName(id) || null) }));
  for (const c of UNIT_CLASS_CHOICES) out.push({ value: c.value, keys: keysFor(c.label, ...(c.aliases ?? [])) });
  return out;
}

/**
 * The unit table from a data set's names: an entry for each type the set names, at its id — `Terran_Mason` and
 * `"Terran Mason"` — with the map's custom name after them, then the trigger's unit classes under the game's words
 * (`AnyUnit`, `Men`, …), which a type's identifier is suffixed past rather than taken from.
 */
export function dataSetUnitEntries(names: readonly string[], customName: (id: number) => string | null = () => null): NameEntry[] {
  const classes = UNIT_CLASS_CHOICES.map((c) => ({ value: c.value, keys: keysFor(c.label, ...(c.aliases ?? [])) }));
  const list = names.map((n, id) => (id >= UNIT_NAMES.length && id <= UNIT_NAMES.length + UNIT_CLASS_CHOICES.length ? "" : n));
  // (A type's name that is a class's word — a unit called "Men" — is left to the class.)
  const classKeys = new Set(classes.flatMap((c) => c.keys));
  const named = new Set<number>();
  const out: NameEntry[] = dataSetEntries(list, "Unit", classKeys).map((e) => {
    named.add(e.id);
    const keys = [e.identifier];
    for (const k of [e.name, ...keysBy(identifierOf, customName(e.id) || null)]) if (!keys.includes(k) && !classKeys.has(k)) keys.push(k);
    return { value: e.id, keys };
  });
  // A type the set leaves unnamed that the map names (the CHK's custom names reach the game's 228): by that name.
  for (let id = 0; id < Math.min(list.length, UNIT_NAMES.length); id++) {
    const custom = named.has(id) ? null : customName(id);
    const keys = custom ? keysBy(identifierOf, custom).filter((k) => !classKeys.has(k)) : [];
    if (keys.length) out.push({ value: id, keys });
  }
  out.sort((a, b) => a.value - b.value);
  return [...out, ...classes];
}

/** A weapon, upgrade or technology table from a data set's names (`extra`: entries of the script's own, `weapons.None`). */
function dataSetEntriesOf(names: readonly string[], kind: string, extra: NameEntry[] = []): NameEntry[] {
  return [...dataSetEntries(names, kind, extra.flatMap((e) => e.keys)).map((e) => ({ value: e.id, keys: e.identifier === e.name ? [e.name] : [e.identifier, e.name] })), ...extra];
}

export function aiScriptEntries(): NameEntry[] {
  return AI_SCRIPT_CHOICES.map((s) => ({ value: aiScriptCode(s.id), keys: keysFor(s.name, s.id) }));
}

/** The default name of a switch slot, as StarEdit shows it. */
export const defaultSwitchName = (index: number) => `Switch ${index + 1}`;

/** The tables for a map's names — or, with nothing given, the fixed lists alone (what tests use). */
export function scriptNames(src: NameSources = {}): ScriptNames {
  const withMap = !!(src.forceNames || src.locations || src.switchNames || src.unitCustomName || src.sounds);
  const locations: NameEntry[] = [{ value: 0, keys: ["NoLocation", "No Location"] }];
  const listed = (src.locations ?? []).slice().sort((a, b) => a.index - b.index);
  if (!listed.some((l) => l.index === ANYWHERE_INDEX)) listed.push({ index: ANYWHERE_INDEX, name: "Anywhere" });
  for (const { index, name } of listed) {
    locations.push({ value: index + 1, keys: index === ANYWHERE_INDEX ? ["Anywhere", ...keysFor(name).filter((k) => k !== "Anywhere")] : keysFor(name) });
  }
  const switches = Array.from({ length: SWITCH_COUNT }, (_, i) => {
    const keys = [`Switch${i + 1}`, `Switch ${i + 1}`];
    const name = src.switchNames?.[i];
    if (name && name.trim() && name.trim() !== defaultSwitchName(i)) for (const k of keysFor(name.trim())) if (!keys.includes(k)) keys.push(k);
    return { value: i, keys };
  });
  const set = src.dataSet;
  const weaponNone: NameEntry = { value: WEAPON_NAMES.length, keys: ["None"] };
  return {
    players: table("players", "Player", withMap ? "Players, player groups and the map's forces." : "Players and player groups.", playerEntries(src.forceNames ?? [])),
    units: set?.units
      ? table("units", "UnitType", `Unit types, by the names of the data set ${set.name}${src.unitCustomName ? " and by the map's custom names" : ""}.`, dataSetUnitEntries(set.units, src.unitCustomName ?? (() => null)))
      : table("units", "UnitType", withMap ? "Unit types, by StarEdit name and by the map's custom names." : "Unit types, by StarEdit name.", unitEntries(src.unitCustomName ?? (() => null))),
    locations: table("locations", "Location", "The map's locations.", locations),
    switches: table("switches", "Switch", withMap ? "The 256 switches, by number and by the map's names." : "The 256 switches.", switches),
    aiScripts: table("aiScripts", "AiScript", "AI scripts, by StarEdit name or four-character code.", aiScriptEntries()),
    weapons: set?.weapons
      ? table("weapons", "Weapon", `Weapons, by the names of the data set ${set.name}, for stats() and a unit type's groundWeapon / airWeapon.`, dataSetEntriesOf(set.weapons.slice(0, WEAPON_NAMES.length), "Weapon", [weaponNone]))
      : table("weapons", "Weapon", "Weapons, for stats() and a unit type's groundWeapon / airWeapon.", [...WEAPON_NAMES.map((name, id) => ({ value: id, keys: keysFor(name) })), weaponNone]),
    upgrades: set?.upgrades
      ? table("upgrades", "Upgrade", `Upgrades, by the names of the data set ${set.name}, for stats().`, dataSetEntriesOf(set.upgrades.slice(0, UPGRADE_NAMES.length), "Upgrade"))
      : table("upgrades", "Upgrade", "Upgrades, for stats().", UPGRADE_NAMES.map((name, id) => ({ value: id, keys: keysFor(name) }))),
    techs: set?.techs
      ? table("techs", "Tech", `Technologies, by the names of the data set ${set.name}, for stats().`, dataSetEntriesOf(set.techs.slice(0, TECH_NAMES.length), "Tech"))
      : table("techs", "Tech", "Technologies, for stats().", TECH_NAMES.map((name, id) => ({ value: id, keys: keysFor(name) }))),
    orders: table("orders", "Order", "Orders, what a unit is doing: u.orderId, and what on.order() listens for.", ORDER_NAMES.map((name, id) => ({ value: id, keys: [name] }))),
    // `staredit\wav\bad apple.ogg` is sounds.BadApple — the file's name without its folder or extension — or by its path.
    unitTypes: set?.units ? Math.max(set.units.length, UNIT_NAMES.length + UNIT_CLASS_CHOICES.length + 1) : 0x10000,
    sounds: table("sounds", "Sound", "The map's sounds (the Sound Editor's list), for playWav() and transmission().", (src.sounds ?? []).filter((w) => w.stringIndex > 0).map((w) => {
      const file = w.path.split(/[\\/]/).pop() ?? w.path;
      return { value: w.stringIndex, keys: [identifier(file.replace(/\.[^.]*$/, "")), w.path] };
    })),
  };
}

/** Tables over fixed lists only — what a script sees with no map open, and what tests use. */
export function defaultScriptNames(): ScriptNames {
  return scriptNames();
}

/** The entry for a value, if the table has one. */
export function entryFor(t: NameTable, value: number): NameEntry | undefined {
  return t.entries.find((e) => e.value === value);
}

/** The game's own data set, as the editor names it: the tables stand with the game's names. */
export const GAME_DATA_SET = "starcraft";

/** A list as the editor's `api.names` gives it: an entry's place is its value. */
type NamedList = readonly { value: number; label: string }[];

/**
 * What of a data set's names the tables take (`NameSources.dataSet`), from the editor's lists (`api.names.units()` and
 * the rest): a list where it is not the game's own — another name for an id, or more ids — and nothing for a list
 * that is, so a set that changes only pictures or numbers leaves the script's names as they are. Undefined when no
 * list differs. The editor names a type it has no name for `Unit #<id>`: that makes no entry.
 */
export function dataSetNamesOf(name: string, lists: { units: NamedList; weapons: NamedList; upgrades: NamedList; techs: NamedList }): DataSetNames | undefined {
  const byId = (list: NamedList, none: (value: number) => string): string[] => {
    const out: string[] = [];
    for (const e of list) if (Number.isInteger(e.value) && e.value >= 0) out[e.value] = e.label === none(e.value) ? "" : e.label;
    return Array.from(out, (n) => n ?? "");
  };
  const differs = (mine: readonly string[], game: readonly string[], width: number) => mine.length > width || game.some((n, id) => (mine[id] ?? "") !== n);
  const units = byId(lists.units, (id) => `Unit #${id}`);
  const classes = UNIT_NAMES.length + UNIT_CLASS_CHOICES.length;
  const weapons = byId(lists.weapons, (id) => `Weapon #${id}`), upgrades = byId(lists.upgrades, (id) => `Upgrade #${id}`), techs = byId(lists.techs, (id) => `Technology #${id}`);
  const out: DataSetNames = { name };
  if (differs(units, UNIT_NAMES, classes + 1)) out.units = units;
  if (differs(weapons, WEAPON_NAMES, WEAPON_NAMES.length)) out.weapons = weapons;
  if (differs(upgrades, UPGRADE_NAMES, UPGRADE_NAMES.length)) out.upgrades = upgrades;
  if (differs(techs, TECH_NAMES, TECH_NAMES.length)) out.techs = techs;
  return out.units || out.weapons || out.upgrades || out.techs ? out : undefined;
}
