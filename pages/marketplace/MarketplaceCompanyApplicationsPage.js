const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');
const { LoginPage } = require('../LoginPage');

const STAGING_ORIGIN = 'https://staging.hyrefast.ai';

/** Page object for the company-side applications list used by status sync tests. */
class MarketplaceCompanyApplicationsPage extends BasePage {
  constructor(page) {
    super(page);
    this.loginPage = new LoginPage(page);
  }

  async signIn(email, password) {
    await this.page.goto(STAGING_ORIGIN);
    if (await this.loginPage.emailInput.isVisible().catch(() => false)) {
      await this.loginPage.login(email, password);
      await expect(this.loginPage.emailInput).toBeHidden({ timeout: 20_000 });
    }
  }

  async openJob(jobId, jobTitle, credentials) {
    this.currentJob = { jobId, jobTitle, credentials };
    await this.signIn(credentials.email, credentials.password);
    await this.page.goto(`${STAGING_ORIGIN}/job/${jobId}/applications`);
    if (await this.loginPage.emailInput.isVisible().catch(() => false)) {
      await this.loginPage.login(credentials.email, credentials.password);
      await expect(this.loginPage.emailInput).toBeHidden({ timeout: 20_000 });
      await this.page.goto(`${STAGING_ORIGIN}/job/${jobId}/applications`);
    }
    await expect(this.page.getByRole('heading', { name: jobTitle, exact: true })).toBeVisible();
  }

  applicationRow(email) {
    return this.page.getByRole('row').filter({ hasText: email });
  }

  async shortlistApplication(email) {
    const row = this.applicationRow(email);
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Open actions' }).click();
    await this.page.getByText('Shortlist', { exact: true }).click();
    await expect(this.page.getByRole('heading', { name: 'Shortlist Candidate' })).toBeVisible();
    await this.page.getByRole('button', { name: 'Yes, Shortlist' }).click();
    await expect(row).toContainText('Shortlisted');
  }

  async deleteApplicationIfPresent(email) {
    if (!this.currentJob) throw new Error('Open a company job before deleting an application');
    const { jobId, jobTitle, credentials } = this.currentJob;
    await this.openJob(jobId, jobTitle, credentials);
    const row = this.applicationRow(email);
    if (!(await row.count())) return;

    await row.getByRole('button', { name: 'Open actions' }).click();
    await this.page.getByText('Delete Application', { exact: true }).click();
    await expect(this.page.getByRole('heading', { name: 'Delete Candidate Application' })).toBeVisible();
    await expect(this.page.getByText('This action cannot be undone.')).toBeVisible();
    await this.page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(row).toHaveCount(0);
  }
}

module.exports = { MarketplaceCompanyApplicationsPage };
