/**
 * A script's language for any editor: errors, completions, hovers, go to definition and the outline of a file, as
 * plain data with 1-based lines and columns. It holds the script's files and keeps a TypeScript language service over
 * them, laid out the way the compiler lays them out (`compileScript`): the generated declarations for the map's names,
 * the standard library's modules where "trigscript/fog" finds them, other plugins' libraries where "waves/spawn" finds
 * them, and the same compiler options (`scriptCompilerOptions`), so what a hover says and what a build refuses agree.
 * Its errors are the compiler's own (`check`), TypeScript's and the program compiler's together.
 *
 * Nothing here touches a file system, a DOM or a protocol: `scmjs lsp` puts the Language Server Protocol round it, and
 * an editor of the plugin's own could put its widgets round it. TypeScript comes in as `ts`, as the compiler takes it.
 * The words are English, as the compiler's are, apart from what is shared with the editor's own hovers
 * (`variableNote`), which takes a `Translate`.
 */
import type * as TS from "typescript";
import { compileScript, LIB_FILE, normalizePath, scriptCompilerOptions, usableLibraries, variableNote, type CompileResult, type ScriptFiles, type SourceRange } from "./compiler/compiler";
import { DECLARATIONS_FILE, generateDeclarations } from "./compiler/declarations";
import { libraryName } from "./compiler/hoist";
import { isMediaFile } from "./compiler/media";
import { allTables, defaultScriptNames, type NameEntry, type NameTable, type ScriptNames } from "./compiler/names";
import { STDLIB, STDLIB_DIR, stdlibPath } from "./compiler/stdlib";
import { LIBRARY_DIR, type ScriptLibraries } from "./compiler/libraries";
import { english, type Translate } from "./i18n";

export { DECLARATIONS_FILE, LIB_FILE, LIBRARY_DIR, STDLIB_DIR, stdlibPath };

