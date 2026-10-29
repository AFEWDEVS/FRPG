import { launch, newGame } from './lib.mjs';
const w = +(process.env.W || 1280), h = Math.round(w * 9 / 16);
const t = await launch({ w, h });
try {
  await newGame(t, 'Tester', 1);
  await t.dbg(() => { const g = window.__dbg.GameState; g.profile.level = 6; g.profile.skillPoints = 3; g.addGold(240); g.emitProgress(); });
  await t.page.keyboard.press('t'); await t.sleep(700);
  await t.click(1030, 250); await t.page.mouse.move(0, 0);
  const box = await t.dbg(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
  await t.page.mouse.move(box.x + box.w * 0.8, box.y + box.h * 0.35); await t.sleep(600); await t.shot(`u2_${w}_skills`);
  await t.page.keyboard.press('Escape'); await t.sleep(400);
  await t.dbg(async () => { const { EventBus } = { EventBus: window.__dbg.EventBus }; EventBus.emit('boss:engaged', { bossId: 'x', name: 'Gárgola Celosa', hp: 800, maxHp: 1000 }); EventBus.emit('boss:hp', { hp: 560, maxHp: 1000 }); EventBus.emit('boss:poise', { value: 40, max: 100 }); EventBus.emit('boss:taunt', { text: 'Nadie la mira como yo.' }); EventBus.emit('player:stamina', { stamina: 40, max: 100 }); });
  await t.sleep(1200); await t.shot(`u2_${w}_boss`);
  await t.dbg(async () => { const { EventBus } = { EventBus: window.__dbg.EventBus }; EventBus.emit('quests:updated', [{ id: 'q', title: 'El corazón perdido', description: 'x', steps: [{ text: 'Habla con el Anciano en la plaza', done: false }], done: false }]); EventBus.emit('dialogue:show', { speaker: 'Anciano', portrait: 'elder', text: 'Bienvenido, joven aventurero. Hace tiempo que {gold}nadie{/gold} cruza esas puertas.', who: 'elder', choices: [{ id: 'a', text: 'Cuéntame más.' }, { id: 'b', text: 'Adiós.' }] }); });
  await t.sleep(2800); await t.shot(`u2_${w}_dialogue`);
  await t.dbg(async () => { const { EventBus } = { EventBus: window.__dbg.EventBus }; EventBus.emit('dialogue:hide'); });
  await t.sleep(900); await t.shot(`u2_${w}_after`);
} catch (e) { console.log('FAIL', e.stack); }
console.log('ERRORS:\n' + [...new Set(t.errors)].filter((e) => !e.includes('Failed to process')).slice(0, 8).join('\n'));
await t.browser.close();
