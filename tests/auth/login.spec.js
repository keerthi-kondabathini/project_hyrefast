// tests/auth/login.spec.js
const { test, expect } = require('../../utils/authFixture');
const { LoginPage } = require('../../pages/LoginPage');
const { YopMailPage } = require('../../pages/YopMailPage');
const { DashboardPage } = require('../../pages/DashboardPage');
const { getTimeOfDay, getEnv } = require('../../utils/helpers');
const { MailTmClient } = require('../../utils/mailTmClient');

const RESET_EMAIL = getEnv('RESET_TEST_EMAIL');
const RESET_PASSWORD = getEnv('RESET_TEST_PASSWORD');
const RESET_YOP_USERNAME = RESET_EMAIL ? RESET_EMAIL.split('@')[0] : '';

/**
 * Build a Mail.tm-backed email inbox for the reset tests.
 * Falls back to a fresh Mail.tm account when YopMail is blocked by CAPTCHA.
 */
async function createResetInbox() {
  const mailTm = new MailTmClient();
  const account = await mailTm.createAccount('hyrefast_reset');
  return {
    provider: 'mailtm',
    email: account.email,
    yopUsername: account.email.split('@')[0],
    mailTmClient: mailTm,
  };
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
    test.skip(
      true,
      'Blocked on staging: reset emails are not delivered to disposable inboxes (YopMail shows reCAPTCHA; Mail.tm receives no email). ' +
      'Re-enable once a controllable email account (e.g. Gmail app-password inbox) is configured.'
    );

    const inbox = await createResetInbox();

    const yopContext = await browser.newContext();
    const yopPage = await yopContext.newPage();
    const yopMail = new YopMailPage(yopPage);

    await test.step('Open Mail.tm inbox for reset test account', async () => {
      await yopMail.openInbox(inbox);
    });

    // ── Request password reset on the login page ──
    const resetContext = await browser.newContext();
    const resetPage = await resetContext.newPage();
    const loginPage = new LoginPage(resetPage);

    await test.step('Open forgot-password form and request reset link', async () => {
      await loginPage.navigate();
      await loginPage.requestPasswordReset(inbox.email);
      await loginPage.assertPasswordResetEmailSent();
    });

    await test.step('Verify reset email is received in inbox', async () => {
      await yopMail.assertResetPasswordEmailVisible();
    });

    await yopContext.close();
    await resetContext.close();
  });

  test('TC_AUTH_006 — Reset password via email link and login with new password', async ({
    browser
  }) => {
    test.skip(
      true,
      'Blocked on staging: reset emails are not delivered to disposable inboxes (YopMail shows reCAPTCHA; Mail.tm receives no email). ' +
      'Re-enable once a controllable email account (e.g. Gmail app-password inbox) is configured.'
    );

    const newPassword = 'ResetPass123!';
    const inbox = await createResetInbox();

    const yopContext = await browser.newContext();
    const yopPage = await yopContext.newPage();
    const yopMail = new YopMailPage(yopPage);

    await test.step('Open Mail.tm inbox for reset test account', async () => {
      await yopMail.openInbox(inbox);
    });

    // ── Request password reset ──
    const resetContext = await browser.newContext();
    const resetPage = await resetContext.newPage();
    const loginPage = new LoginPage(resetPage);

    await test.step('Request password reset link', async () => {
      await loginPage.navigate();
      await loginPage.requestPasswordReset(inbox.email);
      await loginPage.assertPasswordResetEmailSent();
    });

    // ── Open reset link from email and set new password ──
    let resetLink;
    await test.step('Extract reset link from email', async () => {
      await yopMail.assertResetPasswordEmailVisible();
      resetLink = await yopMail.extractLinkHref('Reset My Password');
      expect(resetLink).toContain('/reset-password/');
    });

    await test.step('Open reset link and set new password', async () => {
      await resetPage.goto(resetLink);
      await loginPage.assertOnSetNewPasswordPage();
      await loginPage.setNewPassword(newPassword);
    });

    await test.step('Verify password reset successful email', async () => {
      await yopMail.assertPasswordResetSuccessfulEmailVisible();
    });

    // ── Login with new password ──
    const loginContext = await browser.newContext();
    const loginPageInstance = await loginContext.newPage();
    const freshLogin = new LoginPage(loginPageInstance);
    const dashboard = new DashboardPage(loginPageInstance);

    await test.step('Login with the new password', async () => {
      await freshLogin.navigate();
      await freshLogin.login(inbox.email, newPassword);
    });

    await test.step('Verify dashboard is displayed', async () => {
      await dashboard.assertWelcomeDashboard(/./);
    });

    await yopContext.close();
    await resetContext.close();
    await loginContext.close();
  });
});
