const { test, expect } = require('../../utils/apiFixture');

async function listReportApplications(api, workspaceId, query = {}, options = {}) {
  const response = await api.post('api/v1/application/list', {
    data: {
      query: { workspace: workspaceId, isDeleted: false, ...query },
      options: { page: 1, limit: 20, ...options },
    },
  });
  const body = await response.json();
  expect(response.status()).toBe(200);
  expect(body.data?.data).toEqual(expect.any(Array));
  return body.data.data;
}

const idOf = x => x && typeof x === 'object' ? (x.id || x._id) : x;
const jobOf = row => row.job && typeof row.job === 'object' ? row.job : {};

test.describe('API — Reports & Trackers data queries (TC_RPT_001–015)', () => {
  test('TC_RPT_001 — report endpoint returns the data rows used by the report UI', async ({ apiSession }) => {
    const { api } = apiSession;
    const response = await api.get('api/v1/reports/job-report/all/data?page=1&limit=20&isExport=false&companyId=all&reportType=custom');
    const body = await response.json();
    expect(response.status()).toBe(200);
    expect(body.data?.data).toEqual(expect.any(Array));
  });

  test('Application feed supplies candidate/job rows used by the report UI', async ({ apiSession }) => {
    const rows = await listReportApplications(apiSession.api, apiSession.workspaceId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].candidate).toBeTruthy();
    expect(rows[0].job).toBeTruthy();
  });

  test('TC_RPT_002 — company filter returns only rows linked to that company', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const baseline = await listReportApplications(api, workspaceId);
    const row = baseline.find(item => jobOf(item).company);
    test.skip(!row, 'No report row with a linked company exists');
    const companyId = idOf(jobOf(row).company);
    const filtered = await listReportApplications(api, workspaceId, { company: { $in: [companyId] } });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(item => String(idOf(jobOf(item).company)) === String(companyId))).toBe(true);
  });

  test('TC_RPT_003 — job filter returns only rows for the selected job', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const baseline = await listReportApplications(api, workspaceId);
    const row = baseline.find(item => item.job);
    test.skip(!row, 'No report row with a linked job exists');
    const jobId = idOf(row.job);
    const filtered = await listReportApplications(api, workspaceId, { job: { $in: [jobId] } });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(item => String(idOf(item.job)) === String(jobId))).toBe(true);
  });

  test('TC_RPT_005 — candidate stage filter returns only the selected stage', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const baseline = await listReportApplications(api, workspaceId);
    const target = baseline.find(item => item.status || item.statusCode);
    test.skip(!target, 'No candidate stage exists in the report data');
    const stage = target.status || target.statusCode;
    const filtered = await listReportApplications(api, workspaceId, { status: { $in: [stage] } });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(item => (item.status || item.statusCode) === stage)).toBe(true);
  });

  test('TC_RPT_004 — date range query returns records inside the requested range', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const baseline = await listReportApplications(api, workspaceId);
    const dated = baseline.filter(item => item.createdAt && !Number.isNaN(Date.parse(item.createdAt)));
    test.skip(!dated.length, 'No dated report records are available');
    const from = new Date(Math.min(...dated.map(item => Date.parse(item.createdAt))));
    const to = new Date(Math.max(...dated.map(item => Date.parse(item.createdAt))));
    const filtered = await listReportApplications(api, workspaceId, {
      createdAt: { $gte: from.toISOString(), $lte: to.toISOString() },
    });
    expect(filtered.length).toBeGreaterThan(0);
    for (const item of filtered) {
      const at = Date.parse(item.createdAt);
      expect(at).toBeGreaterThanOrEqual(from.getTime());
      expect(at).toBeLessThanOrEqual(to.getTime());
    }
  });

  test('TC_RPT_006 — candidate selection can be queried through the application API', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const baseline = await listReportApplications(api, workspaceId);
    const row = baseline.find(item => item.candidate);
    test.skip(!row, 'No candidate link exists in the report data');
    const candidateId = idOf(row.candidate);
    const filtered = await listReportApplications(api, workspaceId, { candidate: { $in: [candidateId] } });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(item => String(idOf(item.candidate)) === String(candidateId))).toBe(true);
  });

  test('TC_RPT_007–008 — report API honors page-size and page options', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const response = await api.post('api/v1/application/list', {
      data: { query: { workspace: workspaceId, isDeleted: false }, options: { page: 1, limit: 20 } },
    });
    const body = await response.json();
    expect(response.status()).toBe(200);
    expect(body.data.data.length).toBeLessThanOrEqual(20);
    expect(body.data.paginator).toBeTruthy();
  });

  test('TC_RPT_009 — report API honors sort order', async ({ apiSession }) => {
    const rows = await listReportApplications(apiSession.api, apiSession.workspaceId, {}, { sort: { createdAt: -1 } });
    const dates = rows.map(row => Date.parse(row.createdAt)).filter(Number.isFinite);
    expect(dates.length).toBeGreaterThan(1);
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  test('TC_RPT_014 — empty filters restore the unfiltered report data', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const baseline = await listReportApplications(api, workspaceId);
    const filtered = await listReportApplications(api, workspaceId, { status: { $in: [baseline[0].status || baseline[0].statusCode] } });
    const reset = await listReportApplications(api, workspaceId);
    expect(reset.map(row => idOf(row))).toEqual(baseline.map(row => idOf(row)));
    expect(filtered.length).toBeLessThanOrEqual(baseline.length);
  });
});
