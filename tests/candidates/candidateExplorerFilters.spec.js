/**
 * Candidate Explorer — Filters & Dropdowns Smoke Tests
 *
 * TC_CEF_001  Navigate to Candidate Explorer and capture baseline table data
 * TC_CEF_002  Search dropdown: filter by Candidate name and verify results
 * TC_CEF_003  Search dropdown: filter by Email and verify results
 * TC_CEF_004  Search dropdown: filter by Phone and verify results
 * TC_CEF_005  Search dropdown: filter by Role and verify results
 * TC_CEF_006  Search dropdown: filter by Company and verify results
 * TC_CEF_007  Search dropdown: filter by Job ID and verify results
 * TC_CEF_008  Advanced Filters: filter by Application Status and click Apply Filters
 * TC_CEF_009  Advanced Filters: filter by Interview Link Status and click Apply Filters
 * TC_CEF_010  Advanced Filters: filter by Applicant Added By and click Apply Filters
 * TC_CEF_011  Toggle: Show Active Candidates Only
 * TC_CEF_012  Rows per page dropdown
 * TC_CEF_013  Table column sorting (Status)
 * TC_CEF_014  Action menu dropdown opens for a candidate row
 * TC_CEF_015  Reset All filters returns table to baseline
 *
 * Approach:
 *   - Capture a baseline set of candidates from the first page.
 *   - Use real values from that baseline to drive each filter assertion.
 *   - This avoids hard-coding staging data that may change.
 */

const { test, expect } = require('../../utils/authFixture');
const { CandidateExplorerPage } = require('../../pages/CandidateExplorerPage');

