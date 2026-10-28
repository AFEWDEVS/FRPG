import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const SHOTS = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(SHOTS, { recursive: true });
export const URL = process.env.FRPG_URL || 'http://localhost:5173/';

export async function launch({ w = 1280, h = 720 } = {}) {
  const browser = await chromium.launch({ args: process.env.GPU ? ['--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) || m.text().startsWith('[assets]')) errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
  page.on('requestfailed', (r) => errors.push(`[reqfail] ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });
  await page.goto(URL);
  const shot = async (name) => { await page.screenshot({ path: join(SHOTS, name + '.png') }); console.log('shot', name); };
  const sleep = (ms) => page.waitForTimeout(ms);
  const dbg = (fn, arg) => page.evaluate(fn, arg);
  const sceneActive = (k) => page.evaluate((k) => window.__dbg.game.scene.isActive(k), k);
  const waitScene = async (k, t = 30000) => { const s = Date.now(); while (Date.now() - s < t) { if (await sceneActive(k)) return true; await sleep(200); } throw new Error('timeout scene ' + k); };
  // game coords (1280x720) -> page coords
  const click = async (x, y, opts = {}) => {
    const box = await page.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
    await page.mouse.click(box.x + (x / 1280) * box.w, box.y + (y / 720) * box.h, opts);
  };
  const fps = async (ms = 3000) => {
    const arr = []; const n = ms / 500;
    for (let i = 0; i < n; i++) { await sleep(500); arr.push(await dbg(() => window.__dbg.fps())); }
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };
  return { browser, page, errors, shot, sleep, dbg, sceneActive, waitScene, click, fps };
}

export async function newGame(t, name = 'Tester', classIdx = 0) {
  await t.waitScene('MainMenu');
  await t.sleep(800);
  await t.click(640, 360);
  await t.waitScene('CharacterCreate');
  await t.sleep(600);
  await t.page.fill('input[type=text]', name);
  await t.click(640 + (classIdx - 1) * 390, 430);
  await t.click(840, 670);
  await t.sleep(2500); await t.page.keyboard.press('Escape');
  await t.waitScene('Game', 20000);
  await t.sleep(1500);
}

/** Click at a grid position (continuous) using the Game camera. */
export async function clickGrid(t, gx, gy, opts = {}, dy = 0) {
  const p = await t.dbg(([gx, gy, dy]) => {
    const c = window.__dbg.scene.cameras.main; const wx = (gx - gy) * 64, wy = (gx + gy) * 32 + dy;
    return { x: (wx - c.worldView.x) * c.zoom, y: (wy - c.worldView.y) * c.zoom };
  }, [gx, gy, dy]);
  await t.click(p.x, p.y, opts);
}
