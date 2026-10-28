import { launch, newGame, clickGrid } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Tester', 0);
  await t.dbg(() => window.__dbg.scene.player.warp(9.5, 11.5));
  await t.sleep(800);
  await clickGrid(t, 8.5, 9.5, {}, -50);
  await t.sleep(2500);
  for (let i = 0; i < 10; i++) {
    await t.page.keyboard.press('Enter'); await t.sleep(400);
    console.log(i, await t.dbg(() => { const d = window.__dbg.scene.scene.get('UI').dialogue; return d.visible + ' ' + d.full.slice(0,40) + ' ch=' + d.choices.length; }));
  }
  await t.shot('g1');
} catch (e) { console.log('FAIL', e.stack); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
