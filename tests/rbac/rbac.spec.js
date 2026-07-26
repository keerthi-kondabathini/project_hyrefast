
// tests/rbac/rbac.spec.js
/**
 * Role-Based Access Control (RBAC) Tests
 *
 * Each test suite uses the `workspace` fixture from rbacFixture.js which:
 *  1. Signs up a fresh organisation as Owner
 *  2. Creates a team
 *  3. Invites Admin, Team Lead, Team Member
 *  4. Accepts all invites
 *  5. Opens authenticated sessions for all 4 actors
 *
 * Test Map
 * ────────
 *  TC_RBAC_001  Invite Admin, Team Lead, Member → verify invite emails
 *  TC_RBAC_002  Invite member with pre-assigned team → pending invite visible
 *  TC_RBAC_003  Create team, add Owner/Admin/Lead/Member → assert section labels
 *  TC_RBAC_004  User menu items — per role (Owner/Admin sees Billing, Lead doesn't, Member restricted)
 *  TC_RBAC_005  JD creation — Owner publishes
 *  TC_RBAC_006  JD creation — Admin publishes
 *  TC_RBAC_007  JD creation — Team Lead publishes
 *  TC_RBAC_008  JD creation — Member sees "Request to Publish" (not Publish Now)
 *  TC_RBAC_009  JD assignment tabs — Owner/Admin see Advanced Proctoring; Lead doesn't; Member sees restricted badge
 *  TC_RBAC_010  JD assignment — assign to team
 *  TC_RBAC_011  JD assignment — assign to individual member
 *  TC_RBAC_012  Candidate visibility — member sees only own candidates; lead/admin sees all in team
 *  TC_RBAC_013  Update member role → role responsibilities change
 *  TC_RBAC_014  Remove member → member no longer found in search
 */

