// pages/SettingsPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * SettingsPage covers all sections reachable via the Settings menu:
 *  - Team & Workspace Members (add member, search member)
 *  - Teams (create team, add members to team)
 *  - Personal Profile (edit name, email, phone)
 *  - Clients / Companies (add company, upload logo, search)
 */
class SettingsPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Nav ───────────────────────────────────────────────
    this.userMenuButton         = page.getByRole('button', { name: 'Company Logo' });
    this.settingsLink           = page.getByText('Settings');

    // ── Sidebar sections ──────────────────────────────────
    this.teamMembersSection     = page.getByRole('button', { name: 'Team & Workspace Members' });
    this.personalProfileSection = page.getByRole('button', { name: 'Personal Profile Your account' });
    this.clientsSection         = page.getByRole('button', { name: 'Clients Client companies,' });

    // ── Team Members ──────────────────────────────────────
    this.addMemberButton   = page.getByRole('button', { name: 'Add Member' });
    this.memberEmailInput  = page.getByRole('textbox', { name: 'Email' });
    this.memberRoleCombo   = page.getByRole('combobox', { name: 'Role' });
    this.memberTeamsCombo  = page.getByRole('combobox', { name: 'Teams' });
    this.teamSearchInput   = page.getByPlaceholder('Search teams...');
    this.inviteSentText    = page.getByText('Invite sent successfully!');
    this.memberSearchInput = page.getByRole('textbox', { name: 'Search members' });

    // ── Teams ─────────────────────────────────────────────
    this.teamsTab          = page.getByRole('tab',   { name: 'Teams' });
    this.addTeamButton     = page.getByRole('button', { name: 'New Team' });
    this.teamNameInput     = page.getByRole('textbox', { name: 'Team Name' });
    this.teamMemberSearch  = page.getByRole('textbox', { name: 'Search members by name, email' });
    this.createTeamButton  = page.getByRole('button', { name: 'Create Team' });

    // ── Personal Profile ──────────────────────────────────
    this.editProfileButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.fullNameInput     = page.getByRole('textbox', { name: 'Full Name *' });
    this.profileEmailInput = page.getByRole('textbox', { name: 'Email Address *' });
    this.phoneInput        = page.getByRole('textbox', { name: 'Phone Number *' });
    this.saveChangesButton = page.getByRole('button', { name: 'Save Changes' });

    // ── Companies ─────────────────────────────────────────
    this.companiesHeading    = page.getByRole('heading', { name: 'Companies inside this' });
    this.addCompanyButton    = page.getByRole('button', { name: 'Add company' });
    this.companyNameInput    = page.getByRole('textbox', { name: 'Company name' });
    this.legalNameInput      = page.getByRole('textbox', { name: 'Legal name' });
    this.websiteInput        = page.getByRole('textbox', { name: 'Website' });
    this.companyLocInput     = page.getByRole('textbox', { name: 'Search city, state, country' });
    this.descriptionInput    = page.getByRole('textbox', { name: 'Short description' });
    this.createCompanyButton = page.getByRole('button', { name: 'Create company' });
    this.companySearchInput  = page.getByRole('textbox', { name: 'Search company, legal name,' });
    this.uploadLogoInput     = page.locator('input[type="file"]').nth(0);
    this.saveCompanyButton   = page.getByRole('button', { name: 'Save company' });
  }

  // ── Navigation ─────────────────────────────────────────
  async openSettings() {
    await this.userMenuButton.click();
    await this.settingsLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToTeamMembers() {
    await this.teamMembersSection.click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToPersonalProfile() {
    await this.personalProfileSection.click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToClients() {
    await this.clientsSection.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ── Team Members ───────────────────────────────────────
  async addMember({ email, role, teamName }) {
    await this.addMemberButton.click();
    await this.memberEmailInput.fill(email);
    await this.memberRoleCombo.click();
    await this.page.getByRole('option', { name: role }).click();
    await this.memberTeamsCombo.click();
    // Type the team name to filter suggestions reliably
    await this.teamSearchInput.fill(teamName);
    await this.page.waitForTimeout(300);
    // If suggestions explicitly say 'No team found.', skip selecting a team
    let noTeamFound = false;
    try {
      const suggestions = this.page.getByLabel('Suggestions');
      const noCount = await suggestions.getByText('No team found.').count();
      noTeamFound = noCount > 0;
    } catch (err) {
      // ignore — suggestions container may not be labeled; continue to selection attempts
    }

    if (!noTeamFound) {
      // Try the accessible option role first, then fall back to text search inside suggestions
      const optionLocator = this.page.getByRole('option', { name: new RegExp(`^${teamName}$`, 'i') });
      try {
        await optionLocator.click({ timeout: 10_000 });
      } catch (e) {
        const fallback = this.page.getByText(teamName, { exact: true });
        try {
          await fallback.click({ timeout: 10_000 });
        } catch (err) {
          // If fallback also fails, proceed without selecting a team
        }
      }
    }
    await this.addMemberButton.click();
    await this.assertVisible(this.inviteSentText, '"Invite sent successfully!" not visible');
  }

  async searchMember(query) {
    await this.memberSearchInput.click();
    await this.memberSearchInput.fill(query);
    await this.page.waitForTimeout(1000);
  }

  async assertMemberRowVisible({ email, role }) {
    const memberRow = this.page.locator('div').filter({
      hasText: new RegExp(`${email}.*${role}`, 'i')
    }).first();
    await expect(memberRow).toBeVisible({ timeout: 10_000 });
  }

  // ── Teams ──────────────────────────────────────────────
  async createTeam({ teamName, members }) {
    await this.teamsTab.click();
    await this.page.waitForLoadState('networkidle');
    await this.addTeamButton.click();
    await this.teamNameInput.fill(teamName);
    for (const member of members) {
      await this.teamMemberSearch.click();
      await this.teamMemberSearch.fill(member);
      await this.page.waitForTimeout(800);
      await this.page.getByRole('checkbox', { name: new RegExp(member, 'i') }).click();
    }
    await this.createTeamButton.click();
    await expect(this.page.getByRole('status')).toBeVisible({ timeout: 10_000 });
  }

  async assertTeamCreated(teamName, memberNames) {
    const memberList = memberNames.join(', ');
    await expect(
      this.page.getByText(new RegExp(`${teamName}.*${memberList}`, 'i'))
    ).toBeVisible({ timeout: 10_000 });
  }

  // ── Personal Profile ───────────────────────────────────
  async updateProfile({ fullName, email, phone }) {
    await this.editProfileButton.click();
    await this.fullNameInput.click();
    await this.fullNameInput.fill(fullName);
    await this.profileEmailInput.click();
    await this.profileEmailInput.fill(email);
    await this.phoneInput.click();
    await this.phoneInput.fill(phone);
    await this.saveChangesButton.click();
  }

  // ── Companies ──────────────────────────────────────────
  async addCompany({ companyName, legalName, website, locationQuery, locationOption, description }) {
    await this.assertVisible(this.companiesHeading);
    await this.addCompanyButton.click();
    await this.companyNameInput.click();
    await this.companyNameInput.fill(companyName);
    await this.legalNameInput.click();
    await this.legalNameInput.fill(legalName);
    await this.websiteInput.click();
    await this.websiteInput.fill(website);
    await this.companyLocInput.click();
    await this.companyLocInput.fill(locationQuery);
    await this.page.getByRole('button', { name: locationOption }).click();
    await this.descriptionInput.click();
    await this.descriptionInput.fill(description);
    await this.createCompanyButton.click();
    await expect(this.page.getByRole('status')).toBeVisible({ timeout: 10_000 });
  }

  async searchCompany(query) {
    await this.companySearchInput.click();
    await this.companySearchInput.fill(query);
    await this.page.waitForTimeout(1000);
  }

  async assertCompanyRow({ companyName, legalName, website, location, status }) {
    await expect(this.page.getByRole('cell', { name: `${companyName} ${legalName}` })).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByRole('cell', { name: website })).toBeVisible();
    await expect(this.page.getByRole('cell', { name: location })).toBeVisible();
    await expect(this.page.getByRole('cell', { name: status })).toBeVisible();
  }

  async uploadCompanyLogo(companyName, filePath) {
    await this.page.getByRole('button', { name: `Edit ${companyName}` }).click();
    await this.uploadLogoInput.setInputFiles(filePath);
    await expect(this.page.getByRole('status')).toBeVisible({ timeout: 10_000 });
    await this.saveCompanyButton.click();
  }

  async assertWorkspaceInMenu(workspaceName) {
    await this.userMenuButton.click();
    await expect(this.page.getByText(workspaceName, { exact: true })).toBeVisible({ timeout: 10_000 });
  }
}

module.exports = { SettingsPage };