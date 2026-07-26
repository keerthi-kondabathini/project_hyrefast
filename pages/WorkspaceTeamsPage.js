// pages/WorkspaceTeamsPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * WorkspaceTeamsPage — all workspace settings interactions:
 *
 *  Navigation
 *    openWorkspaceSettings()
 *    goToTeamMembers()
 *    goToTeamsTab()
 *
 *  Member management
 *    inviteMember({ email, role })
 *    assertInviteSent()
 *    searchMember(query)
 *    assertMemberRow({ email, role })
 *    updateMemberRole(email, newRole)
 *    removeMember(email)
 *    assertMemberRemoved(query)
 *
 *  Team management
 *    createTeam(teamName)
 *    addMembersToTeam(teamName, members[])
 *    assertTeamSection(label, memberName)
 *
 *  JD Assignment
 *    openJDAssignMenu(jobIndex)
 *    assertJDAssignTabs(tabs[])
 *    assignJDToTeam(teamSearchQuery, teamOptionText)
 *    assignJDToIndividual(memberOptionText)
 *    assertPeopleWithAccess(names[])
 *
 *  Menu item visibility
 *    openUserMenu()
 *    assertMenuItemsVisible(items[])
 *    assertMenuItemsNotVisible(items[])
 */
class WorkspaceTeamsPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Navigation ────────────────────────────────────────
    // The user menu toggle is located in the top navigation bar and is rendered as a single-letter avatar button.
    this.userMenuBtn          = page.locator('nav').getByRole('button', { name: /^[A-Z]$/ }).first();
    this.userMenuPanel        = page.locator('div').filter({ hasText: /Log out/ }).first();
    this.workspaceSettingsLink = page.getByRole('menuitem', { name: 'Workspace Settings' });
    this.teamMembersSection   = page.getByRole('button', { name: 'Team & Workspace Members' });

    // ── Invite member form ────────────────────────────────
    this.addMemberBtn    = page.getByRole('button', { name: 'Add Member' });
    this.inviteHeading   = page.getByRole('heading', { name: 'Invite Member' });
    this.emailInput      = page.getByRole('textbox', { name: 'Email' });
    this.roleCombo       = page.getByRole('combobox', { name: 'Role' });
    this.teamsCombo      = page.getByRole('combobox', { name: 'Teams' });
    this.teamSearchInput = page.getByPlaceholder('Search teams...');
    this.confirmAddBtn   = page.getByRole('button', { name: 'Add Member' });
    this.inviteSentToast = page.getByText('Invite sent successfully!').last();

    // ── Members table ─────────────────────────────────────
    this.memberSearchInput = page.getByRole('textbox', { name: 'Search members' });
    this.memberRoleUpdated = page.getByText('Member role updated');
    this.memberRemovedToast = page.getByText('Member removed successfully!');

    // ── Teams tab ─────────────────────────────────────────
    this.teamsTab          = page.getByRole('tab', { name: 'Teams' });
    this.newTeamBtn        = page.getByRole('button', { name: 'New Team' });
    this.teamNameInput     = page.getByRole('textbox', { name: 'e.g. Engineering Hiring' });
    this.createTeamConfirm = page.getByRole('button', { name: 'Create' });
    this.addMembersBtn     = page.getByRole('button', { name: 'Add members' });
    this.memberSearchInTeam = page.getByRole('textbox', { name: 'Search workspace members' });

    // ── JD Assignment ─────────────────────────────────────
    this.assignJDMenuItem      = page.getByRole('menuitem', { name: 'Assign JD' });
    this.selectTeamsBtn        = page.getByRole('button', { name: 'Select teams' });
    this.teamSearchInAssign    = page.getByPlaceholder('Search teams...');
    this.grantTeamAccessBtn    = page.getByRole('button', { name: 'Grant team access' });
    this.accessGrantedToast    = page.getByText('Access granted to 1 team');
    this.selectMemberBtn       = page.getByRole('button', { name: 'Select team member...' });
    this.memberAddedToast      = page.getByText('Member added successfully');
    this.accessRestrictedBadge = page.locator('div').filter({
      hasText: /^Access RestrictedOnly workspace admins can manage job access settings\.$/
    }).nth(3);

    // ── Pending invites ───────────────────────────────────
    this.pendingInvitesSection = page.locator('div').filter({ hasText: /Pending Invites/i }).first();
  }

  // ═══════════════════════════════════════════════════════
  //  Navigation
  // ═══════════════════════════════════════════════════════

  async openWorkspaceSettings() {
    await this.userMenuBtn.click();
    await this.workspaceSettingsLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToTeamMembers() {
    await this.teamMembersSection.click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToTeamsTab() {
    await this.teamsTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  // ═══════════════════════════════════════════════════════
  //  Member Management
  // ═══════════════════════════════════════════════════════

  /**
   * Invite a member.
   * @param {{ email: string, role: string }} opts
   */
  async inviteMember({ email, role }) {
    await this.addMemberBtn.click();
    await expect(this.inviteHeading).toBeVisible({ timeout: 10_000 });

    await this.emailInput.fill(email);
    await this.roleCombo.click();
    await this.page.getByRole('option', { name: role }).click();

    await this.confirmAddBtn.click();
    await expect(this.inviteSentToast).toBeVisible({ timeout: 15_000 });
  }

  async searchMember(query) {
    await this.memberSearchInput.click();
    await this.memberSearchInput.fill(query);
    await this.page.waitForTimeout(1200);
  }

  /**
   * Assert a member row contains all the expected details.
   * HyreFast row format: "<Initial><name><email><email><team><date><role>"
   */
  async assertMemberRowVisible({ email, role }) {
    const memberRow = this.page.locator('div').filter({
      hasText: new RegExp(`${email}.*${role}`, 'i')
    }).first();
    await expect(memberRow).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Update a member's role via the combobox in their row.
   * @param {string} currentRole  - Current visible role text in the dropdown
   * @param {string} newRole
   */
  async updateMemberRole(currentRole, newRole) {
    await this.page.getByRole('combobox').filter({ hasText: currentRole }).click();
    await this.page.getByText(newRole).click();
    await expect(this.memberRoleUpdated).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Remove a member — clicks the overflow button in the member's row.
   */
  async removeMember() {
    // The 3-dot / trash button in the member row (positional — first overflow button)
    await this.page.getByRole('button').filter({ hasText: /^$/ }).nth(3).click();
    await expect(
      this.page.getByRole('heading', { name: 'Remove Member' })
    ).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('Are you sure you want to')).toBeVisible();
    await this.page.getByRole('button', { name: 'Remove Member' }).click();
    await expect(this.memberRemovedToast).toBeVisible({ timeout: 10_000 });
  }

  async assertMemberNotFound(query) {
    await this.searchMember(query);
    await expect(
      this.page.getByText('No Members YetAdd your first')
    ).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  Pending Invites
  // ═══════════════════════════════════════════════════════

  async assertPendingInviteVisible(email, role, teamName) {
    await expect(this.pendingInvitesSection).toBeVisible({ timeout: 10_000 });
    const emailPattern = new RegExp(`${email}`, 'i');
    const pendingRow = this.pendingInvitesSection.locator('div').filter({ hasText: emailPattern }).first();

    await expect(pendingRow).toBeVisible({ timeout: 10_000 });
    // Role is rendered as snake_case in the pending invite row (e.g. "team_member")
    const snakeRole = role.toLowerCase().replace(/\s+/g, '_');
    await expect(pendingRow.getByText(snakeRole, { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(pendingRow.getByText(`Team: ${teamName}`)).toBeVisible();
    await expect(pendingRow.getByText('Invite Pending')).toBeVisible();
  }

  // ═══════════════════════════════════════════════════════
  //  Team Management
  // ═══════════════════════════════════════════════════════

  async createTeam(teamName) {
    await this.goToTeamsTab();
    await this.newTeamBtn.click();
    await this.teamNameInput.fill(teamName);
    await this.createTeamConfirm.click();
    await expect(this.page.getByRole('status')).toBeVisible({ timeout: 10_000 });
    // Team row appears as "teamName0 members"
    await expect(
      this.page.locator('div').filter({ hasText: new RegExp(`^${teamName}0 members$`) }).first()
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Add members to an existing team via the "Add members" button.
   * @param {string} teamName  - Name of the team to add members to
   * @param {{ query: string, displayText: string }[]} members
   */
  async addMembersToTeam(teamName, members) {
    const teamHeading = this.page.getByRole('heading', { name: teamName });
    await expect(teamHeading).toBeVisible({ timeout: 10_000 });
    // Navigate from the team heading to the Add members button within the same card
    const addBtn = teamHeading.locator('xpath=ancestor::*[.//button[@title="Add members"]][1]//button[@title="Add members"]').first();
    for (const { query, displayText } of members) {
      await addBtn.click();
      await this.memberSearchInTeam.fill(query);
      await this.page.waitForTimeout(600);
      await this.page.getByText(displayText).click();
      await this.page.getByRole('button', { name: /Add \(\d+\)/ }).click();
    }
  }

  /**
   * Assert a team membership section.
   * @param {string} label  - e.g. "Leads", "Owners & Admins", "Members"
   * @param {string} memberName
   */
  async assertTeamMemberSection(label, memberName) {
    await expect(
      this.page.getByText(new RegExp(`${label}\\d+${memberName}`, 'i'))
    ).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  JD Assignment
  // ═══════════════════════════════════════════════════════

  /** Open the 3-dot overflow menu for a job by position */
  async openJobOverflowMenu(jobIndex = 0) {
    await this.page.getByRole('button').filter({ hasText: /^$/ }).nth(jobIndex).click();
    await this.page.waitForTimeout(300);
  }

  async clickAssignJD() {
    await this.assignJDMenuItem.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Assert that exactly these tabs are visible (no more, no less).
   * @param {string[]} expectedTabs
   */
  async assertJDAssignTabs(expectedTabs) {
    for (const tab of expectedTabs) {
      await expect(
        this.page.getByRole('tab', { name: tab })
      ).toBeVisible({ timeout: 10_000 });
    }
  }

  async assertAccessRestrictedBadge() {
    await expect(this.accessRestrictedBadge).toBeVisible({ timeout: 10_000 });
  }

  async assignJDToTeam(teamSearchQuery, teamOptionText) {
    await this.page.getByRole('tab', { name: 'Access Settings' }).click();
    await this.selectTeamsBtn.click();
    await this.teamSearchInAssign.fill(teamSearchQuery);
    await this.page.waitForTimeout(500);
    await this.page.getByRole('option', { name: new RegExp(teamOptionText, 'i') }).click();
    await this.grantTeamAccessBtn.click();
    await expect(this.accessGrantedToast).toBeVisible({ timeout: 10_000 });
  }

  async assignJDToIndividual(memberOptionText) {
    await this.page.getByRole('tab', { name: 'Access Settings' }).click();
    await this.selectMemberBtn.click();
    await this.page.getByRole('option', { name: memberOptionText }).click();
    // Click the "add individual" confirm button (small button next to member)
    await this.page.getByRole('button').filter({ hasText: /^$/ }).nth(5).click();
    await expect(this.memberAddedToast).toBeVisible({ timeout: 10_000 });
  }

  async assertPeopleWithAccess(names) {
    const pattern = new RegExp(`People with access${names.join('')}`, 'i');
    await expect(this.page.getByText(pattern)).toBeVisible({ timeout: 10_000 });
  }

  // ═══════════════════════════════════════════════════════
  //  User menu visibility checks
  // ═══════════════════════════════════════════════════════

  async openUserMenu() {
    await expect(this.userMenuBtn).toBeVisible({ timeout: 15_000 });
    await this.userMenuBtn.click();
    await expect(this.page.getByRole('menuitem', { name: /Personal profile/i })).toBeVisible({ timeout: 10_000 });
  }

  async assertMenuItemsVisible(items) {
    for (const item of items) {
      const menuItem = this.userMenuPanel
        .getByRole('menuitem')
        .filter({ hasText: new RegExp(item, 'i') })
        .first();
      const fallback = this.userMenuPanel
        .getByText(new RegExp(`^${item}$`, 'i'))
        .first();

      await expect(menuItem.or(fallback).first()).toBeVisible({ timeout: 10_000 });
    }
  }

  async assertMenuItemsNotVisible(items) {
    for (const item of items) {
      const menuItem = this.userMenuPanel
        .getByRole('menuitem')
        .filter({ hasText: new RegExp(item, 'i') })
        .first();
      const fallback = this.userMenuPanel
        .getByText(new RegExp(`^${item}$`, 'i'))
        .first();

      await expect(menuItem.or(fallback).first()).not.toBeVisible({ timeout: 5_000 });
    }
  }

  async closeMenu() {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }
}

module.exports = { WorkspaceTeamsPage };
