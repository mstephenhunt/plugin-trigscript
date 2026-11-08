/**
 * Errors on a map of our own (TrigScript 4, step 11 of the way off eudplib). The front end has done most of it (B4):
 * before a `throw` it sets the error in flight — its class's code into `Program.errors.thrown`, its message into
 * `message` — `finally` is copied before every way out, and a program's body is a `try` whose `catch` is `uncaught`.
 * What is left is where the walk goes, which is the emitter's (`Emitter.handler`): a `throw` goes to the `catch` of the
 * nearest `try` around it, or out of the function it is in, and the call goes on from there.
 *
 * `ownErrors` rewrites what the emitter would need texts for, before the texts are lowered (`texts.ts`): the line each
 * error is thrown at kept in a variable of the program's, `uncaught` as the print the Python side makes of it, and —
 * when a function calls itself — the RangeError a stack that runs out throws, a function the emitter calls there. Last,
 * an error's message is made where it is read rather than where it is thrown (`lazyMessages`).
 */
import { ERROR_CODES, STACK_OVERFLOW_MESSAGE, type At, type Call, type FuncDecl, type NumExpr, type Program, type ProgramErrors, type Stmt, type TextExpr, type TextPart, type VarDecl } from "../ir";

/** The variable the line an error was thrown at is kept in: what an uncaught one is said with. */
export const errorLine = (errors: ProgramErrors): string => `${errors.thrown}@line`;
/** The function that sets the error in flight to the RangeError of a stack that ran out (`Emitter.keep`). */
export const OVERFLOW_FN = "@error.overflow";
/** The function that says an error nothing caught, where more than one place may: each a call of it. */
const UNCAUGHT_FN = "@error.uncaught";
/**
 * The functions a task's error goes through: the front end's `catch` around a task's body — the error noted in the
 * task's slot for an `await` of it, or said — which reads the task's number (`taskHandle`) and nothing of the task's
 * own, laid out once for every task whose `catch` is the same, a call each (a start of sixteen slots had sixteen).
 */
const TASK_FAILED_FN = "@error.task";

