// pages/JobEditPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * JobEditPage — Advanced Edit mode for an existing job.
 * Handles:
 *  - Navigating into Advanced Edit from the jobs list
 *  - Capturing and asserting skills (Must Have / Good to Have / Bonus)
 *  - Navigating to Questions stage and capturing question text dynamically
 */
class JobEditPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Jobs list ──────────────────────────────────────────
    this.jobSearchInput     = page.getByRole('textbox', { name: 'Search by job name or ID' });
    this.advancedEditItem   = page.getByRole('menuitem', { name: 'Advanced Edit' });
    this.continueToSkillsBtn = page.getByRole('button', { name: 'Continue to Skills' });
    this.acceptSkillsBtn    = page.getByRole('button', { name: 'Accept Skills & Generate' });
    this.nextStageBtn       = page.getByRole('button', { name: 'Next Stage' });

    // ── Skill sections ────────────────────────────────────
    this.mustHaveSection    = page.locator('#root');
    this.root               = page.locator('#root');

    // ── Questions stage ───────────────────────────────────
    this.decideQuestionsHeading = page.getByRole('heading', { name: /Decide Questions/ });
  }

  // ── Open Advanced Edit for a job ──────────────────────
  async openAdvancedEdit(jobTitle) {
    await this.fillInput(this.jobSearchInput, jobTitle);
    await this.page.waitForTimeout(1500);

    // The overflow/kebab menu button — 4th empty-label button
    await this.page.locator('#jobs-section').getByRole('button').filter({ hasText: /^$/ }).first().click();
    await this.advancedEditItem.click();
    await this.page.waitForLoadState('networkidle');
  }

  async proceedToSkillsStep() {
    await this.continueToSkillsBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ── Capture skills dynamically ───────────────────────
  /**
   * Captures all skill text from #root grouped by type.
   * Returns { mustHave: string, goodToHave: string, bonus: string }
   */
  async captureSkills() {
    const rootText = await this.root.innerText();
    return rootText;
  }

  async assertSkillsPresent({ mustHaveText, goodToHaveText, bonusText }) {
    await expect(this.root).toContainText(mustHaveText, { timeout: 15_000 });
    await expect(this.root).toContainText(goodToHaveText, { timeout: 15_000 });
    await expect(this.root).toContainText(bonusText, { timeout: 15_000 });
  }

  async acceptSkillsAndProceed() {
    await this.acceptSkillsBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  // Move through interview config stages to reach Questions
  async proceedToQuestionsStage() {
    await this.nextStageBtn.click(); // Stage 1 → 2
    await this.page.waitForTimeout(2000);
    await this.nextStageBtn.click(); // Stage 2 → Questions
    await this.page.waitForTimeout(2000);
  }

  // ── Capture question count from Decide Questions heading ─
  async captureQuestionCount() {
    // The number is in a sibling element right after the heading (e.g. <h3>Decide Questions</h3><div>9</div>)
    const parentText = await this.decideQuestionsHeading.locator('xpath=..').innerText();
    const match = parentText.match(/Decide Questions\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // ── Capture questions dynamically ────────────────────
  /**
   * Scrapes all question texts visible in #root.
   * Returns an ordered string[] of question texts.
   */
  async captureQuestions() {
    // Questions are rendered as paragraph/span text inside the root;
    // we grab all visible question-like text blocks
    const questionLocators = this.page.locator('#root p, #root li, #root span').filter({
      hasText: /\?$/,
    });
    const count     = await questionLocators.count();
    const questions = [];
    for (let i = 0; i < count; i++) {
      const text = (await questionLocators.nth(i).innerText()).trim();
      if (text.length > 20) questions.push(text); // filter out short noise
    }
    // Deduplicate (some questions appear twice in the recorded flow)
    return [...new Set(questions)];
  }

  async assertQuestionsPresent(expectedQuestions) {
    for (const q of expectedQuestions) {
      await expect(this.root).toContainText(q, { timeout: 15_000 });
    }
  }
}

module.exports = { JobEditPage };