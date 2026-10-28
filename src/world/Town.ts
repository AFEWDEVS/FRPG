import { TileMap } from './TileMap';

const N = 32;

/** Hand-placed Pueblo Rosaleda. Deterministic (seed only affects nothing here). */
export function buildTown(seed = 0): TileMap {
  const map = new TileMap(N, N, seed);
  map.wallKey = 'town_wall';
  const cobble = map.groundIndex('town_cobble');
  const grass = map.groundIndex('w1_grass');
  for (let j = 1; j < N - 1; j++) {
    for (let i = 1; i < N - 1; i++) {
      const patch = (i < 8 && j > 22) || (i > 24 && j > 22) || (i > 24 && j < 8);
      map.ground[map.idx(i, j)] = patch ? grass : cobble;
    }
  }
  for (let k = 0; k < N; k++) {
    for (const [i, j] of [[k, 0], [k, N - 1], [0, k], [N - 1, k]]) map.wall[map.idx(i, j)] = 1;
  }

  const prop = (key: string, gx: number, gy: number, w = 1, h = 1, blocks = true) => map.addProp({ key, gx, gy, w, h, blocks });

  prop('house_1', 4, 4, 2, 2);
  prop('house_2', 24, 5, 2, 2);
  prop('house_1', 5, 14, 2, 2);
  prop('house_2', 24, 16, 2, 2);
  prop('market_stall', 12, 8, 2, 1);
  prop('well', 15, 13);
  prop('campfire', 15, 19);
  for (let i = 8; i < 13; i++) prop('fence', i, 26);
  for (let i = 19; i < 24; i++) prop('fence', i, 26);
  for (const [x, y] of [[3, 24], [5, 27], [27, 25], [28, 3], [26, 28], [2, 9]]) prop(x % 2 ? 'tree_oak_1' : 'tree_oak_2', x, y);
  for (const [x, y] of [[9, 24], [26, 9], [20, 20], [10, 17]]) prop('bush', x, y);
  for (const [x, y] of [[14, 3], [17, 3]]) prop('torch', x, y, 1, 1, false);
  for (const [x, y] of [[27, 11], [27, 14]]) prop('torch', x, y, 1, 1, false);
  prop('barrel', 11, 10);
  prop('crate', 14, 10);

  // Festival de las Dos Lunas: flowers and lanterns (non-blocking decor around the plaza and the roads)
  for (const [x, y] of [[13, 13], [17, 13], [14, 14], [16, 12], [13, 18], [17, 18], [14, 21], [16, 21], [11, 11], [19, 11], [10, 20], [20, 20], [7, 8], [9, 8], [22, 9], [20, 9], [6, 16], [23, 15], [18, 7], [12, 7]]) prop('flowers', x, y, 1, 1, false);
  for (const [x, y] of [[13, 6], [17, 6], [13, 9], [17, 9], [12, 14], [18, 14], [12, 22], [18, 22], [25, 12], [25, 15], [6, 10], [10, 8], [20, 8]]) prop('torch', x, y, 1, 1, false);
  for (const [x, y] of [[13, 24], [17, 24]]) prop('brazier', x, y);
  // Portals
  prop('dungeon_entrance', 15, 2);
  map.addMarker('portal', 15, 2, { to: 'w1', label: 'Bosque de Verdeluna' });
  prop('dungeon_entrance', 28, 12);
  map.addMarker('portal', 28, 12, { to: 'w2', label: 'Ruinas de Cenizar' });

  // NPCs (placeholder entities; npcId indexes data/npcs.ts)
  map.addMarker('npc', 8, 9, { npcId: 'elder' });
  map.addMarker('npc', 14, 11, { npcId: 'merchant' });
  map.addMarker('npc', 21, 10, { npcId: 'healer' });
  map.addMarker('npc', 17, 17, { npcId: 'bard' });

  map.addMarker('spawn', 15, 22);
  return map;
}