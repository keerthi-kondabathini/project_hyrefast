const { expect } = require('@playwright/test');
const { ExternalUserSectionPage } = require('./ExternalUserSectionPage');

/** Page object for the third-party user's profile and security page. */
class ExternalUserProfilePage extends ExternalUserSectionPage {
  constructor(page) {
    super(page);
    this.personalInformationHeading = page.getByRole('heading', { name: /personal information/i });
    this.passwordSecurityHeading = page.getByRole('heading', { name: /password & security/i });
    this.emailInput = page.getByRole('textbox', { name: /email address/i });
    this.fullNameInput = page.getByRole('textbox', { name: /full name/i });
    this.phoneInput = page.getByRole('textbox', { name: /phone number/i });
    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
    this.saveProfileButton = page.getByRole('button', { name: 'Save Changes', exact: true });
    this.passwordResetButton = page.getByRole('button', { name: /send password reset email/i });
    this.twoFactorSwitch = page.getByRole('switch');
    this.logoutButton = page.getByRole('button', { name: /log out/i });
  }

  async assertLoaded(email) {
    await expect(this.page).toHaveURL(/\/external\/profile\/?$/);
    await expect(this.personalInformationHeading).toBeVisible();
    await expect(this.passwordSecurityHeading).toBeVisible();
    await expect(this.emailInput).toHaveValue(email);

    await expect(this.sections.credits.button).toBeVisible();
    await expect(this.sections.apiKeys.button).toBeVisible();
    await expect(this.sections.brand.button).toBeVisible();
  }

  async assertProfileAndSecurityControls() {
    await this.editButton.click();
    await expect(this.fullNameInput).toBeEnabled();
    await expect(this.phoneInput).toBeEnabled();
    await expect(this.saveProfileButton).toBeDisabled();
    await this.cancelButton.click();

    // Confirm these controls are available without triggering email or security changes.
    await expect(this.passwordResetButton).toBeEnabled();
    await expect(this.twoFactorSwitch).toBeVisible();
    await expect(this.twoFactorSwitch).toBeEnabled();
  }

  async updateFullName(name) {
    const currentName = await this.fullNameInput.inputValue();
    if (!(await this.fullNameInput.isEnabled())) {
      if (currentName === name) return;
      await this.editButton.click();
    }
    if (currentName === name) {
      await this.cancelButton.click();
      return;
    }
    await this.fullNameInput.fill(name);
    await this.saveProfileButton.click();
    await expect(this.fullNameInput).toBeDisabled();
    await expect(this.fullNameInput).toHaveValue(name);
  }

  async logout() {
    await this.logoutButton.click();
    await expect(this.page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  }
}

module.exports = { ExternalUserProfilePage };
