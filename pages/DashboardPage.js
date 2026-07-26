// pages/DashboardPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

class DashboardPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Header / greeting (FIXED) ─────────────────────────
    this.welcomeHeading = (userName) =>
      page.getByRole('heading', {
        name: new RegExp(`Good (Morning|Afternoon|Evening), ${userName}`, 'i')
      });
this.logoutLink = page.getByRole('menuitem', { name: /log out/i });
    this.hyrefastHeading = page.getByRole('heading', { name: 'Hyrefast' });

    // ── User menu ─────────────────────────────────────────
this.companyLogoButton = page
  .getByRole('button')
  .filter({ hasText: 'G' })
  // ── CTA ───────────────────────────────────────────────
    this.createJobButton = page.getByRole('button', { name: 'Create Job' });
    this.searchJobInput  = page.getByRole('textbox', { name: 'Search by job name or ID' });
  }

  // ─── Actions ───────────────────────────────────────────
  async logout() {
    await this.companyLogoButton.click();
    await this.logoutLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickCreateJob() {
    await this.createJobButton.click();
  }

  async searchJob(query) {
    await this.fillInput(this.searchJobInput, query);
    await this.waitMs(1500); // debounce
  }

  // ─── Assertions ────────────────────────────────────────
  async assertWelcomeDashboard(userName) {
    await this.assertVisible(
      this.welcomeHeading(userName),
      'User name not visible on dashboard'
    );

    await this.assertVisible(
      this.hyrefastHeading,
      'Hyrefast heading not visible'
    );
  }

  async getPublishedJobsCount() {
    return this.extractCount('Published Jobs');
  }

  async assertPublishedJobsCount(expectedCount) {
    // Find the Published Jobs card (first stats card) and verify the count inside it
    const card = this.page.locator('div').filter({ hasText: /Published Jobs/i }).first();
    await expect(card.locator('p').filter({ hasText: String(expectedCount) })).toBeVisible({ timeout: 15_000 });
  }

  // ─── Job deletion helpers ────────────────────────────────
  async openJobActionsMenu() {
    const kebab = this.page.locator('#jobs-section').getByRole('button').filter({ hasText: /^$/ });
    await kebab.first().click();
  }

  async deleteJob(jobTitle) {
    await this.searchJob(jobTitle);
    await this.openJobActionsMenu();
    await this.page.getByRole('menuitem', { name: 'Delete Job' }).click();
    await this.page.getByRole('button', { name: 'Delete Job' }).click();
    await expect(this.page.getByRole('status')).toBeVisible({ timeout: 15_000 });
    await this.page.getByRole('status').click();
  }

  async assertJobNotFound(jobTitle) {
    await this.searchJob(jobTitle);
    await expect(this.page.getByRole('heading', { name: 'No matching jobs found' })).toBeVisible({ timeout: 15_000 });
  }
}

module.exports = { DashboardPage };