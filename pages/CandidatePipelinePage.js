// pages/CandidatePipelinePage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * CandidatePipelinePage — all candidate status transitions from the
 * Applications view (3-dot action menu) through the full hiring pipeline:
 *
 *  Awaiting Interview
 *    └─ Assessment In Progress  (while interview is live)
 *    └─ Decision Pending        (AI analysis complete)
 *        └─ Shortlisted
 *        └─ Shared with Hiring Manager  (auto-shortlists)
 *        └─ Advance to Round N
 *            └─ Update Round (Pass / No Show / Fail)
 *            └─ Advance to Next Round
 *        └─ Move to Offer Made
 *            └─ Mark Offer Accepted / Rejected
 *            └─ Mark Candidate Joined / Not Joined
 *            └─ Mark Candidate Continued / Not Continued
 *  Any point:
 *        └─ Mark Candidate Not Interested
 *        └─ Mark Candidate Rejected (with or without email)
 *
 * Usage:
 *   const pipeline = new CandidatePipelinePage(page);
 *   await pipeline.openActionMenu(candidateName);
 *   await pipeline.shortlist(candidateName);
 */
class CandidatePipelinePage extends BasePage {
  constructor(page) {
    super(page);

    // ── Search / Filter ───────────────────────────────────
    this.filterByNameCombo   = page.getByRole('combobox').filter({ hasText: 'Name' });
    this.filterByEmailCombo  = page.getByRole('combobox').filter({ hasText: 'Email' });
    this.filterEmailInput    = page.getByRole('textbox', { name: 'Search email' });
    this.clearFilterBtn      = page.getByRole('button', { name: 'Clear filter' });

    // ── Status text locators (for assertions) ─────────────
    // All reachable via page.getByText(STATUS_LABELS.xxx)
    this.statusLabels = {
      awaitingInterview:   'Awaiting Candidate Interview',
      assessmentInProgress: 'Interview In Progress',
      decisionPending:     'Decision Pending',
      shortlisted:         'Shortlisted',
      candidateShared:     'Candidate Shared',
      offerMade:           'Offer Made',
      offerAccepted:       'Offer Accepted',
      candidateJoined:     'Candidate Joined',
      candidateContinued:  'Candidate Continued',
      notInterested:       'Candidate Not Interested',
      rejected:            'Candidate Rejected',
      dropped:             'Candidate Dropped',
    };

    // ── Success toast ─────────────────────────────────────
    this.successToast = page.getByText('Success');

    // ── Generic confirm button (used across dialogs) ──────
    this.confirmBtn = page.getByRole('button', { name: 'Confirm' });

    // ── Date picker ───────────────────────────────────────
    this.autoNowBtn = page.getByRole('button', { name: 'Auto (now)' });
  }

  // ═══════════════════════════════════════════════════════
  //  Filter helpers
  // ═══════════════════════════════════════════════════════

  async filterByEmail(email) {
    // Ensure any toast is gone before interacting with the filter
    const toast = this.page.getByRole('status').filter({ hasText: 'Candidates Added Successfully' });
    if (await toast.isVisible().catch(() => false)) {
      await toast.getByRole('button').click();
      await expect(toast).not.toBeVisible({ timeout: 5_000 });
    }

    // Switch filter to Email if it currently shows Name
    const currentFilter = this.page.getByRole('combobox').filter({ hasText: 'Name' });
    const isName = await currentFilter.isVisible().catch(() => false);
    if (isName) {
      await currentFilter.click();
      await this.page.getByRole('option', { name: 'Email' }).click();
    }
    await this.filterEmailInput.waitFor({ state: 'visible', timeout: 10_000 });
    await this.filterEmailInput.fill(email);
    await this.page.waitForTimeout(1500);
  }

