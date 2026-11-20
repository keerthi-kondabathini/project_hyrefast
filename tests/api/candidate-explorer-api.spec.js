const { test, expect } = require('../../utils/apiFixture');

async function listApplications(api, workspaceId, query = {}, options = {}) {
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

const candidateOf = app => (app.candidate && typeof app.candidate === 'object' ? app.candidate : app);
const jobOf = app => (app.job && typeof app.job === 'object' ? app.job : {});
const idOf = value => typeof value === 'object' && value ? (value.id || value._id) : value;

test.describe('API — Candidate Explorer query equivalents (TC_CEF_001–015)', () => {
  test('TC_CEF_001 — baseline candidate rows include the fields used by the UI', async ({ apiSession }) => {
    const rows = await listApplications(apiSession.api, apiSession.workspaceId);
    expect(rows.length).toBeGreaterThan(0);
    const app = rows[0];
    const candidate = candidateOf(app);
    expect(candidate.name || app.name).toBeTruthy();
    expect(candidate.email || app.email).toBeTruthy();
    expect(app.status || app.statusCode).toBeTruthy();
  });

  const textSearchCases = [
    { caseId: 'TC_CEF_002', label: 'candidate name', get: a => candidateOf(a).name || a.name, apiField: 'candidate', getId: a => idOf(a.candidate) },
    { caseId: 'TC_CEF_003', label: 'email', get: a => candidateOf(a).email || a.email, apiField: 'candidate', getId: a => idOf(a.candidate) },
    { caseId: 'TC_CEF_004', label: 'phone', get: a => candidateOf(a).mobileNo || candidateOf(a).phone || a.mobileNo || a.mobileNumber, apiField: 'candidate', getId: a => idOf(a.candidate) },
    { caseId: 'TC_CEF_005', label: 'role', get: a => jobOf(a).title || a.role, apiField: 'job', getId: a => idOf(a.job) },
    { caseId: 'TC_CEF_006', label: 'company', get: a => typeof jobOf(a).company === 'object' ? jobOf(a).company.name : jobOf(a).company, apiField: 'company', getId: a => idOf(jobOf(a).company) },
    { caseId: 'TC_CEF_007', label: 'job ID', get: a => jobOf(a).id || jobOf(a)._id || a.job, apiField: 'job', getId: a => idOf(a.job) },
  ];

  for (const search of textSearchCases) {
    test(`${search.caseId} — API query by ${search.label} narrows the candidate list`, async ({ apiSession }) => {
      const { api, workspaceId } = apiSession;
      const baseline = await listApplications(api, workspaceId);
      const target = baseline.find(row => search.get(row) !== undefined && search.get(row) !== null && String(search.get(row)).trim());
      test.skip(!target, `No candidate has a ${search.label} value in the current workspace`);
      const value = String(search.get(target)).trim();
      const targetId = search.getId(target);
      test.skip(!targetId, `The selected ${search.label} does not have a linked record ID`);
      const filtered = await listApplications(api, workspaceId, { [search.apiField]: { $in: [targetId] } });
      expect(filtered.length).toBeGreaterThan(0);
      for (const row of filtered) {
        expect(String(search.getId(row))).toBe(String(targetId));
        expect(String(search.get(row) ?? '').toLowerCase()).toContain(value.toLowerCase());
      }
    });
  }

  test('TC_CEF_008 — API application-status filter returns only that status', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const rows = await listApplications(api, workspaceId);
    const status = rows.find(row => row.status || row.statusCode)?.status || rows.find(row => row.statusCode)?.statusCode;
    test.skip(!status, 'No application status exists in the baseline data');
    const filtered = await listApplications(api, workspaceId, { status: { $in: [status] } });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(row => (row.status || row.statusCode) === status)).toBe(true);
  });

  test('TC_CEF_009 — interview-link query is accepted by the application API', async ({ apiSession }) => {
    const rows = await listApplications(apiSession.api, apiSession.workspaceId, { privateInterviewLink: { $exists: true } });
    expect(rows).toEqual(expect.any(Array));
  });

  test('TC_CEF_010 — added-by filter is accepted by the application API', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const baseline = await listApplications(api, workspaceId);
    const addedBy = baseline.find(row => row.addedBy)?.addedBy;
    test.skip(!addedBy, 'No added-by value exists in the baseline data');
    const id = typeof addedBy === 'object' ? (addedBy.id || addedBy._id) : addedBy;
    const filtered = await listApplications(api, workspaceId, { addedBy: { $in: [id] } });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(row => String(typeof row.addedBy === 'object' ? row.addedBy.id || row.addedBy._id : row.addedBy) === String(id))).toBe(true);
  });

  test('TC_CEF_011 — active-only query returns active applications', async ({ apiSession }) => {
    const rows = await listApplications(apiSession.api, apiSession.workspaceId, { isActive: true });
    expect(rows.every(row => row.isActive === true)).toBe(true);
  });

  test('TC_CEF_012 — API pagination honors the requested page size', async ({ apiSession }) => {
    const rows = await listApplications(apiSession.api, apiSession.workspaceId, {}, { page: 1, limit: 20 });
    expect(rows.length).toBeLessThanOrEqual(20);
  });

  test('TC_CEF_013 — API sort by status returns ordered results', async ({ apiSession }) => {
    const rows = await listApplications(apiSession.api, apiSession.workspaceId, {}, { sort: { status: 1 } });
    const statuses = rows.map(row => String(row.status || row.statusCode || ''));
    expect(statuses).toEqual([...statuses].sort((a, b) => a.localeCompare(b)));
  });

  test('TC_CEF_015 — clearing query filters restores the baseline result set', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const baseline = await listApplications(api, workspaceId);
    const narrowed = await listApplications(api, workspaceId, { isActive: true });
    const reset = await listApplications(api, workspaceId);
    expect(reset.map(row => row.id || row._id)).toEqual(baseline.map(row => row.id || row._id));
    expect(narrowed.length).toBeLessThanOrEqual(baseline.length);
  });
});
