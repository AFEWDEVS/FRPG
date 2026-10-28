import { launch, newGame, clickGrid } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Loot', 0);
  await t.dbg(async () => { const g = window.__dbg.GameState; const gen = await import('/src/items/generate.ts'); const inv = await import('/src/items/inventory.ts');
    for (const [grp, r] of [['weapon','rare'],['armor','magic'],['helm','unique'],['ring','rare']]) { try { inv.addToGrid(g.profile.inventory, 10, 4, gen.generateItem({ ilvl: 12, rarity: r, group: grp })); } catch (e) {} }
    inv.addToGrid(g.profile.inventory, 10, 4, gen.generateItem({ ilvl: 12, rarity: 'rare' }));
    g.profile.belt[0] = gen.makePotion('health', 1); window.__dbg.EventBus.emit('inventory:changed'); });
  await t.page.keyboard.press('i'); await t.sleep(500);
  await t.shot('l_inv');
  // hover first item
  await t.page.mouse.move(883 * 1 + 0, 380); await t.sleep(300); await t.shot('l_inv_hover');
  await t.page.keyboard.press('Space');
  // drops in w1
  await t.dbg(() => window.__dbg.go('w1')); await t.sleep(3500);
  await t.dbg(() => { const s = window.__dbg.scene; for (let i = 0; i < 6; i++) { const e = s.enemies.filter((x) => !x.dead)[i]; s.player.warp(e.gx - 2, e.gy - 2); e.applyDamage(99999); } });
  await t.sleep(1500); await t.shot('l_drops');
  console.log(await t.dbg(() => JSON.stringify({ drops: window.__dbg.scene.loot.drops?.length ?? Object.keys(window.__dbg.scene.loot) })));
  await t.dbg(() => { const s = window.__dbg.scene; s.player.warp(s.player.gx, s.player.gy); });
  await t.page.keyboard.down('Tab'); await t.page.keyboard.up('Tab'); await t.sleep(400); await t.shot('l_automap');
} catch (e) { console.log('FAIL', e.stack); await t.shot('fail'); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
