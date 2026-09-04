// tests/settings/Settings-TeamManagement.spec.js
// ---------------------------------------------------------------------------
// TC_SET_012 — Add members to an existing team
// TC_SET_013 — Delete a team
// ---------------------------------------------------------------------------

const { test, expect }       = require('../../utils/authFixture');
const { SettingsPage }       = require('../../pages/SettingsPage');
const { WorkspaceTeamsPage } = require('../../pages/WorkspaceTeamsPage');
const { generateYopMailUser } = require('../../utils/helpers');
const testData               = require('../../data/testData.json');

// ══════════════════════════════════════════════════════════════════════════
//  TC_SET_012 — Add members to an existing team
// ══════════════════════════════════════════════════════════════════════════
test.describe('TC_SET_012 — Add members to an existing team', () => {

  test('Create team → invite a couple members → add them to the team → verify sections', async ({
    page, browser, loggedInPage,
  }) => {
    const settingsData = testData.settings;
    const settings     = new SettingsPage(page);
    const wsPage       = new WorkspaceTeamsPage(page);
    const timeouts     = testData.timeouts;

    const teamName = `AutoTeam_${Date.now()}`;

    // Create 2 fresh users to add to the team
    const [user1, user2] = await Promise.all([
      generateYopMailUser('teamadd1'),
      generateYopMailUser('teamadd2'),
    ]);

    await test.step('Open Workspace Settings → Team Members', async () => {
      await settings.openSettings();
      await settings.goToTeamMembers();
    });

    await test.step(`Create team "${teamName}"`, async () => {
      await wsPage.createTeam(teamName);
    });

    // Invite both users so they exist in workspace
    await test.step('Invite two members to workspace', async () => {
      await wsPage.inviteMember({ email: user1.email, role: settingsData.memberRole });
      await wsPage.inviteMember({ email: user2.email, role: settingsData.memberRole });
    });

    await test.step('Search and verify both members exist in workspace', async () => {
      await wsPage.searchMember(user1.yopUsername);
      await wsPage.assertMemberRowVisible({ email: user1.email, role: settingsData.memberRole });
      await wsPage.searchMember(user2.yopUsername);
      await wsPage.assertMemberRowVisible({ email: user2.email, role: settingsData.memberRole });
    });

    await test.step(`Add both members to team "${teamName}"`, async () => {
      await wsPage.addMembersToTeam(teamName, [
        { query: user1.yopUsername, displayText: `${user1.yopUsername} ${settingsData.memberRole}` },
        { query: user2.yopUsername, displayText: `${user2.yopUsername} ${settingsData.memberRole}` },
      ]);
    });

    await test.step('Verify members appear in team\'s Members section', async () => {
      await wsPage.assertTeamMemberSection('Members', user1.yopUsername);
      await wsPage.assertTeamMemberSection('Members', user2.yopUsername);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  TC_SET_013 — Delete a team
// ══════════════════════════════════════════════════════════════════════════
test.describe('TC_SET_013 — Delete a team', () => {

  test('Create team → add a member → delete team → verify removed', async ({
    page, browser, loggedInPage,
  }) => {
    const settingsData = testData.settings;
    const settings     = new SettingsPage(page);
    const wsPage       = new WorkspaceTeamsPage(page);

    const teamName = `AutoDeleteTeam_${Date.now()}`;

    await test.step('Open Workspace Settings → Team Members', async () => {
      await settings.openSettings();
      await settings.goToTeamMembers();
    });

    await test.step(`Create team "${teamName}"`, async () => {
      await wsPage.createTeam(teamName);
    });

    // Verify team exists
    await test.step('Verify team appears in Teams tab', async () => {
      await wsPage.goToTeamsTab();
      await expect(
        wsPage.page.locator('div').filter({ hasText: new RegExp(`^${teamName}0 members$`) }).first()
      ).toBeVisible({ timeout: 10_000 });
    });

    const beforeCount = await wsPage.page.locator('div').filter({ hasText: /members$/ }).count();
    console.log(`Team count before delete: ${beforeCount}`);

    await test.step(`Delete team "${teamName}"`, async () => {
      await wsPage.deleteTeam(teamName);
    });

    await test.step('Verify team no longer appears', async () => {
      await expect(
        wsPage.page.locator('div').filter({ hasText: new RegExp(`^${teamName}`) }).first()
      ).not.toBeVisible({ timeout: 10_000 });
    });

    await test.step('Verify team count decreased', async () => {
      const afterCount = await wsPage.page.locator('div').filter({ hasText: /members$/ }).count();
      expect(afterCount).toBe(beforeCount - 1,
        `Expected count ${beforeCount - 1} after delete but got ${afterCount}`);
    });
  });
});
