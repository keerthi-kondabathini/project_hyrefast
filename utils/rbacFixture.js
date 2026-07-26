// utils/rbacFixture.js
/**
 * RBAC Test Fixture
 *
 * Provides a `workspace` fixture that signs up a fresh organisation
 * and returns fully typed actor objects for every role.
 *
 * Returned shape:
 * {
 *   owner:    { email, yopUsername, password, page, context }
 *   admin:    { email, yopUsername, password, page, context }
 *   teamLead: { email, yopUsername, password, page, context }
 *   member:   { email, yopUsername, password, page, context }
 *   teamName: string
 *   workspaceName: string
 *   jobTitle: string
 * }
 *
 * Each actor gets their own browser context so sessions never mix.
 *
 * Usage in a test:
 *   const { test } = require('../../utils/rbacFixture');
 *   test('my test', async ({ workspace }) => {
 *     const { owner, teamLead, member } = workspace;
 *     await owner.page.goto('/dashboard');
 *     ...
 *   });
 */

const { test: base, expect } = require('@playwright/test');
const { faker }    = require('@faker-js/faker');
const { SignupPage }      = require('../pages/SignupPage');
const { YopMailPage }     = require('../pages/YopMailPage');
const { LoginPage }       = require('../pages/LoginPage');
const { DashboardPage }   = require('../pages/DashboardPage');
const { WorkspaceTeamsPage } = require('../pages/WorkspaceTeamsPage');
const { getEnv }          = require('./helpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function yopUser(prefix = 'hf') {
  const id = faker.string.alphanumeric(7).toLowerCase();
  const username = `${prefix}_${id}`;
  return { email: `${username}@yopmail.com`, yopUsername: username, password: 'Test@1234' };
}

function randomPhone() {
  return `9${Math.floor(Math.random() * 900_000_000 + 100_000_000)}`;
}

/**
 * Activate an account: open YopMail inbox, find activation email, click link.
 * Returns the new page that opens after clicking "Activate My Account".
 */
async function activateAccount(browser, user, timeoutMs = 15_000) {
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  const yop  = new YopMailPage(page);

  await yop.openInbox(user.yopUsername);

  let found = false;
  for (let i = 1; i <= 5; i++) {
    found = await yop.mailFrame()
      .getByText('Activate Your HyreFast').isVisible().catch(() => false);
    if (found) break;
    await yop.refreshInbox();
    await page.waitForTimeout(timeoutMs);
  }
  if (!found) throw new Error(`Activation email not found for ${user.email}`);

  const popup = ctx.waitForEvent('page');
  await yop.mailFrame().getByRole('link', { name: 'Activate My Account →' }).click();
  const activationPage = await popup;
  await activationPage.waitForLoadState('networkidle');
  return { page: activationPage, context: ctx };
}

/**
 * Accept a workspace invite: open YopMail, click "Accept invite & set password".
 * Returns the page after setting the password.
 */
async function acceptInvite(browser, user, timeoutMs = 15_000) {
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  const yop  = new YopMailPage(page);

  await yop.openInbox(user.yopUsername);

  let found = false;
  for (let i = 1; i <= 5; i++) {
    found = await yop.mailFrame()
      .getByRole('link', { name: 'Accept invite & set password' }).isVisible().catch(() => false);
    if (found) break;
    await yop.refreshInbox();
    await page.waitForTimeout(timeoutMs);
  }
  if (!found) throw new Error(`Invite email not found for ${user.email}`);

  const popup = ctx.waitForEvent('page');
  await yop.mailFrame().getByRole('link', { name: 'Accept invite & set password' }).click();
  const acceptPage = await popup;
  await acceptPage.waitForLoadState('networkidle');

  // Set password
  await acceptPage.getByRole('textbox', { name: 'Password', exact: true }).fill(user.password);
  await acceptPage.getByRole('textbox', { name: 'Confirm Password' }).fill(user.password);
  await acceptPage.getByRole('button', { name: 'Set Password & Join Workspace' }).click();
  await acceptPage.waitForLoadState('networkidle');
  await ctx.close();
}