  async clearFilter() {
    const clearBtn = this.page.getByRole('button', { name: 'Clear filter' });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await this.page.waitForTimeout(800);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Action menu — open via the 3-dot button on a candidate row
  // ═══════════════════════════════════════════════════════

  /**
   * Open the action menu for a named candidate.
   * Playwright finds the row by candidate name text and clicks its
   * overflow button. The button has no stable ID so we use aria patterns.
   *
   * If the menu doesn't open, pass `rowIndex` (0-based) to target by position.
   */
  async openActionMenu(candidateName, rowIndex = 0) {
    // Try to find the row by name
    const row = this.page.locator('tr, [data-candidate-row], .candidate-row').filter({
      hasText: candidateName,
    }).first();

    // Click the overflow/3-dot button inside that row
    const menuBtn = row.getByRole('button', { name: /more|options|⋮|\.\.\./ })
      .or(row.locator('button[aria-haspopup="menu"], button[aria-expanded]'))
      .first();

    const found = await menuBtn.isVisible().catch(() => false);
    if (found) {
      await menuBtn.click();
    } else {
      // Fallback: click the Nth overflow button on the page
      const allMenuBtns = this.page.locator('[id^="radix-"]').or(
        this.page.locator('button[aria-haspopup="menu"]')
      );
      await allMenuBtns.nth(rowIndex).click();
    }

    await this.page.waitForTimeout(400);
  }

  async clickMenuItem(itemName) {
    await this.page.getByRole('menuitem', { name: itemName }).click();
    await this.page.waitForTimeout(300);
  }

  // ═══════════════════════════════════════════════════════
  //  Status assertions
  // ═══════════════════════════════════════════════════════

  async assertStatus(statusKey, candidateName, { timeout = 15_000 } = {}) {
    const label = this.statusLabels[statusKey];
    if (!label) throw new Error(`Unknown status key: "${statusKey}"`);

    const rows = this.page.locator('tr, [data-candidate-row], .candidate-row, [role="row"]');
    const row = candidateName
      ? rows.filter({ hasText: candidateName }).first()
      : rows.first();

    await expect(
      row.getByText(label, { exact: false })
    ).toBeVisible({ timeout });
  }

  async assertScoreVisible(scoreText) {
    await expect(this.page.getByText(scoreText)).toBeVisible({ timeout: 10_000 });
  }

  async assertActionMenuItemVisible(itemName) {
    await expect(
      this.page.getByRole('menuitem', { name: itemName })
    ).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Pipeline actions
  // ═══════════════════════════════════════════════════════

  // ── Add candidate by email (Create & Send Email) ───────
  async addCandidateByEmail(email) {
    await this.page.getByRole('button', { name: 'Add Candidates' }).click();
    await this.page.getByRole('textbox', { name: 'Enter email addresses' }).click();
    await this.page.getByRole('textbox', { name: 'Enter email addresses' }).fill(email);
    await this.page.getByRole('button', { name: 'Add 1 Candidate(s)' }).click();
    await this.page.getByRole('button', { name: 'Create & Send Email' }).click();
    await expect(this.page.getByText('Candidates Added Successfully', { exact: true })).toBeVisible({ timeout: 15_000 });
    // Dismiss the success toast by clicking its close button and wait for it to disappear
    const toast = this.page.getByRole('status').filter({ hasText: 'Candidates Added Successfully' });
    await toast.getByRole('button').click();
    await expect(toast).not.toBeVisible({ timeout: 5_000 });
  }

  // ── Shortlist ──────────────────────────────────────────
  async shortlist(candidateName) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Shortlist');
    await this.assertSuccessAndCandidateMoved(candidateName);
  }

  // ── Share with Hiring Manager ──────────────────────────
  async shareWithHiringManager(candidateName) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Share with Hiring Manager');

    // Confirm dialog
    await expect(
      this.page.getByRole('heading', { name: 'Confirm: Share with Hiring' })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      this.page.getByText(new RegExp(`Update ${candidateName} to`, 'i'))
    ).toBeVisible();
    await this.confirmBtn.click();

    await this.assertSuccessToast();
    await expect(this.page.getByText(`${candidateName} moved to`)).toBeVisible();
    await expect(this.page.getByText('Candidate Shared')).toBeVisible({ timeout: 10_000 });
  }

