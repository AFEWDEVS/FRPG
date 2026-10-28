import { launch, newGame } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Guardado', 1);
  await t.dbg(() => { window.__dbg.GameState.addGold(123); window.__dbg.GameState.gainXp(500); });
  await t.dbg(() => window.__dbg.go('w1')); await t.sleep(3500);
  // death
  await t.dbg(() => { const s = window.__dbg.scene; s.combat.hurtPlayer ? s.combat.hurtPlayer(99999, 'physical') : (window.__dbg.GameState.life = 0, window.__dbg.EventBus.emit('player:damaged', { amount: 99999, type: 'physical', life: 0 })); });
  await t.sleep(1500); await t.shot('s_death');
  await t.sleep(6000); await t.shot('s_respawn');
  console.log('after death', await t.dbg(() => JSON.stringify({ area: window.__dbg.scene.tr.areaId, life: window.__dbg.GameState.life, gold: window.__dbg.GameState.profile.gold, dead: window.__dbg.scene.player.dead })));
  await t.page.reload(); await t.waitScene('MainMenu'); await t.sleep(1500); await t.shot('s_menu_continue');
  await t.click(640, 435); await t.waitScene('Game'); await t.sleep(2000); await t.shot('s_loaded');
  console.log('loaded', await t.dbg(() => JSON.stringify({ n: window.__dbg.GameState.profile.name, lv: window.__dbg.GameState.profile.level, gold: window.__dbg.GameState.profile.gold })));
} catch (e) { console.log('FAIL', e.stack); await t.shot('fail'); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
