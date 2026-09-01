// pages/LoginPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

class LoginPage extends BasePage {
  constructor(page) {
    super(page);

    // Locators
    this.emailInput    = page.getByRole('textbox', { name: 'Email Address' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password' });
    this.signInButton  = page.getByRole('button', { name: 'Sign In' });
    this.welcomeLogo   = page.getByRole('link', { name: /HyreFast Logo Welcome to/ });

    // ── Forgot / reset password ───────────────────────────
    this.forgotPasswordButton = page.getByRole('button', { name: 'Forgot your password?' });
    this.resetPasswordHeading = page.getByRole('heading', { name: 'Reset Password' });
    this.resetEmailInput     = page.locator('input#forgot-email');
    this.sendResetLinkButton = page.getByRole('button', { name: /Send Reset Link/i });
    this.backToSignInButton  = page.getByRole('button', { name: 'Back to Sign In' });

    // ── Set new password page ───────────────────────────────
    this.newPasswordInput     = page.locator('input[name="newPassword"]');
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"]');
    this.resetPasswordSubmit  = page.getByRole('button', { name: 'Reset Password' });
    this.resetSuccessToast    = page.getByRole('status').filter({ hasText: /password reset|successfully/i });
  }

  // ─── Actions ───────────────────────────────────────────────
  async navigate() {
    await this.goto('/');
  }

  async navigateTo(path) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async login(email, password) {
    await this.fillInput(this.emailInput, email);
    await this.fillInput(this.passwordInput, password);
    await this.signInButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ─── Forgot / reset password actions ─────────────────────────
  async openForgotPassword() {
    await this.forgotPasswordButton.click();
    await expect(this.resetPasswordHeading).toBeVisible({ timeout: 10_000 });
  }

  async requestPasswordReset(email) {
    await this.openForgotPassword();
    await this.fillInput(this.resetEmailInput, email);
    await this.sendResetLinkButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async setNewPassword(newPassword) {
    await expect(this.newPasswordInput).toBeVisible({ timeout: 10_000 });
    await this.fillInput(this.newPasswordInput, newPassword);
    await this.fillInput(this.confirmPasswordInput, newPassword);
    await this.resetPasswordSubmit.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ─── Assertions ────────────────────────────────────────────
  async assertOnLoginPage() {
    await this.assertVisible(this.welcomeLogo, 'Expected to be on the login page');
  }

  async assertLoginPageVisible() {
    await expect(this.welcomeLogo).toBeVisible({ timeout: 15_000 });
  }

  async assertOnResetPasswordForm() {
    await expect(this.resetPasswordHeading).toBeVisible({ timeout: 10_000 });
    await expect(this.resetEmailInput).toBeVisible();
    await expect(this.sendResetLinkButton).toBeVisible();
  }

  async assertPasswordResetEmailSent() {
    // After clicking "Send Reset Link" the app returns to the Sign In tab.
    await expect(this.welcomeLogo).toBeVisible({ timeout: 15_000 });
    await expect(this.emailInput).toBeVisible();
  }

  async assertOnSetNewPasswordPage() {
    await expect(this.page.getByRole('heading', { name: 'Reset Your Password' })).toBeVisible({ timeout: 10_000 });
    await expect(this.newPasswordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.resetPasswordSubmit).toBeVisible();
  }
}

module.exports = { LoginPage };