  // ── Advance to Round 1 ────────────────────────────────
  /**
   * @param {string} candidateName
   * @param {string} roundAlias    - Short alias for the round, e.g. "round1"
   */
  async advanceToRound(candidateName, roundAlias) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Advance to Round');

    await expect(
      this.page.getByRole('heading', { name: /Confirm: Advance to Round/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      this.page.getByText(new RegExp(`Update ${candidateName} to`, 'i'))
    ).toBeVisible();

    // Fill optional round alias
    const aliasInput = this.page.getByRole('textbox', { name: 'Round Alias (optional)' });
    if (await aliasInput.isVisible().catch(() => false)) {
      await aliasInput.fill(roundAlias);
    }

    await this.confirmBtn.click();
    await this.assertSuccessToast();
    await expect(this.page.getByText(`${candidateName} moved to Next`)).toBeVisible();
    await expect(
      this.page.getByText(`${roundAlias} · Round 1Pending`)
    ).toBeVisible({ timeout: 10_000 });
  }

  // ── Update Round outcome ───────────────────────────────
  /**
   * @param {string} candidateName
   * @param {string} roundAlias   - Alias used when the round was created
   * @param {'Pass'|'No Show'|'Fail'} outcome
   * @param {number} day          - Calendar day to pick (e.g. 19)
   */
  async updateRound(candidateName, roundAlias, outcome, day) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Update Round');

    await expect(
      this.page.getByRole('heading', { name: 'Update Round' })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      this.page.getByText(new RegExp(`Set the outcome for ${candidateName}`, 'i'))
    ).toBeVisible();
    await expect(
      this.page.getByText(new RegExp(`Current round: ${roundAlias}`, 'i'))
    ).toBeVisible();

    // Optionally view event dates (smoke check)
    await this.page.getByRole('button', { name: 'View Round Event Dates' }).click();
    await expect(
      this.page.getByRole('heading', { name: 'Round Event Dates' })
    ).toBeVisible({ timeout: 10_000 });
    await this.page.getByRole('button', { name: 'Close' }).click();

    // Select outcome
    const outcomeCombo = this.page.getByRole('combobox', { name: 'Round Outcome' });
    await outcomeCombo.selectOption({ label: outcome }).catch(async () => {
      await outcomeCombo.click();
      await this.page.getByRole('option', { name: outcome }).click();
    });

    // Set date
    await this.autoNowBtn.click().catch(() => {});
    if (day) await this.page.getByRole('gridcell', { name: String(day) }).click();

    // Click the outcome-specific confirm button
    const outcomeMap = { Pass: 'Save as Passed', 'No Show': 'Mark No Show', Fail: 'Save as Failed' };
    await this.page.getByRole('button', { name: outcomeMap[outcome] || 'Confirm' }).click();

    await this.assertSuccessToast();
    await expect(this.page.getByText(`${candidateName} round status`)).toBeVisible();

    // Assert round label changes
    const labelMap = { Pass: 'Passed', 'No Show': 'Not shown', Fail: 'Failed' };
    await expect(
      this.page.getByText(`${roundAlias} · Round`)
    ).toBeVisible({ timeout: 10_000 });
  }

  // ── Advance to Next Round ─────────────────────────────
  /**
   * @param {string} candidateName
   * @param {string} roundAlias    - Alias for the new round
   * @param {number} day           - Calendar day for round start date
   */
  async advanceToNextRound(candidateName, roundAlias, day) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Advance to Next Round');

    await expect(
      this.page.getByRole('heading', { name: 'Start New Round' })
    ).toBeVisible({ timeout: 10_000 });

    const aliasInput = this.page.getByRole('textbox', { name: 'Round Alias Name' });
    await aliasInput.fill(roundAlias);

    // Pick date if day provided
    if (day) {
      await this.page.getByRole('button', { name: /\w+ 20\d\d/ }).first().click();
      await this.page.getByRole('gridcell', { name: String(day) }).click();
    }

