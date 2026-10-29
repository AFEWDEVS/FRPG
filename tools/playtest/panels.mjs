import { launch, newGame } from './lib.mjs';
for (const [w, h] of [[1280, 720], [1920, 1080], [1440, 900]]) {
  const t = await launch({ w, h });
  try {
    await newGame(t, 'Panel', 0);
    await t.dbg(async () => { const g = window.__dbg.GameState; g.addGold(300); const L = await import('/src/items/generate.ts'); const inv = await import('/src/items/inventory.ts'); const names = Object.keys(L); window.__names = names; });
    console.log(w, await t.dbg(() => window.__names.join(',')));
    for (const k of ['i', 'c', 't', 'q', 'm']) { await t.page.keyboard.press(k); await t.sleep(500); if (w === 1280 || k === 'i') await t.shot(`p_${w}_${k}`); await t.page.keyboard.press('Escape'); await t.sleep(200); }
    await t.page.keyboard.down('Tab'); await t.sleep(400); await t.shot(`p_${w}_tab`); await t.page.keyboard.up('Tab');
    await t.page.keyboard.press('i'); await t.page.keyboard.press('c'); await t.sleep(500); await t.shot(`p_${w}_ic`);
  } catch (e) { console.log('FAIL', e.stack); }
  console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
  await t.browser.close();
}