/** A location's box, in tiles, for what a hover says of `locations.X`. */
export interface Place {
  /** The slot, 0-based (`locations.X` is slot + 1). */
  index: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LanguageOptions {
  /** The standard library's declarations, as `CompileOptions.lib` takes them. */
  lib: string;
  /** The map's names; the fixed lists alone when there is no map. */
  names?: ScriptNames;
  /** Other plugins' libraries the script may import, by id (the map's copies). */
  libraries?: ScriptLibraries;
  /** The map's locations, for hovers. */
  places?: readonly Place[];
}

/** 1-based; the column counts UTF-16 units, as TypeScript and the Language Server Protocol do. */
export interface Position {
  line: number;
  column: number;
}

/**
 * What kind of name a completion or a symbol is: TypeScript's own words (`ts.ScriptElementKind`) — "function",
 * "const", "let", "var", "property", "method", "class", "interface", "type", "module", "keyword", "alias", "parameter",
 * "enum", "enum member", "string", … — for the editor to draw an icon by.
 */
export type NameKind = string;

export interface CompletionItem {
  name: string;
  kind: NameKind;
  /** The order TypeScript ranks it in. */
  sortText: string;
  /** What to put in, when it is not the name (a quoted key, a bracketed one). */
  insertText?: string;
  /** What it replaces, when that is not the word at the cursor. */
  replace?: SourceRange;
  /** "deprecated", "optional", … as TypeScript gives them, comma-separated. */
  modifiers?: string;
  /** For `completionDetail`: the module an export is from, when TypeScript says. */
  source?: string;
}

export interface CompletionDetail {
  /** The signature: `function trigger(players: …, conditions: …, actions: …): void`. */
  detail: string;
  /** The doc comment, Markdown. */
  documentation: string;
}

export interface HoverInfo {
  range: SourceRange;
  /** TypeScript's line for the name: `(property) locations.Beacon: Location<3>`. */
  signature: string;
  /** The doc comment and its tags, Markdown. */
  documentation: string;
  /** What TrigScript adds: what a program's variable holds, or which of the map's things a name is. Markdown. */
  notes: string[];
}

export interface ScriptSymbol {
  name: string;
  kind: NameKind;
  /** The whole declaration. */
  range: SourceRange;
  /** Its name. */
  selection: SourceRange;
  children: ScriptSymbol[];
}

/** Where a module of another plugin's library sits: "waves/spawn" → `__libraries__/waves/spawn.ts`. */
export const libraryFile = (id: string, path: string): string => `${LIBRARY_DIR}/${id}/${normalizePath(path)}`;
/** Whether a path is one of the script's own files, not the declarations, the standard library or a library's module. */
export const isScriptFile = (path: string): boolean => {
  const p = normalizePath(path);
  return p !== DECLARATIONS_FILE && p !== LIB_FILE && !p.startsWith(`${STDLIB_DIR}/`) && !p.startsWith(`${LIBRARY_DIR}/`);
};

/** The word each table's entries go by in a hover. */
const TABLE_WORDS: Record<string, string> = {
  players: "player", units: "unit type", locations: "location", switches: "switch", aiScripts: "AI script",
  weapons: "weapon", upgrades: "upgrade", techs: "technology", orders: "order", sounds: "sound",
};

/**
 * Which of the map's things `object.key` is, for a hover: `**locations.Beacon** is location 3, "Beacon Alpha": 4 × 4
 * tiles at 10, 12.` The number is the one StarEdit shows (a location's, a switch's and a player's count from 1).
 */
export function mapNameNote(table: NameTable, entry: NameEntry, key: string, places: readonly Place[] = []): string {
  const word = TABLE_WORDS[table.object] ?? table.object;
  const shown = /^[A-Za-z_$][\w$]*$/.test(key) ? `${table.object}.${key}` : `${table.object}["${key}"]`;
  const names = entry.keys.slice(1).filter((k) => k !== key).map((k) => `"${k}"`);
  let what: string;
  switch (table.object) {
    case "players": what = entry.value < 12 ? `player ${entry.value + 1}` : `the player group ${names[0] ?? entry.keys[0]}`; break;
    case "switches": what = `switch ${entry.value + 1}`; break;
    case "locations": what = entry.value === 0 ? "no location" : `location ${entry.value}`; break;
    case "aiScripts": what = "an AI script"; break;
    case "sounds": what = `the sound in string ${entry.value}`; break;
    default: what = `${word} ${entry.value}`;
  }
  const also = table.object === "players" && entry.value >= 12 ? names.slice(1) : names;
  let line = `**${shown}** is ${what}${also.length ? `, ${also.join(", ")}` : ""}`;
  if (table.object === "locations") {
    const place = places.find((p) => p.index + 1 === entry.value);
    if (place) line += `: ${place.w} × ${place.h} tiles at ${place.x}, ${place.y}`;
  }
  return `${line}.`;
}

interface Held {
  text: string;
  version: number;
}

/**
 * The options with the folder `paths` are read from said outright. The files have no folder ("main.ts"), and TypeScript
 * takes the current directory (""), which is enough to resolve an import; but printing a type that names a library's
 * module (a hover of `typeof import("waves/spawn")`) asks for the folder again and fails on an empty one.
 */
const withBase = (options: TS.CompilerOptions): TS.CompilerOptions => ({ ...options, pathsBasePath: "." });

/** The line starts of a text, for offsets ↔ positions. */
function lineStarts(text: string): number[] {
  const out = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) out.push(i + 1);
  return out;
}

export class ScriptLanguage {
  private readonly ts: typeof TS;
  private readonly scripts = new Map<string, Held>();
  /** The declarations, the standard library and the libraries' modules: files the script reads but does not own. */
  private readonly others = new Map<string, Held>();
  private readonly starts = new Map<string, { version: number; starts: number[] }>();
  private names: ScriptNames;
  private libraries: ScriptLibraries = {};
  private places: readonly Place[];
  private options: TS.CompilerOptions;
  private project = 0;
  private versions = 0;
  private readonly service: TS.LanguageService;
  private last: CompileResult | null = null;
  private readonly lib: string;

