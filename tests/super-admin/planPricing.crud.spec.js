const { test, expect } = require('@playwright/test');
const { SuperAdminLoginPage } = require('../../pages/super-admin/SuperAdminLoginPage');
const { BillingPlansPage } = require('../../pages/super-admin/BillingPlansPage');
const { SubscriptionsPage } = require('../../pages/super-admin/SubscriptionsPage');
const { EntitlementsPage } = require('../../pages/super-admin/EntitlementsPage');
const { ServicesPage } = require('../../pages/super-admin/ServicesPage');
const { ServiceContractsPage } = require('../../pages/super-admin/ServiceContractsPage');
const { CreditEconomicsPage } = require('../../pages/super-admin/CreditEconomicsPage');

const STAGING_ORIGIN = 'https://staging.hyrefast.ai';

test.describe('Super Admin — complete Plan & Pricing CRUD (staging only)', () => {
  test('sanity-checks CRUD and key list controls for all Plan & Pricing sections', async ({ page }) => {
    const baseURL = process.env.BASE_URL;
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const workspace = process.env.SUPER_ADMIN_TEST_WORKSPACE || 'Test WorkSpace';

    expect(new URL(baseURL).origin, 'This CRUD flow is restricted to staging').toBe(STAGING_ORIGIN);
    expect(email, 'Set SUPER_ADMIN_EMAIL in the staging environment').toBeTruthy();
    expect(password, 'Set SUPER_ADMIN_PASSWORD in the staging environment').toBeTruthy();

    const login = new SuperAdminLoginPage(page);
    const plans = new BillingPlansPage(page);
    const subscriptions = new SubscriptionsPage(page);
    const entitlements = new EntitlementsPage(page);
    const services = new ServicesPage(page);
    const contracts = new ServiceContractsPage(page);
    const economics = new CreditEconomicsPage(page);

    const suffix = Date.now();
    const planName = `E2E staging plan ${suffix}`;
    const updatedPlanName = `${planName} updated`;
    const serviceName = `E2E staging service ${suffix}`;
    const updatedServiceName = `${serviceName} updated`;
    const subscriptionName = planName;
    const entitlementName = updatedServiceName;
    const contractName = updatedServiceName;
    const rateName = 'EUR';

    await login.navigate();
    await login.login(email, password);
    await expect(page).toHaveURL(/\/super-admin(?:\/|$)/, { timeout: 30_000 });

    const cleanupErrors = [];
    const cleanup = async (name, resourcePage, identifier, deleteMethod = 'deleteRow') => {
      try {
        await resourcePage.navigate();
        const exists = deleteMethod === 'deletePlan'
          ? (await resourcePage.planRow(identifier).count()) > 0
          : await resourcePage.hasRow(identifier);
        if (exists) {
          if (deleteMethod === 'deletePlan') await resourcePage.deletePlan(identifier);
          else await resourcePage.deleteRow(identifier);
        }
      } catch (error) {
        cleanupErrors.push(`${name}: ${error.message}`);
      }
    };

    try {
      await test.step('Billing Plans: create, read, update, search, delete', async () => {
        await plans.navigate();
        await plans.openCreateForm();
        await plans.fillPlanForm({ name: planName, workspace, price: '1' });
        await plans.submitForm(/create plan|save|create/i);
        await plans.assertPlanVisible(planName);
        await plans.toggleAndRestore(planName);
        await plans.filterByStatus('Active');
        await plans.assertPlanVisible(planName);
        await plans.filterByStatus('All Status');

        await plans.openEditForm(planName);
        await plans.fillPlanForm({ name: updatedPlanName, price: '2' });
        await plans.submitForm(/save|update/i);
        await plans.assertPlanVisible(updatedPlanName);
        await plans.deletePlan(updatedPlanName);
      });

      // Recreate the plan as a dependency for subscription and entitlement checks.
      await plans.openCreateForm();
      await plans.fillPlanForm({ name: planName, workspace, price: '1' });
      await plans.submitForm(/create plan|save|create/i);
      await plans.assertPlanVisible(planName);

      await test.step('Services: create, read, update, search, toggle, delete', async () => {
        await services.navigate();
        await services.openCreate();
        await services.choose(0, workspace, { search: workspace });
        await services.fillText('service-name', serviceName);
        await services.submit(/create service/i);
        await services.assertRowVisible(serviceName);
        await services.search(serviceName);

        await services.openEdit(serviceName);
        await services.fillText('service-name', updatedServiceName);
        await services.submit(/save changes/i);
        await services.assertRowVisible(updatedServiceName);
        await services.toggleAndRestore(updatedServiceName);
      });

      await test.step('Subscriptions: create, read, update status, filter, delete', async () => {
        await subscriptions.navigate();
        await subscriptions.openCreate();
        await subscriptions.choose(0, workspace, { search: workspace });
        await subscriptions.choose(1, planName);
        await subscriptions.fillText('sub-end', '2026-11-27');
        await subscriptions.submit(/assign plan/i);
        await subscriptions.assertRowVisible(subscriptionName);

        await subscriptions.openEdit(subscriptionName);
        await subscriptions.choose(2, 'PAUSED');
        await subscriptions.submit(/save changes/i);
        await subscriptions.assertRowVisible(subscriptionName);
        await subscriptions.filterByStatus('Paused');
        await subscriptions.assertRowVisible(subscriptionName);
        await subscriptions.deleteRow(subscriptionName);
      });

      await test.step('Entitlements: create, read, update limit, delete', async () => {
        await entitlements.navigate();
        await entitlements.openCreate();
        await entitlements.choose(0, workspace, { search: workspace });
        await entitlements.choose(1, planName);
        await entitlements.choose(2, updatedServiceName);
        await entitlements.fillNumber('ent-limit', 25);
        await entitlements.submit(/save entitlement/i);
        await entitlements.assertRowVisible(entitlementName);

        await entitlements.openEdit(entitlementName);
        await entitlements.fillNumber('ent-limit', 75);
        await entitlements.submit(/save changes/i);
        await expect(entitlements.row(entitlementName)).toContainText('75');
        await entitlements.deleteRow(entitlementName);
      });

      await test.step('Service Contracts: create, read, update cost, delete', async () => {
        await contracts.navigate();
        await contracts.openCreate();
        await contracts.choose(0, workspace, { search: workspace });
        await contracts.choose(1, updatedServiceName);
        await contracts.fillNumber('sc-cost', 7);
        await contracts.submit(/create contract/i);
        await contracts.assertRowVisible(contractName);

        await contracts.openEdit(contractName);
        await contracts.fillNumber('sc-cost', 8);
        await contracts.submit(/save changes/i);
        await expect(contracts.row(contractName)).toContainText('8');
        await contracts.deleteRow(contractName);
      });

      await test.step('Credit Economics: create EUR rate, read, update, delete', async () => {
        await economics.navigate();
        await economics.openCreate();
        await economics.choose(0, workspace, { search: workspace });
        await economics.fillNumber('ce-value', 1);
        await economics.choose(1, 'EUR (€)');
        await economics.submit(/save rate/i);
        await economics.assertRowVisible(rateName);

        await economics.openEdit(rateName);
        await economics.fillNumber('ce-value', 2);
        await economics.submit(/save changes/i);
        await expect(economics.row(rateName)).toContainText('EUR 2');
        await economics.deleteRow(rateName);
      });

      // Remove dependency records after their dependent records have been removed.
      await services.navigate();
      if (await services.hasRow(updatedServiceName)) await services.deleteRow(updatedServiceName);
      await plans.navigate();
      await plans.assertPlanVisible(planName);
      await plans.deletePlan(planName);
    } finally {
      // Repeat cleanup by unique labels so a failed assertion cannot leave staging test data behind.
      await cleanup('subscription', subscriptions, subscriptionName);
      await cleanup('entitlement', entitlements, entitlementName);
      await cleanup('service contract', contracts, contractName);
      await cleanup('credit rate', economics, rateName);
      await cleanup('service', services, updatedServiceName);
      await cleanup('service', services, serviceName);
      await cleanup('plan', plans, updatedPlanName, 'deletePlan');
      await cleanup('plan', plans, planName, 'deletePlan');
      if (cleanupErrors.length) throw new Error(`Staging cleanup failed: ${cleanupErrors.join('; ')}`);
    }
  });
});
