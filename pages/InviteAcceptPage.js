// pages/InviteAcceptPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * InviteAcceptPage covers the page that opens when a new team member
 * clicks "Accept invite & set password" from their invite email.
 *
 * Operates on page2 — the popup/new tab opened from YopMail.
 */
class InviteAcceptPage extends BasePage {
  constructor(page) {
    super(page);

    this.joinHeading    = (workspaceName) =>
      page.getByRole('heading', { name: `Join ${workspaceName}` });

    this.passwordInput  = page.getByRole('textbox', { name: 'Password', exact: true });
    this.confirmInput   = page.getByRole('textbox', { name: 'Confirm Password' });
    this.joinBtn        = page.getByRole('button', { name: 'Set Password & Join Workspace' });
  }

  // ═══════════════════════════════════════════════════════
  //  Actions
  // ═══════════════════════════════════════════════════════

  async assertJoinPage(workspaceName) {
    await expect(this.joinHeading(workspaceName)).toBeVisible({ timeout: 15_000 });
  }

  async setPasswordAndJoin(password) {
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    await this.confirmInput.click();
    await this.confirmInput.fill(password);
    await this.joinBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ═══════════════════════════════════════════════════════
  //  Post-join assertions (on the new member's dashboard)
  // ═══════════════════════════════════════════════════════

  async assertLandedOnDashboard(firstName) {
    await expect(
      this.page.locator('div').filter({ hasText: /^Hyrefast$/ })
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      this.page.getByRole('heading', { name: new RegExp(`Good .*, ${firstName}`) })
    ).toBeVisible({ timeout: 10_000 });
  }

  async assertWorkspaceVisible(workspaceName) {
    await this.page.getByRole('button', { name: /^[A-Z]$/ }).first().click();
    await expect(
      this.page.getByText(workspaceName, { exact: true })
    ).toBeVisible({ timeout: 10_000 });
  }
}

module.exports = { InviteAcceptPage };