  constructor(ts: typeof TS, options: LanguageOptions) {
    this.ts = ts;
    this.lib = options.lib;
    this.names = options.names ?? defaultScriptNames();
    this.places = options.places ?? [];
    this.options = withBase(scriptCompilerOptions(ts, {}));
    this.put(this.others, LIB_FILE, options.lib);
    this.put(this.others, DECLARATIONS_FILE, generateDeclarations(this.names));
    for (const name of Object.keys(STDLIB)) this.put(this.others, stdlibPath(name), STDLIB[name]);
    this.setLibraries(options.libraries ?? {});
    const held = (path: string) => this.scripts.get(path) ?? this.others.get(path);
    const host: TS.LanguageServiceHost = {
      getProjectVersion: () => String(this.project),
      getScriptFileNames: () => [...[...this.scripts.keys()].filter((p) => !isMediaFile(p)), DECLARATIONS_FILE],
      getScriptVersion: (path) => String(held(path)?.version ?? 0),
      getScriptSnapshot: (path) => {
        const h = held(path);
        return h ? ts.ScriptSnapshot.fromString(h.text) : undefined;
      },
      getScriptKind: (path) => (path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
      getCurrentDirectory: () => "",
      getCompilationSettings: () => this.options,
      getDefaultLibFileName: () => LIB_FILE,
      fileExists: (path) => held(path) !== undefined,
      readFile: (path) => held(path)?.text,
      directoryExists: (dir) => {
        const d = normalizePath(dir).replace(/\/$/, "");
        if (d === "" || d === ".") return true;
        for (const p of [...this.scripts.keys(), ...this.others.keys()]) if (p.startsWith(`${d}/`)) return true;
        return false;
      },
      getDirectories: () => [],
      useCaseSensitiveFileNames: () => true,
    };
    this.service = ts.createLanguageService(host, ts.createDocumentRegistry(true, ""));
  }

  private put(into: Map<string, Held>, path: string, text: string) {
    const was = into.get(path);
    if (was && was.text === text) return;
    into.set(path, { text, version: ++this.versions });
    this.project++;
  }

  /** A file of the script, new or changed (`main.ts`, `ai/waves.ts`; a `.video` or a `.notes` is kept for the compiler). */
  setFile(path: string, text: string): void {
    this.put(this.scripts, normalizePath(path), text);
  }

  deleteFile(path: string): void {
    if (this.scripts.delete(normalizePath(path))) this.project++;
  }

  /** The script's files as the compiler takes them. */
  files(): ScriptFiles {
    return Object.fromEntries([...this.scripts].map(([p, h]) => [p, h.text]));
  }

  /** The map's names changed (or a map was found): the declarations are made again. */
  setNames(names: ScriptNames, places: readonly Place[] = this.places): void {
    this.names = names;
    this.places = places;
    this.put(this.others, DECLARATIONS_FILE, generateDeclarations(names));
  }

  /** The libraries the script may import, by id: what was there before and is not now goes. */
  setLibraries(libraries: ScriptLibraries): void {
    this.libraries = usableLibraries(libraries);
    for (const path of [...this.others.keys()]) if (path.startsWith(`${LIBRARY_DIR}/`)) this.others.delete(path);
    for (const [id, modules] of Object.entries(this.libraries)) for (const [path, text] of Object.entries(modules)) this.put(this.others, libraryFile(id, path), text);
    this.options = withBase(scriptCompilerOptions(this.ts, this.libraries));
    this.project++;
  }

  /** Any file's text: the script's, the declarations (`trigscript.d.ts`), a module of the standard library or of a library. */
  text(path: string): string | undefined {
    const p = normalizePath(path);
    return (this.scripts.get(p) ?? this.others.get(p))?.text;
  }

  /**
   * The script compiled as a build would, its sounds named but not made: `diagnostics` are the errors to show, by file.
   * The result is kept for the hovers of a program's variables.
   */
  check(): CompileResult {
    this.last = compileScript(this.ts, this.files(), this.names, { lib: this.lib, libraries: this.libraries, sounds: false });
    return this.last;
  }

  /** The last `check`'s result, if there was one. */
  lastCheck(): CompileResult | null {
    return this.last;
  }

  private offset(path: string, at: Position): number {
    const starts = this.lineStartsOf(path);
    const line = Math.max(0, Math.min(at.line - 1, starts.length - 1));
    return starts[line] + Math.max(0, at.column - 1);
  }

  private lineStartsOf(path: string): number[] {
    const h = this.scripts.get(path) ?? this.others.get(path);
    if (!h) return [0];
    const cached = this.starts.get(path);
    if (cached && cached.version === h.version) return cached.starts;
    const starts = lineStarts(h.text);
    this.starts.set(path, { version: h.version, starts });
    return starts;
  }

  private position(path: string, offset: number): Position {
    const starts = this.lineStartsOf(path);
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - starts[lo] + 1 };
  }

