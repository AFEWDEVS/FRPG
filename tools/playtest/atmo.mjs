import { launch, newGame } from './lib.mjs';
const t = await launch();
await newGame(t, 'Tester', 0);
const only = process.argv[2];
const areas = ['town', 'w1', 'd1', 'w2', 'd2'];
for (const a of areas) {
  if (only && only !== a) continue;
  if (a !== 'town') { await t.dbg((a) => window.__dbg.go(a), a); }
  await t.sleep(a === 'town' ? 500 : 4500);
  await t.dbg(() => { window.__dbg.heal(); });
  await t.sleep(3200);
  await t.shot('atmo_' + a);
  console.log(a, 'fps', (await t.fps(3000)).toFixed(1), JSON.stringify(await t.dbg(() => { const s = window.__dbg.scene; return { zoom: s.cameras.main.zoom, kids: s.children.list.length }; })));
}
console.log(t.errors.slice(0, 8).join('\n'));
await t.browser.close();
