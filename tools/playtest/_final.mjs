import { launch, newGame } from './lib.mjs';
const t = await launch();
await newGame(t, 'Tester', 0);
await t.sleep(1500); await t.shot('f_town');
await t.dbg(() => window.__dbg.go('w1')); await t.sleep(5000);
await t.dbg(() => { const s = window.__dbg.scene; const p = s.player; for (const e of s.enemies) if (!e.dead && !e.def.boss) { e.warp?.(p.gx + 2 + Math.random() * 3, p.gy + 2 + Math.random() * 3); } });
const arr = [];
for (let i = 0; i < 12; i++) {
  await t.dbg(() => { const s = window.__dbg.scene; window.__dbg.heal(); const e = s.enemies.filter((x) => !x.dead)[0]; if (e) s.combat.attackTarget(e); });
  await t.page.keyboard.press('1'); await t.sleep(400); arr.push(await t.dbg(() => window.__dbg.fps()));
  if (i === 5) await t.shot('f_w1_combat');
}
console.log('fps crowd', arr.map((x) => x.toFixed(0)).join(','), 'enemies', await t.dbg(() => window.__dbg.scene.enemies.filter((x) => !x.dead).length));
// boss summons: thorn queen (vine), malvarron (mirror_clone)
for (const [a, f, id] of [['w1', 0, 'thorn_queen'], ['d2', 3, 'malvarron']]) {
  await t.dbg(([a, f]) => { window.__dbg.GameState.profile.level = 12; window.__dbg.scene.scene.restart({ areaId: a, floor: f, seed: 777, entry: 'start' }); }, [a, f]);
  await t.sleep(4500);
  await t.dbg((id) => { const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.id === id); s.player.warp(e.gx - 3, e.gy - 3); }, id);
  await t.sleep(2500);
  for (let k = 0; k < 10; k++) { await t.page.keyboard.press('1'); await t.page.keyboard.press('Enter'); await t.page.mouse.click(640, 600); await t.sleep(400); }
  await t.shot('f_boss_' + id);
  for (let k = 0; k < 60; k++) { await t.dbg(() => { window.__dbg.heal(); const s = window.__dbg.scene; const e = s.enemies.find((x) => x.def.boss && !x.dead); if (e) { if (s.player.distanceTo(e) > 5) s.player.warp(e.gx - 2, e.gy - 2); s.combat.attackTarget(e); } }); await t.sleep(400); }
  console.log(id, JSON.stringify(await t.dbg(() => { const s = window.__dbg.scene; const b = s.enemies.find((x) => x.def.boss); return { boss: b && [b.hp, b.maxHp, b.poise], others: s.enemies.filter((x) => !x.def.boss && !x.dead).map((x) => x.def.id).slice(0, 8) }; })));
  await t.shot('f_boss2_' + id);
}
console.log([...new Set(t.errors)].slice(0, 6).join('\n'));
await t.browser.close();
