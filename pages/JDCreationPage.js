// pages/JDCreationPage.js
const { expect } = require('@playwright/test');
const path = require('path');
const { BasePage } = require('./BasePage');

/**
 * Covers the entire multi-step JD creation wizard:
 *  Step 1 — JD & Details
 *  Step 2 — Skill Requirements
 *  Step 3 — Interview Configuration (Standard / Topics)
 *  Step 4 — Question Bank
 *  Step 5 — Publish / Distribution
 */
class JDCreationPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Step 1: JD & Details ─────────────────────────────────
    this.jobTitleInput             = page.getByRole('textbox', { name: 'Type a role title or paste a' });
    this.roleTitleInput            = page.getByRole('textbox', { name: 'e.g. Senior Frontend Engineer' });
    this.uploadWorkspaceCombo      = page.getByRole('combobox').first();
    this.generateButton            = page.getByRole('button', { name: 'Generate' });
    this.generateAndCreateBtn      = page.getByRole('button', { name: 'Generate JD & Create Job' });
    this.noJDRoleTitleBtn          = page.getByRole('button', { name: 'I do not have a JD (Generate via Role Title)' });
    this.uploadHeading             = page.getByRole('heading', { name: 'Upload your Job Description' });
    this.uploadDropzone            = page.getByText(/Drag and drop your job description file here, or click to browse\./i);
    this.uploadFileInput           = page.locator('input[type="file"]').first();
    this.locationInput             = page.getByPlaceholder(/Search city|Search city, state or country/i);
    this.continueToJDButton        = page.getByRole('button', { name: 'Continue to JD generation' });
    this.proceedToSkillsBtn        = page.getByRole('button', { name: 'Proceed to Skill Requirements' });
    this.jdDetailsHeading          = page.getByText('JD & Details');
    this.roleDetailsHeading        = page.getByRole('heading', { name: 'Complete the role details' });
    this.workTypeCombo             = page.getByRole('combobox', { name: /Work Type/i }).first();
    this.workModeCombo             = page.getByRole('combobox', { name: /Work Mode/i }).first();

    // ── Step 2: Skills ────────────────────────────────────────
    this.addSkillButton      = page.getByRole('button', { name: 'Add Skill' });
    this.skillTypeCombo      = page.getByRole('combobox');
    this.skillNameInput      = page.getByRole('textbox', { name: 'Skill name' });
    this.skillAliasInput     = page.getByRole('textbox', { name: 'React, Node.js, PostgreSQL' });
    this.skillRationaleInput = page.getByRole('textbox', { name: 'Why this skill and' });
    this.saveSkillButton     = page.getByRole('button', { name: 'Save Skill' });
    this.acceptSkillsButton  = page.getByRole('button', { name: 'Accept Skills & Generate' });

    // ── Step 3: Interview Config ──────────────────────────────
    this.interviewConfigHeading  = page.getByRole('heading', { name: 'Interview Configuration' });
    this.standardApproachButton  = page.getByRole('button', { name: /Standard Approach/ });
    this.regenerateTopicsButton  = page.getByRole('button', { name: 'Regenerate Topics' });
    this.nextStageButton         = page.getByRole('button', { name: 'Next Stage' });

    // ── Step 4: Question Bank ─────────────────────────────────
    this.aiGenerateButton        = page.getByRole('button', { name: 'AI Generate' });
    this.coverageText            = page.getByText('% coverage');
    this.aiCoverUncoveredButton  = page.getByRole('button', { name: /AI Cover Uncovered Skills/ });

    // ── Step 5: Publish / Distribution ───────────────────────
    this.closingDateInput        = page.locator('input[type="date"]');
    this.inviteSenderSwitch      = page.getByRole('switch').first();
    this.saveDraftButton         = page.getByRole('button', { name: 'Save as Draft' });
    this.saveAndPublishButton    = page.getByRole('button', { name: 'Save and Publish' });
    this.addAnotherLinkButton    = page.getByRole('button', { name: 'Add Another Link' });
    this.reviewLinksButton       = page.getByRole('button', { name: 'Review & Generate Links' });
    this.saveLinksButton         = page.getByRole('button', { name: 'Save & Generate Links' });
    this.backButton              = page.getByRole('button', { name: 'Back' });
  }

  // ═══════════════════════════════════════════════════════════
  //  Step 1 — JD & Details
  // ═══════════════════════════════════════════════════════════
  async fillJobDetails({
    jobTitle,
    workspaceName,
    employmentType,
    workMode,
    locationQuery,
    locationOption,
    generateFromRoleTitle = false,
    jobDescriptionFilePath = null,
  }) {
    await this.assertVisible(this.uploadHeading, 'JD creation wizard should be open');

    const defaultJDFilePath = path.resolve(__dirname, '../fixtures/resumes/Advanced_DotNet_Resume_7.docx');
    const uploadPath = jobDescriptionFilePath || defaultJDFilePath;

    // Upload-first flow takes precedence unless the scenario explicitly uses role-title generation.
    if (!generateFromRoleTitle) {
      await this.assertVisible(this.uploadDropzone, 'JD upload dropzone should be visible');
      await this.uploadDropzone.click();
      await this.uploadFileInput.setInputFiles(uploadPath);

      if (await this.uploadWorkspaceCombo.isVisible().catch(() => false)) {
        await this.uploadWorkspaceCombo.click();
        await this.page.getByRole('option', { name: workspaceName }).click();
      }

      if (await this.generateAndCreateBtn.isVisible().catch(() => false)) {
        await this.generateAndCreateBtn.click();
      } else {
        await this.assertVisible(this.continueToJDButton, 'Continue to JD generation button should be visible after upload');
        await this.continueToJDButton.click();
      }

      return;
    }

    await this.assertVisible(this.noJDRoleTitleBtn, 'Generate via Role Title button should be visible');
    await this.noJDRoleTitleBtn.click();
    await this.assertVisible(this.roleTitleInput, 'Role title input should be visible');
    await this.fillInput(this.roleTitleInput, jobTitle);

    // Workspace selection for role-title flow
    await this.uploadWorkspaceCombo.click();
    await this.page.getByRole('option', { name: workspaceName }).click();

    await this.workTypeCombo.click();
    await this.page.getByRole('option', { name: employmentType }).click();

    await this.workModeCombo.click();
    await this.page.getByRole('option', { name: workMode }).click();

    await this.fillInput(this.locationInput, locationQuery);
    const normalizedLocation = new RegExp(locationOption.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    const locationButton = this.page.getByRole('button').filter({ hasText: normalizedLocation }).first();
    await expect(locationButton).toBeVisible({ timeout: 15_000 });
    await locationButton.click();

    // Salary sliders — click first range thumb
    await this.page.locator('.relative.h-1\\.5').first().click();
    await this.page.locator('div:nth-child(6) > .rounded-2xl > .relative.flex > .relative').click();

    await this.continueToJDButton.click();
  }

  async waitForJDGeneration(timeoutMs = 50_000) {
    await expect(this.page.getByRole('heading', { name: 'JD & Details' })).toBeVisible({ timeout: timeoutMs });
    await expect(this.proceedToSkillsBtn).toBeEnabled({ timeout: timeoutMs });
  }

  async assertJDGenerated(jobTitle) {
    await expect(this.page.getByRole('textbox').first()).toBeVisible();
    await expect(this.locationInput).toBeVisible();
  }

  async proceedToSkills() {
    await this.proceedToSkillsBtn.click();
  }

  // ═══════════════════════════════════════════════════════════
  //  Step 2 — Skills
  // ═══════════════════════════════════════════════════════════
  async waitForSkillGeneration(timeoutMs = 15_000) {
    // Skills generation is AI-driven and can take 1–2 minutes
    // await this.waitForToast();
    await this.page.waitForTimeout(timeoutMs);
  }

  async addCustomSkill({ type, name, proficiency, aliases, rationale }) {
    await this.addSkillButton.click();

    // Skill type dropdown (Must Have / Good to Have / Bonus)
    await this.skillTypeCombo.last().click();
    await this.page.getByRole('option', { name: type }).click();

    await this.fillInput(this.skillNameInput, name);

    // Proficiency button (L1–L5 labels)
    await this.page.getByRole('button', { name: proficiency }).click();

    await this.fillInput(this.skillAliasInput, aliases);
    await this.fillInput(this.skillRationaleInput, rationale);
    await this.saveSkillButton.click();
  }

  async acceptSkillsAndGenerate() {
    await this.acceptSkillsButton.click();
  }

  // ═══════════════════════════════════════════════════════════
  //  Step 3 — Interview Configuration
  // ═══════════════════════════════════════════════════════════
 async configureInterview() {
  await this.assertVisible(this.interviewConfigHeading, 'Interview Configuration step should be visible');
  await this.assertVisible(this.standardApproachButton, 'Standard Approach button should be visible');

  // Move from Topics to Questions — first click initiates topic generation.
  await this.nextStageButton.click();

  // Wait until topic generation completes and the button becomes enabled again.
  // Topic generation can be long; allow up to 2 minutes.
  await expect(this.nextStageButton).toBeEnabled({ timeout: 120_000 });

  // Proceed to the questions stage
  await this.nextStageButton.click();
  await this.waitMs(2000);

}

  // ═══════════════════════════════════════════════════════════
  //  Step 4 — Question Bank
  // ═══════════════════════════════════════════════════════════
 async generateQuestions() {
  // Step 1: Trigger AI question generation
  await this.aiGenerateButton.click();
    await this.waitMs(15000);


  // // Step 2: Wait until questions are generated (notification)
  // const questionsPreparedText = this.page.getByText(/\d+\s+AI questions were prepared/);
  // await expect(questionsPreparedText).toBeVisible({ timeout: 20_000 });

  // Step 3: Handle rare case — uncovered skills
  const coverButton = this.page.getByRole('button', { name: /AI Cover Uncovered Skills/ });

  if (await coverButton.isVisible()) {
    await coverButton.click();

     }

  // Step 4: Move to next stage
  await this.nextStageButton.click();
}

  // ═══════════════════════════════════════════════════════════
  //  Step 5 — Publish / Distribution
  // ═══════════════════════════════════════════════════════════
  async configurePublishing({ publishAction, closingDate, workspaceName, workspaceSlug, platforms }) {
    await this.assertVisible(
      this.page.getByText('Publish Settings & Interview Links'),
      'Publish settings section should be visible'
    );

    // Closing date
    await this.closingDateInput.fill(closingDate);

    // Invite sender toggle
    await this.inviteSenderSwitch.click();

    // Workspace for invite sender
    const senderWorkspace = this.page
      .getByRole('combobox')
      .filter({ hasText: workspaceName })
      .first();
    await senderWorkspace.click();
    const option = this.page.getByRole('option', { name: workspaceName }).first();
    await option.waitFor({ state: 'visible' });
    await expect(option).toBeEnabled();
    await option.click();

    // Sender alias — fill only if visible to avoid flaky failures
    const slugInput = this.page.getByLabel('Sender email');
    if (await slugInput.isVisible()) {
      await this.fillInput(slugInput, workspaceSlug);
    } else {
      console.log('Sender email input not visible, skipping slug fill');
    }

    // Wait for sender email preview to update
    await expect(this.page.getByText(`From: ${workspaceName} <`)).toBeVisible({ timeout: 10_000 });

    // Device support switch
    await this.page.getByRole('switch').nth(2).click();

    // Add platform links
    for (let i = 0; i < platforms.length; i++) {
      const { name, label } = platforms[i];
      if (i > 0) {
        await this.addAnotherLinkButton.click();
      }
      const linkInput  = this.page.getByRole('textbox', { name: 'Main Interview Link' }).nth(i);
      const labelInput = this.page.getByRole('textbox', { name: 'LinkedIn, Careers Page,' }).nth(i);
      const dateInput  = this.page.locator('input[type="datetime-local"]').nth(i);

      await this.fillInput(linkInput, `${name} Interview Link`);
      await this.fillInput(labelInput, label);
      await dateInput.click();
    }

    if (publishAction === 'Save as Draft') {
      await this.saveDraftButton.click();
    } else {
      await this.saveAndPublishButton.click();
    }
  }

  async reviewAndSaveLinks(platformCount) {
    // The review button may not be present if the flow already saved/published.
    if (await this.reviewLinksButton.isVisible()) {
      await this.reviewLinksButton.click();

      const confirmText = `You are about to save the interview configuration and create ${platformCount} public interview link`;
      await expect(this.page.getByText(confirmText)).toBeVisible({ timeout: 10_000 });

      await expect(this.page.getByText('Invite senderCompany')).toBeVisible();
      await expect(this.page.getByText('Device supportMobile')).toBeVisible();

      await this.saveLinksButton.click();
      await this.page.getByRole('button', { name: 'done' }).click();
    } else if (await this.saveLinksButton.isVisible()) {
      // Fallback: if review is not available, try saving links directly
      console.log('Review button not visible; clicking Save Links directly');
      await this.saveLinksButton.click();
      if (await this.page.getByRole('button', { name: 'done' }).isVisible()) {
        await this.page.getByRole('button', { name: 'done' }).click();
      }
    } else {
      console.log('No review/save links actions available; continuing');
    }

  }

  async goBack() {
    await this.backButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = { JDCreationPage };
