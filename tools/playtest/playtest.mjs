import { launch, newGame } from './lib.mjs';
const t = await launch();
try {
  await t.waitScene('MainMenu');
  await t.sleep(1500);
  await t.shot('01_menu');
  await t.click(640, 360);
  await t.waitScene('CharacterCreate'); await t.sleep(800);
  await t.shot('02_create');
  await t.page.fill('input[type=text]', 'Tester');
  await t.click(640 + 390, 430);
  await t.sleep(300); await t.shot('02b_create_mage');
  await t.click(640, 430);
  await t.click(840, 670);
  await t.sleep(2500); await t.shot('03_intro'); await t.page.keyboard.press('Escape');
  await t.waitScene('Game', 30000); await t.sleep(2500);
  await t.shot('04_town');
  console.log('fps town', await t.fps());
} catch (e) { console.log('FAIL', e.message); await t.shot('fail'); }
console.log('ERRORS:\n' + [...new Set(t.errors)].join('\n'));
await t.browser.close();
