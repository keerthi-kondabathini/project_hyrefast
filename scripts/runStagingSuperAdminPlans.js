const { spawnSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

process.env.TEST_ENV = 'staging';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.staging') });
process.env.BASE_URL ||= 'https://staging.hyrefast.ai';

const STAGING_ORIGIN = 'https://staging.hyrefast.ai';
let configuredOrigin;
try {
  configuredOrigin = new URL(process.env.BASE_URL).origin;
} catch {
  throw new Error(`Invalid BASE_URL in the staging environment: ${JSON.stringify(process.env.BASE_URL)}`);
}
if (configuredOrigin !== STAGING_ORIGIN) {
  throw new Error(`Billing Plans CRUD is staging-only; configured origin was ${configuredOrigin}`);
}

const playwrightCli = path.join(path.dirname(require.resolve('playwright')), 'cli.js');
const result = spawnSync(process.execPath, [
  playwrightCli,
  'test',
  'tests/super-admin/billingPlans.crud.spec.js',
  '--project=chromium',
], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
