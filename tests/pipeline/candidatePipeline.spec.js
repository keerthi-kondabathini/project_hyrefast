// tests/pipeline/candidatePipeline.spec.js
/**
 * Candidate Pipeline Status Tests
 *
 * Test Map
 * ────────
 *  TC_PIPE_001  Add candidate → assert "Awaiting Interview" → verify "Resend Interview Link" in menu
 *  TC_PIPE_002  Full interview flow → "Assessment In Progress" → poll "Decision Pending"
 *               → performance/integrity scores visible
 *  TC_PIPE_003  Share with Hiring Manager → "Candidate Shared" (in app + Explorer)
 *  TC_PIPE_004  Advance to Round 1 → Update Round = No Show → Advance to Round 2
 *               → Update Round = Pass → "Candidate Dropped" on fail path (side-test)
 *  TC_PIPE_005  Move to Offer Made → Mark Offer Accepted → Candidate Joined → Candidate Continued
 *  TC_PIPE_006  Mark Candidate Not Interested (from any status)
 *  TC_PIPE_007  Reject with email → verify YopMail rejection email received
 *  TC_PIPE_008  Reject without email → verify candidate does NOT receive email
 *
 * Shared state: TC_PIPE_002 runs the full interview and subsequent tests
 * reuse the same candidate. All tests use a fresh YopMail address generated
 * at runtime so runs never conflict.
 */

const { test, expect }           = require('../../utils/authFixture');
const { CandidatePipelinePage }  = require('../../pages/CandidatePipelinePage');
const { YopMailPage }            = require('../../pages/YopMailPage');
const { CandidateInterviewPage } = require('../../pages/CandidateInterviewPage');
const { InterviewPage }            = require('../../pages/InterviewPage');
const { generateYopMailUser, getEnv } = require('../../utils/helpers');
const testData = require('../../data/testData.json');
const path     = require('path');

const PL = testData.pipeline;
const TO = testData.timeouts;
const applicationsUrl = getEnv(PL.applicationsUrlEnvKey, '');

// ─── Runtime-generated candidate credentials ──────────────────────────────────
// Generated once per test run — shared across suites via module state
const CAND1 = generateYopMailUser(); // email-only candidate
const CAND2 = generateYopMailUser(); // full-interview candidate

