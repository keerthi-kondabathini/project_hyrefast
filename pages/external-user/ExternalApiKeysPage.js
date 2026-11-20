const { expect } = require('@playwright/test');
const { ExternalUserSectionPage } = require('./ExternalUserSectionPage');

/** API-key list and lifecycle actions for the external user. */
class ExternalApiKeysPage extends ExternalUserSectionPage {
  constructor(page) {
    super(page);
    this.generateHeading = page.getByRole('heading', { name: /generate api key/i });
    this.keysHeading = page.getByRole('heading', { name: /your api keys/i });
    this.keyNameInput = page.getByRole('textbox', { name: 'Key name' });
    this.expiresInput = page.getByLabel('Expires (optional)');
    this.generateButton = page.getByRole('button', { name: 'Generate', exact: true });
    this.rows = page.getByRole('row');
  }

  async assertLoaded() {
    await this.openSection('apiKeys');
    await expect(this.generateHeading).toBeVisible();
    await expect(this.keysHeading).toBeVisible();
    await expect(this.keyNameInput).toBeVisible();
    await expect(this.expiresInput).toBeVisible();
    await expect(this.generateButton).toBeEnabled();
    await expect(this.rows.first()).toBeVisible();
  }

  keyRow(name) {
    return this.rows.filter({ hasText: name });
  }

  async createKey(name) {
    await this.keyNameInput.fill(name);
    await this.generateButton.click();
    const resultDialog = this.page.getByRole('dialog').or(this.page.getByRole('alertdialog'));
    if (await resultDialog.count()) {
      const dismiss = resultDialog.getByRole('button', { name: /done|close|got it|okay/i });
      if (await dismiss.count()) await dismiss.last().click();
    }
    const row = this.keyRow(name);
    await expect(row).toBeVisible();
    await expect(row.getByText('active', { exact: true })).toBeVisible();
    return row;
  }

  async revokeKey(name) {
    const row = this.keyRow(name);
    await expect(row).toBeVisible();
    const acceptNativeDialog = (dialog) => dialog.accept();
    this.page.once('dialog', acceptNativeDialog);
    try {
      await row.getByRole('button', { name: 'Revoke', exact: true }).click();
      const confirmation = this.page.getByRole('alertdialog').or(this.page.getByRole('dialog'));
      if (await confirmation.count()) {
        await confirmation.getByRole('button', { name: /revoke|confirm|yes/i }).click();
      }
    } finally {
      this.page.off('dialog', acceptNativeDialog);
    }
    await expect(row.getByText('revoked', { exact: true })).toBeVisible();
  }
}

module.exports = { ExternalApiKeysPage };
