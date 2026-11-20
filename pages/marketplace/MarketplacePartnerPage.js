const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');

const MARKETPLACE_ORIGIN = 'https://marketplace.hyrefast.ai';

/** Page object for the recruitment partner Marketplace dashboard. */
class MarketplacePartnerPage extends BasePage {
  constructor(page) {
    super(page);
    this.jobsLink = page.getByRole('link', { name: 'Jobs', exact: true });
    this.submissionsLink = page.getByRole('link', { name: 'Submissions', exact: true });
    this.profileLink = page.getByRole('link', { name: 'Profile', exact: true });
    this.liveJobsHeading = page.getByRole('heading', { name: /live jobs/i });
    this.jobSearchInput = page.getByPlaceholder(/search title, company, location/i);
    this.submitCandidateButton = page.getByRole('button', { name: 'Submit a candidate' });
  }

  async signIn(email, password) {
    await this.page.goto(`${MARKETPLACE_ORIGIN}/auth/login`);
    const emailInput = this.page.locator('input[type="email"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(email);
      await this.page.locator('input[type="password"]').first().fill(password);
      await this.page.getByRole('button', { name: /log in|sign in/i }).click();
    }
    await expect(this.jobsLink).toBeVisible();
  }

  async openJobs() {
    await this.page.goto(`${MARKETPLACE_ORIGIN}/jobs`);
    await expect(this.liveJobsHeading).toBeVisible();
  }

  jobLink(title) {
    return this.page.getByRole('link', { name: new RegExp(title, 'i') }).first();
  }

  async openJob(jobId) {
    await this.page.goto(`${MARKETPLACE_ORIGIN}/jobs/${jobId}`);
  }

  async searchJobs(query) {
    await this.jobSearchInput.fill(query);
  }

  async openCandidateForm() {
    await this.submitCandidateButton.click();
    const form = this.page.getByRole('dialog', { name: 'Submit a candidate' });
    await expect(form).toBeVisible();
    return form;
  }

  async prepareCandidateSubmission({ name, email, phone, notes, resumeBuffer }) {
    const form = await this.openCandidateForm();
    await form.getByLabel('Candidate name').fill(name);
    await form.getByLabel('Email').fill(email);
    await form.getByLabel('Phone').fill(phone);
    await form.getByPlaceholder('Why is this candidate a great fit?').fill(notes);
    await form.locator('input[type="file"]').setInputFiles({
      name: 'marketplace-qa-candidate.pdf',
      mimeType: 'application/pdf',
      buffer: resumeBuffer,
    });
    await form.getByRole('checkbox', { name: /candidate consented/i }).check();
    return form;
  }

  async confirmCandidateSubmission(form) {
    await form.getByRole('button', { name: 'Submit candidate' }).click();
  }

  async openSubmissions() {
    await this.page.goto(`${MARKETPLACE_ORIGIN}/dashboard`);
    await expect(this.page.getByRole('heading', { name: 'Your submissions' })).toBeVisible();
  }

  submissionRow(email) {
    return this.page.getByRole('row').filter({ hasText: email });
  }

  async openProfile() {
    await this.page.goto(`${MARKETPLACE_ORIGIN}/profile`);
    await expect(this.page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
  }

  get fullNameInput() {
    return this.page.getByLabel('Full name');
  }

  get emailInput() {
    return this.page.getByLabel('Email');
  }

  async saveFullName(name) {
    await this.fullNameInput.fill(name);
    await this.page.getByRole('button', { name: /save changes/i }).click();
  }
}

module.exports = { MarketplacePartnerPage };
