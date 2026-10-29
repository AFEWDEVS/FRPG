import { launch, newGame } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Tester', 0);
  await t.dbg(() => window.__dbg.go('w1')); await t.sleep(3500);
  const tests = {
    levelUp: (s, p) => s.vfx.fx.levelUp(p.x, p.y, 5),
    explosion: (s, p) => s.vfx.explosion(p.x, p.y - 50, { element: 'holy', radius: 130, power: 1.6, shake: true, decal: false }),
    shock: (s, p) => { s.vfx.shockwave(p.x, p.y, { element: 'holy', radius: 420, duration: 900 }); s.vfx.decal('magic_circle', p.x, p.y, { scale: 0.9, tint: 0xffe680, duration: 1800, blend: 'ADD', spin: 120, alpha: 0.9 }); },
    flash: (s, p) => { s.vfx.screenFlash(0xfff2b0, 220); s.vfx.zoomPunch(1.06, 250, 250, 500); },
  };
  for (const k of Object.keys(tests)) {
    await t.dbg(([k, src]) => { const s = window.__dbg.scene; (new Function('s', 'p', 'return (' + src + ')(s,p)'))(s, s.player); }, [k, tests[k].toString()]);
    await t.sleep(450); await t.shot('lv_' + k); await t.sleep(2500);
  }
} catch (e) { console.log('FAIL', e.stack); }
await t.browser.close();
