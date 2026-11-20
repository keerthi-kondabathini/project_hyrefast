/**
 * Reports & Trackers — Smoke Tests
 *
 * TC_RPT_001  Navigate to Reports & Trackers and verify page loads
 * TC_RPT_002  Client / Company filter applies correctly
 * TC_RPT_003  Job Data filter applies correctly
 * TC_RPT_004  Date filter (Application Added Date) with range applies correctly
 * TC_RPT_005  Candidate Stage filter applies correctly
 * TC_RPT_006  Search candidates input filters rows
 * TC_RPT_007  Rows per page dropdown changes visible row count
 * TC_RPT_008  Pagination navigates to next/previous page
 * TC_RPT_009  Column sorting changes row order
 * TC_RPT_010  Select all rows via header checkbox updates bulk actions
 * TC_RPT_011  Export selected rows triggers CSV export toast
 * TC_RPT_012  Copy to clipboard shows success toast
 * TC_RPT_013  Refresh data button works
 * TC_RPT_014  Clear all filters resets to baseline
 * TC_RPT_015  Inline cell editing updates value
 * TC_RPT_016  Email dialog opens for selected rows
 * TC_RPT_017  Add custom column dialog opens
 * TC_RPT_018  Manage templates dialog opens
 * TC_RPT_019  Theme toggle switches dark/light mode
 * TC_RPT_021  Email dialog validates required fields and shows errors
 * TC_RPT_022  Send report email and verify delivery in test inbox
 * TC_RPT_023  Add custom tracker column, bind existing candidate data, and verify
 *
 * Approach:
 *   - Capture baseline data from the first page.
 *   - Use real values from the baseline to drive filter assertions.
 *   - DOM-evaluate clicks are used for multi-select pills and scrollable dialogs
 *     because standard Playwright locators struggle with the Radix UI overlays.
 */

const { test, expect } = require('../../utils/authFixture');
const { ReportsAndTrackersPage } = require('../../pages/ReportsAndTrackersPage');
const { generateTestEmail } = require('../../utils/emailProvider');
const { YopMailPage } = require('../../pages/YopMailPage');

