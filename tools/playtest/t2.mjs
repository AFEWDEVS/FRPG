import { launch, newGame } from './lib.mjs';
const t = await launch(); await newGame(t,'T',0);
await t.shot('x_on');
await t.dbg(()=>window.__dbg.scene.cameras.main.postFX.clear()); await t.sleep(500); await t.shot('x_nofx');
console.log(t.errors.slice(0,8).join('\n')); await t.browser.close();
