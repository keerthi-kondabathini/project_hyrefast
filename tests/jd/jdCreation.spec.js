// tests/jd/jdCreation.spec.js
const { test, expect } = require('../../utils/authFixture');
const path = require('path');
const { JDCreationPage } = require('../../pages/JDCreationPage');
const { futureDateString, getEnv } = require('../../utils/helpers');
const testData = require('../../data/testData.json');


/**
 * Data-driven JD creation tests.
 * Each scenario in testData.json.jdCreation.scenarios runs as its own test.
 */
for (const scenario of testData.jdCreation.scenarios) {

  test.describe(`JD Creation — ${scenario.description} [${scenario.id}]`, () => {

    test(`${scenario.id} — Full JD creation flow: "${scenario.jobTitle}"`, async ({
      page, loggedInPage, credentials
    }) => {
      const jdPage = new JDCreationPage(page);
      const timeouts = testData.timeouts;

      // Resolve env-driven values
      const workspaceName  = credentials.workspace;
      const workspaceSlug  = credentials.workspaceSlug;
      const closingDate    = futureDateString(scenario.closingDateOffsetDays);

      // ── 1. Capture initial published jobs count ─────────────
      let initialCount;
      await test.step('Capture current Published Jobs count', async () => {
        initialCount = await loggedInPage.getPublishedJobsCount();
        console.log(`Initial published jobs count: ${initialCount}`);
      });

      // ── 2. Open JD creation wizard ──────────────────────────
      await test.step('Open Create Job wizard', async () => {
        await loggedInPage.clickCreateJob();
        await expect(page.getByRole('heading', { name: 'Upload your Job Description' })).toBeVisible({ timeout: 15_000 });
      });

      // ── 3. Fill Step 1 — JD Details ─────────────────────────
      await test.step('Step 1: Fill JD details', async () => {
        await jdPage.fillJobDetails({
          jobTitle:       scenario.jobTitle,
          workspaceName:  workspaceName,
          employmentType: scenario.employmentType,
          workMode:       scenario.workMode,
          locationQuery:  scenario.locationQuery,
          locationOption: scenario.locationOption,
          generateFromRoleTitle: scenario.generateFromRoleTitle || false,
          jobDescriptionFilePath: scenario.generateFromRoleTitle ? null : path.resolve(__dirname, '../../fixtures/resumes/Advanced_DotNet_Resume_7.docx'),
        });
      });

      // ── 4. Wait for AI JD generation ─────────────────────────
      await test.step('Wait for AI JD generation', async () => {
        await jdPage.waitForJDGeneration(timeouts.jdGeneration);
      });

      // ── 5. Proceed to Skills ──────────────────────────────────
      await test.step('Step 1 → Step 2: Proceed to Skills', async () => {
        await jdPage.proceedToSkills();
      });

      // ── 6. Wait for AI skill generation ──────────────────────
      await test.step('Wait for AI skill generation (1–2 min)', async () => {
        await jdPage.waitForSkillGeneration(timeouts.skillGeneration);
      });

      // ── 7. Add a custom skill ─────────────────────────────────
      await test.step('Step 2: Add a custom skill', async () => {
        await jdPage.addCustomSkill(scenario.extraSkill);
      });

      // ── 8. Accept skills & generate interview config ──────────
      await test.step('Step 2 → Step 3: Accept Skills & Generate', async () => {
        await jdPage.acceptSkillsAndGenerate();
      });

      // ── 9. Configure interview (Step 3) ───────────────────────
      await test.step('Step 3: Interview configuration & topics', async () => {
        await jdPage.configureInterview(timeouts.interviewTopicGeneration);
      });

      // ── 10. Generate questions (Step 4) ───────────────────────
      await test.step('Step 4: Generate question bank', async () => {
        await jdPage.generateQuestions(
          timeouts.questionGeneration,
          timeouts.aiCoverSkills
        );
      });

      // ── 11. Configure publishing (Step 5) ─────────────────────
      await test.step('Step 5: Configure distribution & publishing', async () => {
        await jdPage.configurePublishing({
          publishAction:  scenario.publishAction,
          closingDate:    closingDate,
          workspaceName:  workspaceName,
          workspaceSlug:  workspaceSlug,
          platforms:      scenario.platforms,
        });
      });

      // ── 12. Review & save links ────────────────────────────────
      await test.step('Step 5: Review and save interview links', async () => {
        await jdPage.reviewAndSaveLinks(scenario.platforms.length);
      });

      // ── 13. Go back to jobs list ───────────────────────────────
      await test.step('Navigate back to jobs list', async () => {
        await jdPage.goBack();
      });

      // ── 14. Search & verify the new job appears ───────────────
      await test.step('Search for the newly created job', async () => {
        await loggedInPage.searchJob(scenario.jobTitle);
        const jobLink = page.getByRole('link', { name: new RegExp(scenario.jobTitle, 'i') }).first();
        await expect(jobLink).toBeVisible({ timeout: 15_000 });
      });

      // ── 15. Verify published count increased (live statuses only) ───
      const LIVE_STATUSES = ['Published', 'Hiring In Progress'];
      if (LIVE_STATUSES.includes(scenario.publishAction)) {
        await test.step('Verify Published Jobs counter incremented by 1', async () => {
          const expectedCount = initialCount + 1;
          await loggedInPage.assertPublishedJobsCount(expectedCount);
        });
      }
    });

  });
}

// ─── Isolated scenario: Verify JD wizard opens correctly ────────────────────
test.describe('JD Creation — Wizard smoke test', () => {

  test('TC_JD_SMOKE_001 — Create Job button opens JD wizard', async ({
    page, loggedInPage
  }) => {
    await test.step('Click Create Job', async () => {
      await loggedInPage.clickCreateJob();
    });

    await test.step('Verify JD wizard heading is visible', async () => {
      await expect(page.getByRole('heading', { name: 'Upload your Job Description' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'I do not have a JD (Generate via Role Title)' })).toBeVisible();
    });
  });

});

// ─── JD Deletion tests ──────────────────────────────────────────────────────
for (const scenario of testData.jdDeletion.scenarios) {

  test.describe(`JD Deletion — ${scenario.description} [${scenario.id}]`, () => {

    test(`${scenario.id} — Delete job and verify removal: "${scenario.jobTitle}"`, async ({
      page, loggedInPage
    }) => {
      await test.step('Delete the job', async () => {
        await loggedInPage.deleteJob(scenario.jobTitle);
      });

      await test.step('Verify job no longer appears in search', async () => {
        await loggedInPage.assertJobNotFound(scenario.jobTitle);
      });
    });

  });
}