export function ownErrors(program: Program): Program {
  const errors = program.errors;
  if (!errors) return program;
  const line = errorLine(errors), at0 = program.at;
  const set = (target: string, value: number, at: At): Stmt => ({ kind: "assign", target, value: { kind: "const", value }, at, label: "" });
  // (`throw` and `uncaught` are statements only: wherever a list holds one, it is a list of statements.)
  const walk = (list: Stmt[]): Stmt[] => deep(list) as Stmt[];
  const deep = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.flatMap((y) => (y && typeof y === "object" && (y.kind === "throw" || y.kind === "uncaught") ? statement(y as Stmt) : [deep(y)]));
    if (!x || typeof x !== "object") return x;
    const o = (x as { kind?: string }).kind === "start" ? outline(x as Extract<Stmt, { kind: "start" }>) : (x as object);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = v && typeof v === "object" ? deep(v) : v;
    return out;
  };
  // (Said where it is when only one place says it; else once, in a function each place calls — a task's body has one
  // in every slot.)
  let sites = 0;
  const count = (x: unknown): void => {
    if (Array.isArray(x)) x.forEach(count);
    else if (x && typeof x === "object") {
      if ((x as { kind?: string }).kind === "uncaught") sites++;
      Object.values(x).forEach(count);
    }
  };
  count([program.body, program.functions ?? []]);
  // (A task's `catch` first: it says an uncaught error too.)
  const failed: { shape: string; f: FuncDecl }[] = [];
  const outline = (st: Extract<Stmt, { kind: "start" }>): Extract<Stmt, { kind: "start" }> => {
    const top = st.call.body.length === 1 ? st.call.body[0] : undefined;
    if (top?.kind !== "try" || !taskCatch(top.catch, st.task)) return st;
    const shape = canonical(top.catch);
    let f = failed.find((x) => x.shape === shape)?.f;
    if (!f) {
      const h: VarDecl = { id: `${TASK_FAILED_FN}${failed.length}.h`, name: "(task)", kind: "number", shared: false, at: st.at };
      const body = replaced(top.catch, (o) => (o.kind === "taskHandle" ? { kind: "var", id: h.id } : undefined)) as Stmt[];
      f = { id: `${TASK_FAILED_FN}${failed.length}`, name: "(a task's error)", params: [h], at: st.at, body };
      failed.push({ shape, f });
    }
    const call: Stmt = { kind: "call", call: { fn: f.id, name: f.name, params: [{ decl: f.params[0], init: { kind: "taskHandle", at: top.at }, label: "" }], body: [], at: top.at, label: "" }, at: top.at, label: "" };
    return { ...st, call: { ...st.call, body: [{ ...top, catch: [call] }] } };
  };
  const said = (at: At, label: string): Stmt[] => [
        { kind: "print", to: CURRENT_PLAYER, position: "chat", at, label, parts: [
          { kind: "text", text: "\x06TrigScript: uncaught " },
          { kind: "value", text: { kind: "textOf", array: errors.names, index: { kind: "var", id: errors.thrown }, at } },
          { kind: "text", text: ": " },
          { kind: "value", text: { kind: "textVar", id: errors.message } },
          { kind: "text", text: ", line " },
          { kind: "number", expr: { kind: "var", id: line } },
          { kind: "text", text: "." },
        ] },
        set(errors.thrown, 0, at),
      ];
  const statement = (s: Stmt): Stmt[] => {
    switch (s.kind) {
      // Where it was thrown: a caught error thrown again keeps where it came from.
      case "throw": return s.rethrow ? [s] : [set(line, s.at.line, s.at), s];
      // Said in red to the player the program runs as, as a fault of the game's is, and given up.
      case "uncaught": return sites > 1 ? [{ kind: "call", call: { fn: UNCAUGHT_FN, name: "(uncaught)", params: [], body: [], at: s.at, label: s.label }, at: s.at, label: s.label }] : said(s.at, s.label);
      default: return [s];
    }
  };
  const decl: VarDecl = { id: line, name: "(error line)", kind: "number", shared: true, at: at0 };
  const functions: FuncDecl[] = (program.functions ?? []).map((f) => ({ ...f, body: walk(f.body) }));
  if (sites > 1) functions.push({ id: UNCAUGHT_FN, name: "(uncaught)", params: [], at: at0, body: said(at0, "") });
  const body = walk(program.body);
  for (const { f } of failed) functions.push({ ...f, body: walk(f.body) });
  if (functions.some((f) => f.recursive)) {
    functions.push({ id: OVERFLOW_FN, name: "(stack overflow)", params: [], at: at0, body: [
      { kind: "assignText", target: errors.message, value: { kind: "text", text: STACK_OVERFLOW_MESSAGE }, at: at0, label: "" },
      set(errors.thrown, ERROR_CODES.RangeError, at0),
    ] });
  }
  const lazy = lazyMessages(errors, body, functions, at0);
  return {
    ...program,
    body: [{ kind: "declare", decl, init: { kind: "const", value: 0 }, at: at0, label: "" }, ...lazy.declares, ...lazy.body],
    ...(lazy.functions.length ? { functions: lazy.functions } : {}),
  };
}

/** The variable that says which `throw` the error in flight's message is still to be made for (0: it is made). */
export const messageSite = (errors: ProgramErrors): string => `${errors.thrown}@site`;
/** The variables that keep the numbers such a message is made from, the first number in the first. */
export const messageArg = (errors: ProgramErrors, i: number): string => `${errors.thrown}@arg${i}`;
/** The function that makes the message of the error in flight, where more than one place reads it. */
const MESSAGE_FN = "@error.message";

