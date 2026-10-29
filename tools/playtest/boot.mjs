import { launch } from './lib.mjs';
const t = await launch();
await t.sleep(5000);
console.log(t.errors.slice(0,10).join('\n'));
await t.browser.close();
