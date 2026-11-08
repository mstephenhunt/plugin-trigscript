// ledger: step 10, takes
// A unit drawn in another player's colour, its owner kept: `u.drawAs(c)` (the main-screen spike), the colour a value.
program(() => {
  let c = 2;
  first({ owner: P1 })?.drawAs(c + 1);
});
