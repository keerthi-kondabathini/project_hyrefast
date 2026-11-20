const { expect } = require('@playwright/test');
const { ExternalUserSectionPage } = require('./ExternalUserSectionPage');

/** Branding form for the external user's workspace. */
class ExternalBrandAppearancePage extends ExternalUserSectionPage {
  constructor(page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Brand & Appearance', exact: true });
    this.brandNameInput = page.getByRole('textbox', { name: 'Brand name' });
    this.primaryColorInput = page.getByRole('textbox', { name: 'Primary color', exact: true });
    this.logoUrlInput = page.getByRole('textbox', { name: 'Logo URL' });
    this.saveButton = page.getByRole('button', { name: 'Save changes', exact: true });
    this.resetButton = page.getByRole('button', { name: 'Reset to default', exact: true });
    this.domainInput = page.getByRole('textbox').last();
  }

  async assertLoaded() {
    await this.openSection('brand');
    await expect(this.heading).toBeVisible();
    await expect(this.brandNameInput).toBeVisible();
    await expect(this.primaryColorInput).toBeVisible();
    await expect(this.logoUrlInput).toBeVisible();
    await expect(this.domainInput).toBeVisible();
    await expect(this.saveButton).toBeVisible();
    await expect(this.resetButton).toBeEnabled();
  }

  async currentAppearance() {
    return {
      name: await this.brandNameInput.inputValue(),
      color: await this.primaryColorInput.inputValue(),
      logoUrl: await this.logoUrlInput.inputValue(),
    };
  }

  async save() {
    await this.saveButton.click();
    await expect(this.saveButton).toBeDisabled();
  }
}

module.exports = { ExternalBrandAppearancePage };
