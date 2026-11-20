const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');

/** Page object for Super Admin > Plan & Pricing > Billing Plans. */
class BillingPlansPage extends BasePage {
  constructor(page) {
    super(page);
    this.createButton = page.getByRole('button', { name: /create plan/i });
    this.refreshButton = page.getByRole('button', { name: /refresh/i });
    this.searchInput = page.getByPlaceholder(/search plan name/i);
    this.rows = page.getByRole('row');
    this.formHeading = page.getByRole('heading', { name: /create billing plan|edit billing plan/i });
    // The heading's immediate parent is only a header wrapper, not the form.
    // Scope all form controls to the accessible dialog containing that heading.
    this.dialog = page.getByRole('dialog').filter({ has: this.formHeading });
  }

  async navigate() {
    await this.page.goto('/super-admin/plan-pricing/plans');
    // The staging app can render this section while normalizing the URL to /super-admin.
    // Assert the page's unique content instead of coupling navigation to that URL behavior.
    await expect(this.page.getByRole('heading', { name: /billing plans/i })).toBeVisible();
  }

  async openCreateForm() {
    await this.createButton.click();
    await expect(this.dialog).toBeVisible();
  }

  async openEditForm(planName) {
    const row = this.planRow(planName);
    await expect(row).toBeVisible();
    // The app renders icon-only action buttons without accessible names: edit is first.
    await row.getByRole('button').first().click();
    await expect(this.dialog).toBeVisible();
  }

  async fillPlanForm(plan) {
    for (const [field, value] of Object.entries(plan)) {
      if (value === undefined || value === null) continue;
      const control = this.formControl(field);
      if (await control.count() === 0) {
        if (['name', 'workspace', 'type', 'price', 'interval'].includes(field)) {
          throw new Error(`Required billing plan field was not found: ${field}`);
        }
        continue;
      }

      const fieldControl = control.first();
      const tagName = await fieldControl.evaluate((el) => el.tagName.toLowerCase());
      if (await fieldControl.getAttribute('type') === 'checkbox') {
        await fieldControl.setChecked(Boolean(value));
      } else if (tagName === 'select') {
        await fieldControl.selectOption({ label: String(value) });
      } else if (await fieldControl.getAttribute('role') === 'combobox') {
        await fieldControl.click();
        if (field === 'workspace') {
          const search = this.page.getByRole('textbox').last();
          if (await search.count()) await search.fill(String(value));
        }
        const option = this.page.getByRole('option', { name: String(value), exact: true })
          .or(this.page.getByRole('button', { name: String(value), exact: true }));
        await option.first().click();
      } else {
        await fieldControl.fill(String(value));
      }
    }
  }

  formControl(field) {
    const labels = {
      name: /plan name|name/i,
      description: /description/i,
      type: /billing type|plan type|type/i,
      price: /price|amount/i,
      interval: /billing interval|interval/i,
      workspace: /workspace/i,
      status: /status/i,
      currency: /currency/i,
    };
    const label = labels[field] || new RegExp(field, 'i');
    const comboIndex = { workspace: 0, type: 1, currency: 2, interval: 3, status: 4 }[field];
    let control = this.dialog.getByLabel(label).or(
      this.dialog.locator(`[name="${field}"]`),
    ).or(this.dialog.getByPlaceholder(label));
    if (comboIndex !== undefined) {
      control = control.or(this.dialog.getByRole('combobox').nth(comboIndex));
    }
    return control;
  }

  async submitForm(action = /save|create|update/i) {
    await this.dialog.getByRole('button', { name: action }).click();
    await expect(this.dialog).toBeHidden();
  }

  async findPlan(planName) {
    if (await this.searchInput.count()) await this.searchInput.fill(planName);
    return this.planRow(planName);
  }

  async filterByStatus(status) {
    const filter = this.page.getByRole('combobox').nth(2);
    await filter.click();
    const option = this.page.getByRole('option', { name: status, exact: true });
    if (await option.count()) await option.click();
    else await this.page.getByText(status, { exact: true }).last().click();
  }

  async toggleAndRestore(planName) {
    const row = this.planRow(planName);
    const toggle = row.getByRole('switch');
    await toggle.click();
    await expect(row.getByText('INACTIVE', { exact: true })).toBeVisible();
    await toggle.click();
    await expect(row.getByText('ACTIVE', { exact: true })).toBeVisible();
  }

  planRow(planName) {
    return this.rows.filter({ hasText: planName });
  }

  async assertPlanVisible(planName) {
    await expect(await this.findPlan(planName)).toBeVisible();
  }

  async deletePlan(planName) {
    const row = this.planRow(planName);
    // The app renders delete as the second icon-only action button.
    await row.getByRole('button').nth(1).click();
    const confirmationHeading = this.page.getByRole('heading', { name: /delete billing plan/i });
    const confirmation = this.page.getByRole('dialog').filter({ has: confirmationHeading })
      .or(this.page.getByRole('alertdialog').filter({ has: confirmationHeading }));
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: /delete|confirm|yes/i }).click();
    await expect(row).toHaveCount(0);
  }
}

module.exports = { BillingPlansPage };
