// pages/YopMailPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * YopMailPage encapsulates all interactions with https://yopmail.com
 * Used to verify that interview invitation emails are delivered and
 * contain the expected content / CTA links.
 *
 * Usage (inside a test):
 *   const context2  = await browser.newContext();
 *   const yopPage   = await context2.newPage();
 *   const yopMail   = new YopMailPage(yopPage);
 *   await yopMail.openInbox('prem');
 *   await yopMail.assertInviteEmailVisible('.net developer');
 *   const [interviewPage] = await yopMail.clickStartInterview(context2);
 */
class YopMailPage extends BasePage {
  constructor(page) {
    super(page);

    this.loginInput    = page.getByRole('textbox', { name: 'Login' });
    this.checkInboxBtn = page.getByTitle('Check Inbox @yopmail.com');

    // The email renders inside an iframe
    this.mailFrame     = () => page.locator('iframe[name="ifmail"]').contentFrame();
  }

  // ═══════════════════════════════════════════════════════
  //  Navigation
  // ═══════════════════════════════════════════════════════

  async openInbox(username) {
    await this.page.goto('https://yopmail.com/');
    await this.fillInput(this.loginInput, username);
    await this.checkInboxBtn.click();
    await this.page.waitForLoadState('networkidle');
    // YopMail auto-refreshes; give it a moment to load the inbox
    await this.page.waitForTimeout(3000);
  }

  /**
   * Refreshes the YopMail inbox once (useful after a short delay waiting
   * for the email to arrive from the HyreFast mailer).
   */
  async refreshInbox() {
    const refreshBtn = this.page.getByTitle(/Refresh|refresh/i).or(
      this.page.getByRole('button', { name: /refresh/i })
    );
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
      await this.page.waitForTimeout(3000);
    } else {
      await this.page.reload();
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(3000);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Email assertions
  // ═══════════════════════════════════════════════════════

  /**
   * Asserts the invite email subject line is present in the inbox frame.
   * @param {string} jobTitle - e.g. ".net developer"
   */
  async assertInviteEmailVisible(jobTitle) {
    const subjectText = `Your Private Interview Link - ${jobTitle}`;
    await expect(
      this.mailFrame().getByText(subjectText)
    ).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Asserts the "Start My Interview" CTA link is visible in the email body.
   */
  async assertStartInterviewLinkVisible() {
    await expect(
      this.mailFrame().getByRole('link', { name: 'Start My Interview' })
    ).toBeVisible({ timeout: 15_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Actions
  // ═══════════════════════════════════════════════════════

  /**
   * Clicks "Start My Interview" in the email and returns the new page
   * that opens (the candidate interview page).
   *
   * @param {import('@playwright/test').BrowserContext} context
   *   Pass the browser context so we can capture the popup/new tab.
   * @returns {Promise<import('@playwright/test').Page>}
   */
  async clickStartInterview(context) {
    const pagePromise = context.waitForEvent('page');
    await this.mailFrame()
      .getByRole('link', { name: 'Start My Interview' })
      .click();
    const newPage = await pagePromise;
    await newPage.waitForLoadState('networkidle');
    return newPage;
  }
}

module.exports = { YopMailPage };