// pages/SkillsExtractionPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

class SkillsExtractionPage extends BasePage {
  constructor(page) {
    super(page);

    // ── JD content textarea (Step 1) ─────────────────────
    this.jdTextarea = page.locator(
      'xpath=//*[@id="root"]/div[3]/div/div[2]/div[2]/div/section[1]/div[2]/textarea'
    );

    // ── Skills column roots (Step 2) ──────────────────────
    // Column containers — div[1]=Must Have, div[2]=Good to Have, div[3]=Bonus
    this.mustHaveCol    = page.locator('div', { hasText: /Must Have/i }).first();
    this.goodToHaveCol  = page.locator('div', { hasText: /Good to Have/i }).first();
    this.bonusCol       = page.locator('div', { hasText: /Bonus/i }).first();

    // Within each column, skill cards sit under div[2]/div/div/div[2]/div
    // Skill name: div[1]/p
    // Skill tools: div[1]/div/div[1]  (first tool chip row)
    this.skillCardSkillNameSelector = 'div:nth-child(2) > div > div > div:nth-child(2) > div > div:first-child > p';
    // Broader fallback: any <p> tag inside the skill cards area
    this.skillNameFallback = 'p';

    // ── Accept Skills button (Step 2) ─────────────────────
    this.acceptSkillsBtn = page.getByRole('button', { name: 'Accept Skills & Generate Topics' })
      .or(page.getByRole('button', { name: /Accept Skills/i }));

    // ── Topics (Step 3) ───────────────────────────────────
    // Each topic name lives in a div row inside div[2]/div[1]/div[2]/div/div[1]/div
    this.topicsContainer = page.locator(
      'xpath=//*[@id="root"]/div[3]/div/div[2]/div[2]/div[2]/div[2]/div[2]/div[1]/div[2]'
    );
    // Individual topic name cells
    this.topicNameCells = page.locator(
      'xpath=//*[@id="root"]/div[3]/div/div[2]/div[2]/div[2]/div[2]/div[2]/div[1]/div[2]/div/div[1]/div'
    );

    // ── Questions (Step 4) ────────────────────────────────
    // Each question text lives in a <p> tag
    this.questionParagraphs = page.locator(
      'xpath=//*[@id="root"]/div[3]/div/div[2]/div[2]/div[2]/div[2]/div[3]/div[1]/div[1]/p'
    );
    // Topics covered section on the question stage
    this.topicsCoveredSection = page.locator(
      'xpath=//*[@id="root"]/div[3]/div/div[2]/div[2]/div[2]/div[2]/div[3]/div[1]/div[2]'
    );

    // Coverage percentage badge
    this.coverageBadge = page.getByText(/100%\s*coverage/i)
      .or(page.getByText(/\d+%\s*coverage/i));
  }

  // ═══════════════════════════════════════════════════════
  //  JD Validation (Step 1)
  // ═══════════════════════════════════════════════════════

  /**
   * Wait until the JD has been generated.
   */
  async waitForJDReady() {
    await expect(
      this.page.locator('textarea')
    ).toBeVisible({ timeout: 90_000 });
    await this.page.getByText(/Generating Job Description\.\.\.|Generating Job Description/i)
      .waitFor({ state: 'hidden', timeout: 90_000 })
      .catch(() => {});
  }

  async waitForJDText(timeoutMs = 90_000) {
    await this.page.waitForFunction(() => {
      const textarea = document.querySelector('textarea');
      if (textarea && textarea.value.trim().length > 20) return true;
      const editable = Array.from(document.querySelectorAll('[contenteditable="true"]'));
      if (editable.some(el => el.innerText.trim().length > 20)) return true;
      return false;
    }, null, { timeout: timeoutMs });
  }

  /**
   * Extract the JD content from the textarea or editable area.
   * @returns {Promise<string>}
   */
  async extractJDContent() {
    await this.waitForJDReady();
    await this.waitForJDText();

    try {
      const content = await this.jdTextarea.inputValue();
      if (content && content.length > 20) return content;
    } catch { /* fallback */ }

    try {
      const content = await this.jdTextarea.innerText();
      if (content && content.length > 20) return content;
    } catch { /* fallback */ }

    const editor = this.page.locator('[contenteditable="true"]');
    const editableText = await editor.first().innerText().catch(() => '');
    if (editableText && editableText.length > 20) return editableText;

    const textarea = await this.page.locator('textarea').first().inputValue().catch(() => '');
    return typeof textarea === 'string' ? textarea : '';
  }

