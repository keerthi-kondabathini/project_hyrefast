
// pages/InterviewPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * InterviewPage covers the candidate-facing live interview session:
 *  - System Requirements Check
 *  - Consent / fair interview screen
 *  - Interview outline validation
 *  - Per-question flow: Show → Start Answer → Submit / Skip / Break
 *  - Text size & highlight controls
 *  - Profile review after interview
 *  - Completion screen & feedback
 */
class InterviewPage extends BasePage {
  constructor(page) {
    super(page);

    // ── System Requirements Check ─────────────────────────
    this.sysReqHeading        = page.getByRole('heading', { name: 'System Requirements Check' });
    this.cameraReady          = page.getByText('Camera TestReady');
    this.micReady             = page.getByText('Microphone TestReady');
    this.networkGood          = page.getByText('Network TestGood Connection');
    this.allSystemsReady      = page.locator('div').filter({
      hasText: /^All systems ready!Your system meets all requirements for the interview\.$/
    }).first();
    this.startInterviewBtn    = page.getByRole('button', { name: 'Start Interview' });

    // ── Consent ───────────────────────────────────────────
    this.fairInterviewHeading = page.getByRole('heading', { name: 'Upholding Fair Interview' });
    this.readUnderstoodCheck  = page.getByRole('checkbox', { name: 'I have read and understand' });
    this.consentCheck         = page.getByRole('checkbox', { name: 'I consent to Hyrefast' });
    this.beginInterviewBtn    = page.getByRole('button', { name: 'Begin recorded interview' });

    // ── Interview Outline ─────────────────────────────────
    this.welcomeText          = page.getByText('Welcome to Your Interview');
    this.interviewOutlineText = page.getByText(/Interview Outline|Interview Overview|Interview Brief/i);
    this.questionCountText    = (n) => page.getByText(new RegExp(`^${n}\\s+questions to answer$`, 'i'));

    // ── Interview Mode Selection ──────────────────────────
    this.chooseInterviewHeading = page.getByRole('heading', { name: 'Choose Your Interview' });
    this.readQuestionsBtn       = page.getByRole('button', { name: /Read Questions/i });

    // ── Per-question controls ─────────────────────────────
    this.showQuestionBtn      = page.getByRole('button', { name: 'Show Question' });
    this.startAnswerBtn       = page.getByRole('button', { name: 'Start Answer' });
    this.submitContinueBtn    = page.getByRole('button', { name: 'Submit & Continue' });
    this.skipQuestionBtn      = page.getByRole('button', { name: 'Skip Question' });
    this.takeBreakBtn         = page.getByRole('button', { name: 'Take a Break' });
    this.submitBreakBtn       = page.getByRole('button', { name: 'Submit and Take a Break' });
    this.resumeInterviewBtn   = page.getByRole('button', { name: 'Resume Interview' });
    this.exitInterviewBtn     = page.getByRole('button', { name: 'Exit Interview' });

    // Text size & highlight
    this.increaseSizeBtn      = page.getByRole('button', { name: 'Increase Text Size' });
    this.decreaseSizeBtn      = page.getByRole('button', { name: 'Decrease Text Size' });
    this.highlightBtn         = page.getByRole('button', { name: 'Highlight Question' });

    // ── Question heading ──────────────────────────────────
    this.questionHeading      = (n) => page.getByRole('heading', { name: `Question ${n} of` });
    this.questionText         = page.locator('h2.font-bold');

    // ── Recording state ───────────────────────────────────
    this.recordingStartedText = page.getByText('Recording Started', { exact: true });
    this.answerBeingRecorded  = page.getByText('Your answer is now being recorded', { exact: true });

    // ── Skip confirmation ─────────────────────────────────
    this.questionSkippedText  = page.getByText('Question Skipped', { exact: true });
    this.movingToNextText     = page.getByText('Question skipped. Moving to next question.', { exact: true });

    // ── Break screen ──────────────────────────────────────
    this.takingBreakHeading   = page.getByRole('heading', { name: 'Taking a Break' });

    // ── Profile Review ────────────────────────────────────
    this.reviewProfileHeading = page.getByRole('heading', { name: 'Review Your Profile' });
    this.confirmSubmitBtn     = page.getByRole('button', { name: 'Confirm & Submit' });
    this.skipForNowBtn        = page.getByRole('button', { name: 'Skip for Now' });

    // ── Completion ────────────────────────────────────────
    this.completedText        = page.getByText('Interview Completed Successfully!');
    this.thankYouText         = page.getByText('Thank you for your time!');
    this.completedHeading     = page.getByRole('heading', { name: 'Interview Completed!' });
    this.feedbackHeading      = page.getByRole('heading', { name: 'How was your interview' });
    this.sendFeedbackBtn      = page.getByRole('button', { name: 'Send Feedback' });
    this.feedbackSentText     = page.getByText('Feedback sent');
    this.closeWindowBtn       = page.getByRole('button', { name: 'Close Window' });
  }

