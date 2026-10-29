import { launch, newGame } from './lib.mjs';
const t = await launch();
t.page.on('framenavigated', (f) => console.log('NAV', f.url()));
try {
  await newGame(t, 'Tester', 2);
  await t.dbg(() => { const D = window.__dbg; D.EventBus.emit('boss:engaged', { bossId: 'ogre_poet', name: 'Ogro', hp: 1, maxHp: 1 }); });
  for (let i = 0; i < 6; i++) { await t.sleep(1500); console.log(i, await t.dbg(() => ['Game','UI','MainMenu'].map(k => k+':'+window.__dbg.game.scene.isActive(k)).join(' '))); await t.shot('bn'+i); await t.page.keyboard.press('Enter'); }
} catch (e) { console.log('FAIL', e.stack); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