const { test, expect, yopUser, loginAs, acceptInvite } = require('../../utils/rbacFixture');
const { WorkspaceTeamsPage } = require('../../pages/WorkspaceTeamsPage');
const { RBACJobPage }        = require('../../pages/RBACJobPage');
const { YopMailPage }        = require('../../pages/YopMailPage');
const { faker }  = require('@faker-js/faker');
const rbac       = require('../../data/rbacTestData.json');

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_001 — Invite each role and verify invite email delivery
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_001 — Invite roles and verify invite emails', () => {

  test('Owner invites Admin, Team Lead, Member — each receives invite email', async ({
    workspace, browser
  }) => {
    const { owner, teamName } = workspace;
    const wsPage = new WorkspaceTeamsPage(owner.page);

    const invitees = [
      { user: yopUser('inv_admin'), role: 'Admin' },
      { user: yopUser('inv_lead'),  role: 'Team Lead' },
      { user: yopUser('inv_mem'),   role: 'Team Member' },
    ];

    for (const { user, role } of invitees) {
      await test.step(`Invite ${role}: ${user.email}`, async () => {
        await wsPage.openWorkspaceSettings();
        await wsPage.goToTeamMembers();
        await wsPage.inviteMember({ email: user.email, role });
      });

      await test.step(`Verify invite email in ${user.email}`, async () => {
        const yopCtx  = await browser.newContext();
        const yopPage = await yopCtx.newPage();
        const yop     = new YopMailPage(yopPage);
        await yop.openInbox(user.yopUsername);

        let found = false;
        for (let i = 1; i <= 4; i++) {
          const f1 = await yop.mailFrame().getByText(`Invitation to join ${workspace.workspaceName}`).isVisible().catch(() => false);
          const f2 = await yop.mailFrame().getByRole('heading', { name: "You've been invited to a" }).isVisible().catch(() => false);
          if (f1 || f2) { found = true; break; }
          await yop.refreshInbox();
          await yopPage.waitForTimeout(10_000);
        }

        expect(found, `Invite email not received by ${user.email}`).toBe(true);

        await expect(
          yop.mailFrame().getByText('This link expires in 7 days and is single-use.')
        ).toBeVisible({ timeout: 10_000 });
        await expect(
          yop.mailFrame().getByRole('link', { name: 'Accept invite & set password' })
        ).toBeVisible();

        await yopCtx.close();
      });
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_002 — Invite member with team pre-assigned → pending invite row
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_002 — Invite with pre-assigned team shows pending invite', () => {

  test('Pending invite row visible with correct email, role, and team', async ({
    workspace
  }) => {
    const { owner } = workspace;
    const wsPage = new WorkspaceTeamsPage(owner.page);
    const newUser = yopUser('pending');

    await test.step('Invite member', async () => {
      await wsPage.openWorkspaceSettings();
      await wsPage.goToTeamMembers();
      await wsPage.inviteMember({ email: newUser.email, role: 'Team Member' });
    });

    await test.step('Verify pending invite section is visible', async () => {
      await wsPage.assertPendingInviteVisible(newUser.email, 'Team Member');
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_003 — Create team and add all role types
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_003 — Create team, add members of each role type', () => {

  test('New team shows correct member sections: Leads, Owners & Admins, Members', async ({
    workspace
  }) => {
    const { owner, admin, teamLead, member } = workspace;
    const wsPage   = new WorkspaceTeamsPage(owner.page);
    const newTeam  = `rbac_team_${faker.string.alphanumeric(5).toLowerCase()}`;

    await test.step('Create a new team', async () => {
      await wsPage.openWorkspaceSettings();
      await wsPage.goToTeamMembers();
      await wsPage.createTeam(newTeam);
    });

    await test.step('Add Team Lead to team', async () => {
      await wsPage.addMembersToTeam(newTeam, [{
        query:       teamLead.yopUsername,
        displayText: `${teamLead.yopUsername}team lead`,
      }]);
      await wsPage.assertTeamMemberSection('Leads', teamLead.yopUsername);
    });

    await test.step('Add Admin to team', async () => {
      await wsPage.addMembersToTeam(newTeam, [{
        query:       admin.yopUsername,
        displayText: `${admin.yopUsername}admin`,
      }]);
      // Admin shows in "Owners & Admins" section
      await wsPage.assertTeamMemberSection('Owners & Admins', admin.yopUsername);
    });

    await test.step('Add Member to team', async () => {
      await wsPage.addMembersToTeam(newTeam, [{
        query:       member.yopUsername,
        displayText: `${member.yopUsername}team member`,
      }]);
      await wsPage.assertTeamMemberSection('Members', member.yopUsername);
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_004 — User menu items per role
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_004 — User menu items per role', () => {

  for (const [roleName, roleConfig] of Object.entries(rbac.roles)) {
    test(`${roleConfig.label} sees correct menu items`, { 
      testId: `TC_RBAC_004_${roleName}` 
    }, async ({ workspace }) => {
      const actor  = workspace[roleName];
      if (!actor) { test.skip(true, `${roleName} not available in workspace fixture`); return; }

      const wsPage = new WorkspaceTeamsPage(actor.page);

      await test.step(`Open user menu as ${roleConfig.label}`, async () => {
        await wsPage.openUserMenu();
      });

      await test.step('Assert required menu items are visible', async () => {
        await wsPage.assertMenuItemsVisible(roleConfig.menuItems);
      });

      if (roleConfig.noMenuItems.length > 0) {
        await test.step('Assert restricted menu items are NOT visible', async () => {
          await wsPage.assertMenuItemsNotVisible(roleConfig.noMenuItems);
        });
      }

      await wsPage.closeMenu();
    });
  }

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_005 — Owner creates and publishes a JD
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_005 — Owner publishes JD', () => {

  test('Owner can create JD and publish it directly (no approval needed)', async ({
    workspace
  }) => {
    const { owner, workspaceName } = workspace;
    const jobPage = new RBACJobPage(owner.page);
    const jobTitle = `Owner JD ${faker.string.alphanumeric(4).toUpperCase()}`;

    await owner.page.goto('/dashboard');

    await test.step('Create JD through to publish step', async () => {
      await jobPage.createJDToPublishStep(jobTitle, workspaceName);
    });

    await test.step('Assert "Request to Publish" button is NOT visible (owner can publish directly)', async () => {
      await expect(jobPage.requestToPublishBtn).not.toBeVisible({ timeout: 3000 });
    });

    await test.step('Publish JD', async () => {
      await jobPage.publishJD();
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_006 — Admin creates and publishes a JD
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_006 — Admin publishes JD', () => {

  test('Admin can create JD and publish it directly', async ({ workspace }) => {
    const { admin, workspaceName } = workspace;
    const jobPage  = new RBACJobPage(admin.page);
    const jobTitle = `Admin JD ${faker.string.alphanumeric(4).toUpperCase()}`;

    await admin.page.goto('/dashboard');

    await test.step('Create JD to publish step as Admin', async () => {
      await jobPage.createJDToPublishStep(jobTitle, workspaceName);
    });

    await test.step('Admin should NOT see Request to Publish', async () => {
      await expect(jobPage.requestToPublishBtn).not.toBeVisible({ timeout: 3000 });
    });

    await test.step('Publish JD as Admin', async () => {
      await jobPage.publishJD();
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_007 — Team Lead creates and publishes a JD
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_007 — Team Lead publishes JD', () => {

  test('Team Lead can create JD and publish without approval', async ({ workspace }) => {
    const { teamLead, workspaceName } = workspace;
    const jobPage  = new RBACJobPage(teamLead.page);
    const jobTitle = `Lead JD ${faker.string.alphanumeric(4).toUpperCase()}`;

    await teamLead.page.goto('/dashboard');

    await test.step('Create JD to publish step as Team Lead', async () => {
      await jobPage.createJDToPublishStep(jobTitle, workspaceName);
    });

    await test.step('Team Lead should NOT see Request to Publish', async () => {
      await expect(jobPage.requestToPublishBtn).not.toBeVisible({ timeout: 3000 });
    });

    await test.step('Publish JD as Team Lead', async () => {
      await jobPage.publishJD();
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_008 — Team Member sees "Request to Publish" instead of Publish Now
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_008 — Member must Request to Publish', () => {

  test('Member sees Request to Publish, selects approver, submits request', async ({
    workspace
  }) => {
    const { member, owner, workspaceName } = workspace;
    const jobPage  = new RBACJobPage(member.page);
    const jobTitle = `Member JD ${faker.string.alphanumeric(4).toUpperCase()}`;

    await member.page.goto('/dashboard');

    await test.step('Member creates JD through to publish step', async () => {
      await jobPage.createJDToPublishStep(jobTitle, workspaceName);
    });

    await test.step('Assert "Request to Publish" button IS visible (member cannot publish directly)', async () => {
      await expect(jobPage.requestToPublishBtn).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Member requests to publish — selects owner as approver', async () => {
      // The approver dropdown shows Owner/Admin names from the workspace
      const approverText = owner.yopUsername;
      await jobPage.requestToPublish(approverText, 'Please review and approve');
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_009 — JD Assignment tabs differ by role
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_009 — JD Assignment tabs per role', () => {

  test('Owner/Admin see Advanced Proctoring tab; Team Lead does not; Member sees restricted badge', async ({
    workspace
  }) => {
    const { owner, teamLead, member } = workspace;
    const jobTitle = rbac.jobTitle;

    // ── Owner: all 4 tabs ─────────────────────────────────
    await test.step('Owner sees all JD assignment tabs including Advanced Proctoring', async () => {
      const wsPage = new WorkspaceTeamsPage(owner.page);
      await owner.page.goto('/dashboard');
      await owner.page.getByRole('textbox', { name: 'Search by job name or ID' }).fill(jobTitle);
      await owner.page.waitForTimeout(1500);
      await wsPage.openJobOverflowMenu(4);
      await wsPage.clickAssignJD();
      await wsPage.assertJDAssignTabs(rbac.jdAssignTabs.ownerAdmin);
    });

    // ── Team Lead: 3 tabs (no Advanced Proctoring) ────────
    await test.step('Team Lead sees Overview, Interview Links, Access Settings (no Advanced Proctoring)', async () => {
      const wsPage = new WorkspaceTeamsPage(teamLead.page);
      await teamLead.page.goto('/dashboard');
      await teamLead.page.getByRole('textbox', { name: 'Search by job name or ID' }).fill(jobTitle);
      await teamLead.page.waitForTimeout(1500);
      await wsPage.openJobOverflowMenu(3);
      await wsPage.clickAssignJD();
      await wsPage.assertJDAssignTabs(rbac.jdAssignTabs.teamLead);
      await expect(
        teamLead.page.getByRole('tab', { name: 'Advanced Proctoring' })
      ).not.toBeVisible({ timeout: 5000 });
    });

    // ── Member: restricted badge + only Overview + Interview Links ──
    await test.step('Member sees Access Restricted badge and limited tabs', async () => {
      const wsPage = new WorkspaceTeamsPage(member.page);
      await member.page.goto('/dashboard');
      await member.page.getByRole('textbox', { name: 'Search by job name or ID' }).fill(jobTitle);
      await member.page.waitForTimeout(1500);
      await wsPage.openJobOverflowMenu(2);
      await wsPage.clickAssignJD();
      await wsPage.assertJDAssignTabs(rbac.jdAssignTabs.member);
      await wsPage.assertAccessRestrictedBadge();
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_010 — JD assigned to a team
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_010 — Assign JD to a team', () => {

  test('Owner assigns JD to a team and gets access granted confirmation', async ({
    workspace
  }) => {
    const { owner } = workspace;
    const wsPage    = new WorkspaceTeamsPage(owner.page);

    await test.step('Open Assign JD for the first published job', async () => {
      await owner.page.goto('/dashboard');
      await owner.page.getByRole('textbox', { name: 'Search by job name or ID' }).fill(rbac.jobTitle);
      await owner.page.waitForTimeout(1500);
      await wsPage.openJobOverflowMenu(4);
      await wsPage.clickAssignJD();
    });

    await test.step('Assign to team', async () => {
      await wsPage.assignJDToTeam(workspace.teamName.slice(0, 5), workspace.teamName);
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_011 — JD assigned to an individual member
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_011 — Assign JD to individual member', () => {

  test('Owner assigns JD to a specific team member individually', async ({
    workspace
  }) => {
    const { owner, member } = workspace;
    const wsPage = new WorkspaceTeamsPage(owner.page);

    await test.step('Open Assign JD', async () => {
      await owner.page.goto('/dashboard');
      await owner.page.getByRole('textbox', { name: 'Search by job name or ID' }).fill(rbac.jobTitle);
      await owner.page.waitForTimeout(1500);
      await wsPage.openJobOverflowMenu(4);
      await wsPage.clickAssignJD();
    });

    await test.step('Assign to individual member', async () => {
      // memberOptionText matches the visible option: "username email@yopmail.com"
      const memberOption = `${member.yopUsername} ${member.email}`;
      await wsPage.assignJDToIndividual(memberOption);
    });

    await test.step('Verify "People with access" shows the member', async () => {
      await wsPage.assertPeopleWithAccess([member.yopUsername]);
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_012 — Candidate visibility per role
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_012 — Candidate visibility by role', () => {

  test('Member sees only own candidates; Team Lead and Admin see all team candidates', async ({
    workspace, browser
  }) => {
    const { member, teamLead, admin } = workspace;
    const memberJobPage   = new RBACJobPage(member.page);
    const teamLeadJobPage = new RBACJobPage(teamLead.page);
    const adminJobPage    = new RBACJobPage(admin.page);

    const memberCandidate    = yopUser('cand_m');
    const teamLeadCandidate  = yopUser('cand_l');

    // ── Member adds a candidate ──────────────────────────
    await test.step('Member adds a candidate to the JD', async () => {
      await memberJobPage.openCandidatesForJob(rbac.jobTitle);
      await memberJobPage.addCandidateByEmail(memberCandidate.email);
    });

    // ── Team Lead adds a different candidate ─────────────
    await test.step('Team Lead adds a different candidate to the same JD', async () => {
      await teamLeadJobPage.openCandidatesForJob(rbac.jobTitle);
      await teamLeadJobPage.addCandidateByEmail(teamLeadCandidate.email);
    });

    // ── Member can see own candidate ──────────────────────
    await test.step('Member can see their own candidate', async () => {
      await memberJobPage.openCandidatesForJob(rbac.jobTitle);
      await memberJobPage.assertCandidateVisible(memberCandidate.email);
    });

    // ── Member CANNOT see Team Lead's candidate ───────────
    await test.step("Member cannot see Team Lead's candidate", async () => {
      await memberJobPage.assertCandidateNotVisible(teamLeadCandidate.email);
    });

    // ── Team Lead sees ALL candidates in the team ─────────
    await test.step('Team Lead sees both candidates (all team candidates)', async () => {
      await teamLeadJobPage.openCandidatesForJob(rbac.jobTitle);
      await teamLeadJobPage.assertCandidateVisible(memberCandidate.email);
      await teamLeadJobPage.assertCandidateVisible(teamLeadCandidate.email);
    });

    // ── Admin sees all candidates ─────────────────────────
    await test.step('Admin sees all candidates', async () => {
      await adminJobPage.openCandidatesForJob(rbac.jobTitle);
      await adminJobPage.assertCandidateVisible(memberCandidate.email);
      await adminJobPage.assertCandidateVisible(teamLeadCandidate.email);
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_013 — Update member role → verify changed responsibilities
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_013 — Update member role and verify access changes', () => {

  test('Promote Team Member to Team Lead → new role menu items appear', async ({
    workspace, browser
  }) => {
    const { owner, member } = workspace;
    const wsPage = new WorkspaceTeamsPage(owner.page);

    await test.step('Search for member in workspace settings', async () => {
      await wsPage.openWorkspaceSettings();
      await wsPage.goToTeamMembers();
      await wsPage.searchMember(member.yopUsername);
      await wsPage.assertMemberRowVisible({ email: member.email, role: 'Team Member' });
    });

    await test.step('Update role from Team Member to Team Lead', async () => {
      await wsPage.updateMemberRole('Team Member', 'Team Lead');
    });

    await test.step('Verify member now sees Workspace Settings in their menu', async () => {
      // Re-login as the promoted member to get fresh session with new role
      const promotedSession = await loginAs(browser, workspace.owner.page.url().split('/dashboard')[0] || 'https://test.hyrefast.ai', member);
      const memberWsPage    = new WorkspaceTeamsPage(promotedSession.page);

      await memberWsPage.openUserMenu();
      await memberWsPage.assertMenuItemsVisible(
        rbac.roles.teamLead.menuItems   // now sees Team Lead items
      );
      await memberWsPage.assertMenuItemsNotVisible(
        rbac.roles.teamLead.noMenuItems // still no Billing
      );
      await memberWsPage.closeMenu();
      await promotedSession.context.close();
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RBAC_014 — Remove member from workspace
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RBAC_014 — Remove member from workspace', () => {

  test('Remove member → member no longer appears in search', async ({
    workspace
  }) => {
    const { owner } = workspace;
    const wsPage    = new WorkspaceTeamsPage(owner.page);

    // Create a fresh user just for removal so we don't break other tests
    const removable = yopUser('remove');

    await test.step('Invite a fresh member', async () => {
      await wsPage.openWorkspaceSettings();
      await wsPage.goToTeamMembers();
      await wsPage.inviteMember({ email: removable.email, role: 'Team Member' });
    });

    await test.step('Search for the member', async () => {
      await wsPage.searchMember(removable.yopUsername);
    });

    await test.step('Remove the member', async () => {
      await wsPage.removeMember();
    });

    await test.step('Verify member no longer appears in search', async () => {
      await wsPage.assertMemberNotFound(removable.yopUsername);
    });
  });

});