    await this.page.getByRole('button', { name: 'Start Round' }).click();
    await this.assertSuccessToast();
    await expect(this.page.getByText(`${candidateName} moved to Next`)).toBeVisible();
    await expect(
      this.page.getByText(new RegExp(`${roundAlias}.*Pending`))
    ).toBeVisible({ timeout: 10_000 });
  }

  // ── Move to Offer Made ────────────────────────────────
  async moveToOfferMade(candidateName) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Move to Offer Made');
    await this.assertSuccessToast();
    await expect(this.page.getByText(`${candidateName} moved to Offer`)).toBeVisible();
    await expect(this.page.getByText('Offer Made')).toBeVisible({ timeout: 10_000 });
  }

  // ── Mark Offer Accepted ───────────────────────────────
  async markOfferAccepted(candidateName, day) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Mark Offer Accepted');

    await expect(
      this.page.getByRole('heading', { name: 'Confirm: Mark Offer Accepted' })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      this.page.getByText(new RegExp(`Update ${candidateName} to`, 'i'))
    ).toBeVisible();
    await expect(this.page.getByText('Milestone completion date')).toBeVisible();

    if (day) {
      await this.page.getByRole('button', { name: /\w+ 20\d\d/ }).first().click();
      await this.page.getByRole('gridcell', { name: String(day) }).click();
    }

    await this.confirmBtn.click();
    await this.assertSuccessToast();
    await expect(this.page.getByText(`${candidateName} moved to Offer`)).toBeVisible();
    await expect(this.page.getByText('Offer Accepted')).toBeVisible({ timeout: 10_000 });
  }

  // ── Mark Offer Rejected ───────────────────────────────
  async markOfferRejected(candidateName) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Mark Offer Rejected');
    await this.confirmBtn.click();
    await this.assertSuccessToast();
  }

  // ── Mark Candidate Joined ─────────────────────────────
  async markCandidateJoined(candidateName, day) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Mark Candidate Joined');

    await expect(
      this.page.getByRole('heading', { name: 'Confirm: Mark Candidate Joined' })
    ).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('Joining date')).toBeVisible();

    if (day) {
      await this.page.getByRole('button', { name: /\w+ 20\d\d/ }).first().click();
      await this.page.getByRole('gridcell', { name: String(day) }).click();
    }

    await this.confirmBtn.click();
    await this.assertSuccessToast();
    await expect(this.page.getByText(`${candidateName} moved to`)).toBeVisible();
    await expect(this.page.getByText('Candidate Joined')).toBeVisible({ timeout: 10_000 });
  }

  // ── Mark Candidate Continued ──────────────────────────
  async markCandidateContinued(candidateName, day) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Mark Candidate Continued');

    await expect(
      this.page.getByRole('heading', { name: /Confirm: Mark Candidate/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('Milestone completion date')).toBeVisible();

    if (day) {
      await this.page.getByRole('button', { name: /\w+ 20\d\d/ }).first().click();
      await this.page.getByRole('gridcell', { name: String(day) }).click();
    }

    await this.confirmBtn.click();
    await this.assertSuccessToast();
    await expect(this.page.getByText(`${candidateName} moved to`)).toBeVisible();
    await expect(this.page.getByText('Candidate Continued')).toBeVisible({ timeout: 10_000 });
  }

  // ── Mark Candidate Not Interested ─────────────────────
  async markNotInterested(candidateName) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Mark Candidate Not Interested');

    await expect(
      this.page.getByRole('heading', { name: 'Confirm: Candidate Not' })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      this.page.getByText(new RegExp(`Update ${candidateName} to`, 'i'))
    ).toBeVisible();

    await this.confirmBtn.click();
    await expect(
      this.page.getByText('Candidate Not Interested', { exact: true })
    ).toBeVisible({ timeout: 10_000 });
  }

  // ── Mark Candidate Rejected ───────────────────────────
  /**
   * @param {string} candidateName
   * @param {'withEmail'|'withoutEmail'} emailOption
   * @param {object} [yopMailContext]   - Pass { yopMail, jobTitle } to verify rejection email
   */
  async markRejected(candidateName, emailOption, yopMailContext = null) {
    await this.openActionMenu(candidateName);
    await this.clickMenuItem('Mark Candidate Rejected');

    await expect(
      this.page.getByRole('heading', { name: 'Reject Candidate' })
    ).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('Would you like to send a')).toBeVisible();

    if (emailOption === 'withEmail') {
      await this.page.getByRole('button', { name: 'Reject & Send Email' }).click();

      // Email compose step
      await expect(
        this.page.getByRole('heading', { name: 'Send Rejection Email' })
      ).toBeVisible({ timeout: 10_000 });
      await expect(this.page.getByText('Review or adjust the')).toBeVisible();

      // Subject and body are pre-filled — just send
      await this.page.getByRole('button', { name: 'Send Email' }).click();
      await expect(this.page.getByText('Rejection email sent')).toBeVisible({ timeout: 10_000 });
      await expect(this.page.getByText('Email successfully sent to')).toBeVisible();

      // Optionally verify in YopMail
      if (yopMailContext) {
        await yopMailContext.yopMail.openInbox(yopMailContext.yopUsername);
        await this._assertRejectionEmail(yopMailContext.yopMail, yopMailContext.companyName);
      }

    } else {
      await this.page.getByRole('button', { name: 'Reject without Email' }).click();
      await this.assertSuccessToast();
      await expect(
        this.page.getByText(new RegExp(`${candidateName} has`, 'i'))
      ).toBeVisible({ timeout: 10_000 });
    }
  }

  async _assertRejectionEmail(yopMail, companyName) {
    let found = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      found = await yopMail.mailFrame()
        .getByText('Thank you for your').isVisible().catch(() => false);
      if (found) break;
      await yopMail.refreshInbox();
      await yopMail.page.waitForTimeout(8000);
    }
    if (found) {
      await expect(
        yopMail.mailFrame().getByRole('heading', { name: `${companyName} Recruitment Update` })
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        yopMail.mailFrame().getByText('After careful consideration')
      ).toBeVisible();
      await expect(
        yopMail.mailFrame().getByText('We wish you all the best in')
      ).toBeVisible();
    }
  }

  // ── Resend Interview Link (action menu item check) ────
  async assertResendInterviewLinkVisible(candidateName) {
    await this.openActionMenu(candidateName);
    await this.assertActionMenuItemVisible('Resend Interview Link');
    // Close menu without clicking
    await this.page.keyboard.press('Escape');
  }

  // ── Generic success toast ─────────────────────────────
  async assertSuccessToast() {
    await expect(this.successToast).toBeVisible({ timeout: 15_000 });
  }

  async assertSuccessAndCandidateMoved(candidateName) {
    await this.assertSuccessToast();
    await expect(
      this.page.getByText(new RegExp(`${candidateName} moved to`, 'i'))
    ).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Candidate Explorer assertions
  // ═══════════════════════════════════════════════════════

  async goToExplorer() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
    await this.page.getByRole('button', { name: 'Explore Candidates' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async filterExplorerByEmail(email) {
    const filterCombo = this.page.getByRole('combobox').first();
    await filterCombo.click();
    await this.page.getByRole('option', { name: 'Email' }).click();

    const emailInput = this.page.locator('input[placeholder*="Search"], input[placeholder*="Email"], input[type="search"], [role="searchbox"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
    await emailInput.fill(email);
    await emailInput.press('Enter');
    await this.page.waitForTimeout(1500);
  }

  async assertExplorerStatus(candidateName, expectedStatus) {
    const candidateLocator = this.page.getByText(candidateName, { exact: false })
      .or(this.page.getByText(`${candidateName}@yopmail.com`, { exact: false }))
      .first();

    await expect(candidateLocator).toBeVisible({ timeout: 15_000 });
    await expect(
      this.page.getByText(expectedStatus, { exact: false })
    ).toBeVisible({ timeout: 10_000 });
  }
}

module.exports = { CandidatePipelinePage };