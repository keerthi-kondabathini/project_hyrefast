const { PlanPricingResourcePage } = require('./PlanPricingResourcePage');

class ServiceContractsPage extends PlanPricingResourcePage {
  constructor(page) {
    super(page, {
      path: '/super-admin/plan-pricing/service-contracts',
      pageTitle: /service contracts \(pricing\)/i,
      createAction: /set pricing/i,
      formTitle: /create pricing contract|edit service contract/i,
      deleteTitle: /delete pricing contract/i,
      deleteAction: /^delete$/i,
    });
  }
}

module.exports = { ServiceContractsPage };
