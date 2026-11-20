const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');

/** Login page for privileged super-admin accounts (separate from regular admin auth). */
class SuperAdminLoginPage extends BasePage {
  constructor(page) {
    super(page);
    this.emailInput = page.getByLabel(/admin email/i).or(page.getByPlaceholder(/admin email/i));
    this.passwordInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
    this.submitButton = page.getByRole('button', { name: /access admin panel/i });
  }

  async navigate() {
    await this.page.goto('/super-admin/login');
    await expect(this.page.getByRole('heading', { name: /admin login/i })).toBeVisible();
  }

  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.page.waitForTimeout(2_000);
    await this.submitButton.click();
  }
}

module.exports = { SuperAdminLoginPage };