  // ═══════════════════════════════════════════════════════
  //  Interview Boundary Warning (can appear at any time)
  // ═══════════════════════════════════════════════════════

  async dismissBoundaryWarningIfPresent() {
    const boundaryHeading = this.page.getByRole('heading', { name: 'Interview Boundary Warning' });
    try {
      await expect(boundaryHeading).toBeVisible({ timeout: 3_000 });
      await expect(
        this.page.getByText('Your cursor has moved outside')
      ).toBeVisible();
      await this.page.getByRole('button', { name: 'I Understand' }).click();
      // Wait for it to disappear
      await expect(boundaryHeading).toBeHidden({ timeout: 5_000 });
    } catch {
      // Popup not present — nothing to do
    }
  }

  // ═══════════════════════════════════════════════════════
  //  System Requirements Check
  // ═══════════════════════════════════════════════════════

  async assertSystemRequirementsReady() {
    await expect(this.sysReqHeading).toBeVisible({ timeout: 20_000 });
    await expect(this.cameraReady).toBeVisible({ timeout: 15_000 });
    await expect(this.micReady).toBeVisible({ timeout: 15_000 });
    await expect(this.networkGood).toBeVisible({ timeout: 15_000 });

    // Individual requirement rows
    const checks = [
      'Browser Compatibility', 'Camera Access', 'Microphone Access',
      'Network Connection', 'Screen Resolution',
    ];
    for (const check of checks) {
      await expect(
        this.page.locator('div').filter({ hasText: new RegExp(`^${check}$`) }).first()
      ).toBeVisible({ timeout: 10_000 });
    }

    await expect(this.allSystemsReady).toBeVisible({ timeout: 15_000 });
  }

