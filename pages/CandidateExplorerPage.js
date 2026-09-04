const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * CandidateExplorerPage — POM for https://staging.hyrefast.ai/explore-candidates
 *
 * Covers:
 *   - Search dropdown (Candidate, Email, Phone, Role, Company, Job ID)
 *   - Advanced Filters dialog (Application Status, Interview Link Status, Applicant Added By)
 *   - Show Active Candidates Only toggle
 *   - Rows per page dropdown
 *   - Table column sorting
 *   - Row action menu dropdown
 */
class CandidateExplorerPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Page header ───────────────────────────────────────
    this.exploreHeading = page.getByRole('heading', { name: 'Explore Candidates' });
    this.refreshBtn     = page.getByRole('button', { name: 'Refresh Tracker' });

    // ── Search / filter bar ───────────────────────────────
    this.searchCombo    = page.getByRole('combobox').filter({ hasText: /Candidate|Email|Phone|Role|Company|Job ID/ }).first();
    this.searchInput    = page.locator('input[placeholder*="Search candidates"]').first();

    this.exportBtn      = page.getByRole('button', { name: 'Export' });
    this.filtersBtn     = page.getByRole('button', { name: 'Filters' });
    this.activeOnlySwitch = page.locator('#exclude-ended-journey');

    // ── Advanced Filters dialog ─────────────────────────────
    this.resetAllBtn    = page.getByRole('button', { name: 'Reset All' });
    this.cancelBtn      = page.getByRole('button', { name: 'Cancel' });
    this.applyFiltersBtn = page.getByRole('button', { name: 'Apply Filters' });
    this.closeDialogBtn = page.getByRole('button', { name: 'Close' });

    // ── Table ───────────────────────────────────────────────
    this.tableRows      = page.locator('table tbody tr');
    this.rowsPerPageCombo = page.getByRole('combobox').filter({ hasText: /^\d+$/ }).first();
  }

  // ═══════════════════════════════════════════════════════
  //  Navigation
  // ═══════════════════════════════════════════════════════

  async goto() {
    await this.page.goto('/explore-candidates');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1500);
  }

  // ═══════════════════════════════════════════════════════
  //  Assertions
  // ═══════════════════════════════════════════════════════

  async assertExplorerVisible() {
    await expect(this.exploreHeading).toBeVisible({ timeout: 15_000 });
    await expect(this.refreshBtn).toBeVisible({ timeout: 15_000 });
    await expect(this.searchCombo).toBeVisible({ timeout: 15_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Table data extraction
  // ═══════════════════════════════════════════════════════

  /**
   * Parse the visible applicant table rows into a plain array of objects.
   * Falls back to any table row with enough cells.
   */
  async captureTableData() {
    await this.page.waitForTimeout(1000);

    return this.page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr, table tr'));
      const candidates = [];

      rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 7) return;

        const applicantCell = cells[0];
        const paragraphs = applicantCell.querySelectorAll('p');
        const name = paragraphs[0]?.textContent?.trim();
        const email = paragraphs[1]?.textContent?.trim();
        const phone = paragraphs[2]?.textContent?.trim();

        const addedByCell = cells[1];
        const addedByParas = addedByCell.querySelectorAll('p');
        const addedBy = addedByParas[0]?.textContent?.trim();
        const addedOn = addedByParas[2]?.textContent?.trim();

        const updatedOnCell = cells[2];
        const updatedAgo = updatedOnCell.querySelectorAll('p')[0]?.textContent?.trim();
        const updatedDate = updatedOnCell.querySelectorAll('p')[1]?.textContent?.trim();

        const role = cells[3]?.textContent?.trim();
        const scoresText = cells[4]?.textContent?.trim();
        const status = cells[5]?.textContent?.trim();

        if (name) {
          candidates.push({
            name,
            email,
            phone,
            addedBy,
            addedOn,
            updatedAgo,
            updatedDate,
            role,
            scoresText,
            status,
          });
        }
      });

      return candidates;
    });
  }

  // ═══════════════════════════════════════════════════════
  //  Search dropdown filters
  // ═══════════════════════════════════════════════════════

  /**
   * Select a search field from the top combobox and search for a value.
   * @param {string} field - One of: Candidate, Email, Phone, Role, Company, Job ID
   * @param {string} value
   */
  async searchBy(field, value) {
    // Clear any existing search text first
    await this.searchInput.fill('');

    // Open combo and select the requested field
    await this.searchCombo.click();
    await this.page.getByRole('option', { name: field }).click();
    await this.page.waitForTimeout(300);

    // Fill and submit
    await this.searchInput.fill(value);
    await this.searchInput.press('Enter');
    await this.page.waitForTimeout(2500);
  }

  async clearSearch() {
    await this.searchInput.fill('');
    await this.searchInput.press('Enter');
    await this.page.waitForTimeout(1500);
  }

  // ═══════════════════════════════════════════════════════
  //  Advanced Filters dialog
  // ═══════════════════════════════════════════════════════

  async openAdvancedFilters() {
    await this.filtersBtn.click({ force: true });
    await this.page.waitForTimeout(800);
    await expect(this.applyFiltersBtn).toBeVisible({ timeout: 10_000 });
  }

  async closeAdvancedFilters() {
    if (await this.closeDialogBtn.isVisible().catch(() => false)) {
      await this.closeDialogBtn.click();
      await this.page.waitForTimeout(500);
    }
  }

  async _selectFilterButton(sectionHeading, buttonLabel) {
    // The filter options live inside a scrollable Radix dialog. Playwright's
    // built-in locators struggle with the deeply-nested, scrollable generic
    // containers, so we resolve the button directly in the DOM by its section
    // heading and label text, scroll it into view, and click it.
    await this.page.evaluate(
      ({ heading, label }) => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) throw new Error('Advanced Filters dialog not found');

        // Find the section whose direct text content matches the heading.
        const allEls = Array.from(dialog.querySelectorAll('*'));
        const sectionEl = allEls.find((el) => {
          const directText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent.trim())
            .join('');
          return directText === heading;
        });
        if (!sectionEl) throw new Error(`Section "${heading}" not found`);

        // Find the scrollable list container that follows the heading inside
        // the same section card. The buttons we want are inside that container.
        let listContainer = sectionEl.querySelector('[data-radix-scroll-area-viewport]');
        if (!listContainer) {
          // Fallback: the section card may be the heading's parent; search its
          // descendants for a div that contains the "All ..." default button.
          const allBtn = Array.from(sectionEl.querySelectorAll('button')).find((b) =>
            (b.textContent || '').trim().toLowerCase().startsWith('all ')
          );
          listContainer = allBtn ? allBtn.parentElement : sectionEl;
        }

        // If the list container is still empty of buttons, it may be a wrapper
        // around a shadow-like Radix viewport. Try its parent.
        let buttons = Array.from(listContainer.querySelectorAll('button'));
        if (buttons.length === 0 && listContainer.parentElement) {
          buttons = Array.from(listContainer.parentElement.querySelectorAll('button'));
        }

        const btn = buttons.find((b) => {
          const text = (b.textContent || '').trim();
          const inner = (b.innerText || '').trim();
          return text === label || inner === label || text.startsWith(label) || inner.startsWith(label);
        });
        if (!btn) {
          const found = buttons.map((b) => (b.textContent || '').trim()).join(' | ');
          throw new Error(`Button "${label}" not found in section "${heading}". Buttons: ${found}`);
        }

        btn.scrollIntoView({ block: 'center', inline: 'nearest' });
        btn.click();
      },
      { heading: sectionHeading, label: buttonLabel }
    );
    await this.page.waitForTimeout(400);
  }

  async selectStatusFilter(statusLabel) {
    // The table displays some statuses with different wording than the filter
    // dialog buttons. Map known mismatches so we click the correct option.
    const statusMap = {
      'Screening Complete': 'Screening Finished',
      'Shortlisted': 'Candidate Shortlisted',
      'Awaiting Interview': 'Awaiting Candidate Interview',
    };
    await this._selectFilterButton('Application Status', statusMap[statusLabel] || statusLabel);
  }

  async selectInterviewLinkStatus(statusLabel) {
    await this._selectFilterButton('Interview Link Status', statusLabel);
  }

  async selectAddedByFilter(recruiterName) {
    await this._selectFilterButton('Applicant Added By', recruiterName);
  }

  async applyFilters() {
    await this.applyFiltersBtn.click();
    await this.page.waitForTimeout(2500);
  }

  async resetAllFilters() {
    // Reset search field
    await this.clearSearch();

    // Reset advanced filters
    await this.openAdvancedFilters();
    await this.resetAllBtn.click();
    await this.page.waitForTimeout(500);
    await this.applyFiltersBtn.click();
    await this.page.waitForTimeout(2000);

    // Ensure active-only toggle is off
    const isChecked = await this.activeOnlySwitch.isChecked().catch(() => false);
    if (isChecked) {
      await this.activeOnlySwitch.click();
      await this.page.waitForTimeout(1500);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Toggle
  // ═══════════════════════════════════════════════════════

  async toggleActiveCandidatesOnly() {
    await this.activeOnlySwitch.click();
    await this.page.waitForTimeout(2500);
  }

  // ═══════════════════════════════════════════════════════
  //  Rows per page
  // ═══════════════════════════════════════════════════════

  async setRowsPerPage(count) {
    await this.rowsPerPageCombo.click();
    await this.page.getByRole('option', { name: String(count) }).click();
    await this.page.waitForTimeout(2500);
  }

  // ═══════════════════════════════════════════════════════
  //  Column sorting
  // ═══════════════════════════════════════════════════════

  async sortByColumn(columnName) {
    const headerBtn = this.page.locator('table th button').filter({ hasText: columnName }).first();
    await headerBtn.click();
    await this.page.waitForTimeout(2000);
  }

  // ═══════════════════════════════════════════════════════
  //  Row actions
  // ═══════════════════════════════════════════════════════

  async openFirstActionMenu() {
    const actionBtn = this.page.locator('table tbody tr').first().locator('button').filter({ hasText: 'Open actions' }).first();
    await actionBtn.click();
    await this.page.waitForTimeout(800);

    const items = await this.page.locator('[role="menuitem"]').allTextContents();
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
    return items;
  }
}

module.exports = { CandidateExplorerPage };
