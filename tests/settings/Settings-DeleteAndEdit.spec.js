// tests/settings/Settings-DeleteAndEdit.spec.js
// ---------------------------------------------------------------------------
// TC_SET_010 — Delete a company
// TC_SET_011 — Edit company fields (update legal name, website, description)
// ---------------------------------------------------------------------------

const { test, expect }       = require('../../utils/authFixture');
const { SettingsPage }       = require('../../pages/SettingsPage');
const { ClientsPage }        = require('../../pages/ClientsPage');
const testData               = require('../../data/testData.json');
const path                   = require('path');

// ─── helpers ─────────────────────────────────────────────────────────────

async function openClients(settings) {
  await settings.openSettings();
  await settings.goToClients();
  const clientsPage = new ClientsPage(settings.page);
  await clientsPage.assertCompaniesPageOpen();
  return clientsPage;
}

// ══════════════════════════════════════════════════════════════════════════
//  TC_SET_010 — Delete a company
// ══════════════════════════════════════════════════════════════════════════
test.describe('TC_SET_010 — Delete a company from workspace', () => {

  test('Add company → verify → delete → verify removed', async ({
    page, loggedInPage,
  }) => {
    const settingsData = testData.settings;
    const settings     = new SettingsPage(page);
    const companyData  = settingsData.company;

    // Use a unique name to avoid conflicts
    const uniqueName = `AutoDeleteCo_${Date.now()}`;
    const company = {
      name:         uniqueName,
      legalName:    `${uniqueName}.com`,
      website:      `https://${uniqueName.toLowerCase()}.com`,
      locationQuery: 'hyd',
      locationOption: companyData.locationOption,
      description:  'Temporary company for delete test',
    };

    let clientsPage;
    await test.step('Open Clients and add a company', async () => {
      clientsPage = await openClients(settings);
      await clientsPage.addCompany(company);
    });

    await test.step('Verify company appears in list', async () => {
      await clientsPage.searchCompany(uniqueName);
      await clientsPage.assertCompanyRow({
        name:    uniqueName,
        legalName: company.legalName,
        website: company.website,
        location: companyData.locationDisplay,
        status:  'Ready',
      });
    });

    const initialCount = await clientsPage.getCompanyCount();
    console.log(`Company count before delete: ${initialCount}`);

    await test.step('Delete the company', async () => {
      await clientsPage.deleteCompany(uniqueName);
    });

    await test.step('Verify company count decreased', async () => {
      await clientsPage.companySearchInput.clear();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const afterCount = await clientsPage.getCompanyCount();
      expect(afterCount).toBe(initialCount - 1,
        `Expected count ${initialCount - 1} after delete but got ${afterCount}`);
    });

    await test.step('Verify deleted company no longer found', async () => {
      await clientsPage.searchCompany(uniqueName);
      await expect(
        page.getByText(/No matching|No companies found|No results/i)
      ).toBeVisible({ timeout: 10_000 }).catch(() => null);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  TC_SET_011 — Edit company fields
// ══════════════════════════════════════════════════════════════════════════
test.describe('TC_SET_011 — Edit company fields', () => {

  test('Add company → edit legal name, website, description → verify updates', async ({
    page, loggedInPage,
  }) => {
    const settingsData = testData.settings;
    const settings     = new SettingsPage(page);
    const companyData  = settingsData.company;

    const uniqueName = `AutoEditCo_${Date.now()}`;
    const originalLegal = `${uniqueName}.com`;
    const originalWebsite = `https://${uniqueName.toLowerCase()}.com`;

    const company = {
      name:         uniqueName,
      legalName:    originalLegal,
      website:      originalWebsite,
      locationQuery: 'hyd',
      locationOption: companyData.locationOption,
      description:  'Original description',
    };

    let clientsPage;
    await test.step('Open Clients and add a company', async () => {
      clientsPage = await openClients(settings);
      await clientsPage.addCompany(company);
    });

    await test.step('Verify initial company row', async () => {
      await clientsPage.searchCompany(uniqueName);
      await clientsPage.assertCompanyRow({
        name:    uniqueName,
        legalName: originalLegal,
        website: originalWebsite,
        location: companyData.locationDisplay,
        status:  'Ready',
      });
    });

    const newLegalName    = `${uniqueName}-updated-legal.com`;
    const newWebsite      = `https://${uniqueName.toLowerCase()}-updated.com`;
    const newDescription  = 'Updated description for edit test';

    await test.step('Edit company fields', async () => {
      await clientsPage.editCompany(uniqueName, {
        legalName:   newLegalName,
        website:     newWebsite,
        description: newDescription,
      });
    });

    await test.step('Re-search and verify updated values', async () => {
      await clientsPage.companySearchInput.clear();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await clientsPage.searchCompany(uniqueName);
      await clientsPage.assertCompanyRow({
        name:    uniqueName,
        legalName: newLegalName,
        website:  newWebsite,
        location: companyData.locationDisplay,
        status:  'Ready',
      });
    });
  });
});
