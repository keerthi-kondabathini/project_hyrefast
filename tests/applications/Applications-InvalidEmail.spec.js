// tests/applications/Applications-InvalidEmail.spec.js
// ---------------------------------------------------------------------------
// Module 10 — Applications  |  Email-validation + duplicate scenarios
//
//   🔴 Covered here:
//        TC_APP_001 — Invalid email → error message shown, no candidate created
//        TC_APP_002 — Duplicate email → candidate made inactive (count unchanged)
//
// Pre-condition: a published job matching testData.candidates.jobTitle exists.
// ---------------------------------------------------------------------------

const { test, expect }       = require('../../utils/authFixture');
const { CandidatesPage }     = require('../../pages/CandidatesPage');
const { generateYopMailUser } = require('../../utils/helpers');
const testData               = require('../../data/testData.json');

// ─── helpers ─────────────────────────────────────────────────────────────

/** Opens the Candidates view and returns { url, initialCount, jobTitle }. */
async function openCandidates(candidatesPage) {
  const jobTitle = testData.candidates.jobTitle;
  await test.step(`Open Candidates view for "${jobTitle}"`, async () => {
    await candidatesPage.searchAndOpenCandidates(jobTitle);
    await candidatesPage.assertApplicationsPageOpen(jobTitle);
  });
  const url = candidatesPage.getCandidatesPageUrl();
  const initialCount = await candidatesPage.getCandidateCount();
  return { url, initialCount, jobTitle };
}

