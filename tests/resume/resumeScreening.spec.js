// tests/resume/resumeScreening.spec.js
/**
 * Resume Screening Test Suite
 *
 *  TC_RES_001  Upload resume → verify pending state → poll for screening complete
 *              → capture score → assert score consistency across panels
 *              → verify candidate in Explorer with correct status
 */
const { test, expect }        = require('../../utils/authFixture');
const { ResumeScreeningPage } = require('../../pages/ResumeScreeningPage');
const { getEnv }              = require('../../utils/helpers');
const testData  = require('../../data/testData.json');
const path      = require('path');

const RS = testData.resumeScreening;

// Resolve env-driven resume / candidate values at runtime
const resumeFile     = getEnv(RS.resumeFileEnvKey);
const resumeFileName = getEnv(RS.resumeFileNameEnvKey);
const candidateName  = getEnv(RS.candidateNameEnvKey);
const candidateEmail = getEnv(RS.candidateEmailEnvKey);
const explorerEmail  = getEnv(RS.explorerEmailEnvKey);

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RES_001 — Upload resume, verify screening status & score consistency
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RES_001 — Resume Upload & Screening Flow', () => {

  test('Upload resume → pending → screening complete → score matches → Explorer record', async ({
    page, loggedInPage
  }) => {
    const resumePage = new ResumeScreeningPage(page);
    const resumePath = path.resolve(__dirname, '../../', resumeFile);

    // ── 1. Navigate to job candidates page ───────────────
    await test.step(`Navigate to "${RS.jobTitle}" candidates`, async () => {
      await resumePage.goToDashboard();
      await resumePage.openCandidatesForJob(RS.jobTitle);
    });

    // ── 2. Delete existing candidate if already present ──
    await test.step(`Clean up existing candidate for ${candidateEmail} if present`, async () => {
      await resumePage.deleteCandidateIfExists(candidateEmail);
    });

    // ── 3. Upload resume and send later ──────────────────
    await test.step(`Upload resume: ${resumeFileName}`, async () => {
      await resumePage.uploadResumeAndSendLater(resumePath);
    });

    // ── 4. Assert pending banner ──────────────────────────
    await test.step('Assert "Interview links pending" banner is shown', async () => {
      await resumePage.assertPendingBanners();
    });

    // ── 5. Filter by email to find the candidate ─────────
    await test.step(`Filter candidates by email: ${candidateEmail}`, async () => {
      await resumePage.filterByEmail(candidateEmail);
      await resumePage.assertCandidateNameVisible(candidateName);
    });

    // ── 6. Assert initial screening in-progress state ────
    await test.step('Assert "Resume Screening" in-progress status', async () => {
      await resumePage.assertResumeScreeningInProgress();
    });

    // ── 7. Poll for screening to complete (up to 2 min) ──
    let screeningPassed = false;
    await test.step('Wait for Resume Screening to complete (polling with page refresh)', async () => {
      screeningPassed = await resumePage.waitForScreeningComplete(
        RS.screeningMaxWaitMs,
        RS.screeningPollIntervalMs
      );

      // Re-filter after refreshes wipe the filter state
      if (screeningPassed) {
        await resumePage.filterByEmail(candidateEmail);
      }

      expect(
        screeningPassed,
        'Resume Screening did not complete within the timeout — check AI processing status'
      ).toBe(true);
    });

    // ── 8. Capture Resume Fit score ───────────────────────
    let capturedScore;
    await test.step('Capture Resume Fit score from candidate row badge', async () => {
      capturedScore = await resumePage.captureResumeFitScore();
      test.info().annotations.push({
        type:        'Resume Fit Score',
        description: `${capturedScore}%`,
      });
    });

    // ── 9. Open badge → View Analysis → assert score ─────
    await test.step('Open Resume Fit badge and assert score in View Analysis panel', async () => {
      await resumePage.openResumeFitBadge();
      await resumePage.assertViewAnalysisScore(capturedScore);
    });

    // ── 10. Assert same score in Screening panel ───────────
    await test.step('Assert same score in Screening panel', async () => {
      await resumePage.assertScreeningPanelScore(capturedScore);
    });

    // ── 11. Navigate to Candidate Explorer ───────────────
    await test.step('Navigate to Candidate Explorer', async () => {
      await resumePage.goToExplorer();
    });

    // ── 12. Filter Explorer by email ─────────────────────
    await test.step(`Filter Explorer by email: ${explorerEmail}`, async () => {
      await resumePage.filterExplorerByEmail(explorerEmail);
    });

    // ── 13. Verify full Explorer row ─────────────────────
    await test.step('Verify all columns in the Explorer candidate record', async () => {
      await resumePage.assertExplorerRow({
        candidateName: candidateName,
        status:        RS.expectedStatus,
        datePart:      RS.datePart,
        jobTitle:      RS.jobTitle,
        company:       RS.companyName,
        resumeScore:   capturedScore,
      });
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_RES_002 — Screening failed state is handled gracefully
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_RES_002 — Resume Screening Failed state', () => {

  test('If screening fails, the failed status is visible and test surfaces it clearly', async ({
    page, loggedInPage
  }) => {
    const resumePage = new ResumeScreeningPage(page);
    const resumePath = path.resolve(__dirname, '../../', resumeFile);

    await test.step('Upload resume and wait for screening result', async () => {
      await resumePage.goToDashboard();
      await resumePage.openCandidatesForJob(RS.jobTitle);
      await resumePage.deleteCandidateIfExists(candidateEmail);
      await resumePage.uploadResumeAndSendLater(resumePath);
      await resumePage.assertPendingBanners();
      await resumePage.filterByEmail(candidateEmail);
    });

    await test.step('Poll for terminal state (complete or failed)', async () => {
      const complete = await resumePage.waitForScreeningComplete(
        RS.screeningMaxWaitMs,
        RS.screeningPollIntervalMs
      );

      if (!complete) {
        // Re-filter to see the failed state
        await resumePage.filterByEmail(candidateEmail);
        const failedText = page.getByText('Resume Screening Failed');
        const isVisible  = await failedText.isVisible().catch(() => false);

        // Surface the failure as a soft assertion so we see the state
        expect(isVisible, 'Expected either Screening Complete or Screening Failed to be visible').toBe(true);
      } else {
        // Screening succeeded — this test scenario passes trivially
        console.log('TC_RES_002: Screening completed (not failed) — expected behaviour');
      }
    });
  });

});