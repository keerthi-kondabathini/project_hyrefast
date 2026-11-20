// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('node:path');

const testEnv = process.env.TEST_ENV || 'staging';
require('dotenv').config({ path: path.join(__dirname, `.env.${testEnv}`) });
// Staging-specific suites may be run directly from a parent working directory.
// Keep their default target explicit and safe when the local env file omits BASE_URL.
if (testEnv === 'staging') process.env.BASE_URL ||= 'https://staging.hyrefast.ai';

/**
 * HyreFast Automation — Playwright Configuration
 * Supports: staging | production
 *
 * Usage:
 *   TEST_ENV=staging  npx playwright test
 *   TEST_ENV=production npx playwright test
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 600_000,           // 10 min — full interview + AI analysis polling
  expect: { timeout: 50_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 5,
  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'reports/results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL,
    headless: process.env.HEADLESS !== 'false',
    screenshot: process.env.CI ? 'off' : 'only-on-failure',
    video: process.env.CI ? 'off' : 'retain-on-failure',
    trace: process.env.CI ? 'off' : 'on-first-retry',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },

  projects: [
    // ── Default: real browser, no fake media (auth, JD, settings) ──
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
      testIgnore: ['**/interview/**', '**/api/**'],
    },

    // ── Interview tests: fake camera + microphone + audio files ──
    {
      name: 'chromium-interview',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
           // Audio file is passed per-test via TEST_AUDIO_FILE env or fixture
            ...(process.env.FAKE_AUDIO_FILE
              ? [`--use-file-for-fake-audio-capture=${process.env.FAKE_AUDIO_FILE}`]
              : []),
          ],
        },
      },
      testMatch: ['**/interview/**'],
    },

    // API-only equivalents use Playwright's request context and do not launch a browser.
    {
      name: 'api',
      testMatch: ['**/api/**/*.spec.js'],
      workers: 1,
    },
  ],
});