  private range(path: string, start: number, length: number): SourceRange {
    const a = this.position(path, start), b = this.position(path, start + length);
    return { file: path, line: a.line, column: a.column, endLine: b.line, endColumn: b.column };
  }

  private known(path: string): string | null {
    const p = normalizePath(path);
    return this.scripts.has(p) || this.others.has(p) ? p : null;
  }

  /** What may go at a position: names in scope, the members after a `.` (the map's locations after `locations.`), keywords. */
  completions(path: string, at: Position, trigger?: string): CompletionItem[] {
    const p = this.known(path);
    if (!p) return [];
    const r = this.service.getCompletionsAtPosition(p, this.offset(p, at), {
      includeCompletionsWithInsertText: true,
      includeAutomaticOptionalChainCompletions: true,
      includeCompletionsForImportStatements: false,
      includeCompletionsForModuleExports: false,
      ...(trigger && [".", "\"", "'", "`", "/", "@", "<", "#", " "].includes(trigger) ? { triggerCharacter: trigger as TS.CompletionsTriggerCharacter } : {}),
    });
    if (!r) return [];
    return r.entries.map((e) => ({
      name: e.name, kind: e.kind, sortText: e.sortText,
      ...(e.insertText ? { insertText: e.insertText } : {}),
      ...(e.replacementSpan ? { replace: this.range(p, e.replacementSpan.start, e.replacementSpan.length) } : {}),
      ...(e.kindModifiers ? { modifiers: e.kindModifiers } : {}),
      ...(e.source ? { source: e.source } : {}),
    }));
  }

  /** A completion's signature and doc comment, asked for when the editor shows it. */
  completionDetail(path: string, at: Position, item: Pick<CompletionItem, "name" | "source">): CompletionDetail | null {
    const p = this.known(path);
    if (!p) return null;
    const d = this.service.getCompletionEntryDetails(p, this.offset(p, at), item.name, undefined, item.source, undefined, undefined);
    if (!d) return null;
    return { detail: this.ts.displayPartsToString(d.displayParts), documentation: this.docs(d.documentation, d.tags) };
  }

  private docs(documentation: TS.SymbolDisplayPart[] | undefined, tags: TS.JSDocTagInfo[] | undefined): string {
    const ts = this.ts;
    const parts = [ts.displayPartsToString(documentation ?? [])];
    for (const tag of tags ?? []) {
      const text = ts.displayPartsToString(tag.text ?? []);
      if (tag.name === "param") {
        const [name, ...rest] = text.split(" ");
        parts.push(`*@param* \`${name}\`${rest.length ? ` — ${rest.join(" ")}` : ""}`);
      } else parts.push(`*@${tag.name}*${text ? ` — ${text}` : ""}`);
    }
    return parts.filter(Boolean).join("\n\n");
  }

