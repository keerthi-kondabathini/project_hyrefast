// spec: JD Creation - current UI flow
// seed: tests/seed.spec.ts

const { test, expect } = require('../../utils/authFixture');
const { futureDateString } = require('../../utils/helpers');

test.describe('JD Creation', () => {
  test('Create and publish a job using the current JD wizard', async ({ page, loggedInPage, credentials }) => {
    const jobTitle = `QA Automation Engineer ${Date.now()}`;

    // 1. Sign in to the staging app with the configured test account and verify the dashboard is loaded.
    await test.step('Verify signed-in dashboard is loaded', async () => {
      await expect(page.getByRole('heading', { name: new RegExp(`Good (Morning|Afternoon|Evening), ${credentials.fullName}`) })).toBeVisible();
    });

    // 2. Click Create Job and verify the current job creation wizard opens.
    await test.step('Open the current Create Job wizard', async () => {
      await loggedInPage.clickCreateJob();
      await expect(page.getByRole('heading', { name: 'Upload Job Description' })).toBeVisible();
    });

    // 3. Choose role-title generation and complete the required job details.
    await test.step('Enter role title and complete required job details', async () => {
      await page.getByRole('button', { name: 'Generate from Role Title instead' }).click();
      await page.getByRole('textbox', { name: 'e.g. Senior Frontend Engineer' }).fill(jobTitle);
      await page.getByRole('textbox', { name: 'e.g. Senior React Developer' }).fill(jobTitle);

      const locationInput = page.getByRole('textbox', { name: /Remote, City, or Country/ });
      await locationInput.fill('Hyderabad');
      await page.getByRole('button', { name: 'Hyderabad, Telangana, India', exact: true }).click();

      await page.getByRole('button', { name: 'Hybrid', exact: true }).click();
      await page.getByRole('button', { name: 'Full-time', exact: true }).click();

      const maxExperience = page.getByRole('slider', { name: 'Maximum' }).first();
      await maxExperience.focus();
      await maxExperience.press('ArrowRight');

      await page.getByRole('button', { name: 'Add', exact: true }).first().click();
      await page.getByRole('combobox').last().click();
      await page.getByRole('option', { name: "Bachelor's" }).click();
      await expect(page.getByRole('button', { name: 'Continue to Skills →' })).toBeEnabled();
    });

    // 4. Continue to Skills and wait for AI skill extraction to finish.
    await test.step('Continue to Skills and wait for generated skills', async () => {
      await page.getByRole('button', { name: 'Continue to Skills →' }).click();
      const confirmSkillsButton = page.getByRole('button', { name: 'Confirm Skills' });
      await expect(confirmSkillsButton).toBeEnabled({ timeout: 240_000 });
    });

    // 5. Confirm generated skills.
    await test.step('Accept the generated skills', async () => {
      await page.getByRole('button', { name: 'Confirm Skills' }).click();
      await expect(page.getByRole('heading', { name: 'Interview Rounds' })).toBeVisible();
    });

    // 6. Continue through default rounds and defer AI interview question setup.
    await test.step('Continue through rounds and defer question setup', async () => {
      await page.getByRole('button', { name: 'Continue to Job Settings' }).click();
      const deferSetupButton = page.getByRole('button', { name: 'Set Up Later & Continue' });
      if (await deferSetupButton.isVisible()) {
        await deferSetupButton.click();
      }
      await expect(page.getByRole('heading', { name: 'Publish & Job Settings' })).toBeVisible();
    });

    // 7. Complete current publishing settings and publish the job.
    await test.step('Complete required settings and publish the job', async () => {
      await page.getByRole('textbox', { name: 'Enter GST...' }).fill('22AAAAA0000A1Z5');
      await page.getByPlaceholder('Enter Max Candidates...').fill('10');
      await page.locator('input[type="date"]').fill(futureDateString(30));
      await page.getByRole('button', { name: 'Publish Job' }).click();
    });

    // 8. Verify publish confirmation and that the new job is listed as Published.
    await test.step('Verify publish success and the published job on the dashboard', async () => {
      await expect(page.getByRole('heading', { name: 'Job Published — Interview Links Ready' })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText('Published successfully')).toBeVisible();
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('link', { name: new RegExp(`${jobTitle}.*Published`, 'i') })).toBeVisible({ timeout: 30_000 });
    });
  });
});