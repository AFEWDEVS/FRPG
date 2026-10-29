import { launch, newGame } from './lib.mjs';
const t = await launch(); await newGame(t, 'T', 0);
for (const a of ['w1', 'w2', 'd1', 'd2', 'w1', 'w2']) {
  await t.dbg((a) => window.__dbg.go(a), a); await t.sleep(3500);
  console.log(a, JSON.stringify(await t.dbg(() => {
    const m = window.__dbg.scene.map, sp = m.firstMarker('spawn'), d = m.flood(sp.gx, sp.gy);
    const tg = ['dungeon_entrance', 'stairs_down', 'boss', 'chest'].flatMap((k) => m.markersOf(k));
    const ok = tg.filter((x) => [[1,0],[-1,0],[0,1],[0,-1],[0,0]].some(([dx,dy]) => m.inBounds(x.gx+dx,x.gy+dy) && d[m.idx(x.gx+dx,x.gy+dy)] >= 0));
    const sets = m.props.filter((p) => ['cliff_1','cliff_2','ruin_arch','bridge_wood','giant_mushroom','lava_pillar','arcane_obelisk','stalagmite'].includes(p.key)).length;
    return { targets: tg.length, reachable: ok.length, setPieces: sets, bridged: m.bridged.size };
  })));
}
await t.browser.close();
