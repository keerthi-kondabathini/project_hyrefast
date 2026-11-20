const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.staging' });

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(process.env.BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill(process.env.USER_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.USER_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForLoadState('networkidle');

  // search job
  await page.getByRole('textbox', { name: 'Search by job name or ID' }).fill('.net developer');
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'View Candidates' }).first().click();
  await page.waitForURL(/\/job\/.+\/applications/, { timeout: 30000 });
  await page.waitForTimeout(1500);

  // click AI button (3rd button in header action group)
  const aiBtn = page.locator('button').filter({ hasText: /Add Candidates/i }).first().locator('xpath=../button[3]');
  await aiBtn.click();

  // wait for skeletons to disappear and real cards to appear
  await page.waitForFunction(() => {
    const panel = document.querySelector('[role="dialog"]');
    if (!panel) return false;
    const skeletons = panel.querySelectorAll('.animate-pulse');
    const cards = panel.querySelectorAll('.border');
    return skeletons.length === 0 && cards.length > 3;
  }, { timeout: 120000 });

  // dump panel HTML
  const html = await page.evaluate(() => {
    const panel = document.querySelector('[role="dialog"]');
    return panel ? panel.outerHTML.slice(0, 12000) : 'NO PANEL';
  });

  console.log(html);
  await browser.close();
})();
