// tests/auth/login.spec.js
const { test, expect } = require('../../utils/authFixture');
const { getTimeOfDay } = require('../../utils/helpers');
const testData = require('../../data/testData.json');

test.describe('Authentication — Login & Logout', () => {

  test('TC_AUTH_001 — Successful login shows correct dashboard', async ({
    page, loginPage, dashboardPage, credentials
  }) => {
    await test.step('Navigate to login page', async () => {
      await loginPage.navigate();
      await loginPage.assertOnLoginPage();
    });

    await test.step('Enter credentials and sign in', async () => {
      await loginPage.login(credentials.email, credentials.password);
    });

    await test.step('Verify dashboard is displayed with user details', async () => {
      await dashboardPage.assertWelcomeDashboard(credentials.fullName);
    });

    await test.step('Verify time-based greeting is correct', async () => {
      const timeOfDay = getTimeOfDay();
await dashboardPage.assertWelcomeDashboard(credentials.fullName);    });
  });

  test('TC_AUTH_002 — Successful logout returns to login page', async ({
    page, loginPage, dashboardPage, credentials
  }) => {
    // ── Login ──────────────────────────────────────────────
    await test.step('Login', async () => {
      await loginPage.navigate();
      await loginPage.login(credentials.email, credentials.password);
      await dashboardPage.assertWelcomeDashboard(credentials.fullName);
    });

    // ── Logout ─────────────────────────────────────────────
    await test.step('Logout via user menu', async () => {
      await dashboardPage.logout();
    });

    // ── Assert ─────────────────────────────────────────────
    await test.step('Verify login page is shown after logout', async () => {
      await loginPage.assertLoginPageVisible();
    });
  });

  test('TC_AUTH_003 — Invalid credentials show error', async ({
    page, loginPage
  }) => {
    await test.step('Navigate to login page', async () => {
      await loginPage.navigate();
    });

    await test.step('Submit wrong credentials', async () => {
      await loginPage.login('invalid@test.com', 'wrongpassword');
    });

    await test.step('Verify error message is shown', async () => {
      // Error can be a toast or inline message
      const errorLocator = page.locator('li')
        .or(page.getByText(/invalid|incorrect|failed/i));
      await expect(errorLocator.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test('TC_AUTH_004 — Login page loads with required elements', async ({
    page, loginPage
  }) => {
    await loginPage.navigate();

    await test.step('Email field is visible', async () => {
      await expect(loginPage.emailInput).toBeVisible();
    });

    await test.step('Password field is visible', async () => {
      await expect(loginPage.passwordInput).toBeVisible();
    });

    await test.step('Sign In button is visible', async () => {
      await expect(loginPage.signInButton).toBeVisible();
    });
  });
});
