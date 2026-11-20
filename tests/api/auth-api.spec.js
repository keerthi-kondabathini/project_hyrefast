const { test, expect, loginWithApi } = require('../../utils/apiFixture');

test.describe('API — Authentication', () => {
  test('TC_AUTH_001 — valid credentials return a bearer token and user profile', async ({ api }) => {
    const { response, body } = await loginWithApi(api, process.env.USER_EMAIL, process.env.USER_PASSWORD);
    expect(response.status()).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.token).toEqual(expect.any(String));
    expect(body.data.email).toBe(process.env.USER_EMAIL);
  });

  test('TC_AUTH_003 — invalid credentials are rejected by the API', async ({ api }) => {
    const { response, body } = await loginWithApi(api, 'invalid-api-user@example.invalid', 'incorrect-password');
    expect(response.status()).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toEqual(expect.any(String));
  });

  test('TC_AUTH_004 — protected profile API rejects an unauthenticated request', async ({ api }) => {
    const response = await api.get('api/v1/user/me');
    expect(response.status()).toBe(401);
  });
});
