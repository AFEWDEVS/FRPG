import { launch, newGame } from './lib.mjs';
const t = await launch();
const log = (...a) => console.log(...a);
try {
  await newGame(t, 'Tester', Number(process.env.CLS ?? 0));
  await t.dbg(() => window.__dbg.go('w1')); await t.sleep(4000);
  await t.dbg(() => {
    const D = window.__dbg; window.__ev = [];
    for (const k of ['player:stamina', 'enemy:staggered', 'player:parry', 'boss:poise', 'player:damaged', 'enemy:damaged']) D.EventBus.on(k, (p) => window.__ev.push([k, p]));
    const s = D.scene; const e = s.enemies.filter((x) => !x.dead && !x.def.boss)[0];
    s.player.warp(e.gx - 2.2, e.gy - 2.2); window.__e = e; e.aggro = false;
  });
  await t.sleep(500);
  // combo chain via auto attack
  const hp0 = await t.dbg(() => window.__e.hp);
  await t.dbg(() => { const s = window.__dbg.scene; s.combat.attackTarget(window.__e); });
  for (let i = 0; i < 6; i++) { await t.sleep(250); log('state', await t.dbg(() => window.__dbg.scene.combat.moves.state + ' st=' + Math.round(window.__dbg.GameState.stamina) + ' hp=' + window.__e.hp + ' poise=' + Math.round(window.__e.poise))); if (i === 2) await t.shot('hv_combo'); }
  // dodge
  await t.dbg(() => { window.__dbg.scene.combat.clearTarget(); const s = window.__dbg.scene; s.player.warp(window.__e.gx - 4, window.__e.gy - 4); });
  await t.sleep(300);
  const before = await t.dbg(() => ({ gx: window.__dbg.scene.player.gx, gy: window.__dbg.scene.player.gy }));
  await t.page.mouse.move(640, 500); await t.page.keyboard.press('Space'); await t.sleep(120); await t.shot('hv_dodge');
  const mid = await t.dbg(() => ({ ifr: window.__dbg.scene.combat.moves.iframes, st: window.__dbg.scene.combat.moves.state }));
  await t.sleep(600);
  const after = await t.dbg(() => ({ gx: window.__dbg.scene.player.gx, gy: window.__dbg.scene.player.gy, stam: window.__dbg.GameState.stamina }));
  log('dodge', JSON.stringify({ before, mid, after, dist: Math.hypot(after.gx - before.gx, after.gy - before.gy) }));
  // i-frames: damage during dodge
  await t.sleep(1500);
  await t.dbg(() => { const c = window.__dbg.scene.combat; window.__life = window.__dbg.GameState.life; c.moves.dodge(c.player.gx + 3, c.player.gy); });
  await t.sleep(80);
  const dmg = await t.dbg(() => { const c = window.__dbg.scene.combat; const r = c.damagePlayer({ amount: 10, type: 'physical' }, window.__e); return { r, life: window.__dbg.GameState.life, was: window.__life }; });
  log('iframe hit', JSON.stringify(dmg));
  // parry
  await t.sleep(1200);
  await t.dbg(() => { const c = window.__dbg.scene.combat; c.moves.setBlock(true); });
  await t.sleep(60);
  const pr = await t.dbg(() => { const c = window.__dbg.scene.combat; const e = window.__e; e.poise = e.maxPoise; const r = c.damagePlayer({ amount: 10, type: 'physical' }, e); return { r, stag: e.staggered }; });
  await t.shot('hv_parry'); log('parry', JSON.stringify(pr));
  await t.dbg(() => window.__dbg.scene.combat.moves.setBlock(false));
  // heavy charge
  await t.sleep(1500);
  await t.dbg(() => { const s = window.__dbg.scene; const e = window.__e; s.player.warp(e.gx - 1.5, e.gy - 1.5); window.__dbg.heal(); window.__e.hp = window.__e.maxHp; });
  await t.sleep(300);
  await t.dbg(() => { const s = window.__dbg.scene, e = window.__e; s.combat.moves.heavyStart(e.gx, e.gy); });
  await t.sleep(900); await t.shot('hv_charge');
  log('charge', await t.dbg(() => window.__dbg.scene.combat.moves.charge));
  await t.dbg(() => { const e = window.__e; window.__dbg.scene.combat.moves.heavyRelease(e.gx, e.gy); });
  await t.sleep(300); await t.shot('hv_release');
  log('heavy result', await t.dbg(() => JSON.stringify({ hp: window.__e.hp, max: window.__e.maxHp, stag: window.__e.staggered, dead: window.__e.dead })));
  // exhaustion
  await t.dbg(() => { const m = window.__dbg.scene.combat.moves; m.spend(999); });
  await t.sleep(400); await t.shot('hv_exhaust');
  log('exh', await t.dbg(() => window.__dbg.scene.combat.moves.exhausted));
  // boss stagger
  await t.dbg(() => { const s = window.__dbg.scene; s.scene.restart({ areaId: 'd1', floor: 1, seed: 12345, entry: 'start' }); }); await t.sleep(1500);
  await t.dbg(() => window.__dbg.go('w1', 0)); await t.sleep(300);
  log('events', await t.dbg(() => JSON.stringify(window.__ev.filter((x) => x[0] !== 'player:stamina' && x[0] !== 'enemy:damaged').slice(0, 12))));
  log('stamina evs', await t.dbg(() => window.__ev.filter((x) => x[0] === 'player:stamina').length));
} catch (e) { console.log('ERR', e.message); }
console.log(t.errors.slice(0, 8).join('\n'));
await t.browser.close();