  // ═══════════════════════════════════════════════════════
  //  Skills Extraction (Step 2)
  // ═══════════════════════════════════════════════════════

  /**
   * Wait for skills columns to be populated.
   * Waits for the Must Have column to contain at least one skill card.
   */
  async waitForSkillsReady() {
    // The skills page should show generated skills and available actions.
    await expect(
      this.page.getByRole('button', { name: /Re-extract Skills|Add Skill/i }).first()
    ).toBeVisible({ timeout: 90_000 });

    const visibleSkillText = this.page.locator('div', { hasText: /Must Have|Good to Have|Bonus/i }).locator('p');
    await visibleSkillText.first().waitFor({ state: 'visible', timeout: 60_000 })
      .catch(() => {}); // This step may still succeed with only column headings visible.
  }

  /**
   * Extract all skill names from a single column locator.
   * Uses the XPath-derived CSS path for reliability.
   *
   * The card structure per screenshot:
   *   column > div[2] > div (card wrapper) > div > div[2] > div > div[1] > p  ← skill name
   *
   * @param {import('@playwright/test').Locator} columnLocator
   * @returns {Promise<string[]>}
   */
  _isSkillText(text) {
    const normalized = text.trim();
    if (!normalized || normalized.length < 3 || normalized.length > 80) return false;

    const noise = new Set([
      'must have', 'good to have', 'bonus',
      'core skills that directly impact role success.',
      'complementary strengths that improve fit.',
      'differentiators that can set top candidates apart.',
      'save draft', 'add skill', 're-extract skills',
      'no skills extracted for this column yet.',
      'accept skills & generate topics',
      're-extract skills', 'regenerate topics', 'next stage',
      'ai cover uncovered skills', 'interview questions',
      'job title', 'jd & details',
      'job title, jd content, and role requirements',
      'skills & proficiency',
      'configure must-have, good-to-have, and bonus skills',
      'ai-generated questions for candidates',
      'enriching skills in the background',
    ]);

    const lower = normalized.toLowerCase();
    if (lower.includes('|')) return false;
    if (lower.split(/\s+/).length > 8) return false;
    if (noise.has(lower)) return false;
    if (/^\d+$/.test(lower)) return false;
    if (/^l[1-5]$/i.test(lower)) return false;
    if (/^(edit|remove|delete|save|back)$/i.test(lower)) return false;
    return true;
  }

  async _extractSkillNamesFromColumn(columnLocator) {
    const namePs = columnLocator.locator(this.skillCardSkillNameSelector);
    let candidateLocators = namePs;
    let count  = await namePs.count();

    if (count === 0) {
      candidateLocators = columnLocator.locator('p, span');
      count = await candidateLocators.count();
    }

    if (count > 0) {
      const names = [];
      for (let i = 0; i < count; i++) {
        const t = (await candidateLocators.nth(i).innerText()).trim();
        if (this._isSkillText(t)) names.push(t);
      }
      if (names.length > 0) {
        return [...new Set(names)];
      }
    }

    const allPs   = columnLocator.locator('p');
    const pCount  = await allPs.count();
    const results = [];

    for (let i = 0; i < pCount; i++) {
      const t = (await allPs.nth(i).innerText()).trim();
      if (this._isSkillText(t)) {
        results.push(t);
      }
    }
    return [...new Set(results)];
  }

  /**
   * Extract skills grouped by category using the exact XPath columns.
   * @returns {Promise<{mustHave: string[], goodToHave: string[], bonus: string[], all: string[]}>}
   */
  async extractSkillsByCategory() {
    await this.waitForSkillsReady();

    const mustHave   = await this._extractSkillNamesFromColumn(this.mustHaveCol);
    const goodToHave = await this._extractSkillNamesFromColumn(this.goodToHaveCol);
    const bonus      = await this._extractSkillNamesFromColumn(this.bonusCol);

    return {
      mustHave,
      goodToHave,
      bonus,
      all: [...mustHave, ...goodToHave, ...bonus],
    };
  }

  async extractAllSkills() {
    const { all } = await this.extractSkillsByCategory();
    return all;
  }

  // ═══════════════════════════════════════════════════════
  //  Topics Extraction (Step 3)
  // ═══════════════════════════════════════════════════════

  /**
   * Wait for topics to be generated.
   * "Regenerate Topics" button appears once topics are ready.
   */
  async waitForInterviewConfigReady(timeoutMs = 90_000) {
    await expect(
      this.page.getByRole('heading', { name: /Interview Configuration/i })
    ).toBeVisible({ timeout: timeoutMs });

    await expect(
      this.page.locator('button', { hasText: /Question Strategy|Topics & Off Topics|Questions|Publish & Links/i }).first()
    ).toBeVisible({ timeout: timeoutMs });
  }