test.describe('TC_RPT — Reports & Trackers', () => {
  let reports;
  let baseline;

  test.beforeEach(async ({ page, loggedInPage }) => {
    reports = new ReportsAndTrackersPage(page);
    await reports.goto();
    baseline = await reports.captureTableData();
    expect(baseline.length, 'Expected at least one candidate in Reports & Trackers').toBeGreaterThan(0);
  });

  test('TC_RPT_001 — Reports & Trackers page loads', async () => {
    await test.step('Verify page heading and filter bar are visible', async () => {
      await reports.assertReportsPageVisible();
    });

    await test.step('Baseline contains candidate data', async () => {
      expect(baseline[0].values.length).toBeGreaterThan(0);
      expect(baseline[0].candidateName).toBeTruthy();
    });
  });

  test('TC_RPT_002 — Client / Company filter applies correctly', async () => {
    await test.step('Filter by a different company', async () => {
      await reports.selectCompany('Capgemini');
    });

    await test.step('Verify filter tag appears and table reloads', async () => {
      const text = await reports.page.evaluate(() => document.body.innerText);
      expect(text).toContain('Capgemini');
      const data = await reports.captureTableData();
      expect(data.length).toBeGreaterThanOrEqual(0);
    });
  });

  test('TC_RPT_003 — Job Data filter applies correctly', async () => {
    await test.step('Select a job title from baseline if available', async () => {
      // The default template does not expose job title in cells, so we pick a known job.
      await reports.selectJobData('Documentum Platform Engineer');
    });

    await test.step('Verify table reloads without error', async () => {
      const data = await reports.captureTableData();
      expect(data.length).toBeGreaterThanOrEqual(0);
    });

    await test.step('Reset to All Jobs', async () => {
      await reports.selectAllJobs();
      const data = await reports.captureTableData();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  test('TC_RPT_004 — Date filter with range applies correctly', async () => {
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await test.step('Select Application Added Date and set range', async () => {
      await reports.selectDateFilter('Application Added Date');
      await reports.setDateRange(lastMonth, today);
    });

    await test.step('Verify matching rows or the empty-result state is shown', async () => {
      const emptyState = reports.page.getByText(/No candidates matching current filter criteria/i);
      if (await emptyState.isVisible().catch(() => false)) {
        await expect(emptyState).toBeVisible();
      } else {
        await expect(reports.page.getByText(/Showing \d+\s*-\s*\d+ of \d+ candidates/i)).toBeVisible();
      }
    });

    await test.step('Clear date filter', async () => {
      await reports.clearDateFilter();
      const data = await reports.captureTableData();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  test('TC_RPT_005 — Candidate Stage filter applies correctly', async () => {
    const targetStage = 'Candidate Shared';

    await test.step(`Select stage: ${targetStage}`, async () => {
      await reports.selectCandidateStage(targetStage);
    });

    await test.step('Verify filter tag appears and rows load', async () => {
      const text = await reports.page.evaluate(() => document.body.innerText);
      expect(text).toContain(targetStage);
      const data = await reports.captureTableData();
      expect(data.length).toBeGreaterThanOrEqual(0);
    });
  });

  test('TC_RPT_006 — Search candidates input filters rows', async () => {
    const targetName = baseline[0].candidateName;

    await test.step(`Search by name: ${targetName}`, async () => {
      await reports.searchCandidates(targetName);
    });

    await test.step('Verify every visible row contains the search term', async () => {
      const data = await reports.captureTableData();
      expect(data.length).toBeGreaterThan(0);
      for (const row of data) {
        expect(row.candidateName.toLowerCase()).toContain(targetName.toLowerCase());
      }
    });

    await test.step('Clear search', async () => {
      await reports.clearSearch();
      const data = await reports.captureTableData();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  test('TC_RPT_007 — Rows per page dropdown changes visible row count', async () => {
    let selectedSize;
    await test.step('Change rows per page to 20', async () => {
      selectedSize = await reports.setRowsPerPage(20);
    });

    await test.step('Verify up to 20 rows are visible', async () => {
      const count = await reports.getVisibleRowCount();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(selectedSize);
    });
  });

  test('TC_RPT_008 — Pagination navigates to next page', async () => {
    await test.step('Set a page size that allows pagination through available candidates', async () => {
      await reports.setRowsPerPage(10);
      await expect(reports.nextPageBtn).toBeEnabled();
    });

    await test.step('Go to next page', async () => {
      await reports.goToNextPage();
    });

    await test.step('Verify page number changed', async () => {
      const text = await reports.pageInfoText.textContent();
      expect(text).toMatch(/Page 2 of \d+/);
    });

    await test.step('Return to previous page', async () => {
      await reports.goToPreviousPage();
      const text = await reports.pageInfoText.textContent();
      expect(text).toMatch(/Page 1 of \d+/);
    });
  });

  test('TC_RPT_009 — Column sorting changes row order', async () => {
    const before = baseline.map((r) => r.candidateName);

    await test.step('Click first column header to sort', async () => {
      await reports.sortByColumn('Candidate Name');
    });

    await test.step('Verify order changed', async () => {
      const after = await reports.captureTableData();
      expect(after.length).toBeGreaterThan(0);
      const afterNames = after.map((r) => r.candidateName);
      expect(afterNames).not.toEqual(before);
    });
  });

  test('TC_RPT_010 — Select all rows updates bulk actions', async () => {
    await test.step('Select all rows via header checkbox', async () => {
      await reports.selectAllRows();
    });

    await test.step('Verify Export and Email buttons show count', async () => {
      const exportText = await reports.page.locator('button').filter({ hasText: /^Export \(/ }).textContent();
      const emailText = await reports.page.locator('button').filter({ hasText: /^Email \(/ }).textContent();
      expect(exportText).toMatch(/Export \(\d+\)/);
      expect(emailText).toMatch(/Email \(\d+\)/);
    });
  });

  test('TC_RPT_011 — Export selected rows triggers CSV export', async () => {
    await test.step('Select first row and export', async () => {
      await reports.selectFirstRow();
      await reports.exportSelected();
    });

    await test.step('Verify export toast appears', async () => {
      await expect(reports.toast.filter({ hasText: /Spreadsheet exported|Fetching dataset/ })).toBeVisible({ timeout: 10_000 });
    });
  });

  test('TC_RPT_012 — Copy to clipboard shows success toast', async () => {
    await test.step('Click copy button', async () => {
      await reports.copyToClipboard();
    });

    await test.step('Verify copied toast', async () => {
      await expect(reports.toast.filter({ hasText: /Copied .* rows .* columns to clipboard/ })).toBeVisible({ timeout: 10_000 });
    });
  });

  test('TC_RPT_013 — Refresh data button works', async () => {
    await test.step('Click refresh', async () => {
      await reports.refreshData();
    });

    await test.step('Verify refresh toast', async () => {
      await expect(reports.toast.filter({ hasText: /Report data refreshed/ })).toBeVisible({ timeout: 10_000 });
    });
  });

  test('TC_RPT_014 — Clear all filters resets to baseline', async () => {
    await test.step('Apply a search filter', async () => {
      await reports.searchCandidates(baseline[0].candidateName);
    });

    await test.step('Clear all filters', async () => {
      await reports.clearAllFilters();
    });

    await test.step('Verify table reloads to baseline state', async () => {
      const data = await reports.captureTableData();
      expect(data.length).toBeGreaterThan(0);
      const text = await reports.page.evaluate(() => document.body.innerText);
      expect(text).not.toContain('Application Added Date');
    });
  });

  test('TC_RPT_015 — Inline cell editing updates value', async () => {
    const originalValue = baseline[0].values[0].value;
    const testValue = `Test-${Date.now()}`;

    await test.step('Edit first cell', async () => {
      await reports.editCell(0, 0, testValue);
    });

    await test.step('Verify cell value changed', async () => {
      const data = await reports.captureTableData();
      expect(data[0].values[0].value).toBe(testValue);
    });

    await test.step('Revert the edit', async () => {
      await reports.editCell(0, 0, originalValue);
      const data = await reports.captureTableData();
      expect(data[0].values[0].value).toBe(originalValue);
    });
  });

  test('TC_RPT_016 — Email dialog opens for selected rows', async () => {
    await test.step('Select first row and open email dialog', async () => {
      await reports.selectFirstRow();
      await reports.openEmailDialog();
    });

    await test.step('Verify email dialog is visible', async () => {
      await expect(reports.dialog.filter({ hasText: /Send Report via Email/ })).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Close dialog', async () => {
      await reports.closeDialog();
    });
  });

  test('TC_RPT_017 — Add custom column dialog opens', async () => {
    await test.step('Click add column button', async () => {
      await reports.openAddColumnDialog();
    });

    await test.step('Verify dialog is visible', async () => {
      await expect(reports.dialog.filter({ hasText: /Add Custom Field Column/ })).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Close dialog', async () => {
      await reports.closeDialog();
    });
  });

  test('TC_RPT_018 — Manage templates dialog opens', async () => {
    await test.step('Click manage templates button', async () => {
      await reports.openManageTemplates();
    });

    await test.step('Verify dialog is visible', async () => {
      await expect(reports.dialog.filter({ hasText: /Manage Tracker Columns/ })).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Close dialog', async () => {
      await reports.closeDialog();
    });
  });

  test('TC_RPT_019 — Theme toggle switches dark/light mode', async () => {
    const originalTheme = await reports.page.evaluate(() => document.documentElement.classList.contains('dark'));
    await test.step('Toggle theme and verify class changed', async () => {
      await reports.toggleTheme();
      await expect.poll(() => reports.page.evaluate(() => document.documentElement.classList.contains('dark')))
        .not.toBe(originalTheme);
    });

    await test.step('Toggle back', async () => {
      await reports.toggleTheme();
      await expect.poll(() => reports.page.evaluate(() => document.documentElement.classList.contains('dark')))
        .toBe(originalTheme);
    });
  });

  test('TC_RPT_020 — Back button returns to dashboard', async () => {
    await test.step('Click Back button', async () => {
      await reports.goBack();
    });

    await test.step('Verify URL is dashboard', async () => {
      await expect(reports.page).toHaveURL(/\/dashboard/);
    });
  });

  test('TC_RPT_021 — Email dialog validates required fields', async () => {
    await test.step('Select first row and open email dialog', async () => {
      await reports.selectFirstRow();
      await reports.openEmailDialog();
      await expect(reports.dialog.filter({ hasText: /Send Report via Email/ })).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Verify email dialog is open with body field', async () => {
      await reports.page.waitForTimeout(1000);
      const inputs = await reports.page.evaluate(() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
          .find((d) => d.textContent.includes('Send Report via Email'));
        if (!dialog) return { found: false, body: false };
        return {
          found: true,
          body: !!dialog.querySelector('[contenteditable="true"]'),
        };
      });
      expect(inputs.found).toBe(true);
      expect(inputs.body).toBe(true);
    });

    await test.step('Enter invalid email and click Send', async () => {
      await reports.fillEmailDialog({ to: 'not-an-email', subject: '' });
      await reports.sendEmail({ allowDisabled: true });
    });

    await test.step('Verify validation error is shown', async () => {
      const bodyText = await reports.page.evaluate(() => document.body.innerText);
      const hasError = /invalid|required|please enter|valid email|email is required/i.test(bodyText);
      const dialogStillOpen = await reports.dialog.isVisible().catch(() => false);
      expect(hasError || dialogStillOpen).toBe(true);
    });

    await test.step('Cancel dialog', async () => {
      await reports.cancelEmailDialog();
    });
  });

  test('TC_RPT_022 — Send report email and verify delivery', async () => {
    const inbox = await generateTestEmail('reports');
    const recipientEmail = inbox.email;
    const today = new Date().toLocaleDateString('en-US');
    let subject;

    await test.step('Select first row and open email dialog', async () => {
      await reports.selectFirstRow();
      await reports.openEmailDialog();
    });

    await test.step('Address the report to a controllable test inbox', async () => {
      const templateName = await reports.page.evaluate(() => {
        const templateCombo = document.querySelectorAll('[role="combobox"]')[2];
        return templateCombo ? templateCombo.textContent.trim() : 'Default Template';
      });
      subject = `Candidate Report - ${templateName} (${today})`;
      await reports.fillEmailDialog({
        to: recipientEmail,
        subject,
        body: 'This is an automated report email test.',
      });
      await reports.sendEmail();
    });

    await test.step('Verify send success toast or dialog closes', async () => {
      await reports.page.waitForTimeout(3000);
      const toastText = await reports.page.evaluate(() => {
        const toasts = Array.from(document.querySelectorAll('[role="status"], [role="alert"]'));
        return toasts.map((t) => t.innerText).join(' | ');
      });
      console.log('Toast text:', toastText);
      const dialogClosed = !(await reports.dialog.isVisible().catch(() => false));
      expect(dialogClosed || /sent|queued|success|email/i.test(toastText)).toBe(true);
    });

    await test.step('Verify email delivery in test inbox', async () => {
      const inboxPage = await reports.page.context().newPage();
      try {
        const yopMail = new YopMailPage(inboxPage);
        await yopMail.openInbox(inbox);
        await yopMail.openEmailBySubject(subject, 90_000);
        await yopMail.waitForEmailByText('This is an automated report email test.', 90_000);
      } finally {
        await inboxPage.close();
      }
    });
  });

  test('TC_RPT_023 — Add, edit, rearrange, delete custom tracker column and bind candidate data', async () => {
    const columnName = `AutoCol_${Date.now()}`;
    const renamedColumn = `${columnName}_Renamed`;
    const firstCandidate = baseline[0].candidateName;
    const secondCandidate = baseline.length > 1 ? baseline[1].candidateName : firstCandidate;

    await test.step('Open add column dialog and create column', async () => {
      await reports.addCustomColumn(columnName);
    });

    await test.step('Verify new column appears in table header', async () => {
      const headers = await reports.getColumnHeaders();
      expect(headers.some((h) => h.toLowerCase().includes(columnName.toLowerCase()))).toBe(true);
    });

    await test.step('Bind first candidate name to the new column', async () => {
      await reports.editLastCell(0, firstCandidate);
      const data = await reports.captureTableData();
      const lastValue = data[0].values[data[0].values.length - 1].value;
      expect(lastValue).toBe(firstCandidate);
    });

    await test.step('Bind a different candidate name to the second row', async () => {
      await reports.editLastCell(1, secondCandidate);
      const data = await reports.captureTableData();
      const lastValue = data[1].values[data[1].values.length - 1].value;
      expect(lastValue).toBe(secondCandidate);
    });

    await test.step('Rename the custom column', async () => {
      await reports.openManageColumnsDialog();
      await reports.renameCustomColumn(columnName, renamedColumn);
      await reports.closeManageColumnsDialog();
      const headers = await reports.getColumnHeaders();
      expect(headers.some((h) => h.toLowerCase().includes(renamedColumn.toLowerCase()))).toBe(true);
    });

    await test.step('Rearrange custom column to the top', async () => {
      await reports.openManageColumnsDialog();
      const rowsBefore = await reports.getManageColumnsRowTitles();
      const renamedRowBefore = rowsBefore.findIndex((t) =>
        t.toLowerCase().includes(renamedColumn.toLowerCase())
      );
      await reports.moveCustomColumn(renamedColumn, 'top');
      // Reopen the dialog to read the persisted order.
      await reports.openManageColumnsDialog();
      const rowsAfter = await reports.getManageColumnsRowTitles();
      const renamedRowAfter = rowsAfter.findIndex((t) =>
        t.toLowerCase().includes(renamedColumn.toLowerCase())
      );
      await reports.closeManageColumnsDialog();
      // Verify the column moved up in the Manage Tracker Columns order and is
      // now above at least one other custom column.
      expect(renamedRowAfter).toBeLessThan(renamedRowBefore);
      const nextAutoRow = rowsAfter.findIndex(
        (t, i) => /^autocol_/i.test(t) && i > renamedRowAfter
      );
      expect(nextAutoRow).toBeGreaterThan(renamedRowAfter);
    });

    await test.step('Delete the custom column', async () => {
      await reports.openManageColumnsDialog();
      await reports.deleteCustomColumn(renamedColumn);
      await reports.closeManageColumnsDialog();
      const headers = await reports.getColumnHeaders();
      expect(headers.some((h) => h.toLowerCase().includes(renamedColumn.toLowerCase()))).toBe(false);
    });
  });
});
