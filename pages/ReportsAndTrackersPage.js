const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * ReportsAndTrackersPage — POM for https://staging.hyrefast.ai/reports
 *
 * Covers:
 *   - Navigation from dashboard
 *   - Client / Company multi-select filter
 *   - Job Data multi-select filter
 *   - Template Layout dropdown
 *   - Date filter (Application Added Date / Shared with Client Date + range)
 *   - Candidate Stage multi-select filter dialog
 *   - Search candidates input
 *   - Rows per page select
 *   - Pagination (next/previous)
 *   - Column sorting
 *   - Row selection (checkboxes) + bulk Export / Email actions
 *   - Inline cell editing
 *   - Toolbar actions: refresh, clear all filters, copy, CSV export, email, manage templates, add column, theme toggle
 */
class ReportsAndTrackersPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Header ──────────────────────────────────────────────
    this.backBtn = page.getByRole('button', { name: 'Back' });

    // ── Filter bar ────────────────────────────────────────────
    this.companyCombo = page.locator('[role="combobox"]').nth(0);
    this.jobDataCombo = page.locator('[role="combobox"]').nth(1);
    this.templateCombo = page.locator('[role="combobox"]').nth(2);
    this.dateTypeCombo = page.locator('[role="combobox"]').nth(3);

    this.searchInput = page.locator('input[placeholder="Search candidates..."]');
    this.clearSearchBtn = page.locator('button[title="Clear search"]');

    this.candidateStageBtn = page.getByRole('button', { name: 'Candidate Stage' });
    this.clearAllFiltersBtn = page.locator('button').filter({ has: page.locator('svg.lucide-filter-x') });
    this.refreshBtn = page.locator('button').filter({ has: page.locator('svg.lucide-refresh-cw') });
    this.copyBtn = page.locator('button').filter({ has: page.locator('svg.lucide-copy') });
    this.csvExportBtn = page.locator('button').filter({ has: page.locator('svg.lucide-file-spreadsheet') });
    this.emailBtn = page.locator('button').filter({ has: page.locator('svg.lucide-mail') });
    this.manageTemplatesBtn = page.locator('button').filter({ has: page.locator('svg.lucide-settings2') }).nth(1);
    this.addColumnBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') }).first();
    this.themeToggleBtn = page.getByRole('button', { name: /theme|dark mode|light mode/i }).first();

    // ── Date range ───────────────────────────────────────────
    this.fromDateInput = page.locator('input[type="date"]').nth(0);
    this.toDateInput = page.locator('input[type="date"]').nth(1);
    this.clearDateFilterBtn = page.locator('button[title="Clear date filter"]');

    // ── Table ────────────────────────────────────────────────
    this.table = page.locator('table:visible').filter({
      has: page.getByRole('columnheader', { name: /Candidate Name/i }),
    }).last();
    this.tableRows = this.table.locator('tbody tr');
    this.headerCheckbox = this.table.locator('thead input[type="checkbox"]').first();
    this.paginationText = page.locator('text=/Showing .* of .* candidates/');
    this.pageInfoText = page.locator('text=/Page \\d+ of \\d+/');
    this.nextPageBtn = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') }).first();
    this.prevPageBtn = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') }).first();

    // ── Dialogs / toasts ─────────────────────────────────────
    this.dialog = page.getByRole('dialog');
    this.toast = page.getByRole('status');

    // ── Email / Add-column dialogs ─────────────────────────────
    // Inputs are not reliably reachable via Playwright locators inside the
    // Radix portal, so all interactions happen via page.evaluate helpers below.
  }

  // ═══════════════════════════════════════════════════════
  //  Navigation
  // ═══════════════════════════════════════════════════════

  async goto() {
    await this.page.goto('/reports');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000);
  }

  async navigateFromDashboard() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
    await this.page.getByRole('button', { name: 'Reports & Trackers' }).click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000);
  }

  async goBack() {
    await this.backBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ═══════════════════════════════════════════════════════
  //  Assertions
  // ═══════════════════════════════════════════════════════

  async assertReportsPageVisible() {
    await expect(this.backBtn).toBeVisible({ timeout: 15_000 });
    await expect(this.companyCombo).toBeVisible({ timeout: 15_000 });
    await expect(this.jobDataCombo).toBeVisible({ timeout: 15_000 });
    await expect(this.table).toBeVisible({ timeout: 15_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Table data extraction
  // ═══════════════════════════════════════════════════════

  async captureTableData() {
    await this.page.waitForTimeout(1000);
    return this.table.evaluate((table) => {
      const headers = Array.from(table.querySelectorAll('thead th'));
      const candidateNameIndex = headers.findIndex((th) => /candidate\s*name/i.test(th.innerText));
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      return rows.map((tr) => {
        const checkbox = tr.querySelector('input[type="checkbox"]');
        const inputs = Array.from(tr.querySelectorAll('input[type="text"]'));
        return {
          selected: checkbox ? checkbox.checked : false,
          candidateName: candidateNameIndex >= 0
            ? (tr.cells[candidateNameIndex]?.innerText || '').trim()
            : '',
          values: inputs.map((i) => ({
            title: i.getAttribute('title') || '',
            value: i.value || '',
          })),
        };
      }).filter((row) => row.values.length > 0);
    });
  }

  async getVisibleRowCount() {
    return this.tableRows.count();
  }

  async getPaginationText() {
    return this.paginationText.textContent();
  }

  // ═══════════════════════════════════════════════════════
  //  Filters
  // ═══════════════════════════════════════════════════════

  async _openMultiSelectDropdown(comboLocator) {
    await comboLocator.evaluate((el) => el.click());
    await this.page.waitForTimeout(800);
  }

  async _selectOptionInOpenDialog(optionText) {
    await this.page.evaluate((label) => {
      const btn = Array.from(document.querySelectorAll('button, [role="option"], [role="listitem"]'))
        .find((b) => b.textContent.trim() === label);
      if (btn) btn.click();
    }, optionText);
    await this.page.waitForTimeout(800);
  }

  async selectCompany(companyName) {
    await this._openMultiSelectDropdown(this.companyCombo);
    await this._selectOptionInOpenDialog(companyName);
    // Close the multi-select dialog by pressing Escape instead of clicking outside,
    // which can accidentally navigate away from the reports page.
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(1500);
  }

  async clearCompanyFilters() {
    await this._openMultiSelectDropdown(this.companyCombo);
    await this.page.evaluate(() => {
      const clearAll = Array.from(document.querySelectorAll('button'))
        .find((b) => b.textContent.trim() === 'Clear All');
      if (clearAll) clearAll.click();
    });
    await this.page.waitForTimeout(500);
  }

  async selectJobData(jobTitle) {
    await this._openMultiSelectDropdown(this.jobDataCombo);
    await this._selectOptionInOpenDialog(jobTitle);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(1500);
  }

  async selectAllJobs() {
    await this.selectJobData('All Jobs (Default)');
  }

  async selectDateFilter(dateType) {
    await this.dateTypeCombo.evaluate((el) => el.click());
    await this.page.waitForTimeout(500);
    await this.page.evaluate((label) => {
      const opt = Array.from(document.querySelectorAll('[role="option"]'))
        .find((o) => o.textContent.trim() === label);
      if (opt) opt.click();
    }, dateType);
    await this.page.waitForTimeout(1000);
  }

  async setDateRange(fromDate, toDate) {
    await this.fromDateInput.fill(fromDate);
    await this.toDateInput.fill(toDate);
    await this.page.waitForTimeout(2500);
  }

  async clearDateFilter() {
    await this.clearDateFilterBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async selectCandidateStage(stageLabel) {
    await this.candidateStageBtn.click();
    await this.page.waitForTimeout(800);
    await this.page.evaluate((label) => {
      const all = document.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
      for (const cb of all) {
        const wrapper = cb.closest('label, div, span');
        if (wrapper && wrapper.textContent.includes(label)) {
          cb.click();
          break;
        }
      }
    }, stageLabel);
    await this.page.waitForTimeout(1500);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
  }

  async clearAllFilters() {
    await this.clearAllFiltersBtn.click();
    await this.page.waitForTimeout(2000);
  }

  async searchCandidates(query) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(2500);
  }

  async clearSearch() {
    if (await this.clearSearchBtn.isVisible().catch(() => false)) {
      await this.clearSearchBtn.click();
      await this.page.waitForTimeout(1500);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Rows per page & pagination
  // ═══════════════════════════════════════════════════════

  async setRowsPerPage(count) {
    // The table contains many native selects for editable tracker cells. Pick
    // the page-size select outside the table, identified by its standard size options.
    const pageSizeIndex = await this.page.locator('select').evaluateAll((selects) =>
      selects.findIndex((select) => !select.closest('table') &&
        Array.from(select.options).some((option) => /^(10|20|25|50|100)$/.test(option.value || option.textContent.trim())))
    );
    if (pageSizeIndex < 0) {
      throw new Error('Could not find the rows-per-page selector outside the tracker table');
    }

    const selector = this.page.locator('select').nth(pageSizeIndex);
    const selectedSize = await selector.evaluate((select, requested) => {
      const sizes = Array.from(select.options)
        .map((option) => Number(option.value || option.textContent.trim()))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b);
      return sizes.includes(requested)
        ? requested
        : (sizes.filter((value) => value <= requested).pop() || sizes[0]);
    }, count);
    await selector.selectOption(String(selectedSize));
    await this.page.waitForTimeout(2500);
    return selectedSize;
  }

  async goToNextPage() {
    await this.nextPageBtn.click();
    await this.page.waitForTimeout(2500);
  }

  async goToPreviousPage() {
    await this.prevPageBtn.click();
    await this.page.waitForTimeout(2500);
  }

  // ═══════════════════════════════════════════════════════
  //  Sorting
  // ═══════════════════════════════════════════════════════

  async sortByColumn(columnName) {
    const header = this.table.getByRole('columnheader', { name: new RegExp(columnName, 'i') }).first();
    await header.click();
    await this.page.waitForTimeout(2000);
  }

  // ═══════════════════════════════════════════════════════
  //  Row selection & bulk actions
  // ═══════════════════════════════════════════════════════

  async selectAllRows() {
    await this.headerCheckbox.click();
    await this.page.waitForTimeout(800);
  }

  async selectFirstRow() {
    const firstRowCheckbox = this.tableRows.first().locator('input[type="checkbox"]');
    await firstRowCheckbox.click();
    await this.page.waitForTimeout(500);
  }

  async exportSelected() {
    const exportBtn = this.page.locator('button').filter({ hasText: /^Export \(/ });
    await exportBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async emailSelected() {
    const emailBtn = this.page.locator('button').filter({ hasText: /^Email \(/ });
    await emailBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async closeDialog() {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
  }

  // ═══════════════════════════════════════════════════════
  //  Toolbar actions
  // ═══════════════════════════════════════════════════════

  async refreshData() {
    await this.refreshBtn.click();
    await this.page.waitForTimeout(2000);
  }

  async copyToClipboard() {
    await this.copyBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async exportToCsv() {
    await this.csvExportBtn.click();
    await this.page.waitForTimeout(3000);
  }

  async openEmailDialog() {
    await this.emailBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async _findDialogByTitle(titleText) {
    return this.page.evaluate((title) => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      return dialogs.find((d) => d.textContent.includes(title)) || null;
    }, titleText);
  }

  async fillEmailDialog({ to, cc, subject, body }) {
    if (to) {
      const recipientInput = this.dialog.getByRole('textbox', { name: /recipient emails/i });
      await recipientInput.fill(to);
      await recipientInput.press('Enter');
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        await expect(this.dialog.getByText(to, { exact: true })).toBeVisible({ timeout: 5000 });
      }
    }

    if (cc) {
      const ccInput = this.dialog.getByRole('textbox', { name: /CC emails/i });
      await ccInput.fill(cc);
      await ccInput.press('Enter');
      await expect(this.dialog.getByText(cc, { exact: true })).toBeVisible({ timeout: 5000 });
    }

    if (subject) {
      await this.dialog.getByRole('textbox', { name: 'Subject' }).fill(subject);
    }

    if (body) {
      await this.dialog.locator('[contenteditable="true"]').fill(body);
    }
  }

  async sendEmail({ allowDisabled = false } = {}) {
    const sendButton = this.dialog.getByRole('button', { name: 'Send Email', exact: true });
    if (allowDisabled && !(await sendButton.isEnabled())) return;
    await expect(sendButton).toBeEnabled({ timeout: 10_000 });
    await sendButton.click();
    await expect(this.dialog).toBeHidden({ timeout: 15_000 }).catch(() => {});
  }

  async cancelEmailDialog() {
    await this.page.evaluate(() => {
      const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
        .find((d) => d.textContent.includes('Send Report via Email'));
      if (!dialog) return;
      const btn = Array.from(dialog.querySelectorAll('button'))
        .find((b) => b.textContent.trim() === 'Cancel');
      if (btn) btn.click();
    });
    await this.page.waitForTimeout(500);
  }

  async closeEmailDialog() {
    await this.page.evaluate(() => {
      const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
        .find((d) => d.textContent.includes('Send Report via Email'));
      if (!dialog) return;
      const btn = Array.from(dialog.querySelectorAll('button'))
        .find((b) => b.textContent.trim() === 'Close');
      if (btn) btn.click();
    });
    await this.page.waitForTimeout(500);
  }

  async openManageTemplates() {
    await this.manageTemplatesBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async openManageColumnsDialog() {
    await this.openManageTemplates();
    await this.page.waitForTimeout(1500);
  }

  async closeManageColumnsDialog() {
    await this.page.evaluate(() => {
      const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
        .find((d) => d.textContent.includes('Manage Tracker Columns'));
      if (!dialog) return;
      const closeBtn = Array.from(dialog.querySelectorAll('button'))
        .find((b) => b.textContent.trim() === 'Close');
      if (closeBtn) closeBtn.click();
    });
    await this.page.waitForTimeout(1500);
  }

  async renameCustomColumn(oldName, newName) {
    await this.page.evaluate((name) => {
      const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
        .find((d) => d.textContent.includes('Manage Tracker Columns'));
      if (!dialog) return;
      const rows = Array.from(dialog.querySelectorAll('div')).filter((el) =>
        el.className.includes('flex items-center justify-between')
      );
      const row = rows.find((r) => {
        const title = r.querySelector('div.flex-col')?.textContent?.trim() || '';
        return title.includes(name);
      });
      if (row) {
        const editBtn = row.querySelectorAll('button')[4];
        if (editBtn) editBtn.click();
      }
    }, oldName);
    await this.page.waitForTimeout(1500);

    // Update the name input via keyboard so React registers the change.
    await this.page.evaluate(() => {
      const allDialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      const dialog = allDialogs[allDialogs.length - 1];
      if (!dialog) return;
      const input = dialog.querySelector('input[type="text"]');
      if (input) {
        input.focus();
        input.select();
      }
    });
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.type(newName);
    await this.page.waitForTimeout(300);

    await this.page.evaluate(() => {
      const allDialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      const dialog = allDialogs[allDialogs.length - 1];
      if (!dialog) return;
      const saveBtn = Array.from(dialog.querySelectorAll('button'))
        .find((b) => b.textContent.trim() === 'Save Changes');
      if (saveBtn) saveBtn.click();
    });
    await this.page.waitForTimeout(2500);
  }

  async deleteCustomColumn(columnName) {
    const dialog = this.page.locator('[role="dialog"]').filter({ hasText: 'Manage Tracker Columns' });
    const searchInput = dialog.locator('input[placeholder*="Search columns"]').first();

    // Filter the dialog so the target column row is visible and clickable.
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(columnName);
      await this.page.waitForTimeout(800);
    }

    const targetRow = dialog.locator('div').filter({ hasClass: /flex items-center justify-between/ }).filter({ hasText: columnName }).first();
    // The delete button is the right-most icon button in the row.
    const deleteBtn = targetRow.locator('button').last();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
    }
    await this.page.waitForTimeout(1500);

    // Confirm deletion if a confirmation dialog appears.
    const confirmDialog = this.page.locator('[role="dialog"]').last();
    const confirmBtn = confirmDialog.locator('button').filter({ hasText: /delete|remove|confirm/i }).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }
    await this.page.waitForTimeout(1500);

    // Persist the deletion by clicking Save Order if it is still available.
    const saveBtn = dialog.locator('button').filter({ hasText: 'Save Order' }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
    }
    await this.page.waitForTimeout(2500);
  }

  async moveCustomColumn(columnName, direction) {
    const btnTitle = {
      top: 'Move to top',
      up: 'Move up',
      down: 'Move down',
      bottom: 'Move to bottom',
    }[direction];

    const dialog = this.page.locator('[role="dialog"]').filter({ hasText: 'Manage Tracker Columns' });
    const searchInput = dialog.locator('input[placeholder*="Search columns"]').first();

    // Filter the dialog so only the target column row is visible; this ensures
    // the Move up button is rendered and enabled.
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(columnName);
      await this.page.waitForTimeout(800);
    }

    const targetRow = dialog.locator('div').filter({ hasClass: /flex items-center justify-between/ }).filter({ hasText: columnName }).first();

    if (btnTitle === 'Move to top') {
      // Repeatedly click Move up until the row reaches the top of the list.
      for (let i = 0; i < 40; i += 1) {
        const upBtn = targetRow.locator('button[title="Move up"]').first();
        const isDisabled = await upBtn.isDisabled().catch(() => true);
        if (isDisabled) break;
        await upBtn.click();
        await this.page.waitForTimeout(250);
      }
    } else {
      const btn = targetRow.locator(`button[title="${btnTitle}"]`).first();
      const isDisabled = await btn.isDisabled().catch(() => true);
      if (!isDisabled) await btn.click();
    }

    // Clear the search so Save Order applies to the full column list.
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('');
      await this.page.waitForTimeout(500);
    }

    // Persist the new order by clicking the Save Order button.
    const saveBtn = dialog.locator('button').filter({ hasText: 'Save Order' }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
    }
    await this.page.waitForTimeout(2500);
  }

  async getManageColumnsRowTitles() {
    return this.page.evaluate(() => {
      const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
        .find((d) => d.textContent.includes('Manage Tracker Columns'));
      if (!dialog) return [];
      return Array.from(dialog.querySelectorAll('div'))
        .filter((divEl) => divEl.className.includes('flex items-center justify-between'))
        .map((r) => r.querySelector('div.flex-col')?.textContent?.trim() || '');
    });
  }

  async openAddColumnDialog() {
    await this.addColumnBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async addCustomColumn(columnName) {
    await this.openAddColumnDialog();
    await this.page.waitForTimeout(1000);
    await this.page.evaluate(() => {
      const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
        .find((d) => d.textContent.includes('Add Custom Field Column'));
      if (!dialog) return;
      const input = dialog.querySelector('input[type="text"]');
      if (input) input.focus();
    });
    await this.page.keyboard.type(columnName);
    await this.page.waitForTimeout(500);
    await this.page.evaluate(() => {
      const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
        .find((d) => d.textContent.includes('Add Custom Field Column'));
      if (!dialog) return;
      const btn = Array.from(dialog.querySelectorAll('button'))
        .find((b) => b.textContent.trim() === 'Save and Add Column');
      if (btn) btn.click();
    });
    await this.page.waitForTimeout(3000);
  }

  async getColumnHeaders() {
    return this.table.evaluate((table) =>
      Array.from(table.querySelectorAll('thead th')).map((th) => th.innerText.trim())
    );
  }

  async getColumnIndex(columnName) {
    const headers = await this.getColumnHeaders();
    return headers.findIndex((h) => h.toLowerCase() === columnName.toLowerCase());
  }

  async toggleTheme() {
    if (await this.themeToggleBtn.isVisible().catch(() => false)) {
      await this.themeToggleBtn.click();
    } else {
      // On this screen the theme control lives in the account menu.
      const accountMenuButton = this.page.locator('nav button').last();
      await accountMenuButton.click();
      const menuToggle = this.page.getByRole('menuitem', { name: /theme|appearance|dark|light/i })
        .or(this.page.getByRole('button', { name: /theme|appearance|dark|light/i })).first();
      await expect(menuToggle, 'Expected a theme control in the account menu').toBeVisible();
      await menuToggle.click();
      if (/appearance/i.test((await menuToggle.innerText().catch(() => '')))) {
        const appearanceChoice = this.page.getByRole('menuitem', { name: /dark|light/i })
          .or(this.page.getByRole('button', { name: /dark|light/i })).first();
        await expect(appearanceChoice, 'Expected a dark or light appearance choice').toBeVisible();
        await appearanceChoice.click();
      }
    }
    await this.page.waitForTimeout(1000);
  }

  // ═══════════════════════════════════════════════════════
  //  Inline editing
  // ═══════════════════════════════════════════════════════

  async editCell(rowIndex, cellIndex, newValue) {
    const cellInput = this.tableRows.nth(rowIndex).locator('input[type="text"]').nth(cellIndex);
    await cellInput.scrollIntoViewIfNeeded();
    await cellInput.fill(newValue);
    await cellInput.press('Enter');
    await this.page.waitForTimeout(1500);
  }

  async editLastCell(rowIndex, newValue) {
    const cellInput = this.tableRows.nth(rowIndex).locator('input[type="text"]').last();
    await cellInput.scrollIntoViewIfNeeded();
    await cellInput.fill(newValue);
    await cellInput.press('Enter');
    await this.page.waitForTimeout(1500);
  }
}

module.exports = { ReportsAndTrackersPage };