/**
 * Log in as a user and return { page, context } with an active session.
 */
async function loginAs(browser, baseURL, user) {
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(baseURL);
  await page.waitForLoadState('networkidle');
  await page.getByRole('textbox', { name: 'Email Address' }).fill(user.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForLoadState('networkidle');
  return { page, context: ctx };
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

const test = base.extend({
  /**
   * `workspace` fixture — creates a complete org with 4 roles + 1 team.
   * Tear-down closes all contexts.
   */
  workspace: async ({ browser, baseURL }, use) => {
    const BASE = baseURL || process.env.BASE_URL || 'https://staging.hyrefast.ai';

    // ── 1. Owner: sign up ──────────────────────────────────
    const ownerUser = yopUser('owner');
    const ownerCtx  = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const signup    = new SignupPage(ownerPage);

    await signup.navigate();
    await signup.openSignUpTab();
    await signup.fillAndSubmitSignUp({
      fullName: `Owner ${ownerUser.yopUsername.slice(-4)}`,
      phone:    randomPhone(),
      email:    ownerUser.email,
      password: ownerUser.password,
    });
    await signup.assertAccountCreated();

    // Activate owner account
    const { page: activationPage, context: activationContext } = await activateAccount(browser, ownerUser);
    // Choose Agency mode on workspace setup
    const setupPage = new SignupPage(activationPage);
    await setupPage.assertWorkspaceSetupScreen();
    await setupPage.selectAgencyModeDirectly();
    await activationPage.waitForLoadState('networkidle');

    // Get workspace name from the page
    const workspaceName = await activationPage
      .getByRole('textbox', { name: /company|workspace/i }).first()
      .inputValue()
      .catch(() => ownerUser.yopUsername);

    await activationPage.close();
    await activationContext.close();

    // Re-login owner in clean context
    const ownerSession = await loginAs(browser, BASE, ownerUser);

    // ── 2. Open workspace settings → Team Members ──────────
    const wsPage = new WorkspaceTeamsPage(ownerSession.page);
    await wsPage.openWorkspaceSettings();
    await wsPage.goToTeamMembers();

    // ── 3. Create team first ────────────────────────────────
    const teamName = `team_${faker.string.alphanumeric(5).toLowerCase()}`;
    await wsPage.createTeam(teamName);
    await wsPage.goToTeamMembers();

    // ── 4. Invite admin, teamLead, member ──────────────────
    const adminUser    = yopUser('admin');
    const teamLeadUser = yopUser('lead');
    const memberUser   = yopUser('member');

    await wsPage.inviteMember({ email: adminUser.email,    role: 'Admin' });
    await wsPage.inviteMember({ email: teamLeadUser.email, role: 'Team Lead' });
    await wsPage.inviteMember({ email: memberUser.email,   role: 'Team Member' });

    // ── 5. Accept invites in parallel ─────────────────────
    await Promise.all([
      acceptInvite(browser, adminUser),
      acceptInvite(browser, teamLeadUser),
      acceptInvite(browser, memberUser),
    ]);

    // ── 6. Open sessions for all actors ───────────────────
    const adminSession    = await loginAs(browser, BASE, adminUser);
    const teamLeadSession = await loginAs(browser, BASE, teamLeadUser);
    const memberSession   = await loginAs(browser, BASE, memberUser);

    const workspace = {
      workspaceName,
      teamName,
      jobTitle: '.net developer',
      owner:    { ...ownerUser,    ...ownerSession    },
      admin:    { ...adminUser,    ...adminSession    },
      teamLead: { ...teamLeadUser, ...teamLeadSession },
      member:   { ...memberUser,   ...memberSession   },
    };

    await use(workspace);

    // ── Teardown: close all contexts ───────────────────────
    for (const actor of [ownerSession, adminSession, teamLeadSession, memberSession]) {
      await actor.context.close().catch(() => {});
    }
  },
});

module.exports = { test, expect, yopUser, loginAs, acceptInvite, activateAccount, randomPhone };