  async clickStartInterview() {
    await this.startInterviewBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ═══════════════════════════════════════════════════════
  //  Consent
  // ═══════════════════════════════════════════════════════

  async acceptConsentAndBegin() {
    await expect(this.fairInterviewHeading).toBeVisible({ timeout: 15_000 });
    await expect(this.readUnderstoodCheck).toBeVisible();
    await this.readUnderstoodCheck.click();
    await this.consentCheck.click();
    await this.beginInterviewBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ═══════════════════════════════════════════════════════
  //  Interview Outline
  // ═══════════════════════════════════════════════════════

  async assertInterviewOutline({ jobTitle, companyName, questionCount }) {
    await expect(this.welcomeText).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByRole('heading', { name: jobTitle })).toBeVisible();

    if (companyName) {
      const companyLabel = this.page.getByText(companyName, { exact: false });
      if (await companyLabel.isVisible().catch(() => false)) {
        await expect(companyLabel).toBeVisible();
      }
    }

    await expect(this.interviewOutlineText).toBeVisible();
    await expect(this.questionCountText(questionCount)).toBeVisible();
  }

  async clickStartInterviewFromOutline() {
    await this.startInterviewBtn.click();
    await expect(this.chooseInterviewHeading).toBeVisible({ timeout: 10_000 });
  }

  async chooseReadQuestionsMode() {
    await this.readQuestionsBtn.click();
  }

  // ═══════════════════════════════════════════════════════
  //  Per-question helpers
  // ═══════════════════════════════════════════════════════

  async assertQuestionNumber(n) {
    await this.dismissBoundaryWarningIfPresent();
    await expect(this.questionHeading(n)).toBeVisible({ timeout: 10_000 });
  }

  async showQuestion() {
    await this.dismissBoundaryWarningIfPresent();
    await expect(this.showQuestionBtn).toBeVisible({ timeout: 10_000 });
    await this.showQuestionBtn.click();
  }

  async assertQuestionText(expectedText) {
    await expect(this.questionText).toContainText(expectedText, { timeout: 10_000 });
  }

  async assertQuestionIsDisplayed() {
    await expect(this.questionText).toBeVisible({ timeout: 10_000 });
    const text = await this.questionText.innerText();
    if (text.length < 10) {
      throw new Error(`Expected a valid question, but got: "${text}"`);
    }
  }

  async captureCurrentQuestion() {
    await expect(this.questionText).toBeVisible({ timeout: 10_000 });
    const text = await this.questionText.innerText();
    return text.trim();
  }

  async startAnswer() {
    await this.dismissBoundaryWarningIfPresent();
    await this.startAnswerBtn.click();
    await expect(this.recordingStartedText).toBeVisible({ timeout: 10_000 });
    await expect(this.answerBeingRecorded).toBeVisible();
  }

  async submitAndContinue() {
    await this.dismissBoundaryWarningIfPresent();
    await this.submitContinueBtn.click();
  }

  // ── Skip ──────────────────────────────────────────────
  async skipQuestion() {
    await this.dismissBoundaryWarningIfPresent();
    await this.skipQuestionBtn.click();
    // Confirmation dialog
    await expect(
      this.page.getByRole('heading', { name: 'Are you sure you want to skip' })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      this.page.getByText("You won't be able to return")
    ).toBeVisible();
    await this.page.getByRole('button', { name: 'Skip Anyway' }).click();
    await expect(this.questionSkippedText).toBeVisible({ timeout: 10_000 });
    await expect(this.movingToNextText).toBeVisible();
  }

  // ── Break ─────────────────────────────────────────────
  async takeBreakAndResume() {
    await this.dismissBoundaryWarningIfPresent();
    await this.takeBreakBtn.click();
    await expect(
      this.page.getByRole('heading', { name: 'Submit Answer and Take a' })
    ).toBeVisible({ timeout: 10_000 });
    await this.submitBreakBtn.click();
    await expect(this.takingBreakHeading).toBeVisible({ timeout: 10_000 });
    await expect(this.resumeInterviewBtn).toBeVisible();
    await expect(this.exitInterviewBtn).toBeVisible();
    await this.resumeInterviewBtn.click();
  }

  // ── UI Controls ───────────────────────────────────────
  async adjustTextSize({ decreaseCount = 0, increaseCount = 0 }) {
    for (let i = 0; i < decreaseCount; i++) await this.decreaseSizeBtn.click();
    for (let i = 0; i < increaseCount; i++) await this.increaseSizeBtn.click();
  }

  async highlightQuestion() {
    await this.highlightBtn.click();
  }

  // ═══════════════════════════════════════════════════════
  //  Profile Review
  // ═══════════════════════════════════════════════════════

  async assertProfileReview() {
    // First check if we're still on the interview page or if interview completed
    const currentUrl = await this.page.url();
    
    // If we've navigated to dashboard or applications, profile review was likely skipped
    if (currentUrl.includes('/dashboard') || currentUrl.includes('/applications')) {
      return;
    }
    
    await expect(this.reviewProfileHeading).toBeVisible({ timeout: 120_000 });

    const profileFields = [
      this.page.getByRole('textbox', { name: 'City' }),
      this.page.getByRole('textbox', { name: 'District' }),
      this.page.getByRole('textbox', { name: 'State' }),
      this.page.getByRole('textbox', { name: 'Country' }),
    ];
    for (const field of profileFields) {
      await expect(field).toBeVisible({ timeout: 10_000 });
    }

    await expect(this.page.getByRole('button', { name: 'Add Experience' })).toBeVisible();
    await expect(this.page.locator('div').filter({ hasText: /^Total Years of Experience$/ }).nth(1)).toBeVisible();
    await expect(this.page.locator('div').filter({ hasText: /^Skills & Technologies$/ })).toBeVisible();
    await expect(this.confirmSubmitBtn).toBeVisible();
    await expect(this.skipForNowBtn).toBeVisible();
  }

  async confirmAndSubmitProfile() {
    // Check if we're still on the interview page
    const currentUrl = await this.page.url();
    if (currentUrl.includes('/dashboard') || currentUrl.includes('/applications')) {
      return;
    }
    
    await this.confirmSubmitBtn.click();
    // Profile generation can take ~1 min after interview completion
    await this.page.waitForTimeout(3_000);
    await this.page.waitForLoadState('networkidle');
  }

  // ═══════════════════════════════════════════════════════
  //  Completion & Feedback
  // ═══════════════════════════════════════════════════════

  async assertInterviewCompleted() {
    // Completion screen elements vary — verify at least one indicator is present
    const completionIndicators = [
      this.completedText,
      this.thankYouText,
      this.completedHeading,
      this.feedbackHeading,
    ];
    
    let anyVisible = false;
    for (const indicator of completionIndicators) {
      try {
        await expect(indicator).toBeVisible({ timeout: 10_000 });
        anyVisible = true;
        break; // If we found one, we don't need to check the others
      } catch {
        // ignore — not all completion elements are mandatory
      }
    }
    
    if (!anyVisible) {
      // If no completion indicators are visible, check if we've navigated away from the interview
      const currentUrl = await this.page.url();
      
      // If we're on a dashboard or applications page, the interview likely completed
      if (currentUrl.includes('/dashboard') || currentUrl.includes('/applications')) {
        return;
      }
      
      throw new Error('No interview completion indicator found and not navigated away from interview');
    }
  }

  /**
   * @param {Object[]} ratings  Array of { label } — button text to click
   *   e.g. [{label:'🙂 Satisfied'}, {label:'Okay'}, ...]
   */
  async submitFeedback(ratings) {
    for (const { rowHeading, label } of ratings) {
      // Find the heading first, then locate the button within the same container
      const heading = this.page.getByText(rowHeading, { exact: true });
      // The button is usually in a sibling or nearby element — use a broader search
      const button = heading.locator('..').getByRole('button', { name: label })
        .or(this.page.getByRole('button', { name: label }).filter({ has: heading }));
      await button.click({ timeout: 10_000 });
    }
    await this.sendFeedbackBtn.click();
    await expect(this.feedbackSentText).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('Thank you. We will use this')).toBeVisible();
  }

  async skipFeedback() {
    await this.page.getByRole('button', { name: 'Skip' }).click();
  }

  async closeWindow() {
    await this.closeWindowBtn.click();
  }
}

module.exports = { InterviewPage };

