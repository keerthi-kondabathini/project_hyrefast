const { test, expect, loginWithApi } = require('../../utils/apiFixture');

test('TC_AUTH_002 — logout invalidates the API session', async ({ api }) => {
  const { response: loginResponse, body } = await loginWithApi(api, process.env.USER_EMAIL, process.env.USER_PASSWORD);
  expect(loginResponse.status()).toBe(200);
  const headers = { Authorization: `Bearer ${body.data.token}` };
  const logout = await api.post('auth/logout', { headers, data: { deviceId: 'playwright-api-suite' } });
  expect(logout.ok(), await logout.text()).toBeTruthy();

  const profile = await api.get('api/v1/user/me', { headers });
  expect(profile.status()).toBe(401);
});
