// Listeners in more than one program (issue #78): each `on.*` at the top of a script is a program of its own, and the
// map's events pass is laid out in the first of them. Before the fix only that program's handler ever ran: the others'
// loops read the frame's count as 0. All three lines should be said at the same frame, about two seconds in.
//   npx tsx scripts/game-check.mts probes/events-programs.ts --frames=200
import { program, print, createUnit, sleep, seconds, frames, on, units, P1, type Location } from "trigscript";

const HOME = 1 as Location;

on.created(units.TerranSCV, () => { print("scv made"); });
on.created(units.ProtossProbe, () => { print("probe made"); });
on.created(units.ZergDrone, () => { print("drone made"); });

program(async () => {
  await sleep(seconds(2));
  createUnit(P1, units.TerranSCV, 1, HOME);
  createUnit(P1, units.ProtossProbe, 1, HOME);
  createUnit(P1, units.ZergDrone, 1, HOME);
  while (true) await sleep(frames(1));
});
