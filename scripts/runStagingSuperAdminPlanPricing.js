const { spawnSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const STAGING_ORIGIN = 'https://staging.hyrefast.ai';
process.env.TEST_ENV = 'staging';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.staging') });
process.env.BASE_URL ||= STAGING_ORIGIN;

if (new URL(process.env.BASE_URL).origin !== STAGING_ORIGIN) {
  throw new Error(`Plan & Pricing CRUD is staging-only; configured origin was ${new URL(process.env.BASE_URL).origin}`);
}

const playwrightCli = path.join(path.dirname(require.resolve('playwright')), 'cli.js');
const result = spawnSync(process.execPath, [
  playwrightCli,
  'test',
  'tests/super-admin/planPricing.crud.spec.js',
  '--project=chromium',
], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
