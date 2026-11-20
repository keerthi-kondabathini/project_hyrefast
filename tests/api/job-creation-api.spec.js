const { test, expect } = require('../../utils/apiFixture');

test.describe('API — Job creation', () => {
  test('TC_JD_API_001 — create a job draft and verify its saved values', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const jobTitle = `API Job Draft ${Date.now()}`;
    const workspaceResponse = await api.post('api/v1/workspace/list', {
      data: { query: { _id: workspaceId }, options: { populate: [{ path: 'default_company' }] } },
    });
    const workspaceBody = await workspaceResponse.json();
    expect(workspaceResponse.status()).toBe(200);
    const workspace = workspaceBody.data?.data?.[0];
    const defaultCompany = workspace?.default_company;
    const companyId = typeof defaultCompany === 'string' ? defaultCompany : (defaultCompany?.id || defaultCompany?._id);
    expect(companyId).toBeTruthy();

    const create = await api.post('api/v1/mastra/recruiter/jd/save-draft', {
      data: {
        workspaceId,
        companyId,
        title: jobTitle,
        roleTitle: jobTitle,
        externalJobId: '',
        jobDescription: `Temporary API test draft for ${jobTitle}.`,
        location: 'Hyderabad, Telangana, India',
        employmentType: 'Full-time',
        workMode: 'Hybrid',
        salaryMin: null,
        salaryMax: null,
        minExperience: 1,
        maxExperience: 3,
        sourceInputType: 'unknown',
        sourceInputValue: jobTitle,
        pipeline: {
          runId: `api-${Date.now()}`,
          status: 'draft',
          output: { structured_extraction: {}, jdScorecard: {}, improvementSuggestions: [] },
          context: {},
          trace: {},
        },
        status: 'draft',
      },
    });
    const createdBody = await create.json();
    const jobId = createdBody.data?.id || createdBody.data?._id;
    expect(create.status()).toBe(200);
    expect(jobId).toBeTruthy();

    try {
      const jobsResponse = await api.post('api/v1/job/list', {
        data: {
          query: { workspace: workspaceId, _id: jobId, isDeleted: false },
          options: { page: 1, limit: 10 },
        },
      });
      const jobsBody = await jobsResponse.json();
      expect(jobsResponse.status()).toBe(200);
      const savedJob = jobsBody.data?.data?.find(job => String(job.id || job._id) === String(jobId));
      expect(savedJob).toBeTruthy();
      expect(savedJob.title).toBe(jobTitle);
      expect(savedJob.workspace).toBe(workspaceId);
      expect(savedJob.status).toBe('draft');
      expect(savedJob.location).toBe('Hyderabad, Telangana, India');
      expect(savedJob.employment_type || savedJob.employmentType).toBe('Full-time');
      expect(savedJob.workMode || savedJob.work_mode).toBe('Hybrid');
    } finally {
      const remove = await api.put(`api/v1/job/update/${jobId}`, { data: { isDeleted: true } });
      expect(remove.status()).toBe(200);
    }
  });
});
