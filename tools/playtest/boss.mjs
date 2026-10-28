import { launch, newGame, clickGrid } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Tester', 1);
  await t.dbg(() => { const g = window.__dbg.GameState; g.profile.level = 12; g.emitProgress(); });
  for (const [area, floor, boss] of [['d1', 0, 0], ['d1', 2, 1]]) {
    await t.dbg(([a, f]) => window.__dbg.scene.scene.restart({ areaId: a, floor: f, seed: 12345, entry: 'start' }), [area, floor]);
    await t.sleep(3500);
    await t.shot(`b_${area}_${floor}`);
    console.log(area, floor, 'fps', await t.fps(2000));
  }
  const b = await t.dbg(() => { const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.boss); if (!e) return null; s.player.warp(e.gx - 4, e.gy - 4); return { def: e.def.id, hp: e.hp, gx: e.gx, gy: e.gy }; });
  console.log('boss', b);
  await t.sleep(3000); await t.shot('b_boss_engage');
  for (let k = 0; k < 14; k++) {
    await t.dbg(() => { window.__dbg.heal(); const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.boss && !x.dead); if (e && k0()) {} function k0() { return false; } });
    await t.dbg(() => { const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.boss && !x.dead); if (e) s.combat.attackTarget(e); });
    await t.page.keyboard.press(String(1 + (k % 6)));
    await t.sleep(600);
    if (k === 3) await t.shot('b_boss_fight');
  }
  await t.dbg(() => { const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.boss && !x.dead); if (e) { e.hp = 5; } });
  await t.sleep(300);
  await t.shot('b_boss_low');
  for (let k = 0; k < 12; k++) { await t.dbg(() => { window.__dbg.heal(); const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.boss && !x.dead); if (e) s.combat.attackTarget(e); }); await t.page.keyboard.press('1'); await t.sleep(500); }
  await t.sleep(2500); await t.shot('b_boss_dead');
  console.log(await t.dbg(() => JSON.stringify({ q: window.__dbg.GameState.flags, alive: window.__dbg.scene.enemies.filter((x) => x.def.boss && !x.dead).length })));
} catch (e) { console.log('FAIL', e.stack); await t.shot('fail'); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
