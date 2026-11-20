// spec: JD Creation - current upload workflow with rounds and prerequisites
// seed: tests/seed.spec.ts

const { test, expect } = require('../../utils/authFixture');
const path = require('path');
const { futureDateString } = require('../../utils/helpers');

test.describe('01JD Creation', () => {
  test('Upload JD, configure interview settings and prerequisites, then publish', async ({ page, loggedInPage, credentials }) => {
    const jobTitle = `JD Upload QA ${Date.now()}`;
    const jdFile = path.resolve(__dirname, '../../fixtures/jds/01_Cybersecurity_Analyst_JD.pdf');
    const prerequisiteQuestion = 'Describe one automated test suite you have built and the tools you used.';

    // 1. Verify the signed-in dashboard is visible.
    await test.step('Verify dashboard is loaded', async () => {
      await expect(page.getByRole('heading', { name: new RegExp(`Good (Morning|Afternoon|Evening), ${credentials.fullName}`) })).toBeVisible();
    });

    // 2. Open the current JD upload workflow.
    await test.step('Open Create Job and upload the JD document', async () => {
      await loggedInPage.clickCreateJob();
      await expect(page.getByRole('heading', { name: 'Upload Job Description' })).toBeVisible();
      await page.getByRole('heading', { name: 'Upload Job Description' }).click();
      await page.locator('input[type="file"]').first().setInputFiles(jdFile);
      await expect(page.getByText('Processed')).toBeVisible({ timeout: 120_000 });
    });

    // 3. Complete current required Job details and proceed.
    await test.step('Set title, work mode and work type', async () => {
      await page.getByRole('textbox', { name: 'e.g. Senior React Developer' }).fill(jobTitle);
      await page.getByRole('button', { name: 'Hybrid', exact: true }).click();
      await page.getByRole('button', { name: 'Full-time', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Continue to Skills →' })).toBeEnabled();
      await page.getByRole('button', { name: 'Continue to Skills →' }).click();
    });

    // 4. Wait for automatic Skills extraction and confirm the generated skills.
    await test.step('Confirm generated skills', async () => {
      const confirmSkills = page.getByRole('button', { name: 'Confirm Skills' });
      await expect(confirmSkills).toBeEnabled({ timeout: 240_000 });
      await confirmSkills.click();
      await expect(page.getByRole('heading', { name: 'Interview Rounds' })).toBeVisible();
    });

    // 5. Configure the screening round instead of taking the rounds bypass.
    await test.step('Open Bot Interview Configuration from the screening round', async () => {
      await page.getByRole('button', { name: 'Configure AI Interview' }).click();
      await expect(page.getByRole('heading', { name: 'Bot Interview Configuration' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Standard Approach' })).toBeVisible();
    });

    // 6. Review topics, generated questions and the Interview Settings page.
    await test.step('Complete AI interview configuration stages', async () => {
      const nextStage = page.getByRole('button', { name: 'Next Stage' });
      await nextStage.click();
      await expect(page.getByText('Topics to Focus')).toBeVisible();
      const offTopicInput = page.getByPlaceholder(/Avoid personal hobbies, unrelated technologies/);
      await expect(offTopicInput).toBeVisible();
      await nextStage.click();
      await expect(page.getByText('Decide Questions')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Regenerate Questions' })).toBeVisible();
      await nextStage.click();
      await expect(page.getByText('Platform & Security')).toBeVisible();

      const mobileInterviewSwitch = page.getByRole('switch').nth(0);
      const proctoringSwitch = page.getByRole('switch').nth(1);
      await expect(mobileInterviewSwitch).toBeVisible();
      await expect(proctoringSwitch).toBeVisible();
      if (await mobileInterviewSwitch.getAttribute('aria-checked') !== 'true') {
        await mobileInterviewSwitch.click();
      }
      if (await proctoringSwitch.getAttribute('aria-checked') !== 'true') {
        await proctoringSwitch.click();
      }
      await expect(mobileInterviewSwitch).toHaveAttribute('aria-checked', 'true');
      await expect(proctoringSwitch).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('button', { name: 'Next: Job Settings' }).click();
      await expect(page.getByRole('heading', { name: 'Publish & Job Settings' })).toBeVisible();
    });

    // 7. Configure and save one required prerequisite question.
    await test.step('Add prerequisite screening question', async () => {
      await page.getByRole('button', { name: 'Configure Prerequisites' }).click();
      await expect(page.getByRole('heading', { name: 'Prerequisite Questions', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Add First Question' }).click();
      await page.getByRole('textbox', { name: /Question text/ }).fill(prerequisiteQuestion);
      await expect(page.getByText('1 Question')).toBeVisible();
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect(page.getByText('1 Question')).toBeVisible();
    });

    // 8. Complete publication metadata and publish the job.
    await test.step('Publish the configured JD', async () => {
      await page.getByRole('textbox', { name: 'Enter GST...' }).fill('22AAAAA0000A1Z5');
      await page.getByPlaceholder('Enter Max Candidates...').fill('10');
      await page.locator('input[type="date"]').fill(futureDateString(30));
      await page.getByRole('button', { name: 'Publish Job' }).click();
    });

    // 9. Verify the job was published and appears on the dashboard.
    await test.step('Verify publish confirmation and the published job on the dashboard', async () => {
      await expect(page.getByRole('heading', { name: 'Job Published — Interview Links Ready' })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText('Published successfully')).toBeVisible();
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('link', { name: new RegExp(`${jobTitle}.*Published`, 'i') })).toBeVisible({ timeout: 30_000 });
    });
  });
});
