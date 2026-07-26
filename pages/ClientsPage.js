// pages/ClientsPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * ClientsPage covers the Clients / Companies section in Settings:
 *  - Viewing company list with count
 *  - Adding a new company (name, legal name, website, location, description)
 *  - Uploading a company logo
 *  - Searching and asserting company row details
 */
class ClientsPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Header ────────────────────────────────────────────
    this.companiesHeading    = page.getByRole('heading', { name: 'Companies inside this' });
    this.companiesCountText  = (count) => page.getByText(`Companies${count}`);

    // ── Add Company ───────────────────────────────────────
    this.addCompanyBtn       = page.getByRole('button', { name: 'Add company' });
    this.companyNameInput    = page.getByRole('textbox', { name: 'Company name' });
    this.legalNameInput      = page.getByRole('textbox', { name: 'Legal name' });
    this.websiteInput        = page.getByRole('textbox', { name: 'Website' });
    this.locationInput       = page.getByRole('textbox', { name: 'Search city, state, country' });
    this.descriptionInput    = page.getByRole('textbox', { name: 'Short description' });
    this.createCompanyBtn    = page.getByRole('button', { name: 'Create company' });

    // ── Search ────────────────────────────────────────────
    this.companySearchInput  = page.getByRole('textbox', { name: 'Search company, legal name,' });

    // ── Edit / Logo upload ────────────────────────────────
    this.saveCompanyBtn      = page.getByRole('button', { name: 'Save company' });
  }

  // ═══════════════════════════════════════════════════════
  //  Assertions — list view
  // ═══════════════════════════════════════════════════════

  async assertCompaniesPageOpen() {
    await this.assertVisible(this.companiesHeading, 'Companies heading should be visible');
  }

  async getCompanyCount() {
    return this.extractCount('Companies');
  }

  async assertCompanyCount(expected) {
    await expect(this.companiesCountText(expected)).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Add Company
  // ═══════════════════════════════════════════════════════

  /**
   * @param {{ name, legalName, website, locationQuery, locationOption, description }} company
   */
  async addCompany({ name, legalName, website, locationQuery, locationOption, description }) {
    await this.addCompanyBtn.click();

    await this.companyNameInput.click();
    await this.companyNameInput.fill(name);

    await this.legalNameInput.click();
    await this.legalNameInput.fill(legalName);

    await this.websiteInput.click();
    await this.websiteInput.fill(website);

    await this.locationInput.click();
    await this.locationInput.fill(locationQuery);
    await this.page.getByRole('button', { name: locationOption }).click();

    await this.descriptionInput.click();
    await this.descriptionInput.fill(description);

    await this.createCompanyBtn.click();
    await expect(this.page.getByRole('status')).toBeVisible({ timeout: 10_000 });
  
  }

  // ═══════════════════════════════════════════════════════
  //  Search & Assert Row
  // ═══════════════════════════════════════════════════════

  async searchCompany(query) {
    await this.companySearchInput.click();
    await this.companySearchInput.fill(query);
    await this.page.waitForTimeout(1000);
  }

  async assertCompanyRow({ name, legalName, website, location, status }) {
    if (name && legalName) {
     await expect(
  this.page.getByRole('cell', { name: `${name} ${legalName}` }).first()
).toBeVisible({ timeout: 10_000 });
    }
    if (website) {
      await expect(
        this.page.getByRole('cell', { name: website })
      ).toBeVisible({ timeout: 10_000 });
    }
    if (location) {
      await expect(
        this.page.getByRole('cell', { name: location })
      ).toBeVisible({ timeout: 10_000 });
    }
    if (status) {
      await expect(
        this.page.getByRole('cell', { name: status })
      ).toBeVisible({ timeout: 10_000 });
    }
  }
  

  // ═══════════════════════════════════════════════════════
  //  Upload Company Logo
  // ═══════════════════════════════════════════════════════

  /**
   * @param {string} companyName - used to click the Edit button
   * @param {string} logoFilePath - absolute path to the image file
   */
 async uploadLogo(companyName, logoFilePath) {
  await this.page.getByRole('button', { name: `Edit ${companyName}` }).click();

  // Click upload button (triggers file input)
  const uploadBtn = this.page.getByRole('button', { name: 'Upload' });
  await uploadBtn.click();

  // Wait for file input to appear
  const fileInput = this.page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached' });

  // Upload file
  await fileInput.setInputFiles(logoFilePath);

  const logoPreview = this.page.locator('img, [data-testid="logo-preview"]');
  await expect(logoPreview.first()).toBeVisible({ timeout: 10_000 });

  // Save
  await this.saveCompanyBtn.click();

  await expect(
    this.page.getByText(/updated|saved/i)
  ).toBeVisible({ timeout: 10_000 });

}

}

module.exports = { ClientsPage };