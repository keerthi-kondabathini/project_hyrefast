const { expect } = require('@playwright/test');
const { ExternalUserSectionPage } = require('./ExternalUserSectionPage');

/** Read-only credit balance and activity view. */
class ExternalCreditsPage extends ExternalUserSectionPage {
  constructor(page) {
    super(page);
    this.availableCreditsHeading = page.getByRole('heading', { name: /available credits/i });
    this.totalPurchasedHeading = page.getByRole('heading', { name: /total purchased/i });
    this.totalUsedHeading = page.getByRole('heading', { name: /total used/i });
    this.creditUsageHeading = page.getByRole('heading', { name: /^credit usage$/i });
    this.refreshButton = page.getByRole('button', { name: 'Refresh', exact: true });
  }

  async assertLoaded() {
    await this.openSection('credits');
    await expect(this.availableCreditsHeading).toBeVisible();
    await expect(this.totalPurchasedHeading).toBeVisible();
    await expect(this.totalUsedHeading).toBeVisible();
    await expect(this.creditUsageHeading).toBeVisible();
    await expect(this.refreshButton).toBeEnabled();
  }

  async refresh() {
    await this.refreshButton.click();
    await expect(this.availableCreditsHeading).toBeVisible();
  }
}

module.exports = { ExternalCreditsPage };
