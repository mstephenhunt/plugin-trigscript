/**
 * A script that imports a sound (or samples, a video …) run again beside the game for its tests (compiler/gameTests.ts):
 * its modules get the media from the payload, as the compile's own run does; without them they cannot run. Found with
 * the Für Elise showcase, whose soundtrack imports the piano's .samples.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { compileScript } from "../compiler/compiler";
import { defaultScriptNames } from "../compiler/names";
import { defaultLib } from "../bundle/lib.mjs";
import { runGameTests } from "../compiler/gameTests";
import type { GameHandle } from "../compiler/gameSim";
import { writeSound } from "../compiler/sound";

const boom = writeSound({ rate: 22050, samples: Float32Array.from({ length: 2205 }, (_, i) => Math.sin(i / 10) * 0.5), source: "boom.wav" });
const files = {
  "main.ts": `import { test, expect } from "trigscript";\nimport boom from "./sfx/boom.sound";\nconst LONG = Math.round(boom.seconds * 10);\ntest("the sound's length, beside the game", () => { expect(LONG).toBe(1); });\n`,
  "sfx/boom.sound": boom,
};

/** A game nothing happens in: enough for a test that only looks at a value of the build. */
const game = () => ({
  m: new DataView(new ArrayBuffer(8)), u8: new Uint8Array(8), localPlayer: 0, over: false, frame: 0,
  step() {}, reset() {}, lines: () => [], action: () => 0, chat() {}, call: () => 0,
}) as unknown as GameHandle;

describe("the game's tests of a script with media", () => {
  const compiled = compileScript(ts, files, defaultScriptNames(), { lib: defaultLib() });

  it("compiles, its test registered", () => {
    expect(compiled.diagnostics.map((d) => d.message)).toEqual([]);
    expect(compiled.modules?.length).toBeGreaterThan(0);
  });

  it("runs its modules again with the media the payload gives", () => {
    const report = runGameTests(game(), { modules: compiled.modules!, names: defaultScriptNames(), locations: {}, media: [["sfx/boom.sound", boom]] });
    expect(report.error).toBeUndefined();
    expect(report.results.map((r) => r.status)).toEqual(["passed"]);
  });

  it("says what is missing without them", () => {
    const report = runGameTests(game(), { modules: compiled.modules!, names: defaultScriptNames(), locations: {} });
    expect(report.error).toMatch(/Cannot find "\.\/sfx\/boom\.sound"/);
  });
});
