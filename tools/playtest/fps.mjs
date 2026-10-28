import { launch, newGame } from './lib.mjs';
const t = await launch();
await newGame(t, 'Tester', 0);
console.log('renderer', await t.dbg(() => { const gl = window.__dbg.game.renderer.gl; const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; }));
console.log('fps town', await t.fps(3000));
await t.dbg(() => window.__dbg.go('w1')); await t.sleep(4000);
console.log('fps w1', await t.fps(3000));
console.log(await t.dbg(() => { const s = window.__dbg.scene; return JSON.stringify({ children: s.children.list.length, enemies: s.enemies.length }); }));
await t.browser.close();
