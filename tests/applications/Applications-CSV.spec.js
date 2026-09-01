// tests/applications/Applications-CSV.spec.js
// ---------------------------------------------------------------------------
// Module 10 — Applications  |  CSV import scenarios
//
//   CSV upload flow (from UI screenshots) is a MULTI-STEP WIZARD:
//     1. Add Candidates → File Upload → CSV Upload sub-tab
//     2. Upload the CSV file (drop zone / file input)
//     3. Map CSV Fields — dropdowns: Name (Required), Email (Required), Phone
//     4. Click "Preview Mapped Data"
//     5. Preview Candidates — review mapped data
//     6. Click "Create N Applications"
//     7. (Optional) Send Now / Send Later dialog
//
//   Covered here:
//     TC_APP_007 — Valid CSV → map fields → preview → create → count +N
//     TC_APP_008 — Malformed CSV → upload fails or rejected at step 1/2
//     TC_APP_009 — CSV with only "name" column → mapping fails (no email column)
//
//   Not covered (known):
//     Google Drive — not supported in staging.
//
// CSV schema (from sample_import.csv + screenshot preview table):
//   name, email, phone
//
// Fixtures (auto-generated):
//   fixtures/csv/valid_import.csv         (2 rows: name,email,phone)
//   fixtures/csv/invalid_malformed.csv    (unclosed quote)
//   fixtures/csv/missing_columns.csv      (only 'name' column)
// ---------------------------------------------------------------------------

const { test, expect }       = require('../../utils/authFixture');
const { CandidatesPage }     = require('../../pages/CandidatesPage');
const path                   = require('path');
const fs                     = require('fs');

const FIX    = path.resolve(__dirname, '../../', 'fixtures');
const CSVDIR = path.join(FIX, 'csv');

// ─── helpers ─────────────────────────────────────────────────────────────

/** Opens the Candidates view and returns { url, initialCount, jobTitle }. */
async function openCandidates(candidatesPage) {
  const jobTitle = require('../../data/testData.json').candidates.jobTitle;
  await test.step(`Open Candidates view for "${jobTitle}"`, async () => {
    await candidatesPage.searchAndOpenCandidates(jobTitle);
    await candidatesPage.assertApplicationsPageOpen(jobTitle);
  });
  const url = candidatesPage.getCandidatesPageUrl();
  const initialCount = await candidatesPage.getCandidateCount();
  return { url, initialCount, jobTitle };
}

// ══════════════════════════════════════════════════════════════════════════
//  TC_APP_007 — Valid CSV upload (full wizard)
// ══════════════════════════════════════════════════════════════════════════
test.describe('TC_APP_007 — Upload a valid CSV via the CSV wizard → candidates created', () => {

  test('Upload valid_import.csv (2 rows) → map → preview → create → count +2', async ({
    page, browser, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const csvPath = path.resolve(CSVDIR, 'valid_import.csv');

    const { url, initialCount } = await openCandidates(candidatesPage);

    await test.step('Run full CSV import wizard (upload → map → preview → create) → Send Now', async () => {
      await candidatesPage.addCandidateByCSV(csvPath, 'now');
    });

    await test.step('Verify count increased by 2', async () => {
      await candidatesPage.navigateToUrl(url);
      await candidatesPage.assertCandidateCount(initialCount + 2);
    });

    // The wizard ends with "Create N Applications" which may surface a
    // "Bulk created N applications." toast — capture it if present.
    await test.step('Verify success indication', async () => {
      const msg = await candidatesPage.getErrorMessage(6000);
      if (msg) console.log(`CSV wizard result message: "${msg}"`);
    });
  });

  test('Upload valid CSV → map → preview → create → Send Later → count +2', async ({
    page, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const csvPath = path.resolve(CSVDIR, 'valid_import.csv');

    const { url, initialCount } = await openCandidates(candidatesPage);

    await test.step('Run CSV import wizard → Send Later', async () => {
      await candidatesPage.addCandidateByCSV(csvPath, 'later');
    });

    await test.step('Verify count increased by 2', async () => {
      await candidatesPage.navigateToUrl(url);
      await candidatesPage.assertCandidateCount(initialCount + 2);
    });
  });

  test('Upload 1-row CSV (created on the fly) → wizard → count +1', async ({
    page, browser, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const tmpPath = path.join(CSVDIR, '_single_row_valid.csv');
    fs.writeFileSync(tmpPath, 'name,email,phone\nAlice Test,alice@test.com,15551000\n');

    try {
      const { url, initialCount } = await openCandidates(candidatesPage);

      await test.step('Run CSV import wizard on 1-row file → Send Now', async () => {
        await candidatesPage.addCandidateByCSV(tmpPath, 'now');
      });

      await test.step('Verify count increased by 1', async () => {
        await candidatesPage.navigateToUrl(url);
        await candidatesPage.assertCandidateCount(initialCount + 1);
      });
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  TC_APP_008 — Invalid / malformed CSV
//  The CSV wizard expects a well-formed CSV that it can parse into a preview
//  table.  An unclosed-quote file should fail at the upload / parse step
//  (step 1→2 transition) — we assert count unchanged and capture any message.
// ══════════════════════════════════════════════════════════════════════════
test.describe('TC_APP_008 — Upload an invalid / malformed CSV', () => {

  test('Upload malformed CSV (unclosed quote) → no candidate created', async ({
    page, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const csvPath = path.resolve(CSVDIR, 'invalid_malformed.csv');

    const { url, initialCount } = await openCandidates(candidatesPage);

    await test.step('Upload malformed CSV through the wizard', async () => {
      try {
        await candidatesPage.addCandidateByCSV(csvPath, 'now');
      } catch (err) {
        // If the wizard throws at the parse/upload step, that is a valid
        // rejection — record it.
        console.log(`Malformed CSV wizard threw: ${err.message}`);
      }
    });

    await test.step('Verify count did NOT increase', async () => {
      await candidatesPage.navigateToUrl(url);
      const afterCount = await candidatesPage.getCandidateCount();
      expect(afterCount).toBe(initialCount,
        `Expected count to remain ${initialCount} after malformed CSV but got ${afterCount}`);
    });

    await test.step('Capture any error message', async () => {
      const msg = await candidatesPage.getErrorMessage(8000);
      if (msg) console.log(`Malformed CSV → message: "${msg}"`);
    });
  });

  /**
   * Tab-delimited file with a .csv extension.
   * The preview may or may not be able to parse it — we just assert count
   * does not increase, and log whatever the UI reports.
   */
  test('Upload tab-delimited CSV → no candidate created (or parse error)', async ({
    page, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const tmpPath = path.join(CSVDIR, '_tab_delimited.csv');
    fs.writeFileSync(tmpPath, 'name\temail\tphone\nBob Smith\tbob@test.com\t15552000\n');

    try {
      const { url, initialCount } = await openCandidates(candidatesPage);

      await test.step('Upload tab-delimited file through the wizard', async () => {
        try {
          await candidatesPage.addCandidateByCSV(tmpPath, 'now');
        } catch (err) {
          console.log(`Tab CSV wizard threw: ${err.message}`);
        }
      });

      await test.step('Verify count unchanged', async () => {
        await candidatesPage.navigateToUrl(url);
        const afterCount = await candidatesPage.getCandidateCount();
        expect(afterCount).toBe(initialCount,
          `Expected count to stay ${initialCount} after tab CSV but got ${afterCount}`);
      });
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  TC_APP_009 — CSV missing required columns
//  The sample CSV schema is name/email/phone.  The "Map CSV Fields" step
//  lists available CSV columns as dropdown options.  If the uploaded CSV is
//  missing the "email" column, the Email (Required) dropdown has no "email"
//  option to select — the wizard should either block progression or create 0
//  candidates.  We assert count unchanged.
//
//  NOTE: the missing_columns.csv fixture has ONLY a "name" column, so BOTH
//  email AND phone columns are absent.  The wizard cannot map Email (Required)
//  and should fail at the mapping step.
// ══════════════════════════════════════════════════════════════════════════
test.describe('TC_APP_009 — CSV missing required columns', () => {

  test('Upload CSV with only "name" column (no email/phone) → mapping blocked / no creation', async ({
    page, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const csvPath = path.resolve(CSVDIR, 'missing_columns.csv');

    const { url, initialCount } = await openCandidates(candidatesPage);

    await test.step('Upload missing-columns CSV through the wizard', async () => {
      try {
        await candidatesPage.addCandidateByCSV(csvPath, 'now');
      } catch (err) {
        console.log(`Missing-columns CSV wizard threw: ${err.message}`);
      }
    });

    await test.step('Verify count did NOT increase', async () => {
      await candidatesPage.navigateToUrl(url);
      const afterCount = await candidatesPage.getCandidateCount();
      expect(afterCount).toBe(initialCount,
        `Expected count to stay ${initialCount} after missing-columns CSV but got ${afterCount}`);
    });

    await test.step('Capture any error message', async () => {
      const msg = await candidatesPage.getErrorMessage(8000);
      if (msg) console.log(`Missing-columns CSV → message: "${msg}"`);
    });
  });

  /**
   * CSV with name + phone but no email column.
   * The Email (Required) dropdown has no "email" option — mapping should fail.
   */
  test('Upload CSV missing email column (name, phone only) → mapping blocked / no creation', async ({
    page, loggedInPage,
  }) => {
    const candidatesPage = new CandidatesPage(page);
    const tmpPath = path.join(CSVDIR, '_no_email_column.csv');
    fs.writeFileSync(tmpPath, 'name,phone\nCarol White,15553000\n');

    try {
      const { url, initialCount } = await openCandidates(candidatesPage);

      await test.step('Upload CSV missing email column through the wizard', async () => {
        try {
          await candidatesPage.addCandidateByCSV(tmpPath, 'now');
        } catch (err) {
          console.log(`No-email-column CSV wizard threw: ${err.message}`);
        }
      });

      await test.step('Verify count unchanged', async () => {
        await candidatesPage.navigateToUrl(url);
        const afterCount = await candidatesPage.getCandidateCount();
        expect(afterCount).toBe(initialCount,
          `Expected count to stay ${initialCount} after no-email CSV but got ${afterCount}`);
      });
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  });
});
