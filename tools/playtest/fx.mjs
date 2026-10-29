import { launch, newGame, SHOTS } from './lib.mjs';
const cls = Number(process.env.CLS ?? 0);
const only = (process.env.ONLY ?? '').split(',').filter(Boolean);
const t = await launch();
const shot2 = async (n) => { await t.page.screenshot({ path: SHOTS + '/' + n + '.png', timeout: 150000 }); console.log('shot', n); };
try {
  await newGame(t, 'Tester', cls);
  await t.dbg(() => { const g = window.__dbg.GameState; g.profile.level = 25; g.profile.skillPoints = 80; g.emitProgress(); });
  const ids = await t.dbg(async () => {
    const m = await import('/src/skills/index.ts'); const d = await import('/src/data/skills.ts');
    const g = window.__dbg.GameState;
    const ids = d.SKILLS.filter((s) => s.classId === g.profile.classId).map((s) => s.id);
    for (let r = 0; r < 3; r++) for (const id of ids) m.learnSkill(id);
    return ids;
  });
  console.log('skills', ids.join(','));
  await t.dbg(() => window.__dbg.go('w1'));
  await t.sleep(4000);
  const info = await t.dbg(() => { const s = window.__dbg.scene; const e = s.enemies.filter((x) => !x.dead).sort((a, b) => a.distanceTo(s.player) - b.distanceTo(s.player))[0]; s.player.warp(e.gx - 4, e.gy - 1); return { gx: e.gx, gy: e.gy }; });
  await t.sleep(1200);
  for (const id of ids) {
    if (only.length && !only.includes(id)) continue;
    await t.dbg(() => { window.__dbg.heal(); const s = window.__dbg.scene; for (const e of s.enemies) { e.hp = e.maxHp; } });
    await t.dbg((id) => { const s = window.__dbg.scene; const e = s.enemies.filter((x) => !x.dead).sort((a, b) => a.distanceTo(s.player) - b.distanceTo(s.player))[0]; s.player.warp(e.gx - 3.5, e.gy - 1); window.__id = id; }, id); await t.sleep(1500); await t.dbg(() => { const s = window.__dbg.scene; const e = s.enemies.filter((x) => !x.dead).sort((a, b) => a.distanceTo(s.player) - b.distanceTo(s.player))[0]; s.combat.cooldowns.clear(); s.combat.castUntil = 0; s.combat.cast(window.__id, e.gx, e.gy, e); });
    const delays = (process.env.AT ?? '250,600').split(',').map(Number);
    let prev = 0;
    for (const d of delays) { await t.sleep(d - prev); prev = d; await shot2(`fx_${cls}_${id}_${d}`); }
    await t.sleep(1800);
  }
  await t.dbg(() => window.__dbg.giveXp(100000)); await t.sleep(700); await shot2('fx_levelup_700'); await t.sleep(600); await shot2('fx_levelup_1300');
  console.log('fps', await t.fps(2000));
} catch (e) { console.log('FAIL', e.stack); await shot2('fail'); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