  async _isTopicsPageVisible() {
    const cellCount = await this.topicNameCells.count();
    if (cellCount > 0) return true;
    return await this.topicsContainer.isVisible();
  }

  async _isQuestionsPageVisible() {
    const questionCount = await this.questionParagraphs.count();
    if (questionCount > 0) return true;
    return await this.page.locator('h3', { hasText: /Decide Questions/i }).isVisible().catch(() => false);
  }

  async acceptSkills() {
    await expect(this.acceptSkillsBtn).toBeVisible({ timeout: 90_000 });
    await expect(this.acceptSkillsBtn).toBeEnabled({ timeout: 90_000 });
    await this.acceptSkillsBtn.click();
    await this.waitForInterviewConfigReady(120_000);
  }

  async waitForTopicsReady() {
    await this.waitForInterviewConfigReady();

    if (await this._isQuestionsPageVisible()) return;
    if (await this._isTopicsPageVisible()) return;

    const topicsButton = this.page.locator('button', { hasText: /Topics & Off Topics/i }).first();
    await expect(topicsButton).toBeVisible({ timeout: 60_000 });
    if (!(await topicsButton.isDisabled())) {
      await topicsButton.click();
    }

    await this.topicsContainer.first().waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {});
    await this.page.getByRole('button', { name: /Regenerate Topics/i }).waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {});
  }

  async navigateToQuestionsStage() {
    await this.waitForInterviewConfigReady();
    if (await this._isQuestionsPageVisible()) return;

    const questionsButton = this.page.locator('button', { hasText: /Questions/i }).first();
    await expect(questionsButton).toBeVisible({ timeout: 60_000 });
    if (!(await questionsButton.isDisabled())) {
      await questionsButton.click();
    }
  }

  /**
   * Extract topic names from the Topics & Off Topics step.
   * @returns {Promise<string[]>}
   */
  async extractTopicNames() {
    await this.waitForTopicsReady();

    // Try the exact XPath cells first
    const cellCount = await this.topicNameCells.count();
    if (cellCount > 0) {
      const names = [];
      for (let i = 0; i < cellCount; i++) {
        const t = (await this.topicNameCells.nth(i).innerText()).trim();
        if (t && t.length > 3) names.push(t);
      }
      if (names.length > 0) return names;
    }

    // Fallback: read all visible topic-like headings in the topics container
    const containerText = await this.topicsContainer.innerText().catch(() => '');
    return containerText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5 && l.length < 100 && !/^\d+\s*min/.test(l));
  }

  /**
   * Returns topic names as text strings — used for coverage checking.
   * @returns {Promise<string[]>}
   */
  async extractTopicTexts() {
    return this.extractTopicNames();
  }

  // ═══════════════════════════════════════════════════════
  //  Questions Extraction (Step 4)
  // ═══════════════════════════════════════════════════════

  /**
   * Wait for questions to be generated.
   */
  async waitForQuestionsReady() {
    await expect(
      this.page.getByRole('button', { name: /Regenerate Questions|New Question/i }).first()
    ).toBeVisible({ timeout: 60_000 });
    // Also ensure at least one question paragraph is visible
    await this.questionParagraphs.first().waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => {});
  }

  /**
   * Extract all question strings from Step 4.
   * @returns {Promise<string[]>}
   */
  async extractQuestions() {
    await this.waitForQuestionsReady();

    const count     = await this.questionParagraphs.count();
    const questions = [];

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const t = (await this.questionParagraphs.nth(i).innerText()).trim();
        if (t.length > 20) questions.push(t);
      }
      if (questions.length > 0) return questions;
    }

    // Fallback: find question-like <p> tags anywhere on page
    const allPs = this.page.locator('p');
    const total = await allPs.count();
    for (let i = 0; i < total; i++) {
      const t = (await allPs.nth(i).innerText()).trim();
      if (t.endsWith('?') && t.length > 30) questions.push(t);
    }
    return questions;
  }

  // ═══════════════════════════════════════════════════════
  //  Coverage % (Step 4 badge)
  // ═══════════════════════════════════════════════════════

  async extractCoveragePercentage() {
    try {
      const text  = await this.coverageBadge.first().innerText();
      const match = text.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch {
      return 0;
    }
  }
}

module.exports = { SkillsExtractionPage };