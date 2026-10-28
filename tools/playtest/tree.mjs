import { launch, newGame } from './lib.mjs';
const t = await launch();
await newGame(t, 'Tree', 0);
await t.dbg(() => window.__dbg.go('w1')); await t.sleep(3500);
await t.dbg(() => { const s = window.__dbg.scene; const m = s.map; const tr = m.props.find((p) => p.key.startsWith('tree')); s.player.warp(tr.gx + 0.5, tr.gy + 0.2); });
await t.sleep(1500); await t.shot('tr');
console.log(await t.dbg(() => { const s = window.__dbg.scene; const p = s.player; return JSON.stringify({ py: p.y, vis: p.visible, a: p.alpha, depth: p.depth, trees: s.children.list.filter((o) => o.texture && o.texture.key.startsWith('tree') && o.visible && Math.abs(o.x - p.x) < 150 && o.y > p.y - 10 && o.y - o.displayHeight < p.y).map((o) => [o.texture.key, Math.round(o.y), Math.round(o.depth), o.alpha, Math.round(o.displayHeight)]) }); }));
await t.browser.close();
