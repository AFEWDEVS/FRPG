import { launch, newGame } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Tester', 2);
  await t.dbg(() => { const g = window.__dbg.GameState; g.profile.level = 25; g.flags.w1BossBeaten = true; g.emitProgress(); });
  await t.dbg(() => window.__dbg.go('w2')); await t.sleep(3500); await t.shot('e_w2');
  await t.dbg(() => window.__dbg.scene.scene.restart({ areaId: 'd2', floor: 3, seed: 777, entry: 'start' })); await t.sleep(3500);
  const b = await t.dbg(() => { const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.id === 'malvarron'); if (!e) return null; s.player.warp(e.gx - 4, e.gy - 4); return e.def.id; });
  console.log('malv', b); await t.sleep(5000); await t.shot('e_malv');
  await t.dbg(() => { const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.id === 'malvarron'); e.hp = 3; });
  for (let k = 0; k < 14; k++) { await t.dbg(() => { window.__dbg.heal(); const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.id === 'malvarron' && !x.dead); if (e) { e.hp = Math.min(e.hp, 3); e.applyDamage(50); } }); await t.sleep(500); }
  await t.sleep(4000); await t.shot('e_after');
  for (let i = 0; i < 12; i++) { await t.sleep(2500); await t.page.keyboard.press('Space'); await t.click(640, 360); }
  await t.shot('e_end2');
  console.log(await t.dbg(() => window.__dbg.game.scene.scenes.filter((s) => s.sys.isActive()).map((s) => s.sys.settings.key).join(',')));
  await t.sleep(30000); await t.shot('e_credits');
  console.log(await t.dbg(() => window.__dbg.game.scene.scenes.filter((s) => s.sys.isActive()).map((s) => s.sys.settings.key).join(',')));
} catch (e) { console.log('FAIL', e.stack); await t.shot('fail'); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
