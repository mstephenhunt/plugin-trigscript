# How the compiler is built

Notes for working on TrigScript's compiler. The [README](../README.md#development) has the commands and the file list; [ir.md](ir.md) describes the IR.

`names.ts` turns the map into name tables (players, units, locations, switches, AI
scripts, and the fixed weapons, upgrades and technologies `stats()` takes). Each entry's
keys are an identifier derived from the display name first (`Terran Marine` →
`TerranMarine`), the display name itself second, then custom names, unique per table by
construction. `declarations.ts` generates the `.d.ts` from them plus
the library: values are branded literal types (`UnitType<0> = 0 & Brand<"unit">`; plain
numbers still pass, a `Location` where a `UnitType` belongs does not), enumerated kinds are
string unions of the canonical words, every condition and action is a `declare function`
whose identifier is its `ConditionType` / `ActionType` key in camel case, and the whole
thing is declared twice: as globals and as the ambient module `"trigscript"`.

`runtime.ts` is the same vocabulary as values: the tables as frozen objects and one
function per condition and action that validates its arguments and returns a record.
`trigger()` pushes a record onto a `Collector`; `program()` pushes the descriptor the
transformer made for it. Strings are not interned here: text and WAV fields hold local
ids into `CompileResult.strings`, and the build resolves them through the map's string
table.

`compiler.ts` builds a real `ts.createProgram` over the files, the declarations and the
standard library (in-memory host; `module: commonjs`, `moduleResolution: bundler`),
collects every reference to the map's tables while the checker is there (so a rename can
follow them even when they no longer type-check), and stops at the first type error. A
standard-library function whose JSDoc carries `@topLevelOnce` (`autoMining()` of
`trigscript/workers`) is held to one call by its name, a statement of its own at the top
of a file; any other reference to it, an alias included, is an error there
(`topLevelOnceErrors` in `hoist.ts`). It
then plans every `program()` body and every `game()` arrow (`hoist.ts`): the *game
bindings* are the body's `let` / `var`, the parameters and the functions declared in it;
a *hoisted expression* is a maximal subexpression that mentions none of those (and is not
`random()`, nor a call of a `game()` function, whose type carries a brand), and a
`const` of the body whose initialiser is hoistable is a build-time constant. The emit
transformer appends its position to every `trigger()` call and replaces each planned
arrow with a descriptor holding a function that returns the hoisted expressions as
thunks and the constants as memoised thunks, every reference to a constant rewritten to a
call of its thunk, so a constant is computed when first needed and never in a pruned
branch. The emitted CommonJS is linked by `link.ts` (relative imports against the files,
`"trigscript"` to the runtime, the library's names in scope as globals) and run; an
error the script throws is placed through the emitted source map. `game(descriptor)`
returns a function that throws if the script calls it and carries the descriptor for
the walker.

`structured.ts` then walks each program body against the same plan, with the thunks the
descriptor's function returned: where the plan says an expression was hoisted, the walker
takes its value: a number, a boolean, a condition, an action or a list of them. `let` →
a variable of the IR (a number, a boolean, a unit, a text), a record of them (an object
literal, an instance of a class) or an array, bound
in a scope keyed by declaration node so shadowing and inlining resolve as the checker
does; expressions become IR expressions as written; `&&` / `||` / `!` stay what they are,
and the lowering short-circuits them; functions declared in the body and `game()`
functions are `call` nodes, inlined where a function is first met, the walker switching
to the function's own plan, file and thunks for the duration, and from the second time on
a call of one body kept in `Program.functions`, when the function compiles with every
parameter a variable (the attempt's diagnostics are thrown away, and a first call already
inlined is changed to match; `settleFunctions` then inlines again whatever is left with one
call); a call, member access or arithmetic over
values a parameter was bound to is evaluated on the spot; a `for` whose bounds evaluate
is unrolled like a `for…of`; an action with a variable argument carries the expression
beside its record. The thunks are memoised in the bodies, so the script's build-time
parts run once.

TrigScript's own build is `compiler/backend/` (see the `compiler/` row above): a program's
body becomes one graph of triggers, laid out after the map's strings. Arithmetic is 32 bits
that wrap, and each comparison, division, shift right, `min`, `max` and printed number reads
them signed or unsigned as `numbers.ts` marked it. An array that grows is a block of one heap
the programs share (sizes double, and a block given back serves the next array of its size),
and a made text is such a block of bytes; an array's cells sit beside the heap's bytes as
cell triggers, 72 bytes each, so that a read or a write is a jump into the cell. A function
that is called is one body with its parameters as variables; one that calls itself keeps
what a call would overwrite on a stack of its own, a region beside the heap whose depth the
script's Settings give. A per-player program is laid out once for each of its owners, with
variables of its own but for the shared ones. A read is the condition itself where a table
of the game is the value (a player's deaths, kills, ore, gas; the player bytes and the supply
tables) and otherwise a search with the condition, "at least" a bit at a time from the top,
so it means what the condition means. A text with values in it is written over a string of
the map's table as long as its template, which is then shown. `docs/ir.md` says what each
node means to the backend. `simulateIr.ts` mirrors all of it, wrap included, so that what
Simulate shows is what the game does. (Until TrigScript 4's step 17 a second lowering,
`python/trigscript.py`, built through eudplib what the backend did not take yet; step 16's
random whole programs, run both ways, held the two to the same lines before it went.)
