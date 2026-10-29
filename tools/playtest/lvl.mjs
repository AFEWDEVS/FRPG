import { launch, newGame } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Tester', 0);
  await t.dbg(async () => {
    const m = await import('/src/audio/AudioManager.ts'); const A = m.AudioManager; window.__aud = [];
    for (const k of Object.getOwnPropertyNames(A)) { if (typeof A[k] === 'function' && /play|sfx|music/i.test(k)) { const o = A[k].bind(A); A[k] = (...a) => { window.__aud.push(k + ':' + String(a[0])); return o(...a); }; } }
  });
  await t.dbg(() => window.__dbg.go('w1')); await t.sleep(3500);
  await t.dbg(() => { const g = window.__dbg.GameState; window.__dbg.giveXp(g.profile.xp !== undefined ? 60 : 60); });
  await t.dbg(() => window.__dbg.giveXp(400));
  await t.sleep(500); await t.shot('lvl_a'); await t.sleep(500); await t.shot('lvl_b');
  console.log('AUDIO', await t.dbg(() => [...new Set(window.__aud)].join(' ')));
} catch (e) { console.log('FAIL', e.stack); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
