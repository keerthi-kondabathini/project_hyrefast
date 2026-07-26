// tests/settings/settings.spec.js
const { test, expect } = require('../../utils/authFixture');
const { SettingsPage }  = require('../../pages/SettingsPage');
const { YopMailPage }   = require('../../pages/YopMailPage');
const { generateYopMailUser } = require('../../utils/helpers');
const testData = require('../../data/testData.json');
const path     = require('path');

// ─────────────────────────────────────────────────────────────────────────────
//  TC_SET_006 — Add team member, verify invite email, accept invite, verify
//               new member shows in owner's settings
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_SET_006 — Add Team Member & Verify Invite', () => {

  test('Add member → verify YopMail invite → accept invite → set password → verify in owner settings', async ({
    page, browser, loggedInPage, credentials
  }) => {
    const settingsData    = testData.settings;
    const { email, yopUsername } = generateYopMailUser();
    const workspaceName   = settingsData.workspaceName;
    const timeouts        = testData.timeouts;

    console.log(`New member email: ${email}`);

    const settings = new SettingsPage(page);

    // ── 1. Open Settings → Team Members ─────────────────
    await test.step('Open Settings → Team & Workspace Members', async () => {
      await settings.openSettings();
      await settings.goToTeamMembers();
    });

    // ── 2. Add member ─────────────────────────────────────
    await test.step(`Add member ${email} as ${settingsData.memberRole}`, async () => {
      await settings.addMember({
        email:    email,
        role:     settingsData.memberRole,
        teamName: settingsData.memberTeam,
      });
    });

    // ── 3. Open YopMail → verify invite email ─────────────
    let inviteContext, invitePage;
    await test.step(`Verify invite email in ${email}`, async () => {
      inviteContext = await browser.newContext();
      invitePage    = await inviteContext.newPage();
      const yopMail = new YopMailPage(invitePage);

      await yopMail.openInbox(yopUsername);

      let found = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Assert workspace name appears in invitation
          await expect(
            yopMail.mailFrame().getByText(`Invitation to join ${workspaceName}`)
          ).toBeVisible({ timeout: 15_000 });
          found = true;
          break;
        } catch {
          console.log(`Attempt ${attempt}: invite not yet delivered, retrying...`);
          await yopMail.refreshInbox();
          await invitePage.waitForTimeout(timeouts.emailDelivery);
        }
      }
      if (!found) throw new Error(`Invite email not found in ${email} after 3 attempts`);

      await expect(
        yopMail.mailFrame().getByRole('heading', { name: "You've been invited to a" })
      ).toBeVisible({ timeout: 10_000 });

      await expect(
        yopMail.mailFrame().getByRole('link', { name: 'Accept invite & set password' })
      ).toBeVisible();
    });

    // ── 4. Accept invite → set password ──────────────────
    let acceptPage;
    await test.step('Click Accept invite → set password → join workspace', async () => {
      const acceptPagePromise = inviteContext.waitForEvent('page');
      await invitePage
        .locator('iframe[name="ifmail"]').contentFrame()
        .getByRole('link', { name: 'Accept invite & set password' })
        .click();
      acceptPage = await acceptPagePromise;
      await acceptPage.waitForLoadState('networkidle');

      // Assert Join heading includes workspace name
      await expect(
        acceptPage.getByRole('heading', { name: `Join ${workspaceName}` })
      ).toBeVisible({ timeout: 15_000 });

      await acceptPage.getByRole('textbox', { name: 'Password', exact: true }).fill(settingsData.newMemberPassword);
      await acceptPage.getByRole('textbox', { name: 'Confirm Password' }).fill(settingsData.newMemberPassword);
      await acceptPage.getByRole('button', { name: 'Set Password & Join Workspace' }).click();
      await acceptPage.waitForLoadState('networkidle');
    });

    // ── 5. Verify new member's dashboard ─────────────────
    await test.step('Verify new member lands on dashboard', async () => {
      await expect(
        acceptPage.locator('div').filter({ hasText: /^Hyrefast$/ })
      ).toBeVisible({ timeout: 20_000 });

      await expect(
        acceptPage.getByRole('heading', { name: new RegExp(`Good .*, ${yopUsername}`, 'i') })
      ).toBeVisible({ timeout: 10_000 });
    });

    // ── 6. New member sees workspace in menu ──────────────
    await test.step('New member can see workspace name in user menu', async () => {
      const newMemberSettings = new SettingsPage(acceptPage);
      await newMemberSettings.assertWorkspaceInMenu(workspaceName);
    });

    // ── 7. Owner verifies member appears in members list ──
    await test.step('Owner searches for new member in Settings', async () => {
      // page is still logged in as owner
      await settings.searchMember(yopUsername);
      await settings.assertMemberRowVisible({ email, role: settingsData.memberRole });
    });

    await inviteContext.close();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_SET_007 — Create a team with existing members
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_SET_007 — Create Team', () => {

  test('Create team and verify it appears with correct members', async ({
    page, loggedInPage
  }) => {
    const settingsData = testData.settings;
    const settings     = new SettingsPage(page);
    const teamName     = `team_${Date.now()}`;

    await test.step('Open Settings → Team Members', async () => {
      await settings.openSettings();
      await settings.goToTeamMembers();
    });

    await test.step(`Create team "${teamName}" with configured members`, async () => {
      await settings.createTeam({
        teamName: teamName,
        members:  settingsData.teamMembers,
      });
    });

    await test.step('Verify team appears with correct member list', async () => {
      await settings.assertTeamCreated(teamName, settingsData.teamMembers);
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_SET_008 — Update Personal Profile
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_SET_008 — Update Personal Profile', () => {

  test('Edit full name, email, phone and verify save notification', async ({
    page, loggedInPage
  }) => {
    const settingsData  = testData.settings;
    const settings      = new SettingsPage(page);
    const profileUpdate = settingsData.profileUpdate;

    await test.step('Open Settings → Personal Profile', async () => {
      await settings.openSettings();
      await settings.goToPersonalProfile();
    });

    await test.step('Update profile fields and save', async () => {
      await settings.updateProfile({
        fullName: profileUpdate.fullName,
        email:    profileUpdate.email,
        phone:    profileUpdate.phone,
      });
    });

   
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_SET_009 — Add Company to Workspace
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_SET_009 — Add Company to Workspace', () => {

  test('Add company, verify in table, upload logo', async ({
    page, loggedInPage
  }) => {
    const settingsData = testData.settings;
    const settings     = new SettingsPage(page);
    const company      = settingsData.company;
    const logoPath     = company.logoFile;

    await test.step('Open Settings → Clients', async () => {
      await settings.openSettings();
      await settings.goToClients();
    });

    // Capture initial company count
    let initialCount = 0;
    await test.step('Capture initial company count', async () => {
      const countText = await page.getByText(/Companies\d+/).innerText().catch(() => '0');
      const match = countText.match(/\d+/);
      initialCount = match ? parseInt(match[0], 10) : 0;
      console.log(`Initial company count: ${initialCount}`);
    });

    await test.step('Add new company', async () => {
      await settings.addCompany({
        companyName:    company.name,
        legalName:      company.legalName,
        website:        company.website,
        locationQuery:  company.locationQuery,
        locationOption: company.locationOption,
        description:    company.description,
      });
    });

    await test.step('Search and verify company in table', async () => {
      await settings.searchCompany(company.name);
      await settings.assertCompanyRow({
        companyName: company.name,
        legalName:   company.legalName,
        website:     company.websiteDisplay,
        location:    company.locationDisplay,
        status:      'Ready',
      });
    });

    await test.step('Upload company logo', async () => {
      await settings.uploadCompanyLogo(company.name, logoPath);
    });

    await test.step('Verify company count increased by 1', async () => {
      await settings.companySearchInput.clear();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await expect(
        page.getByText(`Companies${initialCount + 1}`)
      ).toBeVisible({ timeout: 10_000 });
    });
  });

});