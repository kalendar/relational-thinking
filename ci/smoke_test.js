// Opens every page of the assembled tools site in a real browser and fails if any
// page throws an uncaught error or logs a console error while loading.
// Covers the splitters, which have no unit tests of their own.
// Usage: node ci/smoke_test.js _site
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Network noise (e.g. a slow Google Fonts request) isn't a bug in our code.
const IGNORE = [/Failed to load resource/i, /net::ERR_/i];

(async () => {
  const site = path.resolve(process.argv[2] || '_site');
  const pages = fs.readdirSync(site).filter(f => f.endsWith('.html')).sort();
  const browser = await chromium.launch();
  let failed = 0;
  for (const file of pages) {
    const page = await browser.newPage();
    const problems = [];
    page.on('pageerror', e => problems.push(`uncaught error: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error' && !IGNORE.some(r => r.test(m.text()))) problems.push(`console error: ${m.text()}`);
    });
    try {
      await page.goto('file://' + path.join(site, file), { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1500); // let start-up code (e.g. SQL Studio's database) finish
      const text = (await page.locator('body').innerText()).trim();
      if (!text) problems.push('page body is empty');
    } catch (e) {
      problems.push(`failed to load: ${e.message}`);
    }
    await page.close();
    if (problems.length) {
      failed++;
      for (const p of problems) console.log(`::error title=${file}::${p}`);
    } else {
      console.log(`ok   ${file}`);
    }
  }
  await browser.close();
  console.log(`${pages.length - failed} of ${pages.length} pages loaded cleanly.`);
  process.exit(failed ? 1 : 0);
})();
