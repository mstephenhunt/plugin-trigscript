/**
 * The identifiers a data set's names become: the rule `scmjs mod header` writes a mod's ids by, so that a map's script
 * and a bot made for the same mod call a unit the same (`Terran_Mason`, where the game's own names give the script
 * `TerranMason`).
 *
 * Copied from scm-js `cli/src/mod/header.ts` (`RESERVED`, `identifierOf`, `unusedName`, `headerEntries`), which no
 * package exports: neither `@scm-js/core` nor the plugin API has it. Keep the two the same; a change there is a
 * change here.
 */

/** C++'s keywords, and the names Windows' and BWAPI's headers make macros of, which an identifier must not be. */
const RESERVED = new Set([
  "alignas", "alignof", "and", "and_eq", "asm", "auto", "bitand", "bitor", "bool", "break", "case", "catch", "char", "char8_t", "char16_t", "char32_t",
  "class", "compl", "concept", "const", "consteval", "constexpr", "constinit", "const_cast", "continue", "co_await", "co_return", "co_yield", "decltype",
  "default", "delete", "do", "double", "dynamic_cast", "else", "enum", "explicit", "export", "extern", "false", "float", "for", "friend", "goto", "if",
  "inline", "int", "long", "mutable", "namespace", "new", "noexcept", "not", "not_eq", "nullptr", "operator", "or", "or_eq", "private", "protected",
  "public", "register", "reinterpret_cast", "requires", "return", "short", "signed", "sizeof", "static", "static_assert", "static_cast", "struct",
  "switch", "template", "this", "thread_local", "throw", "true", "try", "typedef", "typeid", "typename", "union", "unsigned", "using", "virtual",
  "void", "volatile", "wchar_t", "while", "xor", "xor_eq",
  "NULL", "TRUE", "FALSE", "IN", "OUT", "OPTIONAL", "ERROR", "DELETE", "VOID", "CONST", "INFINITE", "PASCAL", "CALLBACK", "WINAPI", "APIENTRY",
  "BOOL", "BYTE", "WORD", "DWORD", "UINT", "INT", "CHAR", "LONG", "SHORT", "FLOAT", "HANDLE", "MAX_PATH", "min", "max", "small", "far", "near",
  "assert", "errno", "stdin", "stdout", "stderr", "EOF",
]);

/**
 * A name made an identifier: every run of characters other than letters, digits and `_` becomes one `_`, the ends
 * trimmed of `_`; a leading digit is prefixed with `_`, as is a keyword or a Windows macro's name. Empty when nothing
 * of the name is left (a name in another script): the caller gives such an entry `<Kind>_<id>`.
 */
export function identifierOf(name: string): string {
  let id = name.replace(/[^A-Za-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!id) return "";
  if (/^[0-9]/.test(id) || RESERVED.has(id)) id = `_${id}`;
  return id;
}

/**
 * Rows that name nothing: no name, or the game's own placeholders — "None", "Reserved", "Unused" (with or without a
 * subname in brackets), "*", and a data editor's "Extended Tech #54" for a row past the game's that nothing fills.
 */
export function unusedName(name: string): boolean {
  const n = name.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();
  return !n || n === "*" || n === "none" || n === "reserved" || n === "unused" || /^extended (unit|weapon|upgrade|tech|technology) #\d+$/.test(n);
}

export interface DataSetEntry { id: number; name: string; identifier: string }

/**
 * The named entries of one kind, with an identifier each, unique within the kind: the first entry of a name keeps the
 * identifier, a later one with the same is suffixed `_<id>`. `taken` are identifiers the kind already has otherwise
 * (the script's own: `AnyUnit`, `Men`), which an entry is suffixed past in the same way.
 */
export function dataSetEntries(names: readonly string[], kind: string, taken: Iterable<string> = []): DataSetEntry[] {
  const out: DataSetEntry[] = [];
  const seen = new Set(taken);
  names.forEach((raw, id) => {
    const name = (raw ?? "").trim();
    if (unusedName(name)) return;
    let identifier = identifierOf(name) || `${kind}_${id}`;
    if (seen.has(identifier)) identifier = `${identifier}_${id}`;
    while (seen.has(identifier)) identifier = `${identifier}_`;
    seen.add(identifier);
    out.push({ id, name, identifier });
  });
  return out;
}
