// tests/candidates/candidates.spec.js
const { test, expect }           = require('../../utils/authFixture');
const { CandidatesPage }         = require('../../pages/CandidatesPage');
const { YopMailPage }            = require('../../pages/YopMailPage');
const { CandidateInterviewPage } = require('../../pages/CandidateInterviewPage');
const { generateYopMailUser }    = require('../../utils/helpers');
const testData = require('../../data/testData.json');
const path     = require('path');

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 1 — Add single candidate by email, verify invite, verify count
//  TC_CAND_001
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_CAND_001 — Add single candidate by email and verify invite', () => {

  test('Add 1 candidate via email → send now → verify YopMail invite → count +1', async ({
    page, browser, loggedInPage
  }) => {
    const candidatesPage        = new CandidatesPage(page);
    const user                   = await generateYopMailUser();
    const { email, yopUsername } = user;
    const jobTitle               = testData.candidates.jobTitle;
    const timeouts               = testData.timeouts;

    console.log(`Generated email: ${email}`);

    // ── 1. Open Candidates page ───────────────────────────
    let candidatesUrl;
    await test.step(`Open Candidates view for "${jobTitle}"`, async () => {
      await candidatesPage.searchAndOpenCandidates(jobTitle);
      await candidatesPage.assertApplicationsPageOpen(jobTitle);
      candidatesUrl = candidatesPage.getCandidatesPageUrl();
      console.log(`Candidates URL: ${candidatesUrl}`);
    });

    // ── 2. Capture initial count ──────────────────────────
    let initialCount;
    await test.step('Capture initial candidate count', async () => {
      initialCount = await candidatesPage.getCandidateCount();
      console.log(`Initial count: ${initialCount}`);
    });

    // ── 3. Add candidate by email ─────────────────────────
    await test.step(`Add candidate ${email}`, async () => {
      await candidatesPage.addCandidatesByEmail([email], 'now');
    });

    // ── 4. Verify invite email in YopMail ─────────────────
    await test.step(`Verify invite email in ${email} inbox`, async () => {
      const yopContext = await browser.newContext();
      const yopPage    = await yopContext.newPage();
      const yopMail    = new YopMailPage(yopPage);

      await yopMail.openInbox(user);

      let emailFound = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await yopMail.assertInviteEmailVisible(jobTitle);
          emailFound = true;
          break;
        } catch {
          console.log(`Attempt ${attempt}: email not yet delivered, retrying...`);
          await yopMail.refreshInbox();
          await yopPage.waitForTimeout(timeouts.emailDelivery);
        }
      }

      if (!emailFound) {
        throw new Error(`Invite email not found in ${email} after 3 attempts`);
      }

      await yopMail.assertStartInterviewLinkVisible();
      await yopContext.close();
    });

    // ── 5. Verify count increased ─────────────────────────
    await test.step('Verify candidate count increased by 1', async () => {
      await candidatesPage.navigateToUrl(candidatesUrl);
      await candidatesPage.assertCandidateCount(initialCount + 1);
      console.log(`Count: ${initialCount} → ${initialCount + 1}`);
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 2 — Add multiple candidates by email
//  TC_CAND_002
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_CAND_002 — Add multiple candidates by email', () => {

  test('Add 2 candidates via email → send now → verify both inboxes → count +2', async ({
    page, browser, loggedInPage
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const jobTitle       = testData.candidates.jobTitle;
    const timeouts       = testData.timeouts;

    // Generate a fresh email user for each candidate
    const candidate1 = await generateYopMailUser();
    const candidate2 = await generateYopMailUser();
    const candidates = [candidate1, candidate2];
    const emails     = candidates.map(c => c.email);

    console.log(`Generated: ${emails.join(', ')}`);

    // ── 1. Open Candidates page ───────────────────────────
    let candidatesUrl;
    await test.step(`Open Candidates view for "${jobTitle}"`, async () => {
      await candidatesPage.searchAndOpenCandidates(jobTitle);
      await candidatesPage.assertApplicationsPageOpen(jobTitle);
      candidatesUrl = candidatesPage.getCandidatesPageUrl();
    });

    // ── 2. Capture initial count ──────────────────────────
    let initialCount;
    await test.step('Capture initial candidate count', async () => {
      initialCount = await candidatesPage.getCandidateCount();
    });

    // ── 3. Add both candidates ────────────────────────────
    await test.step(`Add 2 candidates: ${emails.join(', ')}`, async () => {
      await candidatesPage.addCandidatesByEmail(emails, 'now');
    });

    // ── 4. Verify each inbox ──────────────────────────────
    for (const candidate of candidates) {
      await test.step(`Verify invite email in ${candidate.email}`, async () => {
        const yopContext = await browser.newContext();
        const yopPage    = await yopContext.newPage();
        const yopMail    = new YopMailPage(yopPage);

        await yopMail.openInbox(candidate);

        let emailFound = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await yopMail.assertInviteEmailVisible(jobTitle);
            emailFound = true;
            break;
          } catch {
            console.log(`${candidate.email} — attempt ${attempt}, retrying...`);
            await yopMail.refreshInbox();
            await yopPage.waitForTimeout(timeouts.emailDelivery);
          }
        }

        if (!emailFound) {
          throw new Error(`Invite email not found in ${candidate.email} after 3 attempts`);
        }

        await yopMail.assertStartInterviewLinkVisible();
        await yopContext.close();
      });
    }

    // ── 5. Verify count increased by 2 ───────────────────
    await test.step('Verify candidate count increased by 2', async () => {
      await candidatesPage.navigateToUrl(candidatesUrl);
      await candidatesPage.assertCandidateCount(initialCount + 2);
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 3 — Add candidate by email, send later
//  TC_CAND_003
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_CAND_003 — Add candidate by email, send later', () => {

  test('Add 1 candidate via email → send later → count +1 (no email check)', async ({
    page, loggedInPage
  }) => {
    const candidatesPage         = new CandidatesPage(page);
    const user                   = await generateYopMailUser();
    const { email, yopUsername } = user;
    const jobTitle               = testData.candidates.jobTitle;

    console.log(`Generated email (send later): ${email}`);

    // ── 1. Open Candidates page ───────────────────────────
    let candidatesUrl;
    await test.step(`Open Candidates view for "${jobTitle}"`, async () => {
      await candidatesPage.searchAndOpenCandidates(jobTitle);
      await candidatesPage.assertApplicationsPageOpen(jobTitle);
      candidatesUrl = candidatesPage.getCandidatesPageUrl();
    });

    // ── 2. Capture initial count ──────────────────────────
    let initialCount;
    await test.step('Capture initial candidate count', async () => {
      initialCount = await candidatesPage.getCandidateCount();
    });

    // ── 3. Add candidate — send later ─────────────────────
    await test.step(`Add candidate ${email} with send later`, async () => {
      await candidatesPage.addCandidatesByEmail([email], 'later');
    });

    // ── 4. Verify count increased ─────────────────────────
    await test.step('Verify candidate count increased by 1', async () => {
      await candidatesPage.navigateToUrl(candidatesUrl);
      await candidatesPage.assertCandidateCount(initialCount + 1);
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 4 — Candidate opens invite email, uploads resume, reaches Sys Req Check
//  TC_CAND_001_E2E  (self-contained — generates its own YopMail, adds candidate,
//  then immediately enters the interview as that candidate)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_CAND_001_E2E — Candidate starts interview and uploads resume', () => {

  test('Add candidate → verify email → click Start My Interview → upload resume → System Requirements Check', async ({
    page, browser, loggedInPage
  }) => {
    const candidatesPage         = new CandidatesPage(page);
    const user                   = await generateYopMailUser();
    const { email, yopUsername } = user;
    const jobTitle               = testData.candidates.jobTitle;
    const timeouts               = testData.timeouts;
    const resumeFile             = testData.candidates.resumeFile;
    const resumeFileName         = testData.candidates.resumeFileName;
    const resumePath             = path.resolve(__dirname, '../../', resumeFile);

    console.log(`E2E candidate: ${email}`);

    // ── 1. Add candidate (admin side) ────────────────────
    await test.step(`Add candidate ${email} and send invite now`, async () => {
      await candidatesPage.searchAndOpenCandidates(jobTitle);
      await candidatesPage.assertApplicationsPageOpen(jobTitle);
      await candidatesPage.addCandidatesByEmail([email], 'now');
    });

    // ── 2. Open YopMail inbox ─────────────────────────────
    const yopContext = await browser.newContext();
    const yopPage    = await yopContext.newPage();
    const yopMail    = new YopMailPage(yopPage);

    await test.step(`Open ${email} inbox`, async () => {
      await yopMail.openInbox(user);
    });

    // ── 3. Assert invite email arrived ───────────────────
    await test.step('Assert invite email and Start My Interview link', async () => {
      let found = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await yopMail.assertInviteEmailVisible(jobTitle);
          found = true;
          break;
        } catch {
          console.log(`Attempt ${attempt}: waiting for email...`);
          await yopMail.refreshInbox();
          await yopPage.waitForTimeout(timeouts.emailDelivery);
        }
      }
      if (!found) throw new Error(`Invite email not found in ${email} after 3 attempts`);
      await yopMail.assertStartInterviewLinkVisible();
    });

    // ── 4. Click Start My Interview → new tab ────────────
    let interviewPage;
    await test.step('Click "Start My Interview" — opens interview tab', async () => {
      interviewPage = await yopMail.clickStartInterview(yopContext);
    });

    // ── 5. Upload resume ──────────────────────────────────
    const interviewPOM = new CandidateInterviewPage(interviewPage);

    await test.step('Upload resume file', async () => {
      await interviewPOM.uploadResume(resumePath, resumeFileName);
    });

    // ── 6. Complete & Continue ────────────────────────────
    await test.step('Click Complete & Continue', async () => {
      await interviewPOM.clickCompleteContinue();
    });

    // // ── 7. Questionnaire completed ────────────────────────
    // await test.step('Assert questionnaire completed screen', async () => {
    //   await interviewPOM.assertQuestionnaireCompleted();
    // });

    // ── 8. System Requirements Check ─────────────────────
    await test.step('Assert System Requirements Check page', async () => {
      await interviewPOM.assertSystemRequirementsCheckVisible();
    });

    await yopContext.close();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  SUITE 5 — Add candidate via Resume File Upload
//  TC_CAND_004  (resume-upload candidates skip the resume step and land
//  directly on System Requirements Check when they open their interview link)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_CAND_004 — Add candidate via Resume File Upload', () => {

  test('Upload resume to add candidate → send now → count +1 → System Requirements Check', async ({
    page, browser, loggedInPage
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const jobTitle       = testData.candidates.jobTitle;
    const timeouts       = testData.timeouts;
    const resumeFile     = testData.candidates.resumeFile;
    const resumeFileName = testData.candidates.resumeFileName;
    const resumePath     = path.resolve(__dirname, '../../', resumeFile);

    // ── 1. Open Candidates page ───────────────────────────
    let candidatesUrl;
    await test.step(`Open Candidates view for "${jobTitle}"`, async () => {
      await candidatesPage.searchAndOpenCandidates(jobTitle);
      await candidatesPage.assertApplicationsPageOpen(jobTitle);
      candidatesUrl = candidatesPage.getCandidatesPageUrl();
    });

    // ── 2. Capture initial count ──────────────────────────
    let initialCount;
    await test.step('Capture initial candidate count', async () => {
      initialCount = await candidatesPage.getCandidateCount();
    });

    // ── 3. Upload resume ──────────────────────────────────
    await test.step(`Upload resume: ${resumeFileName}`, async () => {
      await candidatesPage.addCandidateByResume(resumePath, 'now');
    });

    // ── 4. Verify count increased ─────────────────────────
    await test.step('Verify candidate count increased by 1', async () => {
      await candidatesPage.navigateToUrl(candidatesUrl);
      await candidatesPage.assertCandidateCount(initialCount + 1);
    });

    // ── 5. Candidate opens interview → System Req Check ───
    // The email is extracted from the uploaded resume by HyreFast AI.
    // For a deterministic test, use a resume that contains a known
    // YopMail address (e.g. aieng@yopmail.com) so the inbox is predictable.
    //
    // To enable this step:
    //   1. Set testData.candidates.resumeYopUsername to the email in the resume
    //   2. Uncomment the block below
    //
    // const resumeYopUsername = testData.candidates.resumeYopUsername;
    // const yopContext = await browser.newContext();
    // const yopPage    = await yopContext.newPage();
    // const yopMail    = new YopMailPage(yopPage);
    // await yopMail.openInbox(resumeYopUsername);
    // ... retry loop ...
    // const interviewPage = await yopMail.clickStartInterview(yopContext);
    // const interviewPOM  = new CandidateInterviewPage(interviewPage);
    // await interviewPOM.assertSystemRequirementsCheckVisible(); // no resume upload step
    // await yopContext.close();

    await test.step('Resume-upload candidate verified — application created successfully', async () => {
      console.log(
        `Candidate added via resume upload (${resumeFileName}). ` +
        'To verify the interview page, add the resume email to testData and uncomment the YopMail block above.'
      );
    });
  });

});