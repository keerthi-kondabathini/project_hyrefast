const { test: base, expect, request } = require('@playwright/test');

const SENSITIVE_KEYS = /(authorization|password|token|otp|email|phone|mobile|name|address|resume|file|url|username|code|ipaddress|useragent|comment|notes|transcript|answer|feedback)/i;
const MAX_LOG_CHARS = 8_000;

function logJson(label, value) {
  const json = JSON.stringify(redact(value), null, 2);
  const output = json.length > MAX_LOG_CHARS
    ? `${json.slice(0, MAX_LOG_CHARS)}\n… [truncated ${json.length - MAX_LOG_CHARS} characters]`
    : json;
  console.log(label, output);
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    SENSITIVE_KEYS.test(key) ? '[REDACTED]' : redact(child),
  ]));
}

function loggedApi(context) {
  return new Proxy(context, {
    get(target, property) {
      const original = target[property];
      if (typeof original !== 'function' || !['get', 'post', 'put', 'patch', 'delete', 'head', 'fetch'].includes(property)) {
        return typeof original === 'function' ? original.bind(target) : original;
      }
      return async (url, options = {}) => {
        const payload = options.data ?? options.form ?? options.multipart ?? null;
        console.log(`\n[API REQUEST] ${String(property).toUpperCase()} ${url}`);
        logJson('[API PAYLOAD]', payload);
        const response = await original.call(target, url, options);
        let body;
        try {
          body = JSON.parse(await response.text());
        } catch {
          body = await response.text().catch(() => '[unavailable]');
        }
        console.log(`[API RESPONSE] ${response.status()} ${url}`);
        logJson('[API BODY]', body);
        return response;
      };
    },
  });
}

function getApiBaseUrl() {
  if (process.env.API_BASE_URL) return `${process.env.API_BASE_URL.replace(/\/+$/, '')}/`;

  const appUrl = process.env.BASE_URL;
  if (!appUrl) throw new Error('BASE_URL is required to choose the HyreFast API host.');
  const appHost = new URL(appUrl).hostname;
  const apiHost = appHost === 'app.hyrefast.ai' ? 'api.hyrefast.ai' : 'staging-api.hyrefast.ai';
  return `https://${apiHost}/client/`;
}

async function loginWithApi(apiRequest, email, password) {
  const response = await apiRequest.post('auth/send_otp_2fa', {
    data: { username: email, password },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

const test = base.extend({
  apiBaseUrl: async ({}, use) => use(getApiBaseUrl()),

  api: async ({}, use) => {
    const context = await request.newContext({
      baseURL: getApiBaseUrl(),
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });
    await use(loggedApi(context));
    await context.dispose();
  },

  apiSession: [async ({}, use) => {
    const email = process.env.USER_EMAIL;
    const password = process.env.USER_PASSWORD;
    if (!email || !password) throw new Error('USER_EMAIL and USER_PASSWORD are required for authenticated API tests.');

    const unauthenticated = await request.newContext({
      baseURL: getApiBaseUrl(),
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });
    const { response: loginResponse, body: loginBody } = await loginWithApi(loggedApi(unauthenticated), email, password);
    if (!loginResponse.ok() || loginBody?.success !== true || !loginBody?.data?.token) {
      await unauthenticated.dispose();
      throw new Error(`API login failed (${loginResponse.status()}): ${loginBody?.message || 'missing token'}`);
    }
    await unauthenticated.dispose();

    const authenticated = await request.newContext({
      baseURL: getApiBaseUrl(),
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginBody.data.token}`,
      },
    });
    const loggedAuthenticated = loggedApi(authenticated);
    const meResponse = await loggedAuthenticated.get('api/v1/user/me');
    const meBody = await meResponse.json().catch(() => ({}));
    if (!meResponse.ok() || !meBody?.data?.workspace) {
      await authenticated.dispose();
      throw new Error(`Could not load API user/workspace (${meResponse.status()}).`);
    }

    await use({
      api: loggedAuthenticated,
      token: loginBody.data.token,
      user: meBody.data,
      workspaceId: meBody.data.workspace,
      loginBody,
    });
    await authenticated.dispose();
  }, { scope: 'worker' }],
});

module.exports = { test, expect, getApiBaseUrl, loginWithApi };
