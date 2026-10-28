import { launch, newGame, clickGrid } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Tester', Number(process.env.CLS ?? 0));
  await t.dbg(() => window.__dbg.scene.player.warp(9.5, 11.5));
  await t.sleep(800);
  await clickGrid(t, 8.5, 9.5, {}, -50);
  await t.sleep(2500);
  await t.shot('f01_elder_click');
  for (let i = 0; i < 10; i++) { await t.page.keyboard.press('Enter'); await t.sleep(400); }
  await t.shot('f02_dlg_choices');
  await t.click(720, 525);
  await t.sleep(800);
  console.log('quests', await t.dbg(() => JSON.stringify(window.__dbg.GameState.flags.quests)));
  await t.page.keyboard.press('q'); await t.sleep(500); await t.shot('f03_quests'); await t.page.keyboard.press('q');
  // merchant
  await t.dbg(() => window.__dbg.scene.player.warp(14.5, 13.5));
  await t.dbg(() => window.__dbg.GameState.addGold(500));
  await t.sleep(800);
  await clickGrid(t, 14.5, 11.5, {}, -50);
  await t.sleep(2500); await t.shot('f04_merchant');
  await t.page.keyboard.press('Enter'); await t.sleep(300); await t.page.keyboard.press('Enter'); await t.sleep(300);
  await t.shot('f04b');
} catch (e) { console.log('FAIL', e.stack); await t.shot('fail'); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
