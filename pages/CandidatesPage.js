// pages/CandidatesPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * CandidatesPage covers:
 *  - Searching for a job and entering the Candidates view
 *  - Adding candidates via email (bulk invite)
 *  - Adding candidates via resume file upload
 *  - Verifying application count changes
 *  - Storing and re-navigating to the candidates URL
 */
class CandidatesPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Job search (on dashboard / jobs list) ─────────────
    this.jobSearchInput   = page.getByRole('textbox', { name: 'Search by job name or ID' });
    this.viewCandidatesBtn = page.getByRole('button', { name: 'View Candidates' });

    // ── Applications header ───────────────────────────────
    this.applicationsHeading = (jobTitle) =>
      page.getByRole('heading', { name: new RegExp(`${jobTitle}`, 'i') });

    // ── Candidate count badge ─────────────────────────────
    // e.g. the "2Applied" text or the numbered badge "1", "2"
    this.appliedCountText  = (count) => page.getByText(`${count}Applied`);
    this.candidateCountBadge = (count) =>
      page.locator('div').filter({ hasText: new RegExp(`^${count}$`) });

    // ── Add Candidates panel ──────────────────────────────
    this.addCandidatesBtn     = page.getByRole('button', { name: 'Add Candidates' });
    this.emailTab             = page.getByRole('tab',   { name: 'Email' });
    this.fileUploadTab        = page.getByRole('tab',   { name: 'File Upload' });
  this.resumeFileInput = page.locator('input[type="file"]');

    // Email flow
    this.emailInput           = page.getByRole('textbox', { name: 'Enter email addresses' });
    this.addCandidateCountBtn = (n) => page.getByRole('button', { name: `Add ${n} Candidate(s)` });
    this.createAndSendEmailBtn = page.getByRole('button', { name: 'Create & Send Email' });
    this.createWithoutEmailBtn = page.getByRole('button', { name: 'Create without Email' });
    this.bulkCreatedText      = (n) => page.getByText(`Bulk created ${n} applications.`, { exact: true });

    // File upload flow
    this.chooseResumeFilesBtn  = page.getByRole('button', { name: 'Choose Resume Files' });
    this.importResumesBtn      = page.getByRole('button', { name: 'Import Selected Resumes' });
    this.sendNowBtn            = page.getByRole('button', { name: 'Send Now' });
    this.sendLaterBtn          = page.getByRole('button', { name: 'I\'ll Send Later' });
  }

  // ═══════════════════════════════════════════════════════
  //  Navigation
  // ════════════════════════════════════════════

  async searchAndOpenCandidates(jobTitle) {
    await this.fillInput(this.jobSearchInput, jobTitle);
    await this.page.waitForTimeout(1500); // debounce
    await this.viewCandidatesBtn.first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async assertApplicationsPageOpen(jobTitle) {
    await this.assertVisible(
      this.applicationsHeading(jobTitle),
      `Expected Applications heading for "${jobTitle}"`
    );
  }

  /**
   * Captures and returns the current page URL (candidates page URL).
   * Use this to navigate back after leaving the page.
   */
  getCandidatesPageUrl() {
    return this.page.url();
  }

  async navigateToUrl(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  // ═══════════════════════════════════════════════════════
  //  Count helpers
  // ═══════════════════════════════════════════════════════

  /**
   * Returns the numeric candidate count shown on the page.
   * Reads the "NApplied" text pattern, e.g. "3Applied" → 3
   */
  async getCandidateCount() {
    // Try "NApplied" format first
    const text = await this.page.locator('text=/\\d+Applied/').first().innerText().catch(() => null);
    if (text) {
      const match = text.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    }
    return 0;
  }

  async assertCandidateCount(expected) {
    await expect(this.appliedCountText(expected)).toBeVisible({ timeout: 15_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Add via Email
  // ═══════════════════════════════════════════════════════

  /**
   * @param {string[]} emails - Array of email addresses
   * @param {'now' | 'later'} sendTiming
   */
  async addCandidatesByEmail(emails, sendTiming = 'now') {
    await this.addCandidatesBtn.click();

    // Enter emails (comma-separated or single)
    await this.fillInput(this.emailInput, emails.join(', '));

    // Click "Add N Candidate(s)"
    await this.addCandidateCountBtn(emails.length).click();

    // Wait for confirmation dialog to appear
    await this.page.waitForTimeout(2000);

    // Check which button is available - "Send Now" or "Create & Send Email"
    const sendNowVisible = await this.sendNowBtn.count() > 0;
    const createEmailVisible = await this.createAndSendEmailBtn.count() > 0;

    if (sendNowVisible) {
      await this.sendNowBtn.click();
    } else if (createEmailVisible) {
      await this.createAndSendEmailBtn.click();
    } else {
      throw new Error('Neither "Send Now" nor "Create & Send Email" button is visible');
    }

    // // Assert bulk creation success toast
    // await this.assertVisible(
    //   this.bulkCreatedText(emails.length),
    //   `Expected "Bulk created ${emails.length} applications." toast`
    // );
  }

  // ═══════════════════════════════════════════════════════
  //  Add via Resume Upload
  // ═══════════════════════════════════════════════════════

  /**
   * @param {string} filePath   - Absolute or relative path to the resume file
   * @param {'now' | 'later'} sendTiming
   */
  async addCandidateByResume(filePath, sendTiming = 'now') {
    await this.addCandidatesBtn.click();
    await this.fileUploadTab.click();

    // 👇 Click button to ensure input is available
    await this.chooseResumeFilesBtn.click();

    // 👇 Use FIRST visible file input
    const fileInput = this.page.locator('input[type="file"]').first();

    await fileInput.waitFor({ state: 'attached' });

    // 👇 Use SAME path passed from test
    await fileInput.setInputFiles(filePath);

    await this.importResumesBtn.click();

    // Wait for confirmation dialog to appear
    await this.page.waitForTimeout(2000);

    // Check which button is available - "Send Now" or "Create & Send Email"
    const sendNowVisible = await this.sendNowBtn.count() > 0;
    const createEmailVisible = await this.createAndSendEmailBtn.count() > 0;

    if (sendTiming === 'now') {
      if (sendNowVisible) {
        await this.sendNowBtn.click();
      } else if (createEmailVisible) {
        await this.createAndSendEmailBtn.click();
      } else {
        throw new Error('Neither "Send Now" nor "Create & Send Email" button is visible');
      }
    } else {
      await this.sendLaterBtn.click();
    }

    // await this.assertVisible(
    //   this.bulkCreatedText(1),
    //   'Expected "Bulk created 1 applications." toast'
    // );
  }
}

module.exports = { CandidatesPage };
