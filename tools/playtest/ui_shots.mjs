import { launch, newGame } from './lib.mjs';
for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const t = await launch({ w, h });
  try {
    await newGame(t, 'Tester', 1);
    await t.dbg(() => { const g = window.__dbg.GameState; g.profile.level = 5; g.profile.skillPoints = 3; g.profile.statPoints = 2; g.addGold(240); g.emitProgress(); });
    await t.sleep(800); await t.shot(`ui_${w}_town`);
    await t.dbg(() => { const g = window.__dbg.GameState; g.life = g.maxLife * 0.22; g.mana = g.maxMana * 0.5; g.emitVitals(); });
    await t.sleep(900); await t.shot(`ui_${w}_lowhp`);
    await t.dbg(() => { window.__dbg.heal(); });
    await t.page.keyboard.press('i'); await t.sleep(600); await t.shot(`ui_${w}_inv`);
    await t.page.keyboard.press('Escape'); await t.sleep(300);
    await t.page.keyboard.press('t'); await t.page.keyboard.press('c'); await t.sleep(600); await t.shot(`ui_${w}_skills`);
    await t.page.keyboard.press('Escape'); await t.sleep(300);
    await t.page.keyboard.press('q'); await t.sleep(500); await t.shot(`ui_${w}_quests`);
    await t.page.keyboard.press('Escape'); await t.sleep(300);
    await t.dbg(() => window.__dbg.scene.scene.restart({ areaId: 'w1', floor: 0, seed: 777, entry: 'start' }));
    await t.sleep(3500); await t.shot(`ui_${w}_w1`);
    await t.dbg(() => { window.__dbg.scene.scene.restart({ areaId: 'd1', floor: 2, seed: 12345, entry: 'start' }); });
    await t.sleep(3500);
    await t.dbg(() => { const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.boss); if (e) s.player.warp(e.gx - 4, e.gy - 4); });
    await t.sleep(3500); await t.shot(`ui_${w}_boss`);
  } catch (e) { console.log('FAIL', e.stack); await t.shot(`ui_${w}_fail`); }
  console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
  await t.browser.close();
}
