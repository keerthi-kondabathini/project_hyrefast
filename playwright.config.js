// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config({ path: `.env.${process.env.TEST_ENV || 'staging'}` });

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
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'reports/results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL,
    headless: process.env.HEADLESS !== 'false',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },

  projects: [
    // ── Default: real browser, no fake media (auth, JD, settings) ──
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/interview/**'],
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
  ],
});