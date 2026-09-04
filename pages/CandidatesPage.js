// pages/CandidatesPage.js
const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * CandidatesPage covers:
 *  - Searching for a job and entering the Candidates view
 *  - Adding candidates via email (bulk invite)
 *  - Adding candidates via resume file upload (File Upload → Resume Upload)
 *  - Adding candidates via CSV upload (File Upload → CSV Upload wizard)
 *  - Verifying application count changes
 *  - Storing and re-navigating to the candidates URL
 *
 *  CSV upload wizard steps (from UI screenshots):
 *    1. File Upload → CSV Upload sub-tab → upload file (drop zone / file input)
 *    2. Map CSV Fields — map Name (Required), Email (Required), Phone dropdowns
 *       to CSV columns → "Preview Mapped Data" button
 *    3. Preview Candidates — review mapped data → "Create N Applications" button
 *    4. (Optional) Send Now / Send Later dialog after create
 */
class CandidatesPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Job search (on dashboard / jobs list) ─────────────
    this.jobSearchInput   = page.getByRole('textbox', { name: 'Search by job name or ID' });
    this.viewCandidatesBtn = page.getByRole('button', { name: 'View Candidates' });

    // ── Applications header ───────────────────────────────
    this.applicationsHeading = (jobTitle) =>
      page.locator('h1, h2').filter({ hasText: new RegExp(`${jobTitle}`, 'i') }).first();

    // ── Candidate count badge ─────────────────────────────
    this.appliedCountText  = (count) => page.getByText(`${count}Applied`);
    this.candidateCountBadge = (count) =>
      page.locator('div').filter({ hasText: new RegExp(`^${count}$`) });

    // ── Add Candidates panel ──────────────────────────────
    this.addCandidatesBtn     = page.getByRole('button', { name: 'Add Candidates' });
    this.emailTab             = page.getByRole('tab',   { name: 'Email' });
    this.fileUploadTab        = page.getByRole('tab',   { name: 'File Upload' });
    // CSV Upload is a SECOND-ROW sub-tab under File Upload (next to Resume Upload).
    this.csvUploadTab        = page.getByRole('tab',   { name: 'CSV Upload' });
    this.resumeFileInput      = page.locator('input[type="file"]');

    // Email flow
    this.emailInput           = page.getByRole('textbox', { name: 'Enter email addresses' });
    this.addCandidateCountBtn = (n) => page.getByRole('button', { name: `Add ${n} Candidate(s)` });
    this.createAndSendEmailBtn = page.getByRole('button', { name: 'Create & Send Email' });
    this.createWithoutEmailBtn = page.getByRole('button', { name: 'Create without Email' });
    this.bulkCreatedText      = (n) => page.getByText(`Bulk created ${n} applications.`, { exact: true });

    // File upload flow (Resume Upload sub-tab)
    this.chooseResumeFilesBtn  = page.getByRole('button', { name: 'Choose Resume Files' });
    this.importResumesBtn      = page.getByRole('button', { name: 'Import Selected Resumes' });
    this.sendNowBtn            = page.getByRole('button', { name: 'Send Now' });
    this.sendLaterBtn          = page.getByRole('button', { name: "I'll Send Later" });

    // ═══════════════════════════════════════════════════════
    //  CSV Upload wizard selectors (File Upload → CSV Upload)
    // ═══════════════════════════════════════════════════════

    // Step 1 — file upload area
    this.csvUploadHeading  = page.getByText('Upload CSV File').first();
    this.csvDropZoneText   = page.getByText('Drop your CSV file here').first();
    // The CSV tab may expose a file input (shared or dedicated); we probe for it.
    this.csvFileInput      = page.locator('input[type="file"]');

    // Step 2 — Map CSV Fields: three mapping dropdowns
    //    Each shows placeholder "Select column..." and expands to a list
    //    with options: "Select column...", "name", "email", "phone".
    //    Target the select elements inside the mapping dialog by label text.
    const mapDialog = page.locator('div[role="dialog"]').filter({ hasText: /Map CSV Fields/i });
    this.nameMapCombo      = mapDialog.locator('select').nth(0);
    this.emailMapCombo     = mapDialog.locator('select').nth(1);
    this.phoneMapCombo     = mapDialog.locator('select').nth(2);

    // Step 2 — buttons
    this.previewMappedDataBtn = page.getByRole('button', { name: 'Preview Mapped Data' });
    this.csvBackBtn           = page.getByRole('button', { name: 'Back' });

    // Step 3 — Preview Candidates
    this.previewCandidatesHeading = page.getByText('Preview Candidates').first();
    this.previewBannerText        = page.getByText(/candidates will be processed/i);
    // "Create N Applications" — text is dynamic (e.g. "Create 2 Applications")
    this.createApplicationsBtn    = page.getByRole('button', { name: /Create \d+ Applic/i });
    this.backToMappingBtn         = page.getByRole('button', { name: 'Back to Mapping' });
  }

  // ═══════════════════════════════════════════════════════
  //  Navigation
  // ════════════════════════════════════════════════

  async searchAndOpenCandidates(jobTitle) {
    await this.fillInput(this.jobSearchInput, jobTitle);
    await this.page.waitForTimeout(1500); // debounce
    await this.viewCandidatesBtn.first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async assertApplicationsPageOpen(jobTitle) {
    await this.assertVisible(
      this.applicationsHeading(jobTitle),
      `Expected Applications heading for "${jobTitle}"`
    );
  }

  getCandidatesPageUrl() {
    return this.page.url();
  }

  async navigateToUrl(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  // ═══════════════════════════════════════════════════════
  //  Count helpers
  // ═══════════════════════════════════════════════════════

  async getCandidateCount() {
    const parseTotalFromText = (text) => {
      if (!text) return null;
      const match = text.match(/(?:\\d+\\s*-\\s*\\d+\\s*of\\s*|of\\s*)(\\d+)/i);
      return match ? parseInt(match[1], 10) : null;
    };

    const paginationPatterns = [
      this.page.locator('text=/\\d+\\s*-\\s*\\d+\\s*of\\s*\\d+/i').first(),
      this.page.locator('p').filter({ hasText: /of\s*\d+/i }).first(),
      this.page.locator('div').filter({ hasText: /of\s*\d+/i }).first(),
      this.page.getByText(/of\s*\d+/i).first(),
    ];

    for (const locator of paginationPatterns) {
      if (await locator.count() > 0) {
        await locator.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null);
        const paginationText = await locator.innerText().catch(() => null);
        const total = parseTotalFromText(paginationText);
        if (typeof total === 'number' && total > 0) {
          return total;
        }
      }
    }

    const rowLocator = this.page.locator('table tbody tr, [role="row"]');
    await rowLocator.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null);

    const tableRows = this.page.locator('table tbody tr');
    if (await tableRows.count() > 0) {
      return await tableRows.count();
    }

    const gridRows = this.page.locator('[role="row"]');
    if (await gridRows.count() > 1) {
      const firstRowText = await gridRows.first().innerText().catch(() => '');
      const hasHeader = /name|email|status|application|actions/i.test(firstRowText);
      return hasHeader ? await gridRows.count() - 1 : await gridRows.count();
    }

    const text = await this.page.locator('text=/\\d+Applied/').first().innerText().catch(() => null);
    if (text) {
      const match = text.match(/(\\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    }

    return 0;
  }

  async assertCandidateCount(expected) {
    await expect.poll(async () => {
      return await this.getCandidateCount();
    }, { timeout: 30_000, message: `Expected candidate count to be ${expected}` }).toBe(expected);
  }

  // ═══════════════════════════════════════════════════════
  //  Add via Email
  // ═══════════════════════════════════════════════════════

  async addCandidatesByEmail(emails, sendTiming = 'now') {
    await this.addCandidatesBtn.click();
    await this.fillInput(this.emailInput, emails.join(', '));
    await this.addCandidateCountBtn(emails.length).click();
    await this.page.waitForTimeout(2000);

    const sendNowVisible = await this.sendNowBtn.count() > 0;
    const createEmailVisible = await this.createAndSendEmailBtn.count() > 0;

    if (sendNowVisible) {
      await this.sendNowBtn.click();
    } else if (createEmailVisible) {
      await this.createAndSendEmailBtn.click();
    } else {
      throw new Error('Neither "Send Now" nor "Create & Send Email" button is visible');
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Add via Resume Upload (File Upload → Resume Upload tab)
  // ═══════════════════════════════════════════════════════

  async addCandidateByResume(filePath, sendTiming = 'now') {
    await this.addCandidatesBtn.click();
    await this.fileUploadTab.click();
    // Resume Upload is the default sub-tab when File Upload is selected.
    await this.chooseResumeFilesBtn.click();

    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached' });
    await fileInput.setInputFiles(filePath);

    await this.importResumesBtn.click();
    await this.page.waitForTimeout(2000);

    const sendNowVisible = await this.sendNowBtn.count() > 0;
    const createEmailVisible = await this.createAndSendEmailBtn.count() > 0;

    if (sendTiming === 'now') {
      if (sendNowVisible) {
        await this.sendNowBtn.click();
      } else if (createEmailVisible) {
        await this.createAndSendEmailBtn.click();
      } else {
        throw new Error('Neither "Send Now" nor "Create & Send Email" button is visible');
      }
    } else {
      await this.sendLaterBtn.click();
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Add via File Upload (PDF / DOC / multiple / unsupported)
  //  Same path as addCandidateByResume — File Upload → Resume Upload.
  // ═══════════════════════════════════════════════════════

  async addCandidateByFileUpload(filePaths, sendTiming = 'now') {
    await this.addCandidatesBtn.click();
    await this.fileUploadTab.click();
    await this.chooseResumeFilesBtn.click();

    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached' });
    await fileInput.setInputFiles(filePaths);

    await this.importResumesBtn.click();
    await this.page.waitForTimeout(2000);

    const sendNowVisible     = await this.sendNowBtn.count() > 0;
    const createEmailVisible = await this.createAndSendEmailBtn.count() > 0;

    if (sendTiming === 'now') {
      if (sendNowVisible) {
        await this.sendNowBtn.click();
      } else if (createEmailVisible) {
        await this.createAndSendEmailBtn.click();
      } else {
        throw new Error('Neither "Send Now" nor "Create & Send Email" button is visible');
      }
    } else {
      await this.sendLaterBtn.click();
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Add via CSV Upload (File Upload → CSV Upload wizard)
  // ═══════════════════════════════════════════════════════

  /**
   * Full CSV import wizard:
   *   1. Add Candidates → File Upload → CSV Upload sub-tab
   *   2. Upload the CSV file (drop zone / file input)
   *   3. Map CSV Fields: Name→name, Email→email, Phone→phone
   *   4. Click "Preview Mapped Data"
   *   5. Click "Create N Applications"
   *   6. Handle optional Send Now / Send Later dialog
   *
   * @param {string}  filePath     - absolute path to the CSV file
   * @param {'now' | 'later'} sendTiming
   */
  async addCandidateByCSV(filePath, sendTiming = 'now') {
    // ── Step 0: open panel + navigate to CSV Upload ──────────────
    await this.addCandidatesBtn.click();
    await this.fileUploadTab.click();
    await this.csvUploadTab.click();
    await this.page.waitForTimeout(1500);

    // Confirm we landed on the CSV upload area (not Resume Upload).
    await this.assertVisible(
      this.csvUploadHeading,
      'Expected "Upload CSV File" heading after switching to CSV Upload tab'
    );

    // ── Step 1: upload the file ──────────────────────────────────
    await this._csvUploadFile(filePath);

    // After a file is selected the UI transitions to "Map CSV Fields".
    await this.page.waitForTimeout(2000);
    await this.assertVisible(
      this.page.getByText('Map CSV Fields').first(),
      'Expected "Map CSV Fields" step after CSV file upload'
    );

    // ── Step 2: map CSV fields ───────────────────────────────────
    await this._csvMapFields();

    // ── Step 3: preview mapped data ──────────────────────────────
    await this.previewMappedDataBtn.click();
    await this.page.waitForTimeout(2000);

    await this.assertVisible(
      this.previewCandidatesHeading,
      'Expected "Preview Candidates" step after clicking "Preview Mapped Data"'
    );

    // ── Step 4: create applications ──────────────────────────────
    await this.createApplicationsBtn.click();
    await this.page.waitForTimeout(3000);

    // ── Step 5: optional send-timing dialog (mirror resume flow) ─
    const sendNowVisible     = await this.sendNowBtn.count() > 0;
    const sendLaterVisible   = await this.sendLaterBtn.count() > 0;
    const hasSendDialog      = sendNowVisible || sendLaterVisible;

    if (hasSendDialog) {
      if (sendTiming === 'now') {
        if (sendNowVisible) {
          await this.sendNowBtn.click();
        } else {
          await this.sendLaterBtn.click();
        }
      } else {
        await this.sendLaterBtn.click();
      }
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * Upload a CSV file in the CSV Upload tab.
   * Tries a native file input first; falls back to the file-chooser
   * event if the drop zone uses a custom picker.
   */
  async _csvUploadFile(filePath) {
    // Strategy 1 — native <input type="file">
    const fileInput = this.csvFileInput.first();
    try {
      await fileInput.waitFor({ state: 'attached', timeout: 4000 });
      await fileInput.setInputFiles(filePath);
      return;
    } catch {
      // fall through to strategy 2
    }

    // Strategy 2 — click the drop zone and handle the file chooser event
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser', { timeout: 10000 }),
      this.csvDropZoneText.click(),
    ]);
    await fileChooser.setFiles(filePath);
  }

  /**
   * Map CSV columns to candidate fields in the "Map CSV Fields" step.
   *
   * Default mapping (matches the sample CSV schema):
   *   Name (Required)  → "name"
   *   Email (Required) → "email"
   *   Phone            → "phone"
   *
   * @param {string} [nameCol='name']
   * @param {string} [emailCol='email']
   * @param {string} [phoneCol='phone']
   */
  async _csvMapFields(nameCol = 'name', emailCol = 'email', phoneCol = 'phone') {
    // Helper: select a column option from a native select dropdown if it isn't already set.
    const selectColumn = async (comboLocator, optionText) => {
      if (await comboLocator.count() === 0) return;
      const current = await comboLocator.inputValue().catch(() => '');
      if (current !== optionText) {
        await comboLocator.selectOption(optionText);
        await this.page.waitForTimeout(500);
      }
    };

    // Name (Required)
    await selectColumn(this.nameMapCombo, nameCol);

    // Email (Required)
    await selectColumn(this.emailMapCombo, emailCol);

    // Phone (optional, but map it anyway)
    await selectColumn(this.phoneMapCombo, phoneCol);

    // All mapped — the "Mapping Required" error banner should disappear.
    await this.page.waitForTimeout(500);
  }

  // ═══════════════════════════════════════════════════════
  //  Toast / message assertions
  // ═══════════════════════════════════════════════════════

  async assertBulkCreatedToast(count) {
    await this.assertVisible(
      this.bulkCreatedText(count),
      `Expected "Bulk created ${count} applications." toast`
    );
  }

  /**
   * Returns the first visible error / validation message text on the page
   * (toast, inline error, dialog, banner). Returns '' if none found.
   */
  async getErrorMessage(timeoutMs = 10_000) {
    const patterns = [
      this.page.getByText(/unsupported/i),
      this.page.getByText(/mapping required/i),
      this.page.getByText(/invalid/i),
      this.page.getByText(/error/i),
      this.page.getByText(/duplicate/i),
      this.page.getByText(/exists/i),
      this.page.getByText(/missing/i),
      this.page.getByText(/required/i),
      this.page.getByRole('status').last(),
      this.page.locator('text=/\\S+/').filter({ hasText: /could not|failed|not allowed/i }),
    ];
    for (const loc of patterns) {
      try {
        if (await loc.count() > 0) {
          await loc.first().waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null);
          const txt = await loc.first().innerText().catch(() => '');
          if (txt && txt.trim()) return txt.trim();
        }
      } catch { /* try next pattern */ }
    }
    return '';
  }
}

module.exports = { CandidatesPage };
