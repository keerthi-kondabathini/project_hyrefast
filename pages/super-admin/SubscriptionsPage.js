const { PlanPricingResourcePage } = require('./PlanPricingResourcePage');

class SubscriptionsPage extends PlanPricingResourcePage {
  constructor(page) {
    super(page, {
      path: '/super-admin/plan-pricing/subscriptions',
      pageTitle: /workspace subscriptions/i,
      createAction: /assign plan/i,
      formTitle: /assign new subscription|manage subscription/i,
      deleteTitle: /delete subscription/i,
      deleteAction: /^delete$/i,
    });
  }

  async filterByStatus(status) {
    const filter = this.page.getByRole('combobox').first();
    await filter.click();
    const option = this.page.getByRole('option', { name: status, exact: true });
    if (await option.count()) return option.click();
    await this.page.getByText(status, { exact: true }).last().click();
  }
}

module.exports = { SubscriptionsPage };
