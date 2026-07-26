// pages/TeamMembersPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * TeamMembersPage covers:
 *  - Adding a workspace member (email + role + team)
 *  - Searching for members
 *  - Creating a team with selected members
 */
class TeamMembersPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Add Member ────────────────────────────────────────
    this.addMemberBtn      = page.getByRole('button', { name: 'Add Member' });
    this.memberEmailInput  = page.getByRole('textbox', { name: 'Email' });
    this.roleCombo         = page.getByRole('combobox', { name: 'Role' });
    this.teamsCombo        = page.getByRole('combobox', { name: 'Teams' });
    this.teamSearchInput   = page.getByPlaceholder('Search teams...');
    this.inviteSentText    = page.getByText('Invite sent successfully!');

    // ── Search members ────────────────────────────────────
    this.memberSearchInput = page.getByRole('textbox', { name: 'Search members' });

    // ── Add Team ──────────────────────────────────────────
    this.addTeamBtn           = page.getByRole('button', { name: 'Add Team' });
    this.teamNameInput        = page.getByRole('textbox', { name: 'Team Name' });
    this.memberSearchForTeam  = page.getByRole('textbox', { name: 'Search members by name, email' });
    this.createTeamBtn        = page.getByRole('button', { name: 'Create Team' });
  }

  // ═══════════════════════════════════════════════════════
  //  Add Member
  // ═══════════════════════════════════════════════════════

  /**
   * @param {string} email
   * @param {'Admin'|'Team Lead'|'Member'} role
   * @param {string} teamName - team to assign, searched via typeahead
   */
  async addMember(email, role, teamName) {
    await this.addMemberBtn.click();
    await this.memberEmailInput.fill(email);

    await this.roleCombo.click();
    await this.page.getByRole('option', { name: role }).click();

    await this.teamsCombo.click();
    await this.teamSearchInput.fill(teamName);
    await this.page.getByLabel('Suggestions').getByText(teamName).click();

    await this.addMemberBtn.click(); // Confirm button inside the modal
    await this.assertVisible(this.inviteSentText, 'Expected "Invite sent successfully!" toast');
  }

  // ═══════════════════════════════════════════════════════
  //  Search & Assert Member
  // ═══════════════════════════════════════════════════════

  async searchMember(query) {
    await this.memberSearchInput.click();
    await this.memberSearchInput.fill(query);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Asserts a member row is visible in search results.
   * The text pattern matches HyreFast's member row format:
   * e.g. "Ppranavpranav@yopmail.comnissanTeam Lead"
   */
  async assertMemberVisible(rowText) {
    await expect(this.page.getByText(rowText)).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Create Team
  // ═══════════════════════════════════════════════════════

  /**
   * @param {string} teamName
   * @param {string[]} memberNames - display names to search & check
   */
  async createTeam(teamName, memberNames) {
    await this.addTeamBtn.click();
    await this.teamNameInput.fill(teamName);

    for (const memberName of memberNames) {
      await this.memberSearchForTeam.click();
      await this.memberSearchForTeam.fill(memberName);
      await this.page.waitForTimeout(500);
      // Check the checkbox next to the matching member
      await this.page.getByRole('checkbox', { name: new RegExp(memberName, 'i') }).click();
    }

    await this.createTeamBtn.click();
    await expect(this.page.getByRole('status')).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Asserts the created team summary row is visible.
   * e.g. "dummy team2 memberspranav, pravallikaEdit"
   */
  async assertTeamVisible(teamName, memberCount, memberNames) {
    const rowText = `${teamName}${memberCount} members${memberNames.join(', ')}Edit`;
    await expect(this.page.getByText(rowText)).toBeVisible({ timeout: 10_000 });
  }
}

module.exports = { TeamMembersPage };