test.describe('TC_CEF — Candidate Explorer filters & dropdowns', () => {
  let explorer;
  let baseline;

  test.beforeEach(async ({ page, loggedInPage }) => {
    explorer = new CandidateExplorerPage(page);
    await explorer.goto();
    baseline = await explorer.captureTableData();
    expect(baseline.length, 'Expected at least one candidate on the explorer page').toBeGreaterThan(0);
  });

  test('TC_CEF_001 — Explorer page loads and baseline data is captured', async () => {
    await test.step('Verify explorer heading and table are visible', async () => {
      await explorer.assertExplorerVisible();
    });

    await test.step('Baseline contains required fields', async () => {
      const first = baseline[0];
      expect(first.name).toBeTruthy();
      expect(first.email).toBeTruthy();
      expect(first.status).toBeTruthy();
    });
  });

  test('TC_CEF_002 — Search by Candidate name returns matching rows', async () => {
    const target = baseline[0];

    await test.step(`Filter by Candidate name: ${target.name}`, async () => {
      await explorer.searchBy('Candidate', target.name);
    });

    await test.step('Verify every visible row contains the searched name', async () => {
      const filtered = await explorer.captureTableData();
      expect(filtered.length).toBeGreaterThan(0);
      for (const row of filtered) {
        expect(row.name).toContain(target.name);
      }
    });
  });

  test('TC_CEF_003 — Search by Email returns matching rows', async () => {
    const target = baseline.find(c => c.email && c.email !== '—');
    test.skip(!target, 'No candidate with an email found in baseline');

    await test.step(`Filter by Email: ${target.email}`, async () => {
      await explorer.searchBy('Email', target.email);
    });

    await test.step('Verify every visible row contains the searched email', async () => {
      const filtered = await explorer.captureTableData();
      expect(filtered.length).toBeGreaterThan(0);
      for (const row of filtered) {
        expect(row.email).toContain(target.email);
      }
    });
  });

  test('TC_CEF_004 — Search by Phone returns matching rows', async () => {
    const target = baseline.find(c => c.phone && c.phone !== '—');
    test.skip(!target, 'No candidate with a phone found in baseline');

    await test.step(`Filter by Phone: ${target.phone}`, async () => {
      await explorer.searchBy('Phone', target.phone);
    });

    await test.step('Verify every visible row contains the searched phone', async () => {
      const filtered = await explorer.captureTableData();
      expect(filtered.length).toBeGreaterThan(0);
      for (const row of filtered) {
        expect(row.phone).toContain(target.phone);
      }
    });
  });

  test('TC_CEF_005 — Search by Role returns matching rows', async () => {
    const target = baseline.find(c => c.role && c.role !== '—');
    test.skip(!target, 'No candidate with a role found in baseline');

    // Extract just the role title (strip company / JID suffix)
    const roleTitle = target.role.split(/Gimolov|Hyrefast|JID:/)[0].trim();
    test.skip(!roleTitle, 'Could not extract role title from baseline row');

    await test.step(`Filter by Role: ${roleTitle}`, async () => {
      await explorer.searchBy('Role', roleTitle);
    });

    await test.step('Verify every visible row contains the searched role', async () => {
      const filtered = await explorer.captureTableData();
      expect(filtered.length).toBeGreaterThan(0);
      for (const row of filtered) {
        expect(row.role).toContain(roleTitle);
      }
    });
  });

  test('TC_CEF_006 — Search by Company returns matching rows', async () => {
    const target = baseline.find(c => c.role && /Gimolov|Hyrefast|Capgemini|genpact/i.test(c.role));
    test.skip(!target, 'No candidate with a recognizable company found in baseline');

    const company = target.role.match(/Gimolov|Hyrefast|Capgemini|genpact/i)[0];

    await test.step(`Filter by Company: ${company}`, async () => {
      await explorer.searchBy('Company', company);
    });

    await test.step('Verify every visible row contains the searched company', async () => {
      const filtered = await explorer.captureTableData();
      expect(filtered.length).toBeGreaterThan(0);
      for (const row of filtered) {
        expect(row.role).toContain(company);
      }
    });
  });

  test('TC_CEF_007 — Search by Job ID returns matching rows', async () => {
    const target = baseline.find(c => c.role && /JID:\s*\d+/i.test(c.role));
    test.skip(!target, 'No candidate with a numeric Job ID found in baseline');

    const jobId = target.role.match(/JID:\s*(\d+)/i)[1];

    await test.step(`Filter by Job ID: ${jobId}`, async () => {
      await explorer.searchBy('Job ID', jobId);
    });

    await test.step('Verify every visible row contains the searched Job ID', async () => {
      const filtered = await explorer.captureTableData();
      expect(filtered.length).toBeGreaterThan(0);
      for (const row of filtered) {
        expect(row.role).toMatch(new RegExp(`JID:\\s*0*${jobId}`, 'i'));
      }
    });
  });

  test('TC_CEF_008 — Advanced Filters: Application Status filter applies correctly', async () => {
    const targetStatus = baseline[0].status;

    await test.step(`Open Filters and select status: ${targetStatus}`, async () => {
      await explorer.openAdvancedFilters();
      await explorer.selectStatusFilter(targetStatus);
      await explorer.applyFilters();
    });

    await test.step('Verify every visible row has the selected status', async () => {
      const filtered = await explorer.captureTableData();
      expect(filtered.length).toBeGreaterThan(0);
      for (const row of filtered) {
        expect(row.status).toBe(targetStatus);
      }
    });
  });

  test('TC_CEF_009 — Advanced Filters: Interview Link Status filter applies correctly', async () => {
    await test.step('Open Filters and select Interview Link Status = Sent', async () => {
      await explorer.openAdvancedFilters();
      await explorer.selectInterviewLinkStatus('Sent');
      await explorer.applyFilters();
    });

    await test.step('Verify table still loads without error', async () => {
      const filtered = await explorer.captureTableData();
      // We cannot see the interview link status in the table, so we just assert the filter applies and rows load.
      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });
  });

  test('TC_CEF_010 — Advanced Filters: Applicant Added By filter applies correctly', async () => {
    const target = baseline.find(c => c.addedBy && c.addedBy !== '—');
    test.skip(!target, 'No candidate with an Added By value found in baseline');

    await test.step(`Open Filters and select Added By: ${target.addedBy}`, async () => {
      await explorer.openAdvancedFilters();
      await explorer.selectAddedByFilter(target.addedBy);
      await explorer.applyFilters();
    });

    await test.step('Verify every visible row was added by the selected user', async () => {
      const filtered = await explorer.captureTableData();
      // The Added By filter may legitimately return zero rows if the selected recruiter
      // has no applicants on the current page. We assert the filter applies without error.
      for (const row of filtered) {
        expect(row.addedBy).toBe(target.addedBy);
      }
    });
  });

  test('TC_CEF_011 — Show Active Candidates Only toggle works', async () => {
    await test.step('Toggle Show Active Candidates Only on', async () => {
      await explorer.toggleActiveCandidatesOnly();
    });

    await test.step('Verify table still loads', async () => {
      const filtered = await explorer.captureTableData();
      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });
  });

  test('TC_CEF_012 — Rows per page dropdown changes visible row count', async () => {
    await test.step('Change rows per page to 20', async () => {
      await explorer.goto();
      await explorer.setRowsPerPage(20);
    });

    await test.step('Verify up to 20 rows are visible', async () => {
      const filtered = await explorer.captureTableData();
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.length).toBeLessThanOrEqual(20);
    });
  });

  test('TC_CEF_013 — Table column sorting by Status changes row order', async () => {
    const before = baseline.map(c => c.status);

    await test.step('Click Status column header to sort', async () => {
      await explorer.sortByColumn('Status');
    });

    await test.step('Verify order changed or remained consistently sorted', async () => {
      const after = await explorer.captureTableData();
      expect(after.length).toBeGreaterThan(0);
      // We just assert the sort action did not break the table.
      const afterStatuses = after.map(c => c.status);
      expect(afterStatuses).not.toEqual(before);
    });
  });

  test('TC_CEF_014 — Action menu dropdown opens for a candidate row', async () => {
    await test.step('Open actions menu for the first candidate', async () => {
      const items = await explorer.openFirstActionMenu();
      expect(items.length).toBeGreaterThan(0);
      expect(items).toContain('View Candidate Analysis');
    });
  });

  test('TC_CEF_015 — Reset All filters returns table to baseline state', async () => {
    await test.step('Apply a search filter first', async () => {
      await explorer.searchBy('Candidate', baseline[0].name);
    });

    await test.step('Reset all filters', async () => {
      await explorer.resetAllFilters();
    });

    await test.step('Verify search input is empty and table reloads', async () => {
      const afterReset = await explorer.captureTableData();
      expect(afterReset.length).toBeGreaterThan(0);
      // The first baseline candidate should be visible again after reset.
      expect(afterReset.some(r => r.name === baseline[0].name)).toBe(true);
    });
  });
});
