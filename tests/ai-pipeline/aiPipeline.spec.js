// tests/ai-pipeline/aiPipeline.spec.js
/**
 * AI Pipeline Validation — JD → Skills → Topics → Questions
 *
 * ⚠️  ONE JD is created for the entire file. All 10 test cases share state
 *     via module-level variables populated as the wizard progresses.
 *     Tests run sequentially (workers: 1) in this order:
 *
 *  TC_AIP_001  JD generation is non-empty and keyword-rich
 *  TC_AIP_002  Skills extracted from UI meet recall threshold
 *  TC_AIP_003  Skills API response cross-validates with UI
 *  TC_AIP_004  Skill categorisation accuracy
 *  TC_AIP_005  No duplicate skills across categories
 *  TC_AIP_006  Topics coverage — every skill appears in at least one topic
 *  TC_AIP_007  Questions coverage — every skill reflected in questions
 *  TC_AIP_008  HyreFast built-in coverage % reaches threshold
 *  TC_AIP_009  Full end-to-end scoring report passes
 *  TC_AIP_010  Hallucination rate within threshold
 */

const { test, expect }         = require('../../utils/authFixture');
const { JDCreationPage }       = require('../../pages/JDCreationPage');
const { SkillsExtractionPage } = require('../../pages/SkillsExtractionPage');
const { ApiInterceptor }       = require('../../utils/apiInterceptor');
const {
  compareSkills,
  validateCategories,
  validateTopicCoverage,
  validateQuestionCoverage,
  findDuplicateSkills,
  buildScoringReport,
  printReport,
  DEFAULT_THRESHOLDS,
} = require('../../utils/skillValidator');
const { futureDateString, getEnv } = require('../../utils/helpers');
const goldenData = require('../../data/goldenSkills.json');
const testData   = require('../../data/testData.json');

// ─────────────────────────────────────────────────────────────────────────────
//  Module-level shared state — populated once, reused across all TC_ tests
// ─────────────────────────────────────────────────────────────────────────────
const shared = {
  jdContent:      '',
  skills:         { mustHave: [], goodToHave: [], bonus: [], all: [] },
  topicTexts:     [],
  questionTexts:  [],
  apiSkills:      { mustHave: [], goodToHave: [], bonus: [] },
  apiCaptured:    false,
  pipelineReady:  false,   // true once Steps 1–4 have run successfully
};

// ─────────────────────────────────────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIO = testData.jdCreation.scenarios[0];  // .net developer

function getGolden(jobTitle) {
  const key  = jobTitle.toLowerCase().trim();
  const role = goldenData.roles[key];
  if (!role) {
    console.warn(`[goldenSkills] No golden data for "${key}" — using defaults`);
    return { mustHave: [], goodToHave: [], bonus: [], keywords: [], thresholds: DEFAULT_THRESHOLDS };
  }
  return { ...role, thresholds: { ...DEFAULT_THRESHOLDS, ...role.thresholds } };
}

