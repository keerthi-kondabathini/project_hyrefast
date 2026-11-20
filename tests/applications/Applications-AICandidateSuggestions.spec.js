// tests/applications/Applications-AICandidateSuggestions.spec.js
// ---------------------------------------------------------------------------
// Module 10 — Applications  |  AI Candidate Suggestions
//
//   TC_APP_010 — Open AI Candidate Suggestions panel from a job's
//   Applications page and verify it loads candidate recommendations.
//
//   Pre-condition:
//     A published job exists whose title matches testData.candidates.jobTitle
//     ('.net developer'). The authFixture handles login + logout per test.
// ---------------------------------------------------------------------------

const { test, expect } = require('../../utils/authFixture');
const { CandidatesPage } = require('../../pages/CandidatesPage');
const testData = require('../../data/testData.json');

// ═══════════════════════════════════════════════════════════════════════════
//  TC_APP_010 — AI Candidate Suggestions
// ═══════════════════════════════════════════════════════════════════════════
test.describe('TC_APP_010 — AI Candidate Suggestions', () => {

  async function openJobApplications(candidatesPage, jobTitle) {
    await candidatesPage.searchAndOpenCandidates(jobTitle);
    await candidatesPage.assertApplicationsPageOpen(jobTitle);
  }

  test('Open AI Candidate Suggestions panel → panel loads with suggestions', async ({
    page,
    loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const jobTitle = testData.candidates.jobTitle;

    await test.step(`Open Candidates view for "${jobTitle}"`, async () => {
      await openJobApplications(candidatesPage, jobTitle);
    });

    await test.step('Click AI Candidate Suggestions button', async () => {
      await candidatesPage.openAICandidateSuggestions();
    });

    await test.step('Verify suggestions panel is open', async () => {
      await candidatesPage.assertAICandidateSuggestionsPanelOpen();
    });

    await test.step('Wait for and verify at least one candidate suggestion', async () => {
      await expect.poll(async () => {
        return await candidatesPage.getAICandidateSuggestionCount();
      }, {
        timeout: 240_000,
        message: 'Expected at least one AI candidate suggestion to load within 4 minutes',
      }).toBeGreaterThan(0);
    });

    await test.step('Close suggestions panel', async () => {
      await candidatesPage.closeAICandidateSuggestionsPanel();
    });
  });

  test('Add first AI-suggested candidate → application count increases or Added tab reflects state', async ({
    page,
    loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const jobTitle = testData.candidates.jobTitle;

    await test.step(`Open Candidates view for "${jobTitle}"`, async () => {
      await openJobApplications(candidatesPage, jobTitle);
    });

    const initialCount = await candidatesPage.getCandidateCount();

    await test.step('Open AI Candidate Suggestions panel', async () => {
      await candidatesPage.openAICandidateSuggestions();
      await candidatesPage.assertAICandidateSuggestionsPanelOpen();
    });

    await test.step('Wait for suggestions to load', async () => {
      await expect.poll(async () => {
        return await candidatesPage.getAICandidateSuggestionCount();
      }, {
        timeout: 240_000,
        message: 'Expected AI candidate suggestions to load within 4 minutes',
      }).toBeGreaterThan(0);
    });

    await test.step('Switch to New tab and add a candidate if available', async () => {
      await candidatesPage.aiSuggestionsTab('New').click();
      await page.waitForTimeout(2000);

      const newCount = await candidatesPage.getAICandidateSuggestionCount();
      if (newCount > 0) {
        await candidatesPage.addFirstAICandidateSuggestion();
        await expect(candidatesPage.aiAddedBadge.first()).toBeVisible({ timeout: 30_000 });

        await expect.poll(async () => {
          return await candidatesPage.getCandidateCount();
        }, {
          timeout: 180_000,
          message: 'Expected candidate count to increase by 1 within 3 minutes',
        }).toBe(initialCount + 1);
      } else {
        // All suggestions already added — verify Added tab shows them
        await candidatesPage.aiSuggestionsTab('Added').click();
        await page.waitForTimeout(2000);
        const addedCount = await candidatesPage.getAICandidateSuggestionCount();
        expect(addedCount, 'Expected Added tab to show previously added suggestions').toBeGreaterThan(0);
      }
    });
  });
});
