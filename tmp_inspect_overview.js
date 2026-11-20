const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.staging' });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(process.env.BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill(process.env.USER_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.USER_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForLoadState('networkidle');

  await page.goto(process.env.BASE_URL + '/settings?section=overview');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const html = await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h1,h2,h3')).find(h => h.textContent.includes('Live Hiring Stats'));
    let container = heading;
    for (let i = 0; i < 2 && container; i++) container = container.parentElement;
    return container ? container.outerHTML.slice(0, 6000) : 'NOT FOUND';
  });

  console.log(html);

  const sidebar = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.filter(b => /Overview|Communication|Funnels|Careers Portal|Clients|Team & Workspace/.test(b.textContent)).map(b => b.textContent.trim());
  });
  console.log('SIDEBAR:', sidebar);

  const combos = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="combobox"], button')).filter(b => /Last 7 days|All clients|All jobs/.test(b.textContent)).map(b => ({tag: b.tagName, text: b.textContent.trim(), role: b.getAttribute('role'), aria: b.getAttribute('aria-label')}));
  });
  console.log('COMBOS:', JSON.stringify(combos, null, 2));

  const hiringStage = await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('*')).find(e => e.textContent.trim() === 'Hiring Stage' && e.children.length === 0);
    let container = heading;
    for (let i = 0; i < 4 && container; i++) container = container.parentElement;
    return container ? container.outerHTML.slice(0, 3000) : 'NOT FOUND';
  });
  console.log('HIRING STAGE:', hiringStage);

  const cardNames = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button[aria-label^="Open "]')).map(b => b.getAttribute('aria-label'));
  });
  console.log('CARD ARIA LABELS:', cardNames);
  await browser.close();
})();