const GOLDEN = getGolden(SCENARIO.jobTitle);

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_000 — Build the full pipeline once (shared setup)
//
//  This is the ONLY test that drives the browser through all 4 wizard steps.
//  All TC_AIP_001–010 tests read from `shared.*` and never re-run the wizard.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_000 — Pipeline Setup (runs wizard once)', () => {

  test('Build JD → Skills → Topics → Questions and store all outputs', async ({
    page, loggedInPage
  }) => {
    const jdPage      = new JDCreationPage(page);
    const skillsPage  = new SkillsExtractionPage(page);
    const interceptor = new ApiInterceptor(page);
    interceptor.start();

    // ── Step 1: Generate JD ──────────────────────────────
    await test.step('Step 1 — Generate JD', async () => {
      await loggedInPage.clickCreateJob();

      await jdPage.fillJobDetails({
        jobTitle:       SCENARIO.jobTitle,
        workspaceName:  getEnv('WORKSPACE_NAME'),
        employmentType: SCENARIO.employmentType,
        workMode:       SCENARIO.workMode,
        locationQuery:  SCENARIO.locationQuery,
        locationOption: SCENARIO.locationOption,
      });

      shared.jdContent = await skillsPage.extractJDContent()

      console.log(`JD content length: ${shared.jdContent.length} chars`);
      expect(shared.jdContent.length, 'JD content should not be empty').toBeGreaterThan(50);
    });

    // ── Proceed to Skills ────────────────────────────────
    await test.step('Step 1 → Step 2 — Proceed to Skills', async () => {
      await page.getByRole('button', { name: /Proceed to Skill Requirements/i }).click();
      await skillsPage.waitForSkillsReady();
    });

    // ── Step 2: Extract skills ────────────────────────────
    await test.step('Step 2 — Extract skills from UI', async () => {
      shared.skills = await skillsPage.extractSkillsByCategory();
      console.log(`Skills extracted — Must Have: ${shared.skills.mustHave.length}, Good to Have: ${shared.skills.goodToHave.length}, Bonus: ${shared.skills.bonus.length}`);
      console.log('  Must Have:', shared.skills.mustHave.join(' | '));
      console.log('  Good to Have:', shared.skills.goodToHave.join(' | '));
      console.log('  Bonus:', shared.skills.bonus.join(' | '));

      // Capture API response if available
      const captured = interceptor.getCaptured('skills');
      if (captured) {
        shared.apiSkills   = interceptor.parseSkillsFromResponse(captured);
        shared.apiCaptured = true;
        console.log('Skills API response captured ✓');
      } else {
        console.log('No skills API response captured (endpoint pattern may differ)');
      }
    });

    // ── Accept Skills → Step 3: Topics ───────────────────
    await test.step('Step 2 → Step 3 — Accept Skills & Generate Topics', async () => {
      await skillsPage.acceptSkills();
      await skillsPage.waitForTopicsReady();
      shared.topicTexts = await skillsPage.extractTopicNames();
      console.log(`Topics extracted (${shared.topicTexts.length}):`, shared.topicTexts.join(' | '));
    });

    // ── Step 3 → Step 4: Questions ────────────────────────
    await test.step('Step 3 → Step 4 — Navigate to Questions', async () => {
      await skillsPage.navigateToQuestionsStage();
      await skillsPage.waitForQuestionsReady();
      shared.questionTexts = await skillsPage.extractQuestions();
      console.log(`Questions extracted (${shared.questionTexts.length})`);
      shared.questionTexts.forEach((q, i) => console.log(`  Q${i + 1}: ${q.substring(0, 90)}...`));
    });

    shared.pipelineReady = true;
    interceptor.stop();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function requirePipeline() {
  if (!shared.pipelineReady) {
    test.skip(true, 'TC_AIP_000 pipeline setup did not complete — skipping this test');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_001 — JD content is non-empty and keyword-rich
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_001 — JD Generation Quality', () => {
  test('JD is non-empty and contains expected job keywords', async () => {
    requirePipeline();

    const jdLower  = shared.jdContent.toLowerCase();
    const hits     = GOLDEN.keywords.filter(kw => jdLower.includes(kw));
    const hitRate  = GOLDEN.keywords.length ? hits.length / GOLDEN.keywords.length : 1;

    console.log(`JD keyword hit rate: ${(hitRate * 100).toFixed(1)}% (${hits.length}/${GOLDEN.keywords.length})`);
    console.log(`Missing keywords: ${GOLDEN.keywords.filter(kw => !jdLower.includes(kw)).join(', ')}`);

    expect(shared.jdContent.length, 'JD should not be empty').toBeGreaterThan(50);
    expect(hitRate, `JD keyword coverage ${(hitRate * 100).toFixed(1)}% < 40%`).toBeGreaterThanOrEqual(0.40);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_002 — Skills Extraction:
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_002 — Skills Extraction (UI Recall)', () => {
  test('Extracted skills meet recall and hallucination thresholds', async () => {
    requirePipeline();

    const allExpected = [...GOLDEN.mustHave, ...GOLDEN.goodToHave, ...GOLDEN.bonus];
    const comparison  = compareSkills(shared.skills.all, allExpected);

    printReport(
      buildScoringReport({ comparison, thresholds: GOLDEN.thresholds }),
      'TC_AIP_002 UI Skill Extraction'
    );

    expect(
      shared.skills.all.length,
      'At least 3 skills should be extracted'
    ).toBeGreaterThanOrEqual(3);

    expect(
      comparison.recallScore,
      `Recall ${(comparison.recallScore * 100).toFixed(1)}% < threshold ${(GOLDEN.thresholds.recallScore * 100).toFixed(1)}%.\nMissing: ${comparison.missing.join(', ')}`
    ).toBeGreaterThanOrEqual(GOLDEN.thresholds.recallScore);

    expect(
      comparison.hallucinationRate,
      `Hallucination ${(comparison.hallucinationRate * 100).toFixed(1)}% > threshold ${(GOLDEN.thresholds.hallucinationRate * 100).toFixed(1)}%.\nHallucinated: ${comparison.hallucinated.join(', ')}`
    ).toBeLessThanOrEqual(GOLDEN.thresholds.hallucinationRate);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_003 — Skills Extraction: API cross-validation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_003 — Skills Extraction (API)', () => {
  test('API response skills broadly agree with UI-extracted skills', async () => {
    requirePipeline();

    if (!shared.apiCaptured) {
      console.log('TC_AIP_003: No API response captured — skipping API assertions');
      test.skip(true, 'Skills API endpoint not captured — update PATTERNS in apiInterceptor.js');
      return;
    }

    const allApi      = [...shared.apiSkills.mustHave, ...shared.apiSkills.goodToHave, ...shared.apiSkills.bonus];
    const crossCheck  = compareSkills(shared.skills.all, allApi);

    console.log(`API skills: ${allApi.length} | UI skills: ${shared.skills.all.length}`);
    console.log(`API ↔ UI overlap: ${(crossCheck.recallScore * 100).toFixed(1)}%`);

    expect(allApi.length, 'API should return at least 3 skills').toBeGreaterThanOrEqual(3);
    expect(crossCheck.recallScore, 'UI and API skills should overlap ≥60%').toBeGreaterThanOrEqual(0.60);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_004 — Skill Categorisation Accuracy
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_004 — Skill Categorisation', () => {
  test('Skills are placed in correct categories', async () => {
    requirePipeline();

    const catValidation = validateCategories(shared.skills, GOLDEN);

    if (catValidation.miscategorised.length > 0) {
      console.warn('Miscategorised skills:');
      catValidation.miscategorised.forEach(m =>
        console.warn(`  "${m.skill}" — expected: ${m.expectedCategory}, found in: ${m.foundIn}`)
      );
    }

    console.log(`Category accuracy: ${(catValidation.categoryAccuracy * 100).toFixed(1)}%`);

    expect(
      catValidation.categoryAccuracy,
      `Category accuracy ${(catValidation.categoryAccuracy * 100).toFixed(1)}% < threshold ${(GOLDEN.thresholds.categoryAccuracy * 100).toFixed(1)}%`
    ).toBeGreaterThanOrEqual(GOLDEN.thresholds.categoryAccuracy);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_005 — No Duplicate Skills
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_005 — No Duplicate Skills', () => {
  test('No skill name appears more than once across all categories', async () => {
    requirePipeline();

    const duplicates = findDuplicateSkills(shared.skills);

    if (duplicates.length > 0) {
      console.warn(`Duplicate skill groups (${duplicates.length}):`);
      duplicates.forEach(g => console.warn(`  ${g.join(' ≈ ')}`));
    }

    expect(
      duplicates.length,
      `Duplicate skills found: ${duplicates.map(g => g.join(' / ')).join('; ')}`
    ).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_006 — Topics Coverage
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_006 — Topics Coverage', () => {
  test('All extracted skills appear in at least one topic', async () => {
    requirePipeline();

    expect(shared.topicTexts.length, 'At least 1 topic should be generated').toBeGreaterThanOrEqual(1);

    const result = validateTopicCoverage(shared.skills.all, shared.topicTexts);

    console.log(`Topic coverage: ${(result.topicCoverage * 100).toFixed(1)}% (${result.covered.length}/${shared.skills.all.length})`);
    if (result.uncovered.length) console.warn('Not covered by topics:', result.uncovered.join(', '));

    expect(
      result.topicCoverage,
      `Topic coverage ${(result.topicCoverage * 100).toFixed(1)}% < threshold ${(GOLDEN.thresholds.topicCoverage * 100).toFixed(1)}%.\nUncovered: ${result.uncovered.join(', ')}`
    ).toBeGreaterThanOrEqual(GOLDEN.thresholds.topicCoverage);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_007 — Questions Coverage
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_007 — Questions Coverage', () => {
  test('Generated questions reflect the extracted skills', async () => {
    requirePipeline();

    expect(shared.questionTexts.length, 'At least 3 questions should be generated').toBeGreaterThanOrEqual(3);

    const result = validateQuestionCoverage(shared.skills.all, shared.questionTexts);

    console.log(`Question coverage: ${(result.questionCoverage * 100).toFixed(1)}% (${result.covered.length}/${shared.skills.all.length})`);
    if (result.uncovered.length) console.warn('Not in questions:', result.uncovered.join(', '));

    expect(
      result.questionCoverage,
      `Question coverage ${(result.questionCoverage * 100).toFixed(1)}% < threshold ${(GOLDEN.thresholds.questionCoverage * 100).toFixed(1)}%`
    ).toBeGreaterThanOrEqual(GOLDEN.thresholds.questionCoverage);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_008 — HyreFast Built-in Coverage Badge
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_008 — UI Coverage Badge', () => {
  test('HyreFast shows 100% skill coverage badge on Questions step', async ({
    page, loggedInPage
  }) => {
    requirePipeline();

    // The coverage badge is on the live page — re-read it directly
    // Screenshot 1 shows "100% coverage" badge at bottom right of Questions step
    const badgeLocator = page.getByText(/100%\s*coverage/i)
      .or(page.getByText(/\d+%\s*coverage/i));

    let coveragePct = 0;
    try {
      const badgeText = await badgeLocator.first().innerText({ timeout: 10_000 });
      const match     = badgeText.match(/(\d+)/);
      coveragePct     = match ? parseInt(match[1], 10) : 0;
    } catch {
      // Badge may not be visible if page navigated away — soft check
      console.warn('TC_AIP_008: Coverage badge not found on current page — recording 0');
    }

    console.log(`HyreFast coverage badge: ${coveragePct}%`);
    test.info().annotations.push({ type: 'coverage_pct', description: `${coveragePct}%` });

    expect(coveragePct, `Coverage badge shows ${coveragePct}% — expected ≥80%`).toBeGreaterThanOrEqual(80);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_009 — Full End-to-End Scoring Report
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_009 — End-to-End Pipeline Score', () => {
  test('All pipeline metrics pass — full scoring report', async () => {
    requirePipeline();

    const allExpected = [...GOLDEN.mustHave, ...GOLDEN.goodToHave, ...GOLDEN.bonus];

    const comparison         = compareSkills(shared.skills.all, allExpected);
    const categoryValidation = validateCategories(shared.skills, GOLDEN);
    const topicCoverage      = validateTopicCoverage(shared.skills.all, shared.topicTexts);
    const questionCoverage   = validateQuestionCoverage(shared.skills.all, shared.questionTexts);
    const duplicates         = findDuplicateSkills(shared.skills);

    const report = buildScoringReport({
      comparison,
      categoryValidation,
      topicCoverageResult:    topicCoverage,
      questionCoverageResult: questionCoverage,
      duplicates,
      thresholds: GOLDEN.thresholds,
    });

    printReport(report, 'TC_AIP_009 Full Pipeline Score');

    // Attach scores to Playwright HTML report
    test.info().annotations.push({
      type:        'AI Pipeline Scores',
      description: JSON.stringify(report.scores, null, 2),
    });

    expect(
      report.overallPass,
      `Pipeline FAILED.\nScores: ${JSON.stringify(report.scores, null, 2)}\nFailed checks: ${Object.entries(report.passes).filter(([,v]) => !v).map(([k]) => k).join(', ')}`
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_AIP_010 — Hallucination Rate
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_AIP_010 — Hallucination Rate', () => {
  test('Extracted skills do not contain significant hallucinations', async () => {
    requirePipeline();

    const allExpected = [...GOLDEN.mustHave, ...GOLDEN.goodToHave, ...GOLDEN.bonus];
    const comparison  = compareSkills(shared.skills.all, allExpected);

    console.log(`Hallucination rate: ${(comparison.hallucinationRate * 100).toFixed(1)}%`);
    console.log(`Hallucinated (${comparison.hallucinated.length}): ${comparison.hallucinated.join(', ') || 'none'}`);

    // Informational: log what the AI found that wasn't in golden
    // These may be legitimately good extractions the golden list doesn't cover
    if (comparison.hallucinated.length > 0) {
      console.info('Note: "hallucinated" skills may be valid extractions not yet in the golden dataset.');
      console.info('Consider adding these to goldenSkills.json if they are genuinely relevant:');
      comparison.hallucinated.forEach(s => console.info(`  "${s}"`));
    }

    expect(
      comparison.hallucinationRate,
      `Hallucination rate ${(comparison.hallucinationRate * 100).toFixed(1)}% > threshold ${(GOLDEN.thresholds.hallucinationRate * 100).toFixed(1)}%`
    ).toBeLessThanOrEqual(GOLDEN.thresholds.hallucinationRate);
  });
});