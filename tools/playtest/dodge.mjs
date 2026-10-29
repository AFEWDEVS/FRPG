import { launch, newGame } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Tester', 0);
  await t.dbg(() => window.__dbg.go('w1')); await t.sleep(3500);
  await t.dbg(() => { const s = window.__dbg.scene; for (const e of s.enemies) e.vanish?.(); });
  await t.sleep(500);
  const r = await t.dbg(() => { const c = window.__dbg.scene.combat, p = c.player; const m = c.moves; const b = { gx: p.gx, gy: p.gy }; m.dodge(p.gx + 3, p.gy); return { b, st: m.state, ifr: m.iframes, dashing: p.dashing, stam: window.__dbg.GameState.stamina, ex: m.exhausted }; });
  console.log(JSON.stringify(r));
  await t.sleep(150);
  console.log(JSON.stringify(await t.dbg(() => { const c = window.__dbg.scene.combat; return { ifr: c.moves.iframes, hit: c.damagePlayer({ amount: 10, type: 'physical' }), pos: [c.player.gx, c.player.gy] }; })));
  await t.sleep(700);
  console.log(JSON.stringify(await t.dbg(() => { const c = window.__dbg.scene.combat; return [c.player.gx, c.player.gy, c.moves.state]; })));
  await t.page.mouse.move(900, 400); await t.page.keyboard.press('Space'); await t.sleep(120);
  console.log('key', JSON.stringify(await t.dbg(() => { const c = window.__dbg.scene.combat; return [c.moves.state, c.moves.iframes]; })));
} catch (e) { console.log('ERR', e.message); }
console.log(t.errors.slice(0, 5).join('\n'));
await t.browser.close();
