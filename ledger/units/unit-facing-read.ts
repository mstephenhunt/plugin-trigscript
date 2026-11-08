// ledger: step 10, takes
// Which way a unit faces, 0 … 255 clockwise from north: `u.facing` (the flingy's current direction).
program(() => {
  const u = first({ owner: P1 });
  if (u && u.facing >= 64 && u.facing < 192) print(`facing ${u.facing}: east or south of it`);
});
