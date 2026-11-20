const { PlanPricingResourcePage } = require('./PlanPricingResourcePage');

class EntitlementsPage extends PlanPricingResourcePage {
  constructor(page) {
    super(page, {
      path: '/super-admin/plan-pricing/entitlements',
      pageTitle: /feature entitlements/i,
      createAction: /add entitlement/i,
      formTitle: /configure entitlement|edit entitlement/i,
      deleteTitle: /delete entitlement/i,
      deleteAction: /^delete$/i,
    });
  }
}

module.exports = { EntitlementsPage };
