import { launch, newGame } from './lib.mjs';
const t = await launch();
await newGame(t, 'Tester', 0);
for (const a of ['w1','d1','d2']) { await t.dbg((a) => window.__dbg.go(a), a); await t.sleep(5000); await t.dbg(()=>window.__dbg.heal()); await t.sleep(1500); await t.shot('v_'+a); }
console.log(t.errors.slice(0,5).join('\n')); await t.browser.close();
