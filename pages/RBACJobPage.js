
// pages/RBACJobPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { JDCreationPage } = require('./JDCreationPage');

/**
 * RBACJobPage — JD creation and candidate visibility checks per role.
 *
 * Covers:
 *  - Owner/Admin: full publish flow
 *  - Team Lead: full publish flow
 *  - Member: "Request to Publish" flow (requires approver selection)
 *  - Candidate visibility: member sees only their own, lead/admin sees all in team
 */
class RBACJobPage extends BasePage {
  constructor(page) {
    super(page);

    // Use JDCreationPage for JD creation flow
    this.jdCreation = new JDCreationPage(page);

    // ── Dashboard ─────────────────────────────────────────
    this.createJobBtn    = page.getByRole('button', { name: 'Create Job' });
    this.jobSearchInput  = page.getByRole('textbox', { name: 'Search by job name or ID' });

    // ── Step 2: Skills ────────────────────────────────────
    this.acceptSkillsBtn = page.getByRole('button', { name: /Accept Skills/i });

    // ── Step 3/4: Navigate forward ────────────────────────
    this.nextStageBtn    = page.getByRole('button', { name: 'Next Stage' });

    // ── Publish actions (owner/admin/team lead) ───────────
    this.publishNowOption  = page.getByRole('option', { name: 'Publish Now' });
    this.saveLinksBtn      = page.getByRole('button', { name: 'Save & Generate Links' });

    // ── Member: Request to Publish ────────────────────────
    this.requestToPublishBtn   = page.getByRole('button', { name: 'Request to Publish' });
    this.approverCombo         = page.getByRole('combobox', { name: 'Approver' });
    this.noteInput             = page.getByRole('textbox', { name: 'Note (optional)' });
    this.confirmRequestBtn     = page.getByRole('button', { name: 'Confirm & Request Publish' });
    this.publishRequestedToast = page.getByText('Publish request submitted');
    this.savedAsDraftText      = page.getByText('Job saved as draft, publish');

    // ── Candidates view ───────────────────────────────────
    this.viewCandidatesBtn = page.getByRole('button', { name: 'View Candidates' });
    this.addCandidatesBtn  = page.getByRole('button', { name: 'Add Candidates' });
    this.emailInput        = page.getByRole('textbox', { name: 'Enter email addresses' });
  }

  // ═══════════════════════════════════════════════════════
  //  JD creation using JDCreationPage
  // ═══════════════════════════════════════════════════════

  /**
   * Create a JD and proceed through skills + interview steps just enough
   * to reach the final publish / request-to-publish page.
   *
   * @param {string} jobTitle
   * @param {string} workspaceName  - workspace selector in step 1
   */
  async createJDToPublishStep(jobTitle, workspaceName) {
    await this.createJobBtn.click();
    await expect(this.page.getByText('JD & DetailsJob title, JD')).toBeVisible({ timeout: 15_000 });

    // Use JDCreationPage for the JD creation flow
    await this.jdCreation.fillJobDetails({
      jobTitle,
      workspaceName,
      employmentType: 'Full-time',
      workMode: 'On-site',
      locationQuery: 'San Francisco',
      locationOption: 'San Francisco, CA, USA'
    });

    // Wait for JD generation and proceed to skills
    await this.jdCreation.waitForJDGeneration();
    await this.jdCreation.proceedToSkills();
    await this.jdCreation.waitForSkillGeneration();

    // Accept skills
    await this.jdCreation.acceptSkillsAndGenerate();

    // Navigate through interview config stages
    await this.jdCreation.configureInterview();

    // Generate questions
    await this.jdCreation.generateQuestions();

    // Final step to publish
    await this.jdCreation.nextStageButton.click();
    await this.page.waitForTimeout(2000);
  }

  // ── Owner / Admin / Team Lead: publish ─────────────────
  async publishJD() {
    // Select Publish Now from the dropdown
    const publishCombo = this.page.getByRole('combobox').filter({ hasText: /Publish Now|Save as Draft/i }).first();
    if (await publishCombo.isVisible({ timeout: 5000 }).catch(() => false)) {
      await publishCombo.click();
      await this.publishNowOption.click();
    }

    // Set closing date (30 days from now)
    const dateInput = this.page.locator('input[type="date"]');
    if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      await dateInput.fill(future.toISOString().split('T')[0]);
    }

    // Save & Generate Links
    if (await this.saveLinksBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.saveLinksBtn.click();
      await expect(this.page.getByRole('status')).toBeVisible({ timeout: 15_000 });
    }
  }

  // ── Team Member: request to publish ───────────────────
  /**
   * @param {string} approverText - Visible option text for the approver
   * @param {string} note         - Optional note text
   */
  async requestToPublish(approverText, note = 'Please approve this JD') {
    await expect(this.requestToPublishBtn).toBeVisible({ timeout: 10_000 });
    await this.requestToPublishBtn.click();

    await this.approverCombo.click();
    await this.page.getByText(approverText).click();

    if (note) {
      await this.noteInput.click();
      await this.noteInput.fill(note);
    }

    await expect(this.page.getByRole('heading', { name: 'Select an Approver' })).toBeVisible();
    await expect(this.page.getByText('Choose a Team Lead, Admin, or')).toBeVisible();

    await this.confirmRequestBtn.click();
    await expect(this.publishRequestedToast).toBeVisible({ timeout: 15_000 });
    await expect(this.savedAsDraftText).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Candidate visibility
  // ═══════════════════════════════════════════════════════

  async openCandidatesForJob(jobTitle) {
    await this.goto('/dashboard');
    await this.jobSearchInput.fill(jobTitle);
    await this.page.waitForTimeout(1500);
    await this.viewCandidatesBtn.first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async addCandidateByEmail(email) {
    await this.addCandidatesBtn.click();
    await this.emailInput.fill(email);
    await this.page.getByRole('button', { name: 'Add 1 Candidate(s)' }).click();
    await this.page.getByRole('button', { name: 'Create & Send Email' }).click();
    await expect(this.page.getByText('Candidates Added Successfully')).toBeVisible({ timeout: 15_000 });
  }

  async assertCandidateVisible(email) {
    await expect(this.page.getByText(email)).toBeVisible({ timeout: 10_000 });
  }

  async assertCandidateNotVisible(email) {
    await expect(this.page.getByText(email)).not.toBeVisible({ timeout: 5_000 });
  }

  async getCandidateCount() {
    const text = await this.page.locator('text=/\\d+Applied/').first().innerText().catch(() => '0Applied');
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

module.exports = { RBACJobPage };
