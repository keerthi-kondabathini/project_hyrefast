const { test, expect } = require('../../utils/apiFixture');

function envelope(response, body) {
  expect(response.status()).toBe(200);
  expect(body).toHaveProperty('data');
}

test.describe('API — Dashboard, jobs, and candidate pipeline', () => {
  test('Job list and count APIs return workspace scoped results', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const query = { workspace: workspaceId, isDeleted: false };
    const listResponse = await api.post('api/v1/job/list', {
      data: { query, options: { page: 1, limit: 10, sort: { createdAt: -1 } } },
    });
    const list = await listResponse.json();
    envelope(listResponse, list);
    expect(list.data.data).toEqual(expect.any(Array));
    expect(list.data.paginator).toBeTruthy();

    const countResponse = await api.post('api/v1/job/count', { data: { query, options: {} } });
    const count = await countResponse.json();
    envelope(countResponse, count);
    expect(count.data.count).toEqual(expect.any(Number));
  });

  test('Application list, filter configuration, and workflow configuration APIs return data', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const [workflowResponse, filterResponse, applicationsResponse] = await Promise.all([
      api.get('api/v1/application/workflow-config'),
      api.get('api/v1/application/filter-config'),
      api.post('api/v1/application/list', {
        data: { query: { workspace: workspaceId, isDeleted: false }, options: { limit: 10 } },
      }),
    ]);
    const [workflow, filters, applications] = await Promise.all([
      workflowResponse.json(), filterResponse.json(), applicationsResponse.json(),
    ]);

    envelope(workflowResponse, workflow);
    expect(workflow.data.stages).toEqual(expect.any(Array));
    expect(workflow.data.transitions).toBeTruthy();
    envelope(filterResponse, filters);
    expect(filters.data.filters).toBeTruthy();
    envelope(applicationsResponse, applications);
    expect(applications.data.data).toEqual(expect.any(Array));
    expect(applications.data.paginator).toBeTruthy();
  });

  test('Dashboard job and credit APIs return typed workspace metrics', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const [jobsResponse, creditsResponse] = await Promise.all([
      api.get(`api/v1/dashboard/job-status-stats/${workspaceId}`),
      api.get(`api/v1/credit/balance/${workspaceId}`),
    ]);
    const [jobs, credits] = await Promise.all([jobsResponse.json(), creditsResponse.json()]);
    envelope(jobsResponse, jobs);
    expect(jobs.data.publishedJobs).toEqual(expect.any(Number));
    envelope(creditsResponse, credits);
    expect(credits.data.workspaceId).toBe(workspaceId);
    expect(credits.data.availableCredits).toEqual(expect.any(Number));
  });

  test('Interview response list API is available to the workspace', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const response = await api.post('api/v1/response/list', {
      data: { query: { workspace: workspaceId, isDeleted: false }, options: { limit: 10 } },
    });
    const body = await response.json();
    envelope(response, body);
    expect(body.data.data).toEqual(expect.any(Array));
    expect(body.data.paginator).toBeTruthy();
  });
});
