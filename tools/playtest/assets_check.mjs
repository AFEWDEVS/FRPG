import { launch } from './lib.mjs';
const t = await launch();
const r = await t.page.evaluate(async () => {
  const m = await import('/src/assets/manifest.ts');
  const bad = [];
  const urls = [...m.IMAGE_MANIFEST.map((e) => e.path), ...m.AUDIO_MANIFEST.flatMap((a) => a.urls)];
  for (const u of urls) {
    const res = await fetch('/' + u.replace(/^\//, ''));
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || ct.includes('html')) bad.push(u);
  }
  return { n: urls.length, bad };
});
console.log(JSON.stringify(r, null, 1));
await t.browser.close();
