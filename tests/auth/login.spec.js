// tests/auth/login.spec.js
const { test, expect } = require('../../utils/authFixture');
const { LoginPage } = require('../../pages/LoginPage');
const { YopMailPage } = require('../../pages/YopMailPage');
const { DashboardPage } = require('../../pages/DashboardPage');
const { getTimeOfDay, getEnv } = require('../../utils/helpers');

const RESET_EMAIL = getEnv('RESET_TEST_EMAIL');
const RESET_PASSWORD = getEnv('RESET_TEST_PASSWORD');
const RESET_YOP_USERNAME = RESET_EMAIL ? RESET_EMAIL.split('@')[0] : '';

function assertResetTestConfiguration() {
  if (!RESET_EMAIL || !RESET_PASSWORD) {
    throw new Error('Set RESET_TEST_EMAIL and RESET_TEST_PASSWORD in the selected .env file to run password reset tests.');
  }
  if (!RESET_EMAIL.toLowerCase().endsWith('@yopmail.com')) {
    throw new Error('RESET_TEST_EMAIL must be a YopMail inbox address because the reset tests read the email through YopMail.');
  }
}

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

    await test.step('Forgot password link is visible', async () => {
      await expect(loginPage.forgotPasswordButton).toBeVisible();
    });
  });

  test('TC_AUTH_004 — Protected page redirects unauthenticated user to login', async ({
    page, loginPage
  }) => {
    await test.step('Navigate to a protected route while logged out', async () => {
      await loginPage.navigateTo('/dashboard');
    });

    await test.step('Verify user is redirected to login page', async () => {
      await loginPage.assertLoginPageVisible();
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
    });
  });

  test('TC_AUTH_005 — Password reset link request flow', async ({
    browser
  }) => {
    assertResetTestConfiguration();
    const inboxContext = await browser.newContext();
    const appContext = await browser.newContext();
    try {
      const inboxPage = await inboxContext.newPage();
      const yopMail = new YopMailPage(inboxPage);
      await test.step('Open the configured reset test inbox', async () => {
        await yopMail.openInbox(RESET_YOP_USERNAME);
      });

      const appPage = await appContext.newPage();
      const loginPage = new LoginPage(appPage);
      await test.step('Request a reset link for the dedicated test account', async () => {
        await loginPage.navigate();
        await loginPage.requestPasswordReset(RESET_EMAIL);
        await loginPage.assertPasswordResetEmailSent();
      });

      await test.step('Verify the reset email arrives in the configured inbox', async () => {
        await yopMail.assertResetPasswordEmailVisible();
      });
    } finally {
      await Promise.all([inboxContext.close(), appContext.close()]);
    }
  });

  test('TC_AUTH_006 — Reset password via email link and login with new password', async ({
    browser
  }) => {
    assertResetTestConfiguration();
    const newPassword = RESET_PASSWORD;
    const inboxContext = await browser.newContext();
    const appContext = await browser.newContext();
    const loginContext = await browser.newContext();
    try {
      const inboxPage = await inboxContext.newPage();
      const yopMail = new YopMailPage(inboxPage);
      await test.step('Open the configured reset test inbox', async () => {
        await yopMail.openInbox(RESET_YOP_USERNAME);
      });

      const resetPage = await appContext.newPage();
      const resetLoginPage = new LoginPage(resetPage);
      await test.step('Request a reset link for the dedicated test account', async () => {
        await resetLoginPage.navigate();
        await resetLoginPage.requestPasswordReset(RESET_EMAIL);
        await resetLoginPage.assertPasswordResetEmailSent();
      });

      let resetLink;
      await test.step('Open the reset email and extract its password link', async () => {
        await yopMail.openResetPasswordEmail();
        resetLink = await yopMail.extractLinkHref('Reset My Password');
        expect(resetLink, 'Reset email should contain a password reset link').toBeTruthy();
        expect(new URL(resetLink).pathname).toContain('/reset-password/');
      });

      await test.step('Set the configured new password', async () => {
        await resetPage.goto(resetLink);
        await resetLoginPage.assertOnSetNewPasswordPage();
        await resetLoginPage.setNewPassword(newPassword);
        await resetLoginPage.assertLoginPageVisible();
      });

      await test.step('Verify the password reset confirmation email', async () => {
        await yopMail.refreshInbox();
        await yopMail.assertPasswordResetSuccessfulEmailVisible();
      });

      const freshPage = await loginContext.newPage();
      const freshLogin = new LoginPage(freshPage);
      const dashboard = new DashboardPage(freshPage);
      await test.step('Log in with the new password and verify the account dashboard', async () => {
        await freshLogin.navigate();
        await freshLogin.login(RESET_EMAIL, newPassword);
        await expect(freshPage.getByRole('heading', { name: /Good (Morning|Afternoon|Evening), .+/i })).toBeVisible();
        await expect(dashboard.hyrefastHeading).toBeVisible();
      });
    } finally {
      await Promise.all([inboxContext.close(), appContext.close(), loginContext.close()]);
    }
  });
});
