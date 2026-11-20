const { test, expect } = require('../../utils/apiFixture');

test.describe('API — Workspace settings, teams, and templates', () => {
  test('Workspace members, teams, roles, and pending invites APIs return data', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const responses = await Promise.all([
      api.get(`api/v1/workspace/${workspaceId}/teams`),
      api.get(`api/v1/workspace/${workspaceId}/roles`),
      api.get(`api/v1/workspace/members?workspaceId=${encodeURIComponent(workspaceId)}`),
      api.get(`api/v1/workspace/invite/pending?workspaceId=${encodeURIComponent(workspaceId)}`),
    ]);
    const bodies = await Promise.all(responses.map(response => response.json()));
    for (let i = 0; i < responses.length; i++) {
      expect(responses[i].status()).toBe(200);
      expect(bodies[i]).toHaveProperty('data');
    }
    expect(bodies[0].data).toEqual(expect.any(Array));
    expect(bodies[1].data).toEqual(expect.any(Array));
    expect(bodies[2].data).toEqual(expect.any(Array));
  });

  test('Workspace company list API returns the company collection', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const response = await api.post('api/v1/company/list', {
      data: { query: { workspace: workspaceId }, options: {} },
    });
    const body = await response.json();
    expect(response.status()).toBe(200);
    expect(body.data.companies).toEqual(expect.any(Array));
  });

  test('TC_SET_009–011 — company create, update, list, and delete APIs work', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const name = `API_Test_Company_${Date.now()}`;
    let companyId;
    const create = await api.post('api/v1/company/create', {
      data: {
        name,
        // The app's request interceptor maps the form's camelCase legalName; send both forms in direct API tests.
        legalName: `${name}.example`,
        legal_name: `${name}.example`,
        website: `https://${name.toLowerCase()}.example`,
        location: 'Hyderguda Telangana, India',
        description: 'Temporary company created by API test',
        workspaceId,
      },
    });
    const createdBody = await create.json();
    expect(create.status()).toBe(200);
    companyId = createdBody.data?.company?.id || createdBody.data?.company?._id;
    expect(companyId).toBeTruthy();

    try {
      const initialList = await api.post('api/v1/company/list', {
        data: { query: { workspace: workspaceId }, options: {} },
      });
      const initialListBody = await initialList.json();
      expect(initialList.status()).toBe(200);
      const initiallyPersisted = initialListBody.data?.companies?.find(company => String(company.id || company._id) === String(companyId));
      expect(initiallyPersisted).toBeTruthy();
      expect(initiallyPersisted.name).toBe(name);
      expect(initiallyPersisted.legal_name || initiallyPersisted.legalName).toBe(`${name}.example`);
      expect(initiallyPersisted.website).toBe(`https://${name.toLowerCase()}.example`);

      const update = await api.put(`api/v1/company/update/${companyId}`, {
        data: {
          legal_name: `${name}_Updated.example`,
          website: `https://${name.toLowerCase()}-updated.example`,
          description: 'Updated by API test',
        },
      });
      expect(update.status()).toBe(200);

      const list = await api.post('api/v1/company/list', {
        data: { query: { workspace: workspaceId }, options: {} },
      });
      const listBody = await list.json();
      expect(list.status()).toBe(200);
      const persisted = listBody.data?.companies?.find(company => String(company.id || company._id) === String(companyId));
      expect(persisted).toBeTruthy();
      expect(persisted.name).toBe(name);
      expect(persisted.legal_name || persisted.legalName).toBe(`${name}_Updated.example`);
      expect(persisted.website).toBe(`https://${name.toLowerCase()}-updated.example`);

      const remove = await api.delete(`api/v1/company/delete/${companyId}`);
      expect(remove.status()).toBe(200);
      companyId = null;
      const afterDelete = await api.post('api/v1/company/list', {
        data: { query: { workspace: workspaceId }, options: {} },
      });
      const afterDeleteBody = await afterDelete.json();
      expect(afterDelete.status()).toBe(200);
      expect(afterDeleteBody.data?.companies?.some(company => String(company.id || company._id) === String(companyId))).toBe(false);
    } finally {
      if (companyId) {
        const remove = await api.delete(`api/v1/company/delete/${companyId}`);
        expect(remove.status()).toBe(200);
      }
    }
  });

  test('Report and interview round template list APIs return data', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const workspacesResponse = await api.post('api/v1/workspace/list', {
      data: { query: { _id: workspaceId }, options: { populate: [{ path: 'default_company' }] } },
    });
    const workspaces = await workspacesResponse.json();
    expect(workspacesResponse.status()).toBe(200);
    const company = workspaces.data?.data?.[0]?.default_company;
    const companyId = typeof company === 'string' ? company : company?.id;
    expect(companyId).toBeTruthy();

    const [reportsResponse, roundsResponse] = await Promise.all([
      api.get(`api/v1/reports/templates?companyId=${encodeURIComponent(companyId)}`),
      api.get(`api/v1/interview-rounds/templates?companyId=${encodeURIComponent(companyId)}`),
    ]);
    const [reports, rounds] = await Promise.all([reportsResponse.json(), roundsResponse.json()]);
    expect(reportsResponse.status()).toBe(200);
    expect(roundsResponse.status()).toBe(200);
    expect(reports).toHaveProperty('data');
    expect(rounds).toHaveProperty('data');
  });

  test('TC_RT_001–003 — report-template API supports create, edit, list, and delete', async ({ apiSession }) => {
    const { api, workspaceId } = apiSession;
    const workspacesResponse = await api.post('api/v1/workspace/list', {
      data: { query: { _id: workspaceId }, options: { populate: [{ path: 'default_company' }] } },
    });
    const workspaces = await workspacesResponse.json();
    expect(workspacesResponse.status()).toBe(200);
    const defaultCompany = workspaces.data?.data?.[0]?.default_company;
    const companyId = typeof defaultCompany === 'string' ? defaultCompany : (defaultCompany?.id || defaultCompany?._id);
    expect(companyId).toBeTruthy();

    // Remove leftovers from an interrupted run; these names are reserved for this API test.
    const staleResponse = await api.get(`api/v1/reports/templates?companyId=${encodeURIComponent(companyId)}`);
    const staleBody = await staleResponse.json();
    expect(staleResponse.status()).toBe(200);
    const staleStack = [staleBody];
    while (staleStack.length) {
      const item = staleStack.pop();
      if (Array.isArray(item)) staleStack.push(...item);
      else if (item && typeof item === 'object') {
        const id = item._id || item.id;
        if (typeof item.name === 'string' && item.name.startsWith('API_Report_Template_') && id) {
          const staleDelete = await api.delete(`api/v1/reports/templates/${id}`);
          expect(staleDelete.status()).toBe(200);
        } else staleStack.push(...Object.values(item));
      }
    }

    const name = `API_Report_Template_${Date.now()}`;
    let templateId;
    let deleted = false;
    const create = await api.post('api/v1/reports/templates', {
      data: {
        name,
        companyId,
        setDefault: false,
        columns: [{ header: 'email', field: 'candidate.email', category: 'Candidate' }],
      },
    });
    const created = await create.json();
    expect(create.status()).toBe(200);
    templateId = created.data?._id || created.data?.id;

    try {
      expect(templateId).toBeTruthy();
      expect(created.data?.name).toBe(name);
      expect(created.data?.columns?.map(column => column.header)).toEqual(['email']);

      const update = await api.put(`api/v1/reports/templates/${templateId}`, {
        data: {
          name,
          companyId,
          isDefault: false,
          columns: [
            { header: 'email', field: 'candidate.email', category: 'Candidate' },
            { header: 'candidate name', field: 'candidate.name', category: 'Candidate' },
          ],
        },
      });
      expect(update.status()).toBe(200);

      const list = await api.get(`api/v1/reports/templates?companyId=${encodeURIComponent(companyId)}`);
      const listBody = await list.json();
      expect(list.status()).toBe(200);
      const stack = [listBody];
      let persisted;
      while (stack.length && !persisted) {
        const item = stack.pop();
        if (Array.isArray(item)) stack.push(...item);
        else if (item && typeof item === 'object') {
          if (item.name === name) persisted = item;
          else stack.push(...Object.values(item));
        }
      }
      expect(persisted).toBeTruthy();
      expect(persisted.name).toBe(name);
      expect(persisted.columns.map(column => column.header)).toEqual(['email', 'candidate name']);

      const remove = await api.delete(`api/v1/reports/templates/${templateId}`);
      expect(remove.status()).toBe(200);
      deleted = true;
      const afterDelete = await api.get(`api/v1/reports/templates?companyId=${encodeURIComponent(companyId)}`);
      const afterDeleteBody = await afterDelete.json();
      expect(afterDelete.status()).toBe(200);
      const afterDeleteStack = [afterDeleteBody];
      let stillListed = false;
      while (afterDeleteStack.length) {
        const item = afterDeleteStack.pop();
        if (Array.isArray(item)) afterDeleteStack.push(...item);
        else if (item && typeof item === 'object') {
          if (item.name === name) stillListed = true;
          else afterDeleteStack.push(...Object.values(item));
        }
      }
      expect(stillListed).toBe(false);
    } finally {
      if (!deleted && templateId) await api.delete(`api/v1/reports/templates/${templateId}`);
    }
  });

  test('TC_SET_008 — profile API can save the current profile values', async ({ apiSession }) => {
    const { api, user } = apiSession;
    expect(user.id).toEqual(expect.any(String));
    expect(user.email).toBe(process.env.USER_EMAIL);
    expect(user.workspace).toEqual(expect.any(String));

    const update = await api.put(`api/v1/user/update/${user.id}`, {
      data: { name: user.name, mobileNo: user.mobileNo },
    });
    expect(update.status()).toBe(200);
    const updatedProfile = await api.get('api/v1/user/me');
    const body = await updatedProfile.json();
    expect(updatedProfile.status()).toBe(200);
    expect(body.data.name).toBe(user.name);
    expect(body.data.mobileNo).toBe(user.mobileNo);
  });
});