/** The fields of a statement (or of a call, a case, a function) that hold statements: a list, or a list of lists. */
const LISTS: ReadonlySet<string> = new Set(["body", "then", "else", "catch", "update", "before", "handler"]);
const LISTS_OF_LISTS: ReadonlySet<string> = new Set(["iterations", "branches"]);

/**
 * An error's message made where it is read, not where it is thrown. `throw new RangeError(\`too big: ${n}\`)` made its
 * text at the throw — each number's digits, most of what a throw cost — and even a message known when built was copied
 * into every place of the message that the program reads, though most catches read nothing of it. A throw whose
 * message is a text known when built, or texts known when built and numbers, now keeps which throw it is
 * (`messageSite`) and its numbers (`messageArg`), and the text is made where the message is read: before every
 * statement that reads the variable of the message — a `catch`'s copy of it (taken only when the catch reads
 * `e.message`, or `e` itself goes on), an uncaught error said, a `finally` putting the error aside, a task's error kept
 * for its `await`, `e.stack`. Any other write of the message says that nothing is waiting. Made there, the text is the
 * one the throw would have made: the numbers were taken when it was thrown.
 */
function lazyMessages(errors: ProgramErrors, body: Stmt[], functions: FuncDecl[], at0: At): { body: Stmt[]; functions: FuncDecl[]; declares: Stmt[] } {
  const unchanged = { body, functions, declares: [] };
  const message = errors.message, site = messageSite(errors);
  // The throws whose message can wait: a text known when built, or a template of such texts and numbers.
  const sites = new Map<object, { value: TextExpr; args: NumExpr[] }>();
  let unknown = false;
  const look = (x: unknown): void => {
    if (Array.isArray(x)) { x.forEach(look); return; }
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    if (o.kind === "assignText" && o.target === message) {
      const v = o.value as TextExpr;
      if (v.kind === "text") sites.set(o, { value: v, args: [] });
      else if (v.kind === "template" && !mentions(v, message) && v.parts.every((p) => p.kind === "text" || p.kind === "number" || (p.kind === "value" && p.text.kind === "text"))) {
        const args: NumExpr[] = [];
        const parts = v.parts.map((p): TextPart => {
          if (p.kind !== "number" || p.expr.kind === "const") return p;
          args.push(p.expr);
          return { ...p, expr: { kind: "var", id: messageArg(errors, args.length - 1) } };
        });
        sites.set(o, { value: { ...v, parts }, args });
      }
    }
    for (const [k, v] of Object.entries(o)) {
      // (Every mention of the message is a write of it, its declaration or a read of it as a text: anything else, and
      // nothing is changed.)
      if (v === message && !((k === "target" && o.kind === "assignText") || (k === "id" && (o.kind === "textVar" || ("name" in o && "kind" in o && !("value" in o)))))) unknown = true;
      if (v && typeof v === "object") look(v);
    }
  };
  look([body, functions]);
  if (!sites.size || unknown) return unchanged;
  const numbered = new Map<object, number>([...sites.keys()].map((o, k) => [o, k + 1]));

  const at = at0, label = "(error message)";
  const siteRef: NumExpr = { kind: "var", id: site };
  const set = (target: string, value: NumExpr, at: At): Stmt => ({ kind: "assign", target, value, at, label: "" });
  // The text made for the error in flight, then nothing waiting.
  const made = (): Stmt[] => {
    const all = [...sites.values()];
    let chain: Stmt[] = [];
    for (let k = all.length; k >= 1; k--) {
      const make: Stmt[] = [{ kind: "assignText", target: message, value: all[k - 1].value, at, label }];
      chain = k === all.length ? make : [{ kind: "if", cond: { kind: "compare", op: "==", left: siteRef, right: { kind: "const", value: k }, at, label }, then: make, else: chain, at, label }];
    }
    return [...chain, set(site, { kind: "const", value: 0 }, at)];
  };
  const reads: (Stmt & { kind: "block" })[] = [];
  let unsafe = false;
  // Whether a statement reads the message itself, not in a statement inside it.
  const readsHere = (x: unknown, key?: string): boolean => {
    if (key && (LISTS.has(key) || LISTS_OF_LISTS.has(key)) && Array.isArray(x)) return false;
    if (Array.isArray(x)) return x.some((y) => readsHere(y));
    if (!x || typeof x !== "object") return false;
    const o = x as Record<string, unknown>;
    if (o.kind === "textVar" && o.id === message) return true;
    return Object.entries(o).some(([k, v]) => v && typeof v === "object" && readsHere(v, k));
  };
  // Whether a statement may throw, or write the message, while it is worked out: a call in it, inlined or not. (Its
  // own statements are after: a call statement's arguments are worked out before its body.)
  const mayThrow = (x: unknown): boolean => {
    if (Array.isArray(x)) return x.some(mayThrow);
    if (!x || typeof x !== "object") return false;
    const o = x as Record<string, unknown>;
    if (o.kind === "throw" || (o.kind === "assignText" && o.target === message)) return true;
    if (o.call && typeof o.call === "object" && typeof (o.call as Call).fn === "string") return true;
    return Object.values(o).some(mayThrow);
  };
  const callsIn = (x: unknown, key?: string): boolean => {
    if (key && (LISTS.has(key) || LISTS_OF_LISTS.has(key)) && Array.isArray(x)) return false;
    if (Array.isArray(x)) return x.some((y) => callsIn(y));
    if (!x || typeof x !== "object") return false;
    const o = x as Record<string, unknown>;
    if (o.call && typeof o.call === "object" && (typeof (o.call as Call).fn === "string" || mayThrow((o.call as Call).body))) return true;
    return Object.entries(o).some(([k, v]) => v && typeof v === "object" && callsIn(v, k));
  };
  const throwsHere = (s: Stmt): boolean => (s.kind === "call" ? s.call.params.some((p) => callsIn(p.init)) : callsIn(s));
  const deep = (x: unknown, key?: string): unknown => {
    if (key && LISTS.has(key) && Array.isArray(x)) return list(x as Stmt[]);
    if (key && LISTS_OF_LISTS.has(key) && Array.isArray(x)) return (x as Stmt[][]).map(list);
    if (Array.isArray(x)) return x.map((y) => deep(y));
    if (!x || typeof x !== "object") return x;
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v && typeof v === "object" ? deep(v, k) : v]));
  };
  const list = (stmts: Stmt[]): Stmt[] => stmts.flatMap((s): Stmt[] => {
    const k = numbered.get(s);
    if (k !== undefined) {
      // Thrown: its numbers kept, and which throw it was.
      const { args } = sites.get(s)!;
      return [...args.map((e, i) => set(messageArg(errors, i), deep(e) as NumExpr, s.at)), set(site, { kind: "const", value: k }, s.at)];
    }
    const out: Stmt[] = [];
    if (readsHere(s)) {
      // (A loop's test, read again at every turn, or a unit loop's filter: no one place before it. Nor a statement that
      // may throw while it is worked out — a call inlined in it — before it reads the message: made first, it would be
      // the message before that throw. The front end's reads are copies, and neither.)
      if (s.kind === "while" || s.kind === "do" || s.kind === "for" || s.kind === "unitLoop" || s.kind === "watch" || throwsHere(s)) unsafe = true;
      const at = "at" in s && s.at ? s.at : at0;
      const read: Stmt & { kind: "block" } = { kind: "block", body: [], at };
      reads.push(read);
      out.push(read);
    }
    out.push(deep(s) as Stmt);
    if (s.kind === "assignText" && s.target === message) out.push(set(site, { kind: "const", value: 0 }, s.at));
    return out;
  });
  const newBody = list(body);
  const newFunctions = functions.map((f) => ({ ...f, body: list(f.body) }));
  if (unsafe) return unchanged;
  // Made where it is read: in place where one place reads it, else in a function each place calls. Either way only
  // when one is waiting.
  const waiting = (body: Stmt[], at: At): Stmt => ({ kind: "if", cond: { kind: "compare", op: "!=", left: siteRef, right: { kind: "const", value: 0 }, at, label }, then: body, at, label });
  if (reads.length === 1) reads[0].body = [waiting(made(), reads[0].at)];
  else {
    for (const r of reads) r.body = [waiting([{ kind: "call", call: { fn: MESSAGE_FN, name: "(error message)", params: [], body: [], at: r.at, label }, at: r.at, label }], r.at)];
    if (reads.length) newFunctions.push({ id: MESSAGE_FN, name: "(error message)", params: [], at: at0, body: made() });
  }
  // (Each kept in its one cell and read from it, as a routed variable is: written at every throw, read seldom — a write
  // into every place of it, where the message is made, would cost each throw more than the reads it saves.)
  const declare = (id: string, name: string): Stmt => ({ kind: "declare", decl: { id, name, kind: "number", shared: true, routed: true, at: at0 }, init: { kind: "const", value: 0 }, at: at0, label: "" });
  const most = Math.max(...[...sites.values()].map((x) => x.args.length));
  const declares = [declare(site, "(error message site)"), ...Array.from({ length: most }, (_, i) => declare(messageArg(errors, i), `(error message ${i + 1})`))];
  return { body: newBody, functions: newFunctions, declares };
}

