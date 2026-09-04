// pages/YopMailPage.js

const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * Email page abstraction.
 *
 * Supports:
 *
 * 1. YopMail
 * 2. Mail.tm
 *
 * Existing tests can continue importing:
 *
 *   const { YopMailPage } = require('../../pages/YopMailPage');
 *
 * For YopMail:
 *   await email.openInbox(user.yopUsername);
 *
 * For Mail.tm:
 *   await email.openInbox(user);
 */
class YopMailPage extends BasePage {
  constructor(page) {
    super(page);

    this.loginInput = page.getByRole(
      'textbox',
      { name: 'Login' }
    );

    this.checkInboxBtn = page.getByTitle(
      'Check Inbox @yopmail.com'
    );

    this.mailFrame = () =>
      page
        .locator('iframe[name="ifmail"]')
        .contentFrame();

    this.provider = null;
    this.mailTmClient = null;
    this.mailTmMessage = null;
  }

  // ═══════════════════════════════════════════════════════
  // Navigation
  // ═══════════════════════════════════════════════════════

  async openInbox(userOrUsername) {
    if (
      typeof userOrUsername === 'object' &&
      userOrUsername?.provider === 'mailtm'
    ) {
      this.provider = 'mailtm';
      this.mailTmClient =
        userOrUsername.mailTmClient;

      if (!this.mailTmClient) {
        throw new Error(
          'Mail.tm client is missing from email user object'
        );
      }

      return;
    }

    this.provider = 'yopmail';

    const username =
      typeof userOrUsername === 'string'
        ? userOrUsername
        : userOrUsername.yopUsername;

    await this.page.goto(
      'https://yopmail.com/',
      { waitUntil: 'domcontentloaded' }
    );

    await this.fillInput(
      this.loginInput,
      username
    );

    await this.checkInboxBtn.click();

    await this.page.waitForLoadState(
      'networkidle'
    );

    await this.page.waitForTimeout(3000);
  }

  async refreshInbox() {
    if (this.provider === 'mailtm') {
      return;
    }

    const refreshBtn =
      this.page.getByTitle(
        /Refresh|refresh/i
      ).or(
        this.page.getByRole(
          'button',
          { name: /refresh/i }
        )
      );

    if (
      await refreshBtn.isVisible().catch(
        () => false
      )
    ) {
      await refreshBtn.click();

      await this.page.waitForTimeout(3000);
    } else {
      await this.page.reload();

      await this.page.waitForLoadState(
        'networkidle'
      );

      await this.page.waitForTimeout(3000);
    }
  }

  // ═══════════════════════════════════════════════════════
  // Email assertions
  // ═══════════════════════════════════════════════════════

  async assertResetPasswordEmailVisible() {
    if (this.provider === 'mailtm') {
      this.mailTmMessage = await this.mailTmClient.waitForMessage({
        subject: 'Reset Your HyreFast Password',
        timeoutMs: 60000,
      });
      return;
    }

    await expect(
      this.mailFrame().getByText('Reset Your HyreFast Password')
    ).toBeVisible({ timeout: 60000 });
  }

  async assertPasswordResetSuccessfulEmailVisible() {
    if (this.provider === 'mailtm') {
      this.mailTmMessage = await this.mailTmClient.waitForMessage({
        subject: 'Password Reset Successful',
        timeoutMs: 60000,
      });
      return;
    }

    await expect(
      this.mailFrame().getByText('Password Reset Successful')
    ).toBeVisible({ timeout: 60000 });
  }

  async assertInviteEmailVisible(jobTitle) {
    if (this.provider === 'mailtm') {
      this.mailTmMessage = await this.mailTmClient.waitForMessage({
        subject: 'Your Private Interview Link',
        timeoutMs: 60000,
      });
      return;
    }

    // Wait for the invite email subject in the inbox list, then open it and wait for body.
    const frame = this.mailFrame();
    const subjectLocator = frame.getByText(/Your Private Interview Link/i).first();
    await expect(subjectLocator).toBeVisible({ timeout: 60000 });
    await subjectLocator.click();
    await this.page.waitForTimeout(1500);

    // Confirm the email body loaded (look for job title or salutation).
    const bodyText = frame.getByText(/Your Private Interview Link|Start My Interview|Thank you for your application/i).first();
    await expect(bodyText).toBeVisible({ timeout: 15000 });
  }

