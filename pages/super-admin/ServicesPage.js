const { expect } = require('@playwright/test');
const { PlanPricingResourcePage } = require('./PlanPricingResourcePage');

class ServicesPage extends PlanPricingResourcePage {
  constructor(page) {
    super(page, {
      path: '/super-admin/plan-pricing/services',
      pageTitle: /services catalog/i,
      createAction: /create service/i,
      formTitle: /create new service|edit service/i,
      deleteTitle: /are you sure you want to delete this service/i,
      deleteAction: /delete service/i,
    });
  }

  async toggleAndRestore(identifier) {
    const row = this.row(identifier);
    const toggle = row.getByRole('switch');
    await toggle.click();
    await expect(row.getByText('INACTIVE', { exact: true })).toBeVisible();
    await toggle.click();
    await expect(row.getByText('ACTIVE', { exact: true })).toBeVisible();
  }

  async search(identifier) {
    await this.page.getByPlaceholder(/search/i).fill(identifier);
    await this.assertRowVisible(identifier);
    await this.page.getByPlaceholder(/search/i).fill('');
  }
}

module.exports = { ServicesPage };
