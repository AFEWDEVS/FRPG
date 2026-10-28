import { launch, newGame } from './lib.mjs';
const t = await launch();
await newGame(t, 'Panel', 0);
await t.shot('x0');
for (const k of ['i', 'c']) { await t.page.keyboard.press(k); await t.sleep(500); await t.shot('x_' + k); console.log(await t.dbg(() => { const s = window.__dbg.scene; const p = s.player; return JSON.stringify(s.children.list.filter((o) => o !== p && Math.abs(o.x - p.x) < 120 && Math.abs(o.y - p.y) < 80 && o.visible && o.type !== 'Container').map((o) => `${o.type}:${o.texture?.key} d=${o.depth} a=${o.alpha}`)); })); }
await t.browser.close();
