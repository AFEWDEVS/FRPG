import { launch, newGame } from './lib.mjs';
const t = await launch();
const sc = [
  ['w1', 0, 3, 'normal'], ['w1', 0, 3, 'champion'], ['w1', 0, 5, 'thorn_queen'],
  ['d1', 2, 8, 'ogre_poet'], ['w2', 0, 14, 'jealous_gargoyle'], ['d2', 3, 20, 'malvarron'],
];
try {
  await newGame(t, 'Tester', 0);
  for (const [area, floor, lvl, who] of sc) {
    await t.dbg(([a, f, l]) => { const g = window.__dbg.GameState; g.profile.level = l; g.emitProgress?.(); window.__dbg.scene.scene.restart({ areaId: a, floor: f, seed: 777, entry: 'start' }); }, [area, floor, lvl]);
    await t.sleep(4500);
    const info = await t.dbg((who) => {
      const s = window.__dbg.scene; const pick = (e) => !e.dead && (who === 'normal' ? !e.def.boss && !e.champion : who === 'champion' ? e.champion && !e.def.boss : e.def.id === who);
      const e = s.enemies.find(pick); if (!e) return null;
      window.__bal = { hits: 0, stag: 0, id: e.id, t0: performance.now(), done: null, minPoise: e.maxPoise, rageAt: null };
      const E = window.__dbg.EventBus;
      E.on('enemy:damaged', (d) => { if (d.id === e.id && d.amount > 0) window.__bal.hits++; });
      E.on('enemy:staggered', (d) => { if (d.id === e.id) window.__bal.stag++; });
      E.on('enemy:died', (d) => { if (d.id === e.id) window.__bal.done = performance.now(); });
      s.player.warp(e.gx - 2.5, e.gy - 2.5);
      return { def: e.def.id, lvl: e.level, hp: e.maxHp, poise: e.maxPoise, plvl: window.__dbg.GameState.profile.level, mhp: window.__dbg.GameState.maxLife };
    }, who);
    if (!info) { console.log(area, who, 'NOT FOUND'); continue; }
    const t0 = Date.now();
    while (Date.now() - t0 < 200000) {
      const r = await t.dbg(() => { const s = window.__dbg.scene, b = window.__bal; window.__dbg.heal(); const e = s.enemies.find((x) => x.id === b.id); if (!e || e.dead) return 'dead'; if (e.hp / e.maxHp <= 0.25 && !b.rageAt) b.rageAt = performance.now() - b.t0; if (!e.staggered && s.player.distanceTo(e) > 6) s.player.warp(e.gx - 2, e.gy - 2); s.combat.attackTarget(e); return 'go'; });
      if (r === 'dead') break;
      await t.sleep(150);
    }
    const b = await t.dbg(() => window.__bal);
    console.log(area, who, JSON.stringify(info), 'hits', b.hits, 'stagger', b.stag, 'secs', b.done ? ((b.done - b.t0) / 1000).toFixed(1) : 'timeout', 'rage@', b.rageAt && (b.rageAt / 1000).toFixed(1));
    if (who !== 'normal' && who !== 'champion') await t.shot('bal_' + who);
  }
} catch (e) { console.log('FAIL', e.stack); }
console.log([...new Set(t.errors)].slice(0, 8).join('\n'));
await t.browser.close();
