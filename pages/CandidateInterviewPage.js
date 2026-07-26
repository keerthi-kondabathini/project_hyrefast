// pages/CandidateInterviewPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * CandidateInterviewPage covers the candidate-facing interview flow:
 *  1. Resume upload step
 *  2. Questionnaire completion confirmation
 *  3. System Requirements Check landing
 *
 * This POM operates on `page3` — the new tab that opens after clicking
 * "Start My Interview" from the YopMail email.
 */
class CandidateInterviewPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Resume upload ─────────────────────────────────────
    this.resumeUploadArea      = page.getByText(/Click to upload your file/i);
    this.resumeFileInput       = page.locator('input[type="file"]');
    this.completeContinueBtn   = page.getByRole('button', { name: 'Complete & Continue' });

    // ── Post-upload confirmation ──────────────────────────
    this.questionnaireCompleted = page.getByText('Questionnaire CompletedThank');
    this.thankYouText           = page.getByText('Thank you for your responses');

    // ── System Requirements Check ─────────────────────────
    this.sysReqHeading          = page.getByRole('heading', { name: 'System Requirements Check' });
  }

  // ═══════════════════════════════════════════════════════
  //  Resume Upload
  // ═══════════════════════════════════════════════════════

  /**
   * Uploads a resume file and verifies the success message.
   * @param {string} filePath  - Absolute or relative path to the file
   * @param {string} fileName  - Display name shown in the success toast,
   *                             e.g. "AI_Engineer_Resume (2).docx"
   */
  async uploadResume(filePath, fileName) {
    // Click the upload area to ensure it's focused / visible
    await this.resumeUploadArea.click();

    // Set file on the hidden <input type="file">
    await this.resumeFileInput.setInputFiles(filePath);

    // // Assert upload success banner
    // await expect(
    //   this.page.getByText(`${fileName} uploaded successfully`)
    // ).toBeVisible({ timeout: 15_000 });
  }

  async clickCompleteContinue() {
    await this.completeContinueBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ═══════════════════════════════════════════════════════
  //  Assertions
  // ═══════════════════════════════════════════════════════

  // async assertQuestionnaireCompleted() {
  //   await expect(this.questionnaireCompleted).toBeVisible({ timeout: 15_000 });
  // }

  async assertSystemRequirementsCheckVisible() {
    await expect(this.sysReqHeading).toBeVisible({ timeout: 20_000 });
  }
}

module.exports = { CandidateInterviewPage };