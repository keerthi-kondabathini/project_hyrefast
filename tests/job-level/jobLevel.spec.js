// tests/job-level/jobLevel.spec.js
/**
 * Job-Level Tab Tests
 *
 *  TC_JL_001  View JD — all fields + applicant count
 *  TC_JL_002  Interview Links — Create → Edit → Delete
 *  TC_JL_003  Public Link — open, fill apply form, assert confirmation
 *  TC_JL_004  Interview Pipeline — customize rounds, save
 *  TC_JL_005  Source Document tab — original doc visible
 *  TC_JL_006  Access Settings — team grant/revoke + individual + external
 *  TC_JL_007  Edit Job Details — update fields + tabs + save, verify changes
 */

const { test, expect }  = require('../../utils/authFixture');
const { JobLevelPage }  = require('../../pages/JobLevelPage');
const { generateYopMailUser, faker } = require('../../utils/helpers');
const td = require('../../data/newFeaturesTestData.json');

const JL = td.jobLevel;

// helper — open a job's View JD
async function openViewJD(page, jobLevelPage) {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await jobLevelPage.searchJobOnDashboard(JL.jobSearchQuery);
  await jobLevelPage.openViewJD(JL.overflowNth);
}

// ─────────────────────────────────────────────────────────────────────────────
//  TC_JL_001 — View JD — all fields visible
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_JL_001 — View JD: all field assertions', () => {
  test('Open View JD and assert all displayed fields dynamically', async ({ page, loggedInPage }) => {
    const jlPage = new JobLevelPage(page);

    await test.step('Open View JD', async () => {
      await openViewJD(page, jlPage);
    });

    await test.step('Capture all visible fields', async () => {
      const data = await jlPage.captureViewJDDetails();
      test.info().annotations.push({ type: 'Captured View JD', description: JSON.stringify(data) });
    });

    await test.step('Assert all Job Information and Posting Details sections visible', async () => {
      await jlPage.assertViewJDFields({});  // asserts always-present fields
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_JL_002 — Interview Links — CRUD
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_JL_002 — Interview Links CRUD', () => {
  test('Create → Edit → Delete interview link', async ({ page, loggedInPage }) => {
    const jlPage = new JobLevelPage(page);
    const link   = JL.interviewLink;

    await test.step('Open View JD → Interview Links tab', async () => {
      await openViewJD(page, jlPage);
      await jlPage.navigateToLinksTab();
    });

    await test.step('Create interview link', async () => {
      await jlPage.createInterviewLink({
        name:            link.name,
        uses:            link.uses,
        expirationDay:   link.expirationDay,
        expirationHour:  link.expirationHour,
        toggles:         link.toggleCount,
      });
    });

    await test.step('Edit interview link and verify updated toast', async () => {
      await jlPage.editInterviewLink({ linkName: new RegExp(link.name, 'i'), toggles: link.toggleCount });
    });

    await test.step('Delete interview link and verify deleted toast', async () => {
      await jlPage.deleteInterviewLink({ linkName: new RegExp(link.name, 'i') });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_JL_003 — Public link apply form
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_JL_003 — Public Interview Link Apply Form', () => {
  test('Open public link in popup → fill form → assert Application Submitted', async ({ page, loggedInPage }) => {
    const jlPage    = new JobLevelPage(page);
    const applicant = JL.publicLinkApplicant;
    // Generate fresh email and phone each run to avoid duplicate-application errors
    const { email } = await generateYopMailUser();
    const phone = faker.string.numeric(10);

    await test.step('Open View JD → Interview Links tab', async () => {
      await openViewJD(page, jlPage);
      await jlPage.navigateToLinksTab();
    });

    await test.step('Create a link first (if none exists)', async () => {
      const createBtn = page.getByRole('button', { name: 'Create New Link' });
      if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await jlPage.createInterviewLink({
          name: 'public-test-link',
          uses: 'Unlimited',
          toggles: 0,
        });
      }
    });

    await test.step('Open public link and submit application', async () => {
      await jlPage.testPublicLinkApply({
        linkName: /public-test-link/i,
        fullName: applicant.fullName,
        email,
        phone,
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_JL_004 — Interview Pipeline — customize rounds
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_JL_004 — Interview Pipeline Customization', () => {
  test('Open Pipeline tab → customize rounds → save → verify toast', async ({ page, loggedInPage }) => {
    const jlPage = new JobLevelPage(page);

    await test.step('Open View JD → Pipeline tab', async () => {
      await openViewJD(page, jlPage);
      await jlPage.navigateToPipelineTab();
    });

    await test.step('Customize pipeline and save', async () => {
      const suffix = faker.string.alphanumeric(4).toLowerCase();
      const pipeline = {
        // Customize the already-active rounds; do not copy a template to avoid duplicate config errors.
        rounds: JL.pipeline.rounds.map((r) => ({
          name: `${r.name}_${suffix}`,
          alias: `${r.name}_${suffix}`,
          toggleNth: r.toggleNth,
        })),
      };
      await jlPage.customizePipeline(pipeline);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_JL_005 — Source Document tab
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_JL_005 — Source Document tab', () => {
  test('Open Source Document tab → assert original uploaded document visible', async ({ page, loggedInPage }) => {
    const jlPage = new JobLevelPage(page);

    await test.step('Open View JD → Source Document tab', async () => {
      await openViewJD(page, jlPage);
      await jlPage.navigateToSourceDocTab();
    });

    await test.step('Assert original document text is visible', async () => {
      await jlPage.assertSourceDocumentVisible(JL.sourceDocFragment);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_JL_006 — Access Settings — team, individual, external
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_JL_006 — Access Settings', () => {
  test('Grant team access → revoke → add individual member → revoke → external access CRUD', async ({ page, loggedInPage }) => {
    const jlPage  = new JobLevelPage(page);
    const access  = JL.accessSettings;
    const { email: extEmail } = await generateYopMailUser();

    await test.step('Open View JD → Access Settings tab', async () => {
      await openViewJD(page, jlPage);
      await jlPage.navigateToAccessSettingsTab();
    });

    let grantedTeamName;
    await test.step('Grant team access', async () => {
      grantedTeamName = await jlPage.assignTeamAccess();
    });

    await test.step('Revoke team access', async () => {
      if (grantedTeamName) {
        await jlPage.revokeTeamAccess(grantedTeamName);
      } else {
        test.info().annotations.push({ type: 'skipped', description: 'No grantable team available; revoke step skipped' });
      }
    });

    let grantedMemberName;
    await test.step('Add individual member', async () => {
      grantedMemberName = await jlPage.assignIndividualMember();
    });

    await test.step('Revoke individual member access', async () => {
      await jlPage.revokeMemberAccess(grantedMemberName);
    });

    await test.step('Enable external access', async () => {
      await jlPage.enableExternalAccess();
    });

    await test.step('Invite external user', async () => {
      await jlPage.inviteExternalUser(extEmail, access.externalVisibility);
    });

    await test.step('Update external user visibility', async () => {
      await jlPage.updateExternalUserVisibility(extEmail, access.externalVisibilityUpdate);
    });

    await test.step('Revoke external user', async () => {
      await jlPage.revokeExternalUser(extEmail);
    });

    await test.step('Resend external invite', async () => {
      await jlPage.resendExternalUser(extEmail);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_JL_007 — Edit Job Details
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_JL_007 — Edit Job Details', () => {
  test('Open Edit Job Details → capture before → edit all fields → save → verify changes', async ({ page, loggedInPage }) => {
    const jlPage = new JobLevelPage(page);
    const edit   = JL.editJob;

    await test.step('Navigate to dashboard and open Edit Job Details', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await jlPage.searchJobOnDashboard(JL.jobSearchQuery);
      await jlPage.openEditJobDetails(JL.overflowNth);
    });

    await test.step('Capture current job details before editing', async () => {
      const before = await jlPage.captureJobDetails();
      test.info().annotations.push({ type: 'Before Edit', description: JSON.stringify(before) });
    });

    await test.step('Edit job details and save', async () => {
      await jlPage.editJobDetails({
        roleTitle:       edit.roleTitle,
        company:         edit.company,
        jobID:           edit.jobID,
        deadline:        edit.deadline,
        jobStatus:       edit.jobStatus,
        spocText:        edit.spocText,
        mobileInterview: true,
        agentInterview:  true,
        preScreening:    true,
      });
    });

    await test.step('Open View JD and verify changes are reflected', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await jlPage.searchJobOnDashboard(edit.roleTitle);
      await jlPage.openViewJD(JL.overflowNth);
      await jlPage.assertViewJDFields({
        jobTitle:   edit.roleTitle,
        jobStatus:  edit.jobStatus.toLowerCase(),
      });
    });
  });
});