const { test, expect } = require('@playwright/test');
const { MarketplacePartnerPage } = require('../../pages/marketplace/MarketplacePartnerPage');
const { MarketplaceCompanyApplicationsPage } = require('../../pages/marketplace/MarketplaceCompanyApplicationsPage');
const { SyntheticMarketplaceResume } = require('../../utils/marketplace/SyntheticMarketplaceResume');

const STAGING_ORIGIN = 'https://staging.hyrefast.ai';
const partnerCredentials = {
  email: process.env.MARKETPLACE_PARTNER_EMAIL,
  password: process.env.MARKETPLACE_PARTNER_PASSWORD,
};
const companyCredentials = {
  email: process.env.MARKETPLACE_COMPANY_EMAIL,
  password: process.env.MARKETPLACE_COMPANY_PASSWORD,
};
const jobId = process.env.MARKETPLACE_JOB_ID;
const jobTitle = process.env.MARKETPLACE_JOB_TITLE || 'Cash Collection Team Leader';

// This suite creates only synthetic staging applications. Do not retain traces,
// screenshots, or videos that could contain candidate information.
test.use({ screenshot: 'off', video: 'off', trace: 'off' });

function assertStagingConfiguration({ requireCompany = false } = {}) {
  const baseURL = process.env.BASE_URL;
  if (!baseURL) throw new Error('Set BASE_URL to https://staging.hyrefast.ai in .env.staging');

  let origin;
  try {
    origin = new URL(baseURL).origin;
  } catch {
    throw new Error('BASE_URL must be a valid staging URL');
  }
  if (origin !== STAGING_ORIGIN) {
    throw new Error(`Marketplace CRUD tests are staging-only; received ${origin}`);
  }
  if (!partnerCredentials.email || !partnerCredentials.password) {
    throw new Error('Set MARKETPLACE_PARTNER_EMAIL and MARKETPLACE_PARTNER_PASSWORD in .env.staging');
  }
  if (!jobId) throw new Error('Set MARKETPLACE_JOB_ID to a job assigned to the test partner');
  if (requireCompany && (!companyCredentials.email || !companyCredentials.password)) {
    throw new Error('Set MARKETPLACE_COMPANY_EMAIL and MARKETPLACE_COMPANY_PASSWORD for the staging company account');
  }
}

test.describe('Marketplace partner dashboard (staging only)', () => {
  test.beforeEach(async ({ page }) => {
    assertStagingConfiguration();
    await new MarketplacePartnerPage(page).signIn(
      partnerCredentials.email,
      partnerCredentials.password,
    );
  });

  test('assigned jobs open, and search returns an empty state for no matches', async ({ page }) => {
    const partner = new MarketplacePartnerPage(page);
    await partner.openJobs();

    const jobLink = partner.jobLink(jobTitle);
    await expect(jobLink).toBeVisible();
    await jobLink.click();
    await expect(page.getByRole('heading', { name: jobTitle, exact: true })).toBeVisible();
    await expect(partner.submitCandidateButton).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hiring stages' })).toBeVisible();

    await partner.openJobs();
    await partner.searchJobs(`no-match-${Date.now()}`);
    await expect(page.getByText(/no open jobs match your search/i)).toBeVisible();
  });

  test('candidate form blocks submission when required fields are blank', async ({ page }) => {
    const partner = new MarketplacePartnerPage(page);
    await partner.openJob(jobId);
    const form = await partner.openCandidateForm();
    await form.getByRole('button', { name: 'Submit candidate' }).click();

    const candidateName = form.getByLabel('Candidate name');
    expect(await candidateName.evaluate((element) => element.validity.valueMissing)).toBe(true);
    await expect(form.getByRole('checkbox', { name: /candidate consented/i })).not.toBeChecked();
  });

  test('partner profile update persists and can be restored', async ({ page }) => {
    // Known staging regression: saving the partner profile currently returns 404.
    test.fail(true, 'Known staging issue: Marketplace partner profile save returns HTTP 404');
    const partner = new MarketplacePartnerPage(page);
    await partner.openProfile();

    const originalName = await partner.fullNameInput.inputValue();
    const changedName = `Marketplace QA ${Date.now()}`;
    await expect(partner.emailInput).toBeDisabled();

    try {
      await partner.saveFullName(changedName);
      await expect(partner.fullNameInput).toHaveValue(changedName);
      await page.reload();
      await expect(partner.fullNameInput).toHaveValue(changedName);
    } finally {
      await page.reload();
      if (await partner.fullNameInput.inputValue() !== originalName) {
        await partner.saveFullName(originalName);
        await expect(partner.fullNameInput).toHaveValue(originalName);
      }
    }
  });

  test('synthetic submission is visible to the company, status syncs, and cleanup deletes it', async ({ page }, testInfo) => {
    assertStagingConfiguration({ requireCompany: true });
    const partner = new MarketplacePartnerPage(page);
    const company = new MarketplaceCompanyApplicationsPage(page);
    const runId = Date.now();
    const candidateEmail = `marketplace.qa.${runId}-${testInfo.workerIndex}-${testInfo.retry}@example.com`;
    const phoneNumber = 2_000_000_000 + Math.floor(runId / 1_000);
    let submitted = false;

    try {
      await partner.openJob(jobId);
      await expect(page.getByRole('heading', { name: jobTitle, exact: true })).toBeVisible();
      const form = await partner.prepareCandidateSubmission({
        name: `Marketplace QA ${Date.now()}`,
        email: candidateEmail,
        phone: `+1${phoneNumber}`,
        notes: 'SYNTHETIC QA DATA ONLY. Not a real candidate; created for staging status-sync coverage.',
        resumeBuffer: SyntheticMarketplaceResume.createBuffer(),
      });

      // Set before submitting so cleanup still checks the company portal if the
      // browser action times out after the server has accepted the application.
      submitted = true;
      await partner.confirmCandidateSubmission(form);

      await partner.openSubmissions();
      let partnerRow = partner.submissionRow(candidateEmail);
      await expect(partnerRow).toBeVisible();
      await expect(partnerRow).toContainText(jobTitle);
      await expect(partnerRow).toContainText(/submitted/i);

      await company.openJob(jobId, jobTitle, companyCredentials);
      const companyRow = company.applicationRow(candidateEmail);
      await expect(companyRow).toBeVisible();
      await expect(companyRow).toContainText(/added via marketplace/i);

      await company.shortlistApplication(candidateEmail);
      await partner.openSubmissions();
      partnerRow = partner.submissionRow(candidateEmail);
      await expect(partnerRow).toBeVisible();
      await expect(partnerRow).toContainText('Shortlisted');

      await company.deleteApplicationIfPresent(candidateEmail);
      submitted = false;
      await partner.openSubmissions();
      await expect(partner.submissionRow(candidateEmail)).toHaveCount(0);
    } finally {
      if (submitted) {
        await company.openJob(jobId, jobTitle, companyCredentials);
        await company.deleteApplicationIfPresent(candidateEmail);
      }
    }
  });
});
