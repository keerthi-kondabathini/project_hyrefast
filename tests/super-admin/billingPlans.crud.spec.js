const { test, expect } = require('@playwright/test');
const { SuperAdminLoginPage } = require('../../pages/super-admin/SuperAdminLoginPage');
const { BillingPlansPage } = require('../../pages/super-admin/BillingPlansPage');

const STAGING_ORIGIN = 'https://staging.hyrefast.ai';

test.describe('Super Admin — Billing Plans CRUD (staging only)', () => {
  test('create, read, update, and delete a disposable billing plan', async ({ page }) => {
    const baseURL = process.env.BASE_URL;
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const workspace = process.env.SUPER_ADMIN_TEST_WORKSPACE || 'Test WorkSpace';

    expect(baseURL, 'Set BASE_URL to the staging URL in .env.staging').toBeTruthy();
    let configuredOrigin;
    try {
      configuredOrigin = new URL(baseURL).origin;
    } catch {
      throw new Error(`Invalid BASE_URL in the staging environment: ${JSON.stringify(baseURL)}`);
    }
    expect(configuredOrigin, 'This CRUD flow is restricted to staging').toBe(STAGING_ORIGIN);
    expect(email, 'Set SUPER_ADMIN_EMAIL in the staging environment').toBeTruthy();
    expect(password, 'Set SUPER_ADMIN_PASSWORD in the staging environment').toBeTruthy();

    const login = new SuperAdminLoginPage(page);
    const plans = new BillingPlansPage(page);
    const planName = `E2E staging plan ${Date.now()}`;
    const updatedName = `${planName} updated`;

    await login.navigate();
    await login.login(email, password);
    await expect(page).toHaveURL(/\/super-admin(?:\/|$)/, { timeout: 30_000 });
    await plans.navigate();

    let created = false;
    try {
      await plans.openCreateForm();
      await plans.fillPlanForm({
        name: planName,
        workspace,
        price: '1',
      });
      // Mark it for cleanup before submission in case the request succeeds but its UI wait fails.
      created = true;
      await plans.submitForm(/create plan|save|create/i);

      await plans.assertPlanVisible(planName);
      const rowText = await (await plans.findPlan(planName)).innerText();
      expect(rowText).toContain(planName);

      await plans.openEditForm(planName);
      await plans.fillPlanForm({ name: updatedName, price: '2' });
      await plans.submitForm(/save|update/i);
      await plans.assertPlanVisible(updatedName);

      await plans.deletePlan(updatedName);
      created = false;
    } finally {
      if (created) {
        const original = plans.planRow(planName);
        if (await original.count()) await plans.deletePlan(planName);
        const renamed = plans.planRow(updatedName);
        if (await renamed.count()) await plans.deletePlan(updatedName);
      }
    }
  });
});
