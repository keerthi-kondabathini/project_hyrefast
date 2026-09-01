// pages/POCPage.js 
const { expect } = require('@playwright/test');
const { faker } = require('@faker-js/faker');
const { BasePage } = require('./BasePage'); 
 
/** 
 * POCPage — Point of Contacts (SPOC) management inside a company's Manage panel. 
 * 
 * Covers: 
 *  - Navigating to Clients → search company → Manage → POC tab 
 *  - Add, Edit, Delete a point of contact 
 *  - Assigning a SPOC to a job via Edit Job Details 
 */ 
class POCPage extends BasePage { 
  constructor(page) { 
    super(page); 
 
    // ── Settings navigation ─────────────────────────────── 
    this.userMenuBtn        = page.getByRole('button', { name: 'Company Logo' }) 
                               .or(page.getByRole('button').filter({ hasText: /^[A-Z]$/ }).first()); 
    this.workspaceSettings  = page.getByText('Workspace settings'); 
    this.clientsBtn         = page.getByRole('button', { name: /Clients Client companies/i }); 
    this.companySearchInput = page.getByRole('textbox', { name: 'Search company, legal name,' }); 
    this.manageBtn          = page.getByRole('button', { name: 'Manage' }); 
    this.pocTab             = page.getByRole('tab', { name: 'Point of Contacts (POC)' }); 
 
    // ── Add / Edit contact form ─────────────────────────── 
    this.addContactBtn      = page.getByRole('button', { name: 'Add contact' }); 
    this.nameInput          = page.getByRole('textbox', { name: 'Name *' }); 
    this.designationInput   = page.getByRole('textbox', { name: 'Designation' }); 
    this.emailInput         = page.getByRole('textbox', { name: 'Email *' }); 
    this.mobileInput        = page.getByRole('textbox', { name: 'Mobile' }); 
    this.addRepBtn          = page.getByRole('button', { name: 'Add representative' }); 
    this.pocAddedToast      = page.getByText('Point of contact added'); 
 
    this.editContactBtn     = page.getByRole('button', { name: 'Edit contact' }); 
    this.saveModificationsBtn = page.getByRole('button', { name: 'Save modifications' }); 
    this.pocUpdatedToast    = page.getByText('Point of contact updated'); 
 
    this.deleteContactBtn   = page.getByRole('button', { name: 'Delete contact' }); 
    this.deleteRepBtn       = page.getByRole('button', { name: 'Delete Representative' }); 
    this.pocDeletedToast    = page.getByText('Point of contact deleted'); 
  } 
 
  // ── Navigation ───────────────────────────────────────── 
  async navigateToPOCTab(companySearchQuery) { 
    await this.userMenuBtn.click(); 
    await this.workspaceSettings.click(); 
    await this.page.waitForLoadState('networkidle'); 
    await this.clientsBtn.click(); 
    await this.page.waitForLoadState('networkidle'); 
    await this.companySearchInput.fill(companySearchQuery); 
    await this.page.waitForTimeout(1000); 
    await this.manageBtn.first().click(); 
    await this.page.waitForLoadState('networkidle'); 
    await this.pocTab.click(); 
    await this.page.waitForTimeout(500); 
  } 
 
  // ── CRUD ─────────────────────────────────────────────── 
  async addContact({ name, designation, email, mobile }) { 
    await this.addContactBtn.click(); 
    await this.nameInput.fill(name); 
    await this.designationInput.fill(designation); 
    await this.emailInput.fill(email); 
    await this.mobileInput.fill(mobile); 
    await this.addRepBtn.click(); 
    await expect(this.pocAddedToast).toBeVisible({ timeout: 10_000 }); 
  } 
 
  async editContact({ name, designation, email, mobile } = {}) { 
    await this.editContactBtn.first().click(); 
    if (name)        await this.nameInput.fill(name); 
    if (designation) await this.designationInput.fill(designation); 
    if (email)       await this.emailInput.fill(email); 
    if (mobile)      await this.mobileInput.fill(mobile); 
    await this.saveModificationsBtn.click(); 
    await expect(this.pocUpdatedToast).toBeVisible({ timeout: 10_000 }); 
  } 
 
  async deleteContact() { 
    await this.deleteContactBtn.first().click(); 
    await this.deleteRepBtn.click(); 
    await expect(this.pocDeletedToast).toBeVisible({ timeout: 10_000 }); 
  } 
 
  // ── SPOC assignment on a job ─────────────────────────── 
  /** 
   * Open Edit Job Details for a job and assign a SPOC by searching for their name. 
   * @param {string} jobSearchQuery  - query to find the job in the search box 
   * @param {string} spocSearchQuery - name to search in the SPOC dropdown 
   * @param {string} spocOptionText  - visible text of the option to click 
   */ 
  async assignSPOCToJob({ companyName, jobSearchQuery, spocSearchQuery, spocOptionText }) { 
    // Dashboard defaults to "All companies"; filter to the target company first 
    await this.page.goto('/dashboard'); 
    await this.page.waitForLoadState('networkidle'); 
    const companyFilterBtn = this.page.locator('button').filter({ hasText: /All companies/i }); 
    await companyFilterBtn.click(); 
    await this.page.getByRole('option', { name: new RegExp(companyName, 'i') }).first().click(); 
    await this.page.waitForLoadState('networkidle'); 
 
    const dashJobSearch = this.page.getByRole('textbox', { name: 'Search by job name or ID' }); 
    await dashJobSearch.fill(jobSearchQuery); 
    await this.page.waitForTimeout(1500); 
 
    // Open 3-dot overflow menu on the first job card
    const jobCard = this.page.locator('div').filter({ hasText: new RegExp(jobSearchQuery, 'i') }).first();
    await jobCard.waitFor({ state: 'visible', timeout: 15_000 });
    const overflowBtn = jobCard.locator('button').filter({ hasText: /^$/ }).first();
    await overflowBtn.click(); 
    await this.page.getByRole('menuitem', { name: 'Edit Job Details' }).click(); 
    await this.page.waitForLoadState('networkidle'); 
 
    const spocCombo = this.page.getByRole('combobox', { name: 'Single Point of Contact (SPOC)' }); 
    await spocCombo.click(); 
    await this.page.getByPlaceholder('Search or type name to quick-').fill(spocSearchQuery); 
    await this.page.waitForTimeout(600); 
 
    // The dropdown offers to create a new contact if no existing match is found.
    // Pick the "Create \"<name>\" as new contact" option and fill the dialog.
    const createOption = this.page.getByRole('option').filter({ hasText: new RegExp(`Create "${spocOptionText}" as new contact`, 'i') }).first();
    if (await createOption.isVisible().catch(() => false)) {
      await createOption.scrollIntoViewIfNeeded();
      await createOption.click();
      await this.page.getByRole('textbox', { name: 'Name *' }).fill(spocOptionText);
      await this.page.getByRole('textbox', { name: 'Designation' }).fill('Automation SPOC');
      await this.page.getByRole('textbox', { name: 'Email *' }).fill(`spoc_${faker.string.alphanumeric(5).toLowerCase()}@yopmail.com`);
      await this.page.getByRole('textbox', { name: 'Mobile' }).fill(faker.string.numeric(10));
      await this.page.getByRole('button', { name: 'Save & Set SPOC' }).click();
    } else { 
      const option = this.page.getByRole('option', { name: new RegExp(spocOptionText, 'i') }).first(); 
      await option.scrollIntoViewIfNeeded(); 
      await option.click(); 
      await this.page.getByRole('button', { name: 'Save changes' }).click(); 
    } 
    await expect(this.page.getByRole('status')).toBeVisible({ timeout: 10_000 }); 
  } 
} 

module.exports = { POCPage };
