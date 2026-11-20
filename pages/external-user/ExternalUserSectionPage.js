const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');

/** Shared navigation for the third-party user's external workspace. */
class ExternalUserSectionPage extends BasePage {
  constructor(page) {
    super(page);
    this.sections = {
      profile: {
        button: page.getByRole('button', { name: 'Profile Personal info and security' }),
        path: '/external/profile',
      },
      credits: {
        button: page.getByRole('button', { name: 'Credits Usage and balance' }),
        path: '/external/credits',
      },
      apiKeys: {
        button: page.getByRole('button', { name: 'API Keys Manage developer credentials' }),
        path: '/external/api-keys',
      },
      brand: {
        button: page.getByRole('button', { name: 'Brand & Appearance Customize logo, colors & embeds' }),
        path: '/external/theme',
      },
    };
  }

  async openSection(name) {
    const section = this.sections[name];
    if (!section) throw new Error(`Unknown external user section: ${name}`);
    if (new URL(this.page.url()).pathname !== section.path) await section.button.click();
    await expect(this.page).toHaveURL(new RegExp(`${section.path.replaceAll('/', '\\/')}\\/?$`));
  }
}

module.exports = { ExternalUserSectionPage };
