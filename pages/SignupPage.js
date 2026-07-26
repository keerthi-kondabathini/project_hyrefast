// pages/SignupPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * SignupPage — covers the full new-user sign-up flow including:
 *  - Sign Up form (name, phone, email, password)
 *  - Account activation via YopMail
 *  - Workspace setup: Recruiting mode vs Agency mode
 *  - Agency mode toggle and confirmation
 *
 * Two workspace modes produce different post-activation UIs:
 *  Recruiting → "Primary Company Profile" setup
 *  Agency     → "Company directory" / multi-company workspace
 */
class SignupPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Login page ─────────────────────────────────────────
    this.hyreFastLogo   = page.getByRole('link', { name: 'HyreFast Logo Welcome to' });
    this.signUpTab      = page.getByRole('tab', { name: 'Sign Up' });

    // ── Sign up form ──────────────────────────────────────
    this.createAccountHeading = page.getByRole('heading', { name: 'Create Your Account' });
    this.creditsText          = page.getByText(/Get \d+ credits when you sign/i);
    this.fullNameInput        = page.getByRole('textbox', { name: 'Full Name *' });
    this.phoneInput           = page.getByRole('textbox', { name: 'Phone *' });
    this.emailInput           = page.getByRole('textbox', { name: 'john@company.com' });
    this.passwordInput        = page.getByRole('textbox', { name: 'Create password' });
    // Button text includes credit count — match dynamically
    this.startTrialBtn        = page.getByRole('button', { name: /Start Free Trial/i });

    // ── Post-signup confirmation ──────────────────────────
    this.accountCreatedExact = page.getByText('Account created successfully!', { exact: true });
    this.accountCreatedFull  = page.locator('div.text-sm.opacity-90').filter({ hasText: /Account created successfully! Please activate via email/i });

    // ── Workspace setup (page2, after activation) ─────────
    this.firstWorkspaceSetupText = page.getByText('First workspace setup');
    this.workspaceModeHeading    = page.getByRole('heading', { name: 'Choose how this workspace' });

    this.recruitingModeBtn = page.getByRole('button', { name: /Recruiting mode/i }).first();
    this.agencyModeBtn     = page.getByRole('button', { name: /Agency mode/i }).first();
    this.continueBtn       = page.getByRole('button', { name: 'Continue to company setup' });

    // ── Recruiting mode post-continue ────────────────────
    this.recruitingModeSetText  = page.getByText('Recruiting mode is set.');
    this.primaryCompanyHeading  = page.getByRole('heading', { name: 'Primary Company Profile' });
    this.primaryCompanySyncText = page.getByText('This profile syncs with the');

    // ── Agency mode switch (on Primary Company Profile page)
    this.agencyModeSwitch       = page.getByRole('switch');
    this.enableAgencyHeading    = page.getByRole('heading', { name: 'Enable agency mode?' });
    this.enableAgencyBodyText   = page.getByText('This will unlock multiple');
    this.enableAgencyConfirmBtn = page.getByRole('button', { name: 'Enable Agency Mode' });

    // ── "Add a company" modal that auto-opens after enabling agency mode ──
    this.addCompanyModalCancelBtn = page.getByRole('button', { name: 'Cancel' });

    // ── Agency mode post-enable ───────────────────────────
    this.agencyModeActiveText   = page.locator('div').filter({
      hasText: /^Agency modeMultiple companies can live in one workspace\.$/
    }).first();
    this.companyDirectoryHeading = page.getByRole('heading', { name: 'Company directory' });
    this.companyDirectorySubtext = page.getByText('Search, sort, edit, and');
    this.companyModeLabel        = page.locator('div').filter({ hasText: /^Company mode$/ });
    this.agencyModeOneTimeText   = page.getByText('Agency mode is a one-time');
  }

  // ═══════════════════════════════════════════════════════
  //  Sign Up actions
  // ═══════════════════════════════════════════════════════

  async navigate() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async assertLoginPageVisible() {
    await expect(this.hyreFastLogo).toBeVisible({ timeout: 15_000 });
  }

  async openSignUpTab() {
    await this.signUpTab.click();
    await expect(this.createAccountHeading).toBeVisible({ timeout: 10_000 });
  }

  async assertSignUpPageElements(expectedCredits = 25) {
    await expect(this.createAccountHeading).toBeVisible();
    await expect(this.page.getByText(new RegExp(`Get ${expectedCredits} credits when you sign`, 'i'))).toBeVisible();
  }

  /**
   * Fill and submit the sign-up form.
   * @param {Object} opts
   * @param {string} opts.fullName
   * @param {string} opts.phone
   * @param {string} opts.email
   * @param {string} opts.password
   */
  async fillAndSubmitSignUp({ fullName, phone, email, password }) {
    await this.fullNameInput.click();
    await this.fullNameInput.fill(fullName);

    await this.phoneInput.click();
    await this.phoneInput.fill(phone);

    await this.emailInput.click();
    await this.emailInput.fill(email);

    await this.passwordInput.click();
    await this.passwordInput.fill(password);

    await this.startTrialBtn.click();
  }

  async assertAccountCreated() {
    await expect(this.accountCreatedExact).toBeVisible({ timeout: 15_000 });
    await expect(this.accountCreatedFull).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Workspace setup — Recruiting mode
  // ═══════════════════════════════════════════════════════

  /**
   * Assert workspace mode selection screen is shown.
   */
  async assertWorkspaceSetupScreen() {
    await expect(this.firstWorkspaceSetupText).toBeVisible({ timeout: 20_000 });
    await expect(this.workspaceModeHeading).toBeVisible();
    await expect(this.recruitingModeBtn).toBeVisible();
    await expect(this.agencyModeBtn).toBeVisible();
  }

  /**
   * Select Recruiting mode and continue to company setup.
   * Asserts the "Primary Company Profile" screen appears.
   */
  async selectRecruitingMode() {
    await this.recruitingModeBtn.click();
    await this.continueBtn.click();
    await expect(this.recruitingModeSetText).toBeVisible({ timeout: 15_000 });
    await expect(this.primaryCompanyHeading).toBeVisible({ timeout: 10_000 });
    await expect(this.primaryCompanySyncText).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Workspace setup — Agency mode (path 1: choose at setup)
  // ═══════════════════════════════════════════════════════

  /**
   * Select Agency mode directly on the workspace setup screen.
   */
  async selectAgencyModeDirectly() {
    await this.agencyModeBtn.click();
    await this.continueBtn.click();
    // Confirm the "Enable agency mode?" dialog that appears at setup
    await expect(this.enableAgencyHeading).toBeVisible({ timeout: 10_000 });
    await this.enableAgencyConfirmBtn.click();
    // Close the auto-opened "Add a company" modal so directory is visible
    await expect(this.addCompanyModalCancelBtn).toBeVisible({ timeout: 10_000 });
    await this.addCompanyModalCancelBtn.click();
    // Agency mode continues to company directory
    await this.assertAgencyModeActive();
  }

  // ═══════════════════════════════════════════════════════
  //  Workspace setup — Agency mode (path 2: switch after recruiting)
  // ═══════════════════════════════════════════════════════

  /**
   * After being on Primary Company Profile page, toggle the agency switch,
   * confirm the dialog, and assert agency mode is active.
   */
  async enableAgencyModeViaSwitch() {
    await this.agencyModeSwitch.click();
    await expect(this.enableAgencyHeading).toBeVisible({ timeout: 10_000 });
    await expect(this.enableAgencyBodyText).toBeVisible();
    await this.enableAgencyConfirmBtn.click();
    await this.assertAgencyModeActive();
  }

  // ═══════════════════════════════════════════════════════
  //  Agency mode assertions
  // ═══════════════════════════════════════════════════════

  async assertAgencyModeActive() {
    await expect(this.agencyModeActiveText).toBeVisible({ timeout: 15_000 });
    await expect(this.companyDirectoryHeading).toBeVisible({ timeout: 10_000 });
    await expect(this.companyDirectorySubtext).toBeVisible();
    await expect(this.companyModeLabel).toBeVisible();
    await expect(this.agencyModeOneTimeText).toBeVisible();
  }
}

module.exports = { SignupPage };