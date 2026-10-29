import { launch, newGame } from './lib.mjs';
const t = await launch(); await newGame(t, 'T', 0); await t.sleep(2500);
await t.dbg(() => { const a = window.__dbg.scene.atmosphere; a.depth.setVisible(false); });
await t.shot('line_nodepth');
await t.dbg(() => { const a = window.__dbg.scene.atmosphere; a.depth.setVisible(true); a.grain.setVisible(false); });
await t.shot('line_nograin');
await t.browser.close();