  /** What a name is: TypeScript's line and doc comment, and what TrigScript has to add to them. */
  hover(path: string, at: Position): HoverInfo | null {
    const p = this.known(path);
    if (!p) return null;
    const offset = this.offset(p, at);
    const info = this.service.getQuickInfoAtPosition(p, offset);
    if (!info) return null;
    const notes: string[] = [];
    const variable = this.variableAt(p, offset);
    if (variable) notes.push(variable);
    const name = this.mapNameAt(p, offset);
    if (name) notes.push(name);
    return {
      range: this.range(p, info.textSpan.start, info.textSpan.length),
      signature: this.ts.displayPartsToString(info.displayParts),
      documentation: this.docs(info.documentation, info.tags),
      notes,
    };
  }

  /** A program's variable the name at `offset` is, said as the editor's hover says it — from the last `check`. */
  private variableAt(path: string, offset: number, tr: Translate = english): string | null {
    const variables = this.last?.variables ?? [];
    if (!variables.length) return null;
    for (const d of this.service.getDefinitionAtPosition(path, offset) ?? []) {
      if (!this.known(d.fileName)) continue;
      const at = this.position(d.fileName, d.textSpan.start);
      const v = variables.find((x) => x.at && normalizePath(x.at.file) === d.fileName && x.at.line === at.line && x.at.column === at.column);
      if (v) return variableNote(v, tr);
    }
    return null;
  }

  /** Which of the map's things a `locations.X` / `units["Terran Marine"]` is, when the name at `offset` is one. */
  private mapNameAt(path: string, offset: number): string | null {
    const ts = this.ts;
    const program = this.service.getProgram();
    const sf = program?.getSourceFile(path);
    if (!program || !sf) return null;
    let node: TS.Node | undefined;
    const find = (n: TS.Node) => {
      if (offset < n.getStart(sf) || offset > n.getEnd()) return;
      node = n;
      ts.forEachChild(n, find);
    };
    ts.forEachChild(sf, find);
    if (!node) return null;
    const parent = node.parent;
    let object: TS.Expression | null = null, key: string | null = null;
    if (ts.isIdentifier(node) && parent && ts.isPropertyAccessExpression(parent) && parent.name === node) { object = parent.expression; key = node.text; }
    else if (ts.isStringLiteralLike(node) && parent && ts.isElementAccessExpression(parent) && parent.argumentExpression === node) { object = parent.expression; key = node.text; }
    if (!object || key === null) return null;
    const id = ts.isIdentifier(object) ? object : ts.isPropertyAccessExpression(object) && ts.isIdentifier(object.name) ? object.name : null;
    const lib = id ? libraryName(ts, program.getTypeChecker(), id) : null;
    const table = lib ? allTables(this.names).find((t) => t.object === lib) : undefined;
    const entry = table?.entries.find((e) => e.keys.includes(key!));
    return table && entry ? mapNameNote(table, entry, key, this.places) : null;
  }

  /**
   * Where a name is declared: in the script's files, in a module of the standard library or of a library (an import's
   * module name goes to the module), or in the declarations (`trigscript.d.ts`, `lib.d.ts`), whose text `text` gives.
   */
  definition(path: string, at: Position): SourceRange[] {
    const p = this.known(path);
    if (!p) return [];
    return (this.service.getDefinitionAtPosition(p, this.offset(p, at)) ?? [])
      .filter((d) => this.known(d.fileName))
      .map((d) => this.range(d.fileName, d.textSpan.start, d.textSpan.length));
  }

  /** The outline of a file: its functions, classes, constants and what they hold. */
  symbols(path: string): ScriptSymbol[] {
    const p = this.known(path);
    if (!p) return [];
    const walk = (item: TS.NavigationTree): ScriptSymbol[] => {
      const span = item.spans[0];
      if (!span) return [];
      const name = item.nameSpan ?? span;
      return [{ name: item.text, kind: item.kind, range: this.range(p, span.start, span.length), selection: this.range(p, name.start, name.length), children: (item.childItems ?? []).flatMap(walk) }];
    };
    // An import is a name of the file's too, to TypeScript; an outline is what the file declares.
    return (this.service.getNavigationTree(p).childItems ?? []).filter((item) => item.kind !== "alias").flatMap(walk);
  }

  dispose(): void {
    this.service.dispose();
  }
}
