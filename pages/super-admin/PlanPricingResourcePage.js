const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Shared list, form, custom-select, and deletion behavior for super-admin pricing resources. */
class PlanPricingResourcePage extends BasePage {
  constructor(page, config) {
    super(page);
    Object.assign(this, config);
    this.rows = page.getByRole('row');
    this.formHeading = page.getByRole('heading', { name: this.formTitle });
    this.form = page.getByRole('dialog').filter({ has: this.formHeading });
  }

  async navigate() {
    await this.page.goto(this.path);
    await expect(this.page.getByRole('heading', { name: this.pageTitle })).toBeVisible();
  }

  async openCreate() {
    await this.page.getByRole('button', { name: this.createAction }).click();
    await expect(this.form).toBeVisible();
  }

  row(identifier) {
    return this.rows.filter({ hasText: identifier });
  }

  async hasRow(identifier) {
    return (await this.row(identifier).count()) > 0;
  }

  async assertRowVisible(identifier) {
    await expect(this.row(identifier)).toBeVisible();
  }

  async openEdit(identifier) {
    const row = this.row(identifier);
    await expect(row).toBeVisible();
    await row.getByRole('button').first().click();
    await expect(this.form).toBeVisible();
  }

  async fillText(id, value) {
    await this.form.locator(`#${id}`).fill(String(value));
  }

  async fillNumber(id, value) {
    await this.form.locator(`#${id}`).fill(String(value));
  }

  async choose(index, value, { search } = {}) {
    await this.form.getByRole('combobox').nth(index).click();
    if (search) {
      const searchBox = this.page.getByRole('textbox').last();
      if (await searchBox.count()) await searchBox.fill(search);
    }

    const matcher = new RegExp(escapeRegex(value), 'i');
    const options = this.page.getByRole('option', { name: matcher });
    if (await options.count()) {
      await options.first().click();
      return;
    }

    const buttons = this.page.getByRole('button', { name: matcher });
    if (await buttons.count()) {
      await buttons.last().click();
      return;
    }
    await this.page.getByText(value, { exact: true }).last().click();
  }

  async submit(action) {
    await this.form.getByRole('button', { name: action }).click();
    await expect(this.form).toBeHidden();
  }

  async deleteRow(identifier) {
    const row = this.row(identifier);
    await expect(row).toBeVisible();
    await row.getByRole('button').nth(1).click();
    const confirmationHeading = this.page.getByRole('heading', { name: this.deleteTitle });
    const confirmation = this.page.getByRole('dialog').filter({ has: confirmationHeading })
      .or(this.page.getByRole('alertdialog').filter({ has: confirmationHeading }));
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: this.deleteAction }).click();
    await expect(row).toHaveCount(0);
  }
}

module.exports = { PlanPricingResourcePage };
