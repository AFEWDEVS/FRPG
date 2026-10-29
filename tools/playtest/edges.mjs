import { launch, newGame } from './lib.mjs';
const t = await launch();
await newGame(t);
for (const [area, pts] of [['town', [[2, 2], [30, 30]]], ['w1', [[3, 3], [68, 68], [3, 68]]], ['d1', [[null]]], ['w2', [[3, 3], [68, 40]]]]) {
  await t.dbg((a) => window.__dbg.go(a), area);
  await t.sleep(2500);
  await t.dbg(() => { const s = window.__dbg.scene; s.setZoomTarget(0.55); });
  for (const [x, y] of pts) {
    if (x != null) await t.dbg(([x, y]) => window.__dbg.teleport(x, y), [x, y]);
    await t.sleep(1500);
    await t.shot(`edge_${area}_${x}_${y}`);
  }
}
console.log(t.errors.slice(0, 10));
await t.browser.close();
