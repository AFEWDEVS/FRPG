import { launch, newGame } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Tester', 0);
  await t.shot('t00');
  const view = (gx, gy, z) => t.dbg(([gx, gy, z]) => { const s = window.__dbg.scene; const c = s.cameras.main; c.stopFollow(); c.setZoom(z); const w = { x: (gx - gy) * 64, y: (gx + gy) * 32 }; c.centerOn(w.x, w.y); }, [gx, gy, z]);
  await view(16, 16, 0.5); await t.sleep(700); await t.shot('t01_overview');
  await view(8, 8, 1); await t.sleep(700); await t.shot('t02_elder');
  await view(15, 4, 1); await t.sleep(700); await t.shot('t03_portal');
  await view(24, 10, 1); await t.sleep(700); await t.shot('t04_houses');
} catch (e) { console.log('FAIL', e.message); await t.shot('fail'); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
