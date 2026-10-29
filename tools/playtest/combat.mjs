import { launch, newGame, clickGrid } from './lib.mjs';
const cls = Number(process.env.CLS ?? 0);
const t = await launch();
try {
  await newGame(t, 'Tester', cls);
  // level up and learn all skills
  await t.dbg(() => { const g = window.__dbg.GameState; g.profile.level = 20; g.profile.skillPoints = 40; g.profile.statPoints = 20; g.emitProgress(); g.emitVitals(); });
  await t.page.keyboard.press('t'); await t.sleep(600); await t.shot(`c${cls}_skillpanel`);
  await t.page.keyboard.press('Escape');
  const learned = await t.dbg(async () => {
    const m = await import('/src/skills/index.ts'); const d = await import('/src/data/skills.ts');
    const g = window.__dbg.GameState; const ids = d.SKILLS.filter((s) => s.classId === g.profile.classId).sort((a,b)=>a.reqLevel-b.reqLevel).map((s) => s.id);
    for (let r = 0; r < 3; r++) for (const id of ids) m.learnSkill(id);
    const keys = ids.slice(0, 6); const sl = g.profile.skillSlots; sl[0] = 'attack'; sl[1] = ids[0]; keys.forEach((k, i) => (sl[2 + i] = k));
    window.__dbg.EventBus.emit('skills:changed');
    return ids;
  });
  console.log('skills', learned.join(','));
  await t.dbg(() => window.__dbg.go('w1'));
  await t.sleep(4000);
  await t.shot(`c${cls}_w1`);
  console.log('fps w1', await t.fps(3000));
  // find nearest enemy, warp near, fight
  const info = await t.dbg(() => { const s = window.__dbg.scene; const e = s.enemies.filter((x) => !x.dead).sort((a, b) => a.distanceTo(s.player) - b.distanceTo(s.player))[0]; s.player.warp(e.gx - 3, e.gy - 3); return { n: s.enemies.length, id: e.id, def: e.def.id, gx: e.gx, gy: e.gy }; });
  console.log(info);
  await t.sleep(1000);
  for (let k = 0; k < 8; k++) {
    await t.dbg(() => window.__dbg.heal());
    const tg = await t.dbg(() => { const s = window.__dbg.scene; const e = s.enemies.filter((x) => !x.dead).sort((a, b) => a.distanceTo(s.player) - b.distanceTo(s.player))[0]; return e ? { gx: e.gx, gy: e.gy } : null; });
    if (!tg) break;
    await clickGrid(t, tg.gx, tg.gy, {}, -30);
    await t.page.mouse.move(640, 300);
    await t.page.keyboard.press(String((k % 6) + 1));
    await t.sleep(350);
    if (k === 1 || k === 3 || k === 5) await t.shot(`c${cls}_fx${k}`);
    await t.sleep(700);
  }
  await t.sleep(1500);
  await t.shot(`c${cls}_after`);
  console.log(await t.dbg(() => { const g = window.__dbg.GameState; return JSON.stringify({ xp: g.profile.xp, gold: g.profile.gold, inv: g.profile.inventory.length, lvl: g.profile.level, alive: window.__dbg.scene.enemies.filter(e=>!e.dead).length }); }));
} catch (e) { console.log('FAIL', e.stack); await t.shot('fail'); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
