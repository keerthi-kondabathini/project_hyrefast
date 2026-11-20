const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/LoginPage');
const { ExternalUserProfilePage } = require('../../pages/external-user/ExternalUserProfilePage');
const { ExternalCreditsPage } = require('../../pages/external-user/ExternalCreditsPage');
const { ExternalApiKeysPage } = require('../../pages/external-user/ExternalApiKeysPage');
const { ExternalBrandAppearancePage } = require('../../pages/external-user/ExternalBrandAppearancePage');

const STAGING_ORIGIN = 'https://staging.hyrefast.ai';
const email = process.env.EXTERNAL_USER_EMAIL;
const password = process.env.EXTERNAL_USER_PASSWORD;

// The API key page can briefly display a newly generated secret. Avoid retaining
// screenshots, videos, or traces from this suite in local test artifacts.
test.use({ screenshot: 'off', video: 'off', trace: 'off' });

function assertStagingConfiguration() {
  const baseURL = process.env.BASE_URL;
  expect(baseURL, 'Set BASE_URL to the staging URL').toBeTruthy();
  let origin;
  try {
    origin = new URL(baseURL).origin;
  } catch {
    throw new Error(`Invalid BASE_URL in the staging environment: ${JSON.stringify(baseURL)}`);
  }
  expect(origin, 'This third-party dashboard suite is staging-only').toBe(STAGING_ORIGIN);
  expect(email, 'Set EXTERNAL_USER_EMAIL in .env.staging').toBeTruthy();
  expect(password, 'Set EXTERNAL_USER_PASSWORD in .env.staging').toBeTruthy();
}

test.describe('Third-party user dashboard (staging only)', () => {
  test.beforeEach(async ({ page }) => {
    assertStagingConfiguration();
    const login = new LoginPage(page);
    await login.navigate();
    await login.login(email, password);
    await new ExternalUserProfilePage(page).assertLoaded(email);
  });

  test('profile editing and security controls are available', async ({ page }) => {
    const profile = new ExternalUserProfilePage(page);
    await profile.assertProfileAndSecurityControls();

    const originalName = await profile.fullNameInput.inputValue();
    const testName = `E2E external user ${Date.now()}`;
    try {
      await profile.updateFullName(testName);
      await expect(profile.fullNameInput).toHaveValue(testName);
    } finally {
      await profile.updateFullName(originalName);
      await expect(profile.fullNameInput).toHaveValue(originalName);
    }
  });

  test('credits summary and refresh work', async ({ page }) => {
    const credits = new ExternalCreditsPage(page);
    await credits.assertLoaded();
    await credits.refresh();
  });

  test('logout returns the external user to sign in', async ({ page }) => {
    await new ExternalUserProfilePage(page).logout();
  });

  test('API keys can be generated and revoked', async ({ page }) => {
    const apiKeys = new ExternalApiKeysPage(page);
    await apiKeys.assertLoaded();
    const name = `E2E staging key ${Date.now()}`;
    let cleanupRequired = false;
    try {
      cleanupRequired = true;
      await apiKeys.createKey(name);
      await apiKeys.revokeKey(name);
      cleanupRequired = false;
    } finally {
      if (cleanupRequired && await apiKeys.keyRow(name).count()) {
        await apiKeys.revokeKey(name);
      }
    }
  });

  test('brand appearance settings save and restore', async ({ page }) => {
    const brand = new ExternalBrandAppearancePage(page);
    await brand.assertLoaded();
    const original = await brand.currentAppearance();
    const testName = `E2E brand ${Date.now()}`;
    const testColor = original.color.toLowerCase() === '#0d9488' ? '#10b981' : '#0d9488';

    try {
      await brand.brandNameInput.fill(testName);
      await brand.primaryColorInput.fill(testColor);
      await brand.logoUrlInput.fill(`https://example.com/e2e-logo-${Date.now()}.png`);
      await expect(brand.saveButton).toBeEnabled();
      await brand.save();

      await brand.openSection('credits');
      await brand.openSection('brand');
      await expect(brand.brandNameInput).toHaveValue(testName);
      await expect(brand.primaryColorInput).toHaveValue(testColor);
      await expect(brand.logoUrlInput).toHaveValue(/e2e-logo-/);
    } finally {
      await brand.openSection('brand');
      await brand.brandNameInput.fill(original.name);
      await brand.primaryColorInput.fill(original.color);
      await brand.logoUrlInput.fill(original.logoUrl);
      if (await brand.saveButton.isEnabled()) await brand.save();
      await expect(brand.brandNameInput).toHaveValue(original.name);
      await expect(brand.primaryColorInput).toHaveValue(original.color);
      await expect(brand.logoUrlInput).toHaveValue(original.logoUrl);
    }
  });
});