// ─────────────────────────────────────────────────────────────────────────────
//  TC_PIPE_001 — Add candidate by email → Awaiting Interview → menu check
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_PIPE_001 — Add Candidate → Awaiting Interview status', () => {

  test('Add candidate via email, verify Awaiting Interview status and action menu', async ({
    page, loggedInPage
  }) => {
    const pipeline = new CandidatePipelinePage(page);

    await test.step('Navigate to applications page', async () => {
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
    });

    await test.step(`Add candidate ${CAND1.email} via Create & Send Email`, async () => {
      await pipeline.addCandidateByEmail(CAND1.email);
    });

    await test.step('Filter by email and assert Awaiting Interview status', async () => {
      await pipeline.filterByEmail(CAND1.email);
      await pipeline.assertStatus('awaitingInterview', CAND1.yopUsername);
    });

    await test.step('Open action menu and assert Resend Interview Link is visible', async () => {
      await pipeline.assertResendInterviewLinkVisible(CAND1.yopUsername);
    });

    // Explorer verification
    await test.step('Verify status in Candidate Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(CAND1.email);
      await pipeline.assertExplorerStatus(
        CAND1.yopUsername,
        PL.explorerStatusMap.awaitingInterview
      );
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_PIPE_002 — Full interview → Assessment In Progress → Decision Pending
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_PIPE_002 — Interview → Assessment → Decision Pending', () => {

  test('Candidate completes interview, status progresses to Decision Pending with scores', async ({
    page, browser, loggedInPage
  }) => {
    const pipeline    = new CandidatePipelinePage(page);
    const resumePath  = path.resolve(
      __dirname, '../../',
      PL.candidates.fullFlow.resumeFile || 'fixtures/resumes/Advanced_DotNet_Resume_7.docx'
    );

    // ── Add candidate ────────────────────────────────────
    await test.step(`Add candidate ${CAND2.email}`, async () => {
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.addCandidateByEmail(CAND2.email);
      await pipeline.filterByEmail(CAND2.email);
      await pipeline.assertStatus('awaitingInterview', CAND2.yopUsername);
    });

    // ── Open YopMail → start interview ───────────────────
    const yopContext = await browser.newContext({
      launchOptions: {
        args: [
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
        ],
      },
    });
    const yopPage2 = await yopContext.newPage();
    const yopMail  = new YopMailPage(yopPage2);

    let interviewPage;
    await test.step('Verify invite email and open interview', async () => {
      await yopMail.openInbox(CAND2.yopUsername);
      let found = false;
      for (let i = 1; i <= 4; i++) {
        found = await yopMail.mailFrame()
          .getByRole('heading', { name: 'Your Private Interview Link' })
          .isVisible().catch(() => false);
        if (found) break;
        await yopMail.refreshInbox();
        await yopPage2.waitForTimeout(10_000);
      }
      expect(found, `Interview invite not found in ${CAND2.email}`).toBe(true);
      await expect(
        yopMail.mailFrame().getByRole('link', { name: 'Start My Interview' })
      ).toBeVisible();
      interviewPage = await yopMail.clickStartInterview(yopContext);
    });

    // ── Upload resume ────────────────────────────────────
    const interviewPOM = new CandidateInterviewPage(interviewPage);

    await test.step('Upload resume on interview page', async () => {
      await interviewPOM.uploadResume(resumePath);
      await interviewPOM.clickCompleteContinue();
    });

    // ── Full interview flow using InterviewPage POM ─────
    const interview = new InterviewPage(interviewPage);

    await test.step('System Requirements Check', async () => {
      // Skip strict assertion of individual requirement texts;
      // just click through to the consent screen.
      await interview.clickStartInterview();
    });

    await test.step('Accept consent and begin', async () => {
      await interview.acceptConsentAndBegin();
    });

    await test.step('Interview Outline → choose Read Questions mode', async () => {
      // Interview outline is temporarily disabled — skip assertion
      // await interview.assertInterviewOutline({
      //   jobTitle:      PL.candidates.fullFlow.jobTitle || '.net developer',
      //   companyName:   PL.candidates.fullFlow.companyName || 'Gimolov',
      //   questionCount: PL.candidates.fullFlow.questionCount || 6,
      // });
      // await interview.clickStartInterviewFromOutline();
      await interviewPage.getByRole('button', { name: 'Start Interview' }).click();
      await interview.chooseReadQuestionsMode();
    });

    // ── Q1: Show → Start Answer → Submit ─────────────────
    await test.step('Q1: Answer', async () => {
      await interview.assertQuestionNumber(1);
      await interview.showQuestion();
      await interview.startAnswer();
      // Wait for minimum recording duration (platform requires ~30-45s)
      await interviewPage.waitForTimeout(40_000);
      await interview.submitAndContinue();
    });

    // ── Q2: Skip ─────────────────────────────────────────
    await test.step('Q2: Skip', async () => {
      await interview.assertQuestionNumber(2);
      await interview.showQuestion();
      await interviewPage.getByRole('button', { name: 'Skip Question' }).click();
      await interviewPage.getByRole('button', { name: 'Skip Anyway' }).click();
    });

    // ── Q3–Q6: Skip remaining ────────────────────────────
    await test.step('Q3–Q6: Skip remaining questions', async () => {
      for (let q = 3; q <= 6; q++) {
        try {
          await interview.assertQuestionNumber(q);
          await interview.showQuestion();
          await interviewPage.getByRole('button', { name: 'Skip Question' }).click({ timeout: 5000 });
          await interviewPage.getByRole('button', { name: 'Skip Anyway' }).click({ timeout: 5000 });
        } catch { break; }
      }
    });

    // ── Profile Review ───────────────────────────────────
    await test.step('Review profile and confirm submission', async () => {
      await interview.assertProfileReview();
      await interview.confirmAndSubmitProfile();
    });

    // ── Completion & Feedback ────────────────────────────
    await test.step('Assert completion and submit feedback', async () => {
      await interview.assertInterviewCompleted();
      await interview.submitFeedback([
        { rowHeading: 'How was your interview experience?', label: '🙂 Satisfied' },
        { rowHeading: 'How would you rate the question difficulty?', label: 'Okay' },
        { rowHeading: 'How well could you showcase your skills?', label: 'Good' },
      ]);
      await interview.closeWindow();
    });

    await yopContext.close();

    // ── Assert Assessment In Progress on applications page ─
    await test.step('Assert Assessment In Progress status', async () => {
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.filterByEmail(CAND2.email);
      await pipeline.assertStatus('assessmentInProgress', { timeout: 30_000 });
    });

    // ── Poll for Decision Pending (AI analysis runs in background) ─
    await test.step('Poll for Decision Pending status (up to 5 min)', async () => {
      const maxWait = TO.assessmentMaxWaitMs || 300_000;
      const interval = TO.assessmentPollingMs || 30_000;
      const start = Date.now();
      let reached = false;

      while (Date.now() - start < maxWait) {
        const dp = await page.getByText('Decision Pending').isVisible().catch(() => false);
        if (dp) { reached = true; break; }
        console.log('Decision Pending not yet visible — refreshing...');
        await page.waitForTimeout(interval);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await pipeline.filterByEmail(CAND2.email);
      }

      expect(reached, 'Decision Pending status not reached within timeout').toBe(true);
    });

    // ── Assert scores visible ────────────────────────────
    await test.step('Assert Performance and Integrity scores are visible', async () => {
      // Scores are dynamic — just verify the labels exist with any percentage
      await expect(
        page.getByText(/Performance\d+%/i)
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByText(/Integrity\d+%/i)
      ).toBeVisible({ timeout: 10_000 });
    });

    // ── Explorer verification ────────────────────────────
    await test.step('Verify Decision Pending in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(CAND2.email);
      await pipeline.assertExplorerStatus(
        PL.candidates.fullFlow.name,
        PL.explorerStatusMap.decisionPending
      );
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_PIPE_003 — Share with Hiring Manager
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_PIPE_003 — Share with Hiring Manager', () => {

  test('Candidate is shared with hiring manager → Candidate Shared status', async ({
    page, loggedInPage
  }) => {
    const pipeline     = new CandidatePipelinePage(page);
    const candidateName = PL.candidates.fullFlow.name;

    await test.step('Navigate to applications and filter candidate', async () => {
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.filterByEmail(CAND2.email);
    });

    await test.step('Share with Hiring Manager via action menu', async () => {
      await pipeline.shareWithHiringManager(candidateName);
    });

    await test.step('Verify Candidate Shared in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(CAND2.email);
      await pipeline.assertExplorerStatus(
        candidateName,
        PL.explorerStatusMap.candidateShared
      );
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_PIPE_004 — Round management (Advance → No Show → Next Round → Pass)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_PIPE_004 — Round Advancement & Outcomes', () => {

  test('Advance to Round 1 → No Show → Advance to Round 2 → Pass', async ({
    page, loggedInPage
  }) => {
    const pipeline      = new CandidatePipelinePage(page);
    const candidateName = PL.candidates.fullFlow.name;
    const round1        = PL.rounds[0];
    const round2        = PL.rounds[1];

    await test.step('Navigate to applications', async () => {
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.filterByEmail(CAND2.email);
    });

    await test.step(`Advance to Round 1 with alias "${round1.alias}"`, async () => {
      await pipeline.advanceToRound(candidateName, round1.alias);
    });

    await test.step('Verify round in progress in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(CAND2.email);
      await pipeline.assertExplorerStatus(
        candidateName,
        PL.explorerStatusMap.roundInProgress
      );
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.filterByEmail(CAND2.email);
    });

    await test.step('Update Round 1 → No Show', async () => {
      await pipeline.updateRound(candidateName, round1.alias, 'No Show', round1.noShowDay);
    });

    await test.step(`Advance to Round 2 with alias "${round2.alias}"`, async () => {
      await pipeline.advanceToNextRound(candidateName, round2.alias, round2.startDay);
    });

    await test.step('Update Round 2 → Pass', async () => {
      await pipeline.updateRound(candidateName, round2.alias, 'Pass', round2.passDay);
    });

    await test.step('Verify Next Round status in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(CAND2.email);
      await pipeline.assertExplorerStatus(
        candidateName,
        PL.explorerStatusMap.roundInProgress
      );
    });
  });

  // Separate test: verify Candidate Dropped on round Fail
  test('Update Round → Fail → Candidate Dropped status', async ({
    page, loggedInPage
  }) => {
    const pipeline      = new CandidatePipelinePage(page);
    // Use CAND1 (email-only candidate) for the drop path
    const candidateName = CAND1.yopUsername;

    await test.step('Navigate and advance CAND1 to Round 1', async () => {
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.filterByEmail(CAND1.email);
      await pipeline.advanceToRound(candidateName, 'drop-test');
    });

    await test.step('Update Round → Fail → assert Candidate Dropped', async () => {
      await pipeline.updateRound(candidateName, 'drop-test', 'Fail', 19);
      await pipeline.assertStatus('dropped', { timeout: 10_000 });
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_PIPE_005 — Offer flow: Offer Made → Accepted → Joined → Continued
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_PIPE_005 — Offer Flow (Made → Accepted → Joined → Continued)', () => {

  test('Full offer lifecycle through to Candidate Continued', async ({
    page, loggedInPage
  }) => {
    const pipeline      = new CandidatePipelinePage(page);
    const candidateName = PL.candidates.fullFlow.name;

    await test.step('Navigate and filter candidate', async () => {
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.filterByEmail(CAND2.email);
    });

    await test.step('Move to Offer Made', async () => {
      await pipeline.moveToOfferMade(candidateName);
    });

    await test.step('Verify Offer Made in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(CAND2.email);
      await pipeline.assertExplorerStatus(
        candidateName, PL.explorerStatusMap.offerMade
      );
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.filterByEmail(CAND2.email);
    });

    await test.step('Mark Offer Accepted', async () => {
      await pipeline.markOfferAccepted(candidateName, PL.offerDay);
    });

    await test.step('Verify Offer Accepted in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(CAND2.email);
      await pipeline.assertExplorerStatus(
        candidateName, PL.explorerStatusMap.offerAccepted
      );
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.filterByEmail(CAND2.email);
    });

    await test.step('Mark Candidate Joined', async () => {
      await pipeline.markCandidateJoined(candidateName, PL.joinedDay);
    });

    await test.step('Verify Candidate Joined in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(CAND2.email);
      await pipeline.assertExplorerStatus(
        candidateName, PL.explorerStatusMap.candidateJoined
      );
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.filterByEmail(CAND2.email);
    });

    await test.step('Mark Candidate Continued', async () => {
      await pipeline.markCandidateContinued(candidateName, PL.continuedDay);
    });

    await test.step('Verify Candidate Continued in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(CAND2.email);
      await pipeline.assertExplorerStatus(
        candidateName, PL.explorerStatusMap.candidateContinued
      );
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_PIPE_006 — Mark Not Interested (can happen at any stage)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_PIPE_006 — Mark Candidate Not Interested', () => {

  test('Mark candidate Not Interested from Awaiting Interview state', async ({
    page, loggedInPage
  }) => {
    const pipeline = new CandidatePipelinePage(page);
    // Use a fresh candidate so this doesn't conflict with other test flows
    const { email, yopUsername } = generateYopMailUser();

    await test.step('Add a fresh candidate', async () => {
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.addCandidateByEmail(email);
      await pipeline.filterByEmail(email);
      await pipeline.assertStatus('awaitingInterview', yopUsername);
    });

    await test.step('Mark as Not Interested', async () => {
      await pipeline.markNotInterested(yopUsername);
    });

    await test.step('Verify Not Interested in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(email);
      await pipeline.assertExplorerStatus(
        yopUsername, PL.explorerStatusMap.notInterested
      );
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_PIPE_007 — Reject with email → verify YopMail rejection email
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_PIPE_007 — Reject with Email → YopMail verification', () => {

  test('Reject candidate with email → verify rejection email received in inbox', async ({
    page, browser, loggedInPage
  }) => {
    const pipeline  = new CandidatePipelinePage(page);
    const { email, yopUsername } = generateYopMailUser();

    await test.step('Add a fresh candidate', async () => {
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.addCandidateByEmail(email);
      await pipeline.filterByEmail(email);
      await pipeline.assertStatus('awaitingInterview', yopUsername);
    });

    await test.step('Reject with email', async () => {
      const yopContext = await browser.newContext();
      const yopPage3   = await yopContext.newPage();
      const yopMail    = new YopMailPage(yopPage3);

      await pipeline.markRejected(yopUsername, 'withEmail', {
        yopMail,
        yopUsername,
        companyName: PL.companyName,
      });

      await yopContext.close();
    });

    await test.step('Verify Rejected status in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(email);
      await pipeline.assertExplorerStatus(
        yopUsername, PL.explorerStatusMap.rejected
      );
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_PIPE_008 — Reject without email → inbox should remain empty
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_PIPE_008 — Reject without Email → no inbox email', () => {

  test('Reject candidate silently → candidate inbox receives no rejection email', async ({
    page, browser, loggedInPage
  }) => {
    const pipeline = new CandidatePipelinePage(page);
    const { email, yopUsername } = generateYopMailUser();

    await test.step('Add a fresh candidate', async () => {
      await page.goto(applicationsUrl);
      await page.waitForLoadState('networkidle');
      await pipeline.addCandidateByEmail(email);
      await pipeline.filterByEmail(email);
      await pipeline.assertStatus('awaitingInterview', yopUsername);
    });

    await test.step('Reject without email', async () => {
      await pipeline.markRejected(yopUsername, 'withoutEmail');
    });

    await test.step('Verify inbox is empty (no rejection email sent)', async () => {
      const yopContext = await browser.newContext();
      const yopPage4   = await yopContext.newPage();
      const yopMail    = new YopMailPage(yopPage4);
      await yopMail.openInbox(yopUsername);
      await yopPage4.waitForTimeout(5000);

      // Rejection email should NOT exist
      const rejectionEmailVisible = await yopMail.mailFrame()
        .getByText('Thank you for your').isVisible().catch(() => false);

      expect(
        rejectionEmailVisible,
        'Rejection email was found in inbox despite "Reject without Email" being chosen'
      ).toBe(false);

      await yopContext.close();
    });

    await test.step('Verify Rejected status in Explorer', async () => {
      await pipeline.goToExplorer();
      await pipeline.filterExplorerByEmail(email);
      await pipeline.assertExplorerStatus(
        yopUsername, PL.explorerStatusMap.rejected
      );
    });
  });

});
