import { launch, newGame } from './lib.mjs';
const t = await launch();
try {
  await newGame(t, 'Tester', 2);
  const emit = (e, p) => t.dbg(([e, p]) => window.__dbg.EventBus.emit(e, p), [e, p]);
  await emit('npc:interact', { npcId: 'elder' });
  await t.sleep(2500); await t.shot('dlg_elder');
  await t.page.keyboard.press('Enter'); await t.sleep(300);
  for (let i = 0; i < 12; i++) { await t.page.keyboard.press('Enter'); await t.sleep(1800); if (i === 4) await t.shot('dlg_elder_choices'); }
  await t.sleep(500); await t.shot('dlg_after');
  await emit('npc:interact', { npcId: 'bard' });
  await t.sleep(2500); await t.shot('dlg_pipo');
  await emit('npc:interact', { npcId: 'merchant' });
  await t.sleep(300); await t.shot('dlg_merchant0');
  await t.sleep(3500); await t.shot('dlg_merchant');
  await t.page.keyboard.press('3'); await t.sleep(500);
  await emit('emote:show', { target: 'player', name: 'heart' });
  await emit('emote:show', { target: 'elder', name: '!' });
  await emit('emote:show', { target: 'bard', name: 'music' });
  await t.sleep(500); await t.shot('emotes');
  await t.dbg(() => { const s = window.__dbg.scene; for (const n of s.npcs) n.say('x'); });
  await t.sleep(700); await t.shot('chat');
  await t.dbg(() => { const D = window.__dbg; D.GameState.flags.banterPre_ogre_poet = false; D.EventBus.emit('boss:engaged', { bossId: 'ogre_poet', name: 'Ogro', hp: 1, maxHp: 1 }); });
  await t.sleep(4000); await t.shot('banter_ogre'); await t.page.keyboard.press('Enter'); await t.sleep(1500); await t.page.keyboard.press('Enter'); await t.sleep(5000); await t.shot('banter_ogre_b');
  await t.page.keyboard.press('Enter'); await t.sleep(800);
  await t.shot('banter_ogre2');
} catch (e) { console.log('FAIL', e.stack); await t.shot('fail'); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
