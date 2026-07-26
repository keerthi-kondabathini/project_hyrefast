// pages/PersonalProfilePage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * PersonalProfilePage covers editing the logged-in user's profile:
 * full name, email, phone number.
 */
class PersonalProfilePage extends BasePage {
  constructor(page) {
    super(page);

    this.editBtn       = page.getByRole('button', { name: 'Edit', exact: true });
    this.fullNameInput = page.getByRole('textbox', { name: 'Full Name *' });
    this.emailInput    = page.getByRole('textbox', { name: 'Email Address *' });
    this.phoneInput    = page.getByRole('textbox', { name: 'Phone Number *' });
    this.saveBtn       = page.getByRole('button', { name: 'Save Changes' });
  }

  // ═══════════════════════════════════════════════════════
  //  Actions
  // ═══════════════════════════════════════════════════════

  /**
   * @param {{ fullName?: string, email?: string, phone?: string }} updates
   */
  async editProfile({ fullName, email, phone }) {
    await this.editBtn.click();

    if (fullName !== undefined) {
      await this.fullNameInput.click();
      await this.fullNameInput.fill(fullName);
    }
    if (email !== undefined) {
      await this.emailInput.click();
      await this.emailInput.fill(email);
    }
    if (phone !== undefined) {
      await this.phoneInput.click();
      await this.phoneInput.fill(phone);
    }

    await this.saveBtn.click();
  }

  // ═══════════════════════════════════════════════════════
  //  Assertions
  // ═══════════════════════════════════════════════════════

  async assertProfileUpdated() {
    // HyreFast shows a toast/status on successful save
    await expect(
      this.page.getByRole('status')
        .or(this.page.getByText(/updated successfully/i))
    ).toBeVisible({ timeout: 10_000 });
  }
}

module.exports = { PersonalProfilePage };