const { PlanPricingResourcePage } = require('./PlanPricingResourcePage');

class CreditEconomicsPage extends PlanPricingResourcePage {
  constructor(page) {
    super(page, {
      path: '/super-admin/plan-pricing/credit-economics',
      pageTitle: /credit economics/i,
      createAction: /set new rate/i,
      formTitle: /set credit value rate|edit exchange rate/i,
      deleteTitle: /delete rate card/i,
      deleteAction: /^delete$/i,
    });
  }
}

module.exports = { CreditEconomicsPage };
