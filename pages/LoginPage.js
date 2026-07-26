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
  }

  // ─── Actions ───────────────────────────────────────────────
  async navigate() {
    await this.goto('/');
  }

  async login(email, password) {
    await this.fillInput(this.emailInput, email);
    await this.fillInput(this.passwordInput, password);
    await this.signInButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ─── Assertions ────────────────────────────────────────────
  async assertOnLoginPage() {
    await this.assertVisible(this.welcomeLogo, 'Expected to be on the login page');
  }

  async assertLoginPageVisible() {
    await expect(this.welcomeLogo).toBeVisible({ timeout: 15_000 });
  }
}

module.exports = { LoginPage };
