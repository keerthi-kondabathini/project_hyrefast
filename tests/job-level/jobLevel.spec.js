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
  // loggedInPage already leaves the app on the dashboard. Avoid a full reload:
  // auth is initialized by the SPA and a hard navigation can send this session
  // back to Sign In before the job menu is opened.
  await expect(jobLevelPage.jobSearchInput).toBeVisible({ timeout: 15_000 });
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
    const link   = {
      ...JL.interviewLink,
      name: `${JL.interviewLink.name}-${Date.now()}`,
    };

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
    const linkName = `public-test-link-${Date.now()}`;
    // Generate fresh email and phone each run to avoid duplicate-application errors
    const { email } = await generateYopMailUser();
    const phone = faker.string.numeric(10);

    await test.step('Open View JD → Interview Links tab', async () => {
      await openViewJD(page, jlPage);
      await jlPage.navigateToLinksTab();
    });

    await test.step('Create a fresh public link for this run', async () => {
      await jlPage.createInterviewLink({
        name: linkName,
        uses: 'Unlimited',
        // Keep the default public application settings enabled. Clicking the
        // modal switches here disabled fields that the public form requires.
        toggles: 0,
      });
      await jlPage.enableInterviewLink(linkName);
    });

    await test.step('Open public link and submit application', async () => {
      await jlPage.testPublicLinkApply({
        linkName,
        fullName: applicant.fullName,
        email,
        phone,
      });
    });

    await test.step('Remove the generated interview link', async () => {
      await jlPage.deleteInterviewLink({ linkName });
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
      const customizeButton = page.getByRole('button', { name: /Customize Rounds/i });
      if (await customizeButton.isVisible().catch(() => false)) {
        const suffix = faker.string.alphanumeric(4).toLowerCase();
        await jlPage.customizePipeline({
          rounds: JL.pipeline.rounds.map((round) => ({
            name: `${round.name}_${suffix}`,
            alias: `${round.name}_${suffix}`,
            toggleNth: round.toggleNth,
          })),
        });
        return;
      }

      // Current UI starts on the company default and exposes Copy Template as
      // the supported way to create a job-specific pipeline.
      const copyTemplate = page.getByText(/Copy Template/i).last();
      await expect(copyTemplate).toBeVisible({ timeout: 10_000 });
      await copyTemplate.click();
      // The Copy Template menu has entries such as "Copy from Tech" and
      // "Copy from Sales". Select a template different from the active Tech
      // default so the pipeline becomes dirty and Save Pipeline is enabled.
      const copyFromSales = page.getByText(/^Copy from Sales\b/i);
      await expect(copyFromSales).toBeVisible({ timeout: 10_000 });
      await copyFromSales.click();
      await expect(page.getByRole('button', { name: /Save Pipeline/i })).toBeEnabled({ timeout: 10_000 });
      await page.getByRole('button', { name: /Save Pipeline/i }).click();
      await expect(jlPage.pipelineUpdatedToast.or(jlPage.pipelineCustomisedText))
        .toBeVisible({ timeout: 15_000 });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_JL_005 — Source Document tab
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_JL_005 — Source Document content', () => {
  test('Open job Overview → assert uploaded job description content is visible', async ({ page, loggedInPage }) => {
    const jlPage = new JobLevelPage(page);

    await test.step('Open View JD → Overview', async () => {
      await openViewJD(page, jlPage);
    });

    await test.step('Assert job description sections are visible', async () => {
      await jlPage.assertSourceDocumentVisible();
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
      grantedMemberName = await jlPage.assignIndividualMember(
        access.memberSearchQuery,
        access.memberOptionText,
      );
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
    const futureDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);

    await test.step('Navigate to dashboard and open Edit Job Details', async () => {
      await expect(jlPage.jobSearchInput).toBeVisible({ timeout: 15_000 });
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
        deadline:        futureDeadline,
        jobStatus:       edit.jobStatus,
        spocText:        edit.spocText,
        mobileInterview: true,
        advancedProctoring: true,
        whatsappEnrichment: true,
      });
    });

    await test.step('Open View JD and verify changes are reflected', async () => {
      // The edit page was opened from the dashboard menu; use browser history
      // to return through the SPA router without dropping the authenticated state.
      if (!(await jlPage.jobSearchInput.isVisible().catch(() => false))) {
        await page.goBack();
      }
      await expect(jlPage.jobSearchInput).toBeVisible({ timeout: 15_000 });
      await jlPage.searchJobOnDashboard(edit.roleTitle);
      await jlPage.openViewJD(JL.overflowNth);
      await jlPage.assertViewJDFields({
        jobTitle:   edit.roleTitle,
        jobStatus:  edit.jobStatus.toLowerCase(),
      });
    });
  });
});
