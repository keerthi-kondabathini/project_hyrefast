// pages/BasePage.js
const { expect } = require('@playwright/test');

class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // ─── Navigation ────────────────────────────────────────────
  async goto(path = '') {
    await this.page.goto(path || '/');
    await this.page.waitForLoadState('networkidle');
  }

  // ─── Waits ─────────────────────────────────────────────────
  async waitMs(ms) {
    await this.page.waitForTimeout(ms);
  }

  async waitForToast() {
    // Toast/notification banner – li or role=status
    const locator = this.page.locator('li').or(this.page.getByRole('status'));
    await expect(locator.first()).toBeVisible({ timeout: 30_000 });
  }

  // ─── Form helpers ──────────────────────────────────────────
  async fillInput(locator, value) {
    await locator.click();
    await locator.fill(value);
  }

  async selectDropdownOption(comboLocator, optionText) {
    await comboLocator.click();
    await this.page.getByRole('option', { name: optionText }).click();
  }

  // ─── Assertion helpers ─────────────────────────────────────
  async assertVisible(locator, message) {
    await expect(locator, message).toBeVisible({ timeout: 30_000 });
  }

  async assertTextVisible(text) {
    await expect(this.page.getByText(text)).toBeVisible({ timeout: 30_000 });
  }

  // ─── Counter extraction ───────────────────────────────────
  /**
   * Extracts the numeric count from a text node, e.g. "Published Jobs43" → 43
   * @param {string} partialText - Partial text to locate the element
   * @returns {Promise<number>}
   */
  async extractCount(partialText) {
    const el = this.page.getByText(new RegExp(partialText + '\\d+'));
    const text = await el.innerText();
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }
}

module.exports = { BasePage };