// ══════════════════════════════════════════════════════════════════════════
//  TC_APP_001 — Invalid email
//  Expectation: the app shows an error / validation message and does NOT
//  create a candidate.  We assert the count is unchanged and capture any
//  error text the UI displays.
// ══════════════════════════════════════════════════════════════════════════
test.describe('TC_APP_001 — Add candidate with invalid email', () => {

  test('Enter malformed email → error shown → count unchanged', async ({
    page, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const { url, initialCount, jobTitle } = await openCandidates(candidatesPage);

    // Malformed emails that should be rejected
    const invalidEmails = [
      'not-an-email',
      'missing-at-sign.com',
      '@missing-local.com',
      ' spaces @domain.com ',
      'incomplete@',
    ];

    for (const badEmail of invalidEmails) {
      await test.step(`Try invalid email "${badEmail}"`, async () => {
        await candidatesPage.addCandidatesBtn.click();
        await candidatesPage.emailTab.click();
        await candidatesPage.fillInput(candidatesPage.emailInput, badEmail);
        await candidatesPage.addCandidateCountBtn(1).click();
        await candidatesPage.page.waitForTimeout(1500);

        // If the UI shows an error message, capture it.
        const msg = await candidatesPage.getErrorMessage(6_000);
        if (msg) {
          console.log(`Invalid email "${badEmail}" → UI message: "${msg}"`);
        }

        // Regardless of whether a message is shown, the count must not
        // have increased (no candidate should be created from a bad email).
        await candidatesPage.navigateToUrl(url);
        const count = await candidatesPage.getCandidateCount();
        expect(count).toBe(initialCount,
          `Count should stay ${initialCount} after invalid email "${badEmail}" but was ${count}`);
      });
    }
  });

  test('Enter email with invalid domain → error or no-creation', async ({
    page, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const { url, initialCount } = await openCandidates(candidatesPage);

    await test.step('Try email with nonsense TLD', async () => {
      await candidatesPage.addCandidatesBtn.click();
      await candidatesPage.emailTab.click();
      await candidatesPage.fillInput(candidatesPage.emailInput, 'user@not-a-real-tld.xyz');
      await candidatesPage.addCandidateCountBtn(1).click();
      await candidatesPage.page.waitForTimeout(1500);

      const msg = await candidatesPage.getErrorMessage(6_000);
      if (msg) console.log(`Invalid-domain email → UI message: "${msg}"`);

      await candidatesPage.navigateToUrl(url);
      const count = await candidatesPage.getCandidateCount();
      expect(count).toBe(initialCount,
        'Count should not increase for invalid-domain email');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  TC_APP_002 — Duplicate candidate
//  Business rule (from the team): when a resume is parsed and the extracted
//  email + mobile already exist, the application is made INACTIVE — no error
//  is thrown.  We verify that re-adding an already-added email does not
//  increase the visible count.
//
//  Approach:
//    1. Add a fresh YopMail email as a candidate (send now).
//    2. Re-add the SAME email.
//    3. Assert count did not increase (duplicate made inactive / not recreated).
// ══════════════════════════════════════════════════════════════════════════
test.describe('TC_APP_002 — Add duplicate candidate (same email twice)', () => {

  test('Add candidate → re-add same email → count unchanged (inactive)', async ({
    page, browser, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const { url, initialCount, jobTitle } = await openCandidates(candidatesPage);

    // ── 1. Add a fresh candidate once ────────────────────────────────
    const user  = await generateYopMailUser('dup');
    const email = user.email;

    await test.step(`Add candidate "${email}" (first time, send now)`, async () => {
      await candidatesPage.addCandidatesByEmail([email], 'now');
    });

    // Give the app a moment to process
    await candidatesPage.page.waitForTimeout(3000);

    // Verify the first add succeeded
    await test.step('Verify count increased by 1 after first add', async () => {
      await candidatesPage.navigateToUrl(url);
      await candidatesPage.assertCandidateCount(initialCount + 1);
    });

    // ── 2. Re-add the SAME email ─────────────────────────────────────
    const afterFirstAdd = initialCount + 1;

    await test.step(`Re-add the same email "${email}" (duplicate)`, async () => {
      await candidatesPage.addCandidatesByEmail([email], 'now');
    });

    await candidatesPage.page.waitForTimeout(3000);

    // ── 3. Assert count did NOT increase (duplicate made inactive) ────
    await test.step('Verify count unchanged after duplicate add', async () => {
      await candidatesPage.navigateToUrl(url);
      const finalCount = await candidatesPage.getCandidateCount();
      expect(finalCount).toBe(afterFirstAdd,
        `Expected count to stay ${afterFirstAdd} after duplicate add, but got ${finalCount}`);
    });

    // Also capture any UI message for the record
    await test.step('Capture any UI message on duplicate', async () => {
      const msg = await candidatesPage.getErrorMessage(6_000);
      console.log(`Duplicate email "${email}" → UI message: "${msg || '(none)'}"`);
    });
  });

  test('Add candidate via resume → re-add same email → count unchanged', async ({
    page, browser, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const { url, initialCount } = await openCandidates(candidatesPage);
    const resumePath = require('path').resolve(__dirname, '../../',
      testData.candidates.resumeFile);

    // ── 1. Add candidate via resume (the resume contains a known email) ─
    await test.step('Add candidate via resume upload (first time)', async () => {
      await candidatesPage.addCandidateByResume(resumePath, 'now');
    });

    await candidatesPage.page.waitForTimeout(4000);

    await test.step('Verify count increased by 1 after resume upload', async () => {
      await candidatesPage.navigateToUrl(url);
      await candidatesPage.assertCandidateCount(initialCount + 1);
    });

    const afterFirstAdd = initialCount + 1;

    // ── 2. Re-add the same resume ────────────────────────────────────
    await test.step('Re-upload the same resume (duplicate)', async () => {
      await candidatesPage.addCandidateByResume(resumePath, 'now');
    });

    await candidatesPage.page.waitForTimeout(4000);

    // ── 3. Assert count unchanged ─────────────────────────────────────
    await test.step('Verify count unchanged after duplicate resume', async () => {
      await candidatesPage.navigateToUrl(url);
      const finalCount = await candidatesPage.getCandidateCount();
      expect(finalCount).toBe(afterFirstAdd,
        `Expected count to stay ${afterFirstAdd} after duplicate resume, but got ${finalCount}`);
    });
  });
});