/** Whether a piece of the IR names `id` anywhere. */
function mentions(x: unknown, id: string): boolean {
  if (x === id) return true;
  if (Array.isArray(x)) return x.some((y) => mentions(y, id));
  return !!x && typeof x === "object" && Object.values(x).some((v) => mentions(v, id));
}

/** Player 13 in a print: the current player. */
const CURRENT_PLAYER = 13;

/**
 * Whether a `catch` is the front end's around a task's body: it starts by taking the task's number, reads it nowhere
 * else, and reads no variable of the task's — what lets it be laid out once for every slot and every task.
 */
function taskCatch(list: Stmt[], task: number): boolean {
  const first = list[0];
  if (first?.kind !== "declare" || (first.init as { kind?: string }).kind !== "taskHandle") return false;
  let handles = 0, own = false;
  const look = (x: unknown): void => {
    if (Array.isArray(x)) { x.forEach(look); return; }
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    if (o.kind === "taskHandle") handles++;
    if (o.decl && typeof o.decl === "object" && (o.decl as VarDecl).task === task) own = true;
    if (o.kind === "start" || o.kind === "sleep" || o.kind === "parallel" || o.kind === "return" || o.kind === "break" || o.kind === "continue") own = true;
    Object.values(o).forEach(look);
  };
  look(list);
  // (What it reads of the task's would be declared in the task: a variable it reads and does not declare is the program's.)
  return handles === 1 && !own;
}

/** A piece of the IR as text, the variables it declares numbered in the order they come, `at` and labels left out. */
function canonical(x: unknown): string {
  const names = new Map<string, string>();
  const look = (y: unknown): void => {
    if (Array.isArray(y)) { y.forEach(look); return; }
    if (!y || typeof y !== "object") return;
    const o = y as Record<string, unknown>;
    if (o.decl && typeof o.decl === "object" && !names.has((o.decl as VarDecl).id)) names.set((o.decl as VarDecl).id, `#${names.size}`);
    Object.values(o).forEach(look);
  };
  look(x);
  return JSON.stringify(x, (k, v) => (k === "at" || k === "label" || k === "range" ? undefined : typeof v === "string" && names.has(v) ? names.get(v) : v));
}

/** A copy of a piece of the IR with each object `f` gives something for replaced by it. */
function replaced(x: unknown, f: (o: Record<string, unknown>) => unknown): unknown {
  if (Array.isArray(x)) return x.map((y) => replaced(y, f));
  if (!x || typeof x !== "object") return x;
  const o = x as Record<string, unknown>;
  const r = f(o);
  if (r !== undefined) return r;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, replaced(v, f)]));
}
