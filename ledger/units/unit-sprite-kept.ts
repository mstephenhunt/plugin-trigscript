// ledger: step 10, takes
// A unit's sprite kept (`u.sprite`, read once) and its colour written through it: `u.drawAs(P3, sprite)`, the masked
// write alone (the main-screen pixels).
program(() => {
  const u = first({ owner: P1 });
  if (u) {
    const s = u.sprite;
    u.drawAs(P3, s);
  }
});
