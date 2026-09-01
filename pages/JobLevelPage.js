// pages/JobLevelPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * JobLevelPage — all job-level tab features accessible from View JD.
 *
 * Tabs:
 *  Overview         → View JD details
 *  Interview Links  → ?tab=links   — CRUD for interview links + public apply form
 *  Interview Pipeline → ?tab=pipeline — Customize rounds
 *  Source Document  → ?tab=source-document
 *  Access Settings  → ?tab=settings  — Team & individual access + external access
 *  Edit Job Details → via 3-dot menu
 */
class JobLevelPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Dashboard nav ─────────────────────────────────────
    this.jobSearchInput  = page.getByRole('textbox', { name: 'Search by job name or ID' });
    this.allCompaniesCombo = page.getByRole('combobox').filter({ hasText: 'All companies' });

    // ── 3-dot overflow (positional) ───────────────────────
    this.overflowBtn = (nth = 5) =>
      page.getByRole('button').filter({ hasText: /^$/ }).nth(nth);

    // ── View JD ───────────────────────────────────────────
    this.viewJDMenuItem     = page.getByRole('menuitem', { name: 'View JD' });
    this.jobInfoHeading     = page.getByRole('heading', { name: 'Job Information' });
    this.totalApplicants    = (n) => page.getByText(`${n}Total Applicants`);

    // ── Tab navigation ────────────────────────────────────
    this.interviewLinksTab  = page.getByRole('tab', { name: 'Interview Links' });
    this.pipelineTab        = page.getByRole('tab', { name: 'Interview Pipeline' });
    this.sourceDocTab       = page.getByRole('tab', { name: 'Source Document' });
    this.accessSettingsTab  = page.getByRole('tab', { name: 'Access Settings' });
    this.editJobMenuItem    = page.getByRole('menuitem', { name: 'Edit Job Details' });

    // ── Interview Links CRUD ──────────────────────────────
    this.createNewLinkBtn   = page.getByRole('button', { name: 'Create New Link' });
    this.linkNameInput      = page.getByRole('textbox', { name: 'Link Name *' });
    this.usesCombo          = page.getByRole('combobox');
    this.expirationBtn      = page.getByRole('button', { name: /Select expiration date/i });
    this.createLinkBtn      = page.getByRole('button', { name: 'Create Link' });
    this.updateLinkBtn      = page.getByRole('button', { name: 'Update Link' });
    this.linkUpdatedToast   = page.getByText('Interview link updated');
    this.deleteLinkBtn      = page.getByRole('button', { name: 'Delete Link' });
    this.linkDeletedToast   = page.getByText('Interview link deleted');

    // ── Pipeline ──────────────────────────────────────────
    this.customizeRoundsBtn = page.getByRole('button', { name: 'Customize Rounds' });
    this.addRoundBtn        = page.getByRole('button', { name: 'Add Round' });
    this.savePipelineBtn    = page.getByRole('button', { name: 'Save Changes' });
    this.pipelineUpdatedToast = page.getByText(/pipeline updated|updated successfully/i);
    this.pipelineCustomisedText = page.getByText(/pipeline customized|customized for this job/i);

    // ── Source Document ───────────────────────────────────
    this.originalUploadedText = page.getByText('Original uploaded job');

    // ── Access Settings ───────────────────────────────────
    this.selectTeamsBtn       = page.getByRole('button', { name: 'Select teams' });
    this.grantTeamAccessBtn   = page.getByRole('button', { name: 'Grant team access' });
    this.teamAccessRevokedText = page.getByText('Team access revoked');
    this.selectMemberBtn      = page.getByRole('button', { name: 'Select team member...' });
    this.memberSearchInput    = page.getByPlaceholder('Search members...');
    this.memberAddedToast     = page.getByText('Member access revoked').or(page.getByText('Member added'));
    this.memberAccessRevokedText = page.getByText('Member access revoked');
    this.externalAccessSwitch = page.getByRole('switch', { name: 'Enable External Access' });
    this.externalAccessEnabled = page.getByText('External access enabled');
    this.externalEmailInput   = page.getByRole('textbox', { name: 'name@company.com' });
    this.inviteExternalBtn    = page.getByRole('button', { name: 'Invite' });
    this.revokeExternalBtn    = page.getByRole('button', { name: 'Revoke' });
    this.resendExternalBtn    = page.getByRole('button', { name: 'Resend' });

    // ── Edit Job Details form ─────────────────────────────
    this.roleTitleInput      = page.getByRole('textbox', { name: 'Role title' });
    this.companyCombo        = page.getByRole('combobox', { name: 'Company' });
    this.slaInput            = page.getByPlaceholder('Enter SLA...');
    this.spocCombo           = page.getByRole('combobox', { name: 'Single Point of Contact (SPOC)' });
    this.jobIDInput          = page.getByRole('textbox', { name: 'Job ID' });
    this.deadlineInput       = page.getByRole('textbox', { name: 'Application deadline' });
    this.jobStatusCombo      = page.getByRole('combobox', { name: 'Job status' });
    this.mobileInterviewSwitch = page.getByRole('switch', { name: 'Toggle mobile interview' });
    this.agentInterviewSwitch  = page.getByRole('switch', { name: 'Enable agent interview for' });
    this.preScreeningSwitch    = page.getByRole('switch', { name: 'Enable pre-screening for this' });
    this.skillsTab           = page.getByRole('tab', { name: 'Skills' });
    this.topicsTab           = page.getByRole('tab', { name: 'Topics' });
    this.questionsTab        = page.getByRole('tab', { name: 'Questions' });
    this.saveChangesBtn      = page.getByRole('button', { name: 'Save changes' });
  }

  // ═══════════════════════════════════════════════════════
  //  Navigation
  // ═══════════════════════════════════════════════════════

  async searchJobOnDashboard(query) {
    await this.jobSearchInput.fill(query);
    await this.page.waitForTimeout(1500);
  }

  async filterByCompany(companyLabel) {
    await this.allCompaniesCombo.click();
    await this.page.getByLabel(companyLabel).getByText(companyLabel).click();
    await this.page.waitForTimeout(500);
  }

  async openViewJD(overflowNth = 5) {
    await this.overflowBtn(overflowNth).click();
    await this.viewJDMenuItem.click();
    await this.page.waitForLoadState('networkidle');
  }

  async openEditJobDetails(overflowNth = 5) {
    await this.overflowBtn(overflowNth).click();
    await this.editJobMenuItem.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ═══════════════════════════════════════════════════════
  //  View JD assertions
  // ═══════════════════════════════════════════════════════

  /**
   * Assert all captured job fields in View JD.
   * @param {Object} fields  — any subset of { jobTitle, status, location, workMode,
   *                           workType, experience, salary, employmentType, applicantCount }
   */
  async assertViewJDFields({ jobTitle, status, location, workMode,
                              workType, experience, salary,
                              employmentType, applicantCount } = {}) {
    await expect(this.jobInfoHeading).toBeVisible({ timeout: 15_000 });

    if (jobTitle)  await expect(this.page.getByLabel('Overview').getByText(new RegExp(jobTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeVisible({ timeout: 10_000 });
    if (status)    await expect(this.page.getByText(status).first()).toBeVisible({ timeout: 10_000 });
    if (location)  await expect(this.page.getByText(new RegExp(`Location:.*${location}`, 'i'))).toBeVisible({ timeout: 10_000 });
    if (workMode)  await expect(this.page.getByText(`Work Mode:${workMode}`)).toBeVisible({ timeout: 10_000 });
    if (workType)  await expect(this.page.getByText(`Work Type:${workType}`)).toBeVisible({ timeout: 10_000 });
    if (experience) await expect(this.page.getByText(new RegExp(`Experience:.*${experience}`, 'i'))).toBeVisible({ timeout: 10_000 });
    if (salary)    await expect(this.page.getByText(new RegExp(`Salary:.*${salary}`, 'i'))).toBeVisible({ timeout: 10_000 });
    if (employmentType) await expect(this.page.getByText(`Employment Type${employmentType}`)).toBeVisible({ timeout: 10_000 });
    if (applicantCount !== undefined) await expect(this.totalApplicants(applicantCount)).toBeVisible({ timeout: 10_000 });

    // Always present
    await expect(this.page.getByRole('heading', { name: 'Job Title' })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Posting Details' })).toBeVisible();
    await expect(this.page.getByText(/Created\d/)).toBeVisible();
    await expect(this.page.getByText('Last Updated')).toBeVisible();
  }

  /** Capture current job details dynamically for later comparison */
  async captureViewJDDetails() {
    const data = {};
    const tryText = async (locator) => {
      try { return await locator.innerText({ timeout: 3000 }); } catch { return null; }
    };
    data.jobTitle  = await tryText(this.page.getByRole('heading').first());
    data.status    = await tryText(this.page.getByText(/published|draft|hiring/i).first());
    data.location  = await tryText(this.page.getByText(/Location:/i).first());
    data.workMode  = await tryText(this.page.getByText(/Work Mode:/i).first());
    data.workType  = await tryText(this.page.getByText(/Work Type:/i).first());
    data.experience = await tryText(this.page.getByText(/Experience:/i).first());
    data.salary    = await tryText(this.page.getByText(/Salary:/i).first());
    console.log('[JobLevelPage] Captured View JD:', data);
    return data;
  }

  // ═══════════════════════════════════════════════════════
  //  Interview Links tab
  // ═══════════════════════════════════════════════════════

  async navigateToLinksTab() {
    await this.interviewLinksTab.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Create an interview link.
   * @param {{ name, uses, expirationDay, expirationHour, toggles }} opts
   *   uses: e.g. '1 use' | '5 uses' | 'Unlimited'
   *   expirationDay: calendar grid cell label, e.g. '25'
   *   expirationHour: time button label, e.g. '01:00'
   *   toggles: number of switches to click (default 2)
   */
  async createInterviewLink({ name, uses, expirationDay, expirationHour, toggles = 2 }) {
    await this.createNewLinkBtn.click();
    await this.linkNameInput.fill(name);

    // ── Select number of uses ──────────────────────────────
    if (uses) {
      await this.usesCombo.click();
      await this.page.getByRole('option', { name: uses, exact: true }).click();
    }

    // ── Open expiration date picker ─────────────────────────
    await this.expirationBtn.click();

    // Wait for calendar to appear
    const calendar = this.page.locator('[role="dialog"]')
      .filter({ hasText: /August|September|October|November|December|January|February|March|April|May|June|July/i })
      .last();
    await calendar.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});

    // ── Select expiration date ─────────────────────────────
    const targetDay = expirationDay || this._futureCalendarDay();

    // Pick the first enabled day cell matching the target day.
    // If the target day is in the past for the current month, advance one month.
    let dateCell = this.page.locator('button[role="gridcell"]:not([disabled])')
      .filter({ hasText: new RegExp(`^${targetDay}$`) }).first();

    if (!(await dateCell.isVisible().catch(() => false))) {
      const nextMonthBtn = this.page.locator('[role="dialog"] button')
        .filter({ has: this.page.locator('svg') }).last();
      await nextMonthBtn.click();
      await this.page.waitForTimeout(400);
      dateCell = this.page.locator('button[role="gridcell"]:not([disabled])')
        .filter({ hasText: new RegExp(`^${targetDay}$`) }).first();
    }

    await dateCell.waitFor({ state: 'visible', timeout: 5_000 });
    await dateCell.scrollIntoViewIfNeeded();
    await dateCell.click();
    await this.page.waitForTimeout(500);

    // ── Select expiration time ─────────────────────────────
    const targetHour = expirationHour || this._futureHourLabel();
    const timeButton = this.page.getByRole('button', { name: targetHour, exact: true });
    await timeButton.waitFor({ state: 'visible', timeout: 5_000 });
    await timeButton.click();
    await this.page.waitForTimeout(300);

    // ── Toggle options ─────────────────────────────────────
    for (let i = 0; i < toggles; i++) {
      await this.page.getByRole('switch').nth(i).click();
    }

    // ── Create link ─────────────────────────────────────────
    await this.createLinkBtn.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Return the day-of-month for a date a few days in the future.
   */
  _futureCalendarDay(daysAhead = 3) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return String(d.getDate());
  }

  /**
   * Return a time label one hour ahead of now, e.g. '14:00'.
   */
  _futureHourLabel(hoursAhead = 1) {
    const d = new Date();
    d.setHours(d.getHours() + hoursAhead, 0, 0, 0);
    const hh = String(d.getHours()).padStart(2, '0');
    return `${hh}:00`;
  }

  /**
   * Edit the first visible link card.
   * @param {{ toggles }} opts
   */
  /**
   * Return the action buttons row of the link card matching the given name.
   * Order observed: Copy link, Open link, Link settings, Enable/Disable, Delete.
   * @param {string} linkName
   */
  _linkCardActionBar(linkName = /automation-link/i) {
    const linkCard = this.page.locator('div').filter({ hasText: linkName }).first();
    return linkCard.locator('.flex.items-center.justify-between.p-4 > .flex.items-center.space-x-2');
  }

  async editInterviewLink({ linkName = /automation-link/i, toggles = 2 } = {}) {
    // Link settings (gear icon) is the 3rd action button
    const actionBar = this._linkCardActionBar(linkName);
    const settingsBtn = actionBar.locator('button').nth(2);
    await settingsBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await settingsBtn.scrollIntoViewIfNeeded();
    await settingsBtn.click({ force: true });

    for (let i = 0; i < toggles; i++) {
      await this.page.getByRole('switch').nth(i).click();
    }
    await this.updateLinkBtn.click();
    await expect(this.linkUpdatedToast).toBeVisible({ timeout: 10_000 });
  }

  async deleteInterviewLink({ linkName = /automation-link/i } = {}) {
    // Delete is the last action button in the link card
    const actionBar = this._linkCardActionBar(linkName);
    const deleteBtn = actionBar.locator('button').last();
    await deleteBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await deleteBtn.scrollIntoViewIfNeeded();
    await deleteBtn.click({ force: true });
    await this.deleteLinkBtn.click();
    await expect(this.linkDeletedToast).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Open the public link (opens popup), fill apply form, submit, assert confirmation.
   * @param {{ fullName, email, phone }} applicant
   */
  async testPublicLinkApply({ linkName = /automation-link/i, fullName, email, phone }) {
    const popup = this.page.waitForEvent('popup');
    // Open link is the 2nd action button in the matching link card
    const actionBar = this._linkCardActionBar(linkName);
    await actionBar.locator('button').nth(1).click({ force: true });
    const publicPage = await popup;
    await publicPage.waitForLoadState('networkidle');

    // Assert public page loads
    await expect(publicPage.getByText('Private Interview Process')).toBeVisible({ timeout: 15_000 });
    await expect(publicPage.getByText('After submitting this form')).toBeVisible();

    // Fill form
    await publicPage.getByRole('textbox', { name: 'Full Name *' }).fill(fullName);
    await publicPage.getByRole('textbox', { name: 'Email Address *' }).fill(email);
    await publicPage.getByRole('textbox', { name: 'Phone Number *' }).fill(phone);
    await publicPage.getByRole('button', { name: 'Submit Application & Get' }).click();
    await publicPage.waitForTimeout(2000);

    // Assert success — accept either the post-submit confirmation or the "already applied" state
    const successHeading = publicPage.getByRole('heading').filter({ hasText: /Application Submitted|Interview Link Sent|Already Applied|Application Received/i });
    await expect(successHeading.first()).toBeVisible({ timeout: 15_000 });

    await publicPage.getByRole('button', { name: /Close|OK|Done/i }).first().click().catch(() => {});
    return publicPage;
  }

  // ═══════════════════════════════════════════════════════
  //  Interview Pipeline tab
  // ═══════════════════════════════════════════════════════

  async navigateToPipelineTab() {
    await this.pipelineTab.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Customize pipeline rounds.
   * @param {{ pipelineType, rounds }} opts
   *   pipelineType: e.g. 'Sales' — option in the pipeline type combobox
   *   rounds: [{ name, toggleNth }] — each round to configure
   */
  async customizePipeline({ pipelineType, rounds = [] }) {
    await this.customizeRoundsBtn.click();

    if (pipelineType) {
      await this.page.getByRole('combobox').click();
      await this.page.getByRole('option', { name: pipelineType }).click();
    }

    const allRoundInputs = this.page.getByRole('textbox', { name: 'e.g. Technical Interview' });
    const allAliasInputs = this.page.getByRole('textbox', { name: 'e.g. TI' });

    // Configure existing rounds first
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const roundInput = allRoundInputs.nth(i);
      await roundInput.scrollIntoViewIfNeeded();
      await roundInput.fill(round.name);

      // Fill alias if the field is present for this round
      const aliasInput = allAliasInputs.nth(i);
      if (round.alias && await aliasInput.isVisible().catch(() => false)) {
        await aliasInput.fill(round.alias);
      }

      if (round.toggleNth !== undefined) {
        await this.page.getByRole('switch').nth(round.toggleNth).click();
      }
    }

    await this.savePipelineBtn.click();
    // Wait for either a success toast or the customized indicator on the page.
    await expect(this.pipelineUpdatedToast.or(this.pipelineCustomisedText)).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Source Document tab
  // ═══════════════════════════════════════════════════════

  async navigateToSourceDocTab() {
    await this.sourceDocTab.click();
    await this.page.waitForTimeout(500);
  }

  async assertSourceDocumentVisible(docNameFragment) {
    await expect(this.originalUploadedText).toBeVisible({ timeout: 10_000 });
    if (docNameFragment) {
      await expect(this.page.getByText(docNameFragment)).toBeVisible({ timeout: 10_000 });
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Access Settings tab
  // ═══════════════════════════════════════════════════════

  async navigateToAccessSettingsTab() {
    await this.accessSettingsTab.click();
    await this.page.waitForTimeout(500);
  }

  async assignTeamAccess() {
    await this.selectTeamsBtn.click();
    // Gather team names that already have access from the page.
    const inheritedChips = await this.page.locator('div').filter({ hasText: /Teams with inherited access/i })
      .locator('..').locator('span, div, button').allInnerTexts();
    const assignedMembers = await this.page.locator('table tbody tr td:first-child').allInnerTexts();
    const alreadyGranted = new Set([...inheritedChips, ...assignedMembers].map(t => t.trim()).filter(Boolean));

    // Pick the first dropdown option whose team name is not already granted.
    const options = this.page.getByRole('option');
    const count = await options.count();
    let teamName = null;
    for (let i = 0; i < count; i++) {
      const option = options.nth(i);
      const optionText = await option.innerText();
      // Team name is everything before the member count line, e.g. "New team 18/05\n1 member".
      const name = optionText.split(/\n|\d+\s*member/i)[0].trim();
      if (name && !alreadyGranted.has(name)) {
        await option.click();
        teamName = name;
        break;
      }
    }
    if (!teamName) {
      // No grantable team available — close dropdown and signal caller to skip.
      await this.page.keyboard.press('Escape');
      return null;
    }
    await this.grantTeamAccessBtn.click();
    await expect(this.page.getByText(/Access granted to/i)).toBeVisible({ timeout: 10_000 });
    return teamName;
  }

  async revokeTeamAccess(teamName) {
    // Click the delete icon on the team chip in "Teams with inherited access".
    const chip = this.page.locator('div').filter({ hasText: /Teams with inherited access/i })
      .locator('..').locator('div, span').filter({ hasText: new RegExp(teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();
    await chip.locator('button').filter({ hasText: /^$/ }).first().click();
    await expect(this.page.getByText(/access revoked|removed|deleted/i).first()).toBeVisible({ timeout: 10_000 });
  }

  async assignIndividualMember() {
    await this.selectMemberBtn.click();
    // Select the first available member option and capture the name for revocation.
    const firstOption = this.page.getByRole('option').first();
    const optionText = await firstOption.innerText();
    const memberName = optionText.split(/\n/)[0].trim();
    await firstOption.click();
    // Click the add/confirm button (the primary button with the plus icon) next to the member dropdown.
    await this.page.locator('.p-6 > .flex.space-x-2 > .inline-flex.items-center.justify-center').click();
    await this.page.waitForTimeout(500);
    return memberName;
  }

  async revokeMemberAccess(memberName) {
    // Click the delete/revoke icon on the row containing the given member name.
    const memberRow = this.page.locator('tr').filter({ hasText: new RegExp(memberName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();
    await memberRow.locator('button').filter({ hasText: /^$/ }).last().click();
    await expect(this.memberAccessRevokedText).toBeVisible({ timeout: 10_000 });
  }

  async enableExternalAccess() {
    const isEnabled = await this.externalAccessSwitch.getAttribute('aria-checked') === 'true';
    if (!isEnabled) {
      await this.externalAccessSwitch.click();
    }
    // Confirm the invite form is visible (external access is on).
    await expect(this.externalEmailInput).toBeVisible({ timeout: 10_000 });
  }

  async inviteExternalUser(email, visibilityOption = 'Shortlisted') {
    await this.externalEmailInput.fill(email);
    // Open the invite-level visibility dropdown (the one next to the email input).
    await this.page.locator('form, .flex').filter({ has: this.externalEmailInput }).getByRole('combobox').click();
    await this.page.getByRole('option', { name: visibilityOption }).click();
    await this.inviteExternalBtn.click();
    await this.page.waitForTimeout(500);
  }

  async updateExternalUserVisibility(email, newVisibility) {
    const row = this.page.getByRole('row', { name: new RegExp(email) });
    await row.getByRole('combobox').click();
    await this.page.locator('[role="listbox"]').last().getByRole('option', { name: newVisibility }).click();
    await this.page.waitForTimeout(500);
  }

  async revokeExternalUser(email) {
    const row = this.page.getByRole('row', { name: new RegExp(email) });
    await row.getByRole('button', { name: 'Revoke' }).click();
    await this.page.waitForTimeout(500);
  }

  async resendExternalUser(email) {
    const row = this.page.getByRole('row', { name: new RegExp(email) });
    await row.getByRole('button', { name: 'Resend' }).click();
    await this.page.waitForTimeout(500);
  }

  // ═══════════════════════════════════════════════════════
  //  Edit Job Details
  // ═══════════════════════════════════════════════════════

  /**
   * Capture current job details from Edit Job Details form for later assertion.
   */
  async captureJobDetails() {
    const data = {};
    data.roleTitle = await this.roleTitleInput.inputValue().catch(() => null);
    data.jobID     = await this.jobIDInput.inputValue().catch(() => null);
    data.deadline  = await this.deadlineInput.inputValue().catch(() => null);
    console.log('[JobLevelPage] Captured job details:', data);
    return data;
  }

  /**
   * Edit job details.
   * @param {{ roleTitle, company, jobID, deadline, jobStatus, spocText,
   *           mobileInterview, agentInterview, preScreening }} fields
   */
  async editJobDetails({ roleTitle, company, jobID, deadline, jobStatus,
                         spocText, mobileInterview, agentInterview, preScreening } = {}) {
    if (roleTitle) {
      await this.roleTitleInput.click();
      await this.roleTitleInput.fill(roleTitle);
    }
    if (company) {
      await this.companyCombo.click();
      await this.page.getByRole('option', { name: company }).click();
    }
    if (spocText) {
      await this.spocCombo.click();
      await this.page.getByText(spocText).first().click();
    }
    if (jobID) {
      await this.jobIDInput.click();
      await this.jobIDInput.fill(jobID);
    }
    if (deadline) {
      await this.deadlineInput.fill(deadline);
    }
    if (jobStatus) {
      await this.jobStatusCombo.click();
      await this.page.getByRole('option', { name: jobStatus }).click();
    }
    if (mobileInterview !== undefined) await this.mobileInterviewSwitch.click();
    if (agentInterview  !== undefined) await this.agentInterviewSwitch.click();
    if (preScreening    !== undefined) await this.preScreeningSwitch.click();

    // Navigate Skills → Topics → Questions tabs to verify they load
    await this.skillsTab.click();
    await this.page.waitForTimeout(500);
    await this.topicsTab.click();
    await this.page.waitForTimeout(500);
    await this.questionsTab.click();
    await this.page.waitForTimeout(500);

    await this.saveChangesBtn.click();
    await expect(this.page.getByRole('status')).toBeVisible({ timeout: 15_000 });
  }
}

module.exports = { JobLevelPage };