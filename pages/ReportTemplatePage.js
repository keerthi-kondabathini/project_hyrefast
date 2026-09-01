// pages/ReportTemplatePage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * ReportTemplatePage — Report Templates CRUD inside a company's Manage panel.
 *
 * Covers:
 *  - Navigate to Clients → search company → Manage → Report Templates tab
 *  - Create template with multiple columns (each column has title + DB field mapping)
 *  - Edit template (add/remove columns)
 *  - Delete template
 *  - Use template in Reports & Trackers section
 */
class ReportTemplatePage extends BasePage {
  constructor(page) {
    super(page);

    // ── Navigation ────────────────────────────────────────
    this.userMenuBtn        = page.getByRole('button', { name: 'Company Logo' })
                               .or(page.getByRole('button').filter({ hasText: /^[A-Z]$/ }).first());
    this.workspaceSettings  = page.getByText('Workspace settings');
    this.clientsBtn         = page.getByRole('button', { name: /Clients Client companies/i });
    this.companySearchInput = page.getByRole('textbox', { name: 'Search company, legal name,' });
    this.manageBtn          = page.getByRole('button', { name: 'Manage' });
    this.reportTemplatesTab = page.getByRole('tab', { name: 'Report Templates' });

    // ── Create Template ───────────────────────────────────
    this.createTemplateBtn  = page.getByRole('button', { name: 'Create Template' });
    this.templateNameInput  = page.getByRole('textbox', { name: 'e.g. Standard Developer Sheet' });
    this.setDefaultCheckbox = page.getByRole('checkbox', { name: 'Set as default template' });
    this.addColumnBtn       = page.getByRole('button', { name: 'Add Column' });
    this.columnTitleInput   = page.getByRole('textbox', { name: 'Column Title' });
    this.categoryCombo      = page.getByRole('combobox').filter({ hasText: /Application \/ Candidate/i });
    this.fieldFilterInput   = page.getByRole('textbox', { name: 'Filter fields by name or key' });
    this.saveAddColumnBtn   = page.getByRole('button', { name: 'Save and Add Column' });
    this.saveTemplateBtn    = page.getByRole('button', { name: 'Save Template' });
    this.templateCreatedToast = page.getByText('Client template created');
    this.templateUpdatedToast = page.getByText('Client template updated');
    this.deleteTemplateBtn  = page.getByRole('button', { name: 'Delete Template' });

    // ── Reports & Trackers ────────────────────────────────
    this.reportsTrackersBtn = page.getByRole('button', { name: 'Reports & Trackers' });
    this.clearAllBtn        = page.getByRole('button', { name: 'Clear All' });
    this.clientSearchInput  = page.getByRole('textbox', { name: 'Search clients…' });
    this.templateCombo      = page.getByRole('combobox').filter({ hasText: /nm|xya|\u2728/i });
  }

  // ── Navigation ─────────────────────────────────────────
  async navigateToReportTemplatesTab(companySearchQuery) {
    await this.userMenuBtn.click();
    await this.workspaceSettings.click();
    await this.page.waitForLoadState('networkidle');
    await this.clientsBtn.click();
    await this.page.waitForLoadState('networkidle');
    await this.companySearchInput.fill(companySearchQuery);
    await this.page.waitForTimeout(1000);
    await this.manageBtn.first().click();
    await this.page.waitForLoadState('networkidle');
    await this.reportTemplatesTab.click();
    await this.page.waitForTimeout(500);
  }

  // ── Column helper ──────────────────────────────────────
  /**
   * Add a single column to the template.
   * @param {{ title, category, fieldSearch, fieldOptionText }} col
   *   category: the category to select from the first combobox, e.g. 'Job Opening'
   *             pass null/undefined to keep current selection
   *   fieldSearch: text to type in field filter
   *   fieldOptionText: visible text of the field option to click
   */
  async _addColumn({ title, category, fieldSearch, fieldOptionText }) {
    await this.addColumnBtn.click();
    if (title) await this.columnTitleInput.fill(title);

    if (category) {
      await this.categoryCombo.click();
      await this.page.getByRole('option', { name: category }).click();
    }

    // Field combobox — second combobox in the add-column form
    const fieldCombo = this.page.getByRole('combobox').filter({
      hasText: /Candidate Name|Designation/i,
    }).first();
    await fieldCombo.click();

    if (fieldSearch) {
      await this.fieldFilterInput.fill(fieldSearch);
      await this.page.waitForTimeout(400);
    }

    await this.page.getByText(fieldOptionText).first().click();
    await this.saveAddColumnBtn.click();
    await this.page.waitForTimeout(300);
  }

  // ── Create Template ────────────────────────────────────
  /**
   * Create a full report template.
   * @param {{ name, setDefault, columns[] }} opts
   *   columns: array of { title, category?, fieldSearch?, fieldOptionText }
   */
  async createTemplate({ name, setDefault = true, columns = [] }) {
    await this.createTemplateBtn.click();
    await this.templateNameInput.fill(name);
    if (setDefault) await this.setDefaultCheckbox.check();

    for (const col of columns) {
      await this._addColumn(col);
    }

    await this.saveTemplateBtn.click();
    await expect(this.templateCreatedToast).toBeVisible({ timeout: 15_000 });
  }

  // ── Edit Template ──────────────────────────────────────
  /**
   * Edit the first/nth template card.
   * @param {number} cardNth   - 0-based index of overflow button on template card
   * @param {{ columns[] }} opts  - additional columns to add
   */
  async editTemplate({ cardNth = 4, columns = [] } = {}) {
    await this.page.getByRole('button').filter({ hasText: /^$/ }).nth(cardNth).click();

    for (const col of columns) {
      await this._addColumn(col);
    }

    await this.saveTemplateBtn.click();
    await expect(this.templateUpdatedToast).toBeVisible({ timeout: 15_000 });
  }

  // ── Delete Template ────────────────────────────────────
  async deleteTemplate(cardNth = 5) {
    await this.page.getByRole('button').filter({ hasText: /^$/ }).nth(cardNth).click();
    await expect(this.deleteTemplateBtn).toBeVisible({ timeout: 10_000 });
  }

  // ── Use in Reports & Trackers ──────────────────────────
  /**
   * Open Reports & Trackers, filter by client, select the template.
   * @param {{ clientSearchQuery, templateOptionText, clientComboCurrentText }} opts
   */
  async openInReportsAndTrackers({ clientSearchQuery, templateOptionText, clientComboCurrentText }) {
    // Reports & Trackers lives on the dashboard, not in the workspace settings flow
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');

    await this.reportsTrackersBtn.click();
    await this.page.waitForLoadState('networkidle');

    // Clear existing filters
    await this.page.getByRole('combobox').filter({ hasText: clientComboCurrentText }).click();
    await this.clearAllBtn.click();

    // Search and select client
    await this.clientSearchInput.fill(clientSearchQuery);
    await this.page.waitForTimeout(500);
    await this.page.getByRole('button', { name: new RegExp(clientSearchQuery, 'i') }).first().click();

    // Select template
    await this.templateCombo.click();
    await this.page.getByText(templateOptionText).click();
    await this.page.waitForTimeout(500);
  }
}

module.exports = { ReportTemplatePage };