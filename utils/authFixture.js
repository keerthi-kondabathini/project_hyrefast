// utils/authFixture.js
const { test: base } = require('@playwright/test');
const { LoginPage }    = require('../pages/LoginPage');
const { DashboardPage } = require('../pages/DashboardPage');
const { getEnv }        = require('./helpers');

/**
 * Custom fixture that:
 * - Provides `loginPage` and `dashboardPage` POM instances
 * - Provides `loggedInPage` — performs login and returns dashboard POM
 * - Provides `credentials` — pulled from environment
 */
const test = base.extend({
  credentials: async ({}, use) => {
    await use({
      email:    getEnv('USER_EMAIL'),
      password: getEnv('USER_PASSWORD'),
      fullName: getEnv('USER_FULL_NAME'),
      workspace: getEnv('WORKSPACE_NAME'),
      workspaceSlug: getEnv('WORKSPACE_SLUG'),
    });
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  loggedInPage: async ({ page, credentials }, use) => {
    const loginPage     = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.navigate();
    await loginPage.login(credentials.email, credentials.password);
    await dashboardPage.assertWelcomeDashboard(credentials.fullName);

    await use(dashboardPage);

    // Teardown: logout after each test that uses this fixture
    try {
      await dashboardPage.logout();
    } catch {
      // Page may already be closed; ignore
    }
  },
});

const { expect } = base;
module.exports = { test, expect };
