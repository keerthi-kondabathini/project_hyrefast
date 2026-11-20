const { test, expect } = require('../../utils/authFixture');
const { CandidatesPage } = require('../../pages/CandidatesPage');
const { YopMailPage } = require('../../pages/YopMailPage');
const { generateYopMailUser } = require('../../utils/helpers');
const testData = require('../../data/testData.json');

const jobTitle = testData.candidates.jobTitle;

test.describe('TC_CAND_REM_001 — Daily reminder email after candidate application without interview', () => {
  test('Add candidate → verify reminder email is delivered every 24 hours if interview is not started', async ({
    page, browser, loggedInPage
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const user = await generateYopMailUser();
    const { email } = user;
    const timeouts = testData.timeouts;

    let candidatesUrl;

    await test.step(`Open candidates for "${jobTitle}" and add a new applicant`, async () => {
      await candidatesPage.searchAndOpenCandidates(jobTitle);
      await candidatesPage.assertApplicationsPageOpen(jobTitle);
      candidatesUrl = candidatesPage.getCandidatesPageUrl();
      await candidatesPage.addCandidatesByEmail([email], 'now');
    });

    await test.step(`Verify invite email is delivered to ${email}`, async () => {
      const yopContext = await browser.newContext();
      const yopPage = await yopContext.newPage();
      const yopMail = new YopMailPage(yopPage);

      await yopMail.openInbox(user);
      let found = false;

      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          await yopMail.assertInviteEmailVisible(jobTitle);
          found = true;
          break;
        } catch {
          await yopMail.refreshInbox();
          await yopPage.waitForTimeout(timeouts.emailDelivery);
        }
      }

      expect(found, `Invite email not found in ${email}`).toBe(true);
      await yopContext.close();
    });

    await test.step('Verify a daily reminder email is generated after the application is left unstarted', async () => {
      const yopContext = await browser.newContext();
      const yopPage = await yopContext.newPage();
      const yopMail = new YopMailPage(yopPage);

      await yopMail.openInbox(user);

      let reminderFound = false;
      for (let attempt = 1; attempt <= 6; attempt++) {
        try {
          await yopMail.assertDailyReminderEmailVisible(jobTitle);
          reminderFound = true;
          break;
        } catch {
          console.log(`Daily reminder not yet received for ${email} (attempt ${attempt})`);
          await yopMail.refreshInbox();
          await yopPage.waitForTimeout(Math.max(5000, timeouts.emailDelivery || 5000));
        }
      }

      expect(reminderFound, `Daily reminder email not found in ${email} after 6 attempts`).toBe(true);
      await yopMail.assertDailyReminderCtaVisible();
      await yopContext.close();
    });

    await test.step('Confirm the job applications page still loads for the candidate flow', async () => {
      await candidatesPage.navigateToUrl(candidatesUrl);
      await candidatesPage.assertApplicationsPageOpen(jobTitle);
    });
  });
});
