import { launch, newGame } from './lib.mjs';
const t = await launch();
await newGame(t, 'Tester', 0);
const tag = process.env.TAG || 'a';
const view = async (area, name) => {
  if (area !== 'town') { await t.dbg((a) => window.__dbg.go(a, 0), area); await t.sleep(4500); }
  await t.shot(`${tag}_${name}`);
  await t.dbg(() => window.__dbg.scene.setZoomTarget(0.55)); await t.sleep(1500);
  await t.shot(`${tag}_${name}_min`);
  await t.dbg(() => window.__dbg.scene.setZoomTarget(0.8)); await t.sleep(800);
};
await view('town', 'town');
await view('w1', 'w1');
await view('d1', 'd1');
await view('w2', 'w2');
console.log(t.errors.slice(0, 15).join('\n'));
await t.browser.close();