  async assertStartInterviewLinkVisible() {
    if (this.provider === 'mailtm') {
      if (!this.mailTmMessage) {
        throw new Error(
          'No Mail.tm message loaded. ' +
          'Call assertInviteEmailVisible() first.'
        );
      }

      const link =
        this.mailTmClient.extractLink(
          this.mailTmMessage,
          'Start My Interview'
        );

      if (!link) {
        throw new Error(
          'Mail.tm: Start My Interview link not found'
        );
      }

      return;
    }

    await expect(
      this.mailFrame()
        .getByRole(
          'link',
          { name: 'Start My Interview' }
        )
    ).toBeVisible({
      timeout: 15000,
    });
  }

  // ═══════════════════════════════════════════════════════
  // Generic email searching
  // ═══════════════════════════════════════════════════════

  async waitForEmailBySubject(
    subject,
    timeoutMs = 60000
  ) {
    if (this.provider === 'mailtm') {
      this.mailTmMessage =
        await this.mailTmClient.waitForMessage({
          subject,
          timeoutMs,
        });

      return this.mailTmMessage;
    }

    await expect(
      this.mailFrame().getByText(subject)
    ).toBeVisible({
      timeout: timeoutMs,
    });

    return true;
  }

  async waitForEmailByText(
    text,
    timeoutMs = 60000
  ) {
    if (this.provider === 'mailtm') {
      this.mailTmMessage =
        await this.mailTmClient.waitForMessageByText(
          text,
          { timeoutMs }
        );

      return this.mailTmMessage;
    }

    await expect(
      this.mailFrame().getByText(text)
    ).toBeVisible({
      timeout: timeoutMs,
    });

    return true;
  }

  // ═══════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════

  async clickStartInterview(context) {
    if (this.provider === 'mailtm') {
      if (!this.mailTmMessage) {
        throw new Error(
          'No Mail.tm message loaded'
        );
      }

      const link =
        this.mailTmClient.extractLink(
          this.mailTmMessage,
          'Start My Interview'
        );

      if (!link) {
        throw new Error(
          'Start My Interview link not found'
        );
      }

      const newPage =
        await context.newPage();

      await newPage.goto(link, {
        waitUntil: 'networkidle',
      });

      return newPage;
    }

    const pagePromise =
      context.waitForEvent('page');

    await this.mailFrame()
      .getByRole(
        'link',
        { name: 'Start My Interview' }
      )
      .click();

    const newPage =
      await pagePromise;

    await newPage.waitForLoadState(
      'networkidle'
    );

    return newPage;
  }

  async clickLink(linkText, context) {
    if (this.provider === 'mailtm') {
      if (!this.mailTmMessage) {
        throw new Error(
          'No Mail.tm message loaded'
        );
      }

      const link =
        this.mailTmClient.extractLink(
          this.mailTmMessage,
          linkText
        );

      if (!link) {
        throw new Error(
          `Mail.tm: Link "${linkText}" not found`
        );
      }

      const newPage =
        await context.newPage();

      await newPage.goto(link, {
        waitUntil: 'networkidle',
      });

      return newPage;
    }

    const pagePromise =
      context.waitForEvent('page');

    await this.mailFrame()
      .getByRole(
        'link',
        { name: linkText }
      )
      .click();

    const newPage =
      await pagePromise;

    await newPage.waitForLoadState(
      'networkidle'
    );

    return newPage;
  }

  /**
   * Extracts the href of a link inside the current email.
   * Useful when we want to open the link in a specific page/context.
   */
  async extractLinkHref(linkText) {
    if (this.provider === 'mailtm') {
      if (!this.mailTmMessage) {
        throw new Error(
          'No Mail.tm message loaded'
        );
      }

      return this.mailTmClient.extractLink(
        this.mailTmMessage,
        linkText
      );
    }

    const link = this.mailFrame()
      .getByRole('link', { name: linkText });

    await expect(link).toBeVisible({ timeout: 15000 });

    return link.getAttribute('href');
  }
}

module.exports = {
  YopMailPage,
};