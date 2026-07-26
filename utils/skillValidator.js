// utils/skillValidator.js
/**
 * SkillValidator — fuzzy matching engine for AI pipeline validation.
 *
 * HyreFast uses compound skill card names like "NET Framework Development",
 * "ASP.NET Development", "Code Quality & Security" rather than raw technology
 * names like ".NET Framework" or "Unit Testing". The matching logic handles this
 * via token overlap, substring containment, and a keyword alias table.
 */

const DEFAULT_THRESHOLDS = {
  recallScore:       0.55,
  precisionScore:    0.50,
  hallucinationRate: 0.55,
  topicCoverage:     0.70,
  questionCoverage:  0.60,
  categoryAccuracy:  0.55,
};

// ─── Alias map — HyreFast compound names ↔ canonical skill names ─────────────
// If either side matches the other's tokens, they are considered the same skill.
const SKILL_ALIASES = [
  ['net framework development', 'net framework', '.net framework', 'dotnet framework'],
  ['asp.net development', 'asp.net', 'aspnet', 'asp net core', 'asp.net core'],
  ['c# programming', 'c#', 'csharp', 'c# .net'],
  ['api design', 'rest api', 'restful api', 'web api', 'rest', 'api'],
  ['testing', 'unit testing', 'automated testing', 'test', 'xunit', 'nunit', 'code quality'],
  ['testing & code quality', 'testing', 'unit testing', 'code quality', 'xunit', 'nunit'],
  ['code quality & security', 'code quality', 'security', 'testing', 'sast'],
  ['problem solving', 'debugging', 'problem-solving'],
  ['communication', 'team collaboration', 'collaboration'],
  ['net framework', '.net framework', 'dotnet', '.net'],
  ['entity framework', 'entity framework core', 'ef core', 'dapper', 'orm'],
  ['azure devops', 'azure', 'devops', 'azure devops'],
  ['git', 'version control', 'github', 'gitlab'],
  ['sql', 'sql server', 'database', 'mssql', 't-sql'],
  ['docker', 'containerization', 'container'],
  ['microservices', 'microservice', 'micro services'],
  ['ci/cd', 'cicd', 'continuous integration', 'jenkins', 'github actions', 'gitlab ci'],
  ['leadership', 'team lead', 'mentoring'],
  ['visual studio', 'ide', 'jetbrains rider'],
];

function buildAliasLookup() {
  const map = new Map();
  for (const group of SKILL_ALIASES) {
    for (const term of group) {
      map.set(normalise(term), group.map(normalise));
    }
  }
  return map;
}

const ALIAS_LOOKUP = buildAliasLookup();

// ─── Normalisation ────────────────────────────────────────────────────────────
function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9#.\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'of', 'in', 'to', 'a', 'an', 'or', '&']);

function tokenise(text) {
  return normalise(text)
    .split(' ')
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

// ─── Alias expansion ──────────────────────────────────────────────────────────
function getAliases(text) {
  const n = normalise(text);
  // Direct lookup
  if (ALIAS_LOOKUP.has(n)) return ALIAS_LOOKUP.get(n);
  // Partial: if text contains a known alias key
  for (const [key, aliases] of ALIAS_LOOKUP.entries()) {
    if (n.includes(key) || key.includes(n)) return aliases;
  }
  return [n];
}

// ─── Core match logic ─────────────────────────────────────────────────────────
const MATCH_THRESHOLD = 0.25; // Lower threshold to handle compound names

function similarity(a, b) {
  const ta = new Set(tokenise(a));
  const tb = new Set(tokenise(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  const intersection = [...ta].filter(t => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return intersection / union;
}

function isMatch(a, b) {
  const na = normalise(a);
  const nb = normalise(b);

  // 1. Exact after normalisation
  if (na === nb) return true;

  // 2. One contains the other
  if (na.includes(nb) || nb.includes(na)) return true;

  // 3. Alias expansion — check if any alias of a matches any alias of b
  const aliasesA = getAliases(a);
  const aliasesB = getAliases(b);
  for (const aa of aliasesA) {
    for (const ab of aliasesB) {
      if (aa === ab) return true;
      if (aa.includes(ab) || ab.includes(aa)) return true;
    }
  }

  // 4. Token overlap (Jaccard)
  if (similarity(a, b) >= MATCH_THRESHOLD) return true;

  // 5. Any token from a exists in b's expanded aliases
  const tokensA = tokenise(a);
  const tokensB = tokenise(b);
  if (tokensA.some(t => tokensB.includes(t) && t.length > 2)) return true;

  return false;
}

function findBestMatch(skill, candidates) {
  let best = { matched: false, candidate: null, score: 0 };
  for (const c of candidates) {
    if (isMatch(skill, c)) {
      const score = similarity(skill, c);
      if (score > best.score) {
        best = { matched: true, candidate: c, score };
      }
    }
  }
  if (!best.matched) {
    // Return closest even if below threshold (for diagnostics)
    for (const c of candidates) {
      const score = similarity(skill, c);
      if (score > best.score) best = { matched: false, candidate: c, score };
    }
  }
  return best;
}

// ─── Comparison ───────────────────────────────────────────────────────────────
function compareSkills(extractedSkills, expectedSkills) {
  const matched      = [];
  const missing      = [];
  const hallucinated = [];

  for (const exp of expectedSkills) {
    const { matched: found, candidate, score } = findBestMatch(exp, extractedSkills);
    if (found) matched.push({ expected: exp, extracted: candidate, score });
    else missing.push(exp);
  }

  for (const ext of extractedSkills) {
    const { matched: found } = findBestMatch(ext, expectedSkills);
    if (!found) hallucinated.push(ext);
  }

  const recallScore       = expectedSkills.length  ? matched.length / expectedSkills.length : 1;
  const hallucinationRate = extractedSkills.length ? hallucinated.length / extractedSkills.length : 0;
  const precisionScore    = extractedSkills.length ? (extractedSkills.length - hallucinated.length) / extractedSkills.length : 1;

  return { matched, missing, hallucinated, recallScore, precisionScore, hallucinationRate, totalExpected: expectedSkills.length, totalExtracted: extractedSkills.length };
}

function validateCategories(extractedByCategory, expectedByCategory) {
  const results  = [];
  let correct    = 0;
  let total      = 0;
  const categories = ['mustHave', 'goodToHave', 'bonus'];

  for (const category of categories) {
    const expected  = expectedByCategory[category] || [];
    const extracted = extractedByCategory[category] || [];

    for (const expSkill of expected) {
      total++;
      const inCorrectCat = extracted.some(e => isMatch(e, expSkill));
      const otherCats    = categories.filter(c => c !== category);
      const miscatIn     = otherCats.find(c => (extractedByCategory[c] || []).some(e => isMatch(e, expSkill)));

      if (inCorrectCat) {
        correct++;
        results.push({ skill: expSkill, expectedCategory: category, status: 'correct' });
      } else if (miscatIn) {
        results.push({ skill: expSkill, expectedCategory: category, foundIn: miscatIn, status: 'miscategorised' });
      } else {
        results.push({ skill: expSkill, expectedCategory: category, status: 'missing' });
      }
    }
  }

  return {
    results,
    categoryAccuracy: total ? correct / total : 1,
    miscategorised:   results.filter(r => r.status === 'miscategorised'),
    missing:          results.filter(r => r.status === 'missing'),
  };
}

function validateTopicCoverage(extractedSkills, topicTexts) {
  const covered   = [];
  const uncovered = [];

  for (const skill of extractedSkills) {
    const found = topicTexts.some(text => isMatch(skill, text) || normalise(text).includes(normalise(skill)));
    if (found) covered.push(skill);
    else uncovered.push(skill);
  }

  return { covered, uncovered, topicCoverage: extractedSkills.length ? covered.length / extractedSkills.length : 1 };
}

function validateQuestionCoverage(extractedSkills, questionTexts) {
  const covered   = [];
  const uncovered = [];

  for (const skill of extractedSkills) {
    const skillTokens = tokenise(skill);
    const skillAliases = getAliases(skill);
    const found = questionTexts.some(q => {
      const qLower   = normalise(q);
      const qTokens  = tokenise(q);
      // Token overlap
      if (skillTokens.some(t => t.length > 2 && qTokens.includes(t))) return true;
      // Alias match
      if (skillAliases.some(alias => qLower.includes(alias))) return true;
      return false;
    });
    if (found) covered.push(skill);
    else uncovered.push(skill);
  }

  return { covered, uncovered, questionCoverage: extractedSkills.length ? covered.length / extractedSkills.length : 1 };
}

function findDuplicateSkills(byCategory) {
  const allSkills = [...(byCategory.mustHave || []), ...(byCategory.goodToHave || []), ...(byCategory.bonus || [])];
  const duplicates = [];
  const seen = [];

  for (const skill of allSkills) {
    const match = seen.find(s => isMatch(s, skill));
    if (match) {
      const group = duplicates.find(g => g.includes(match));
      if (group) group.push(skill);
      else duplicates.push([match, skill]);
    } else {
      seen.push(skill);
    }
  }
  return duplicates;
}

function buildScoringReport({ comparison, categoryValidation, topicCoverageResult, questionCoverageResult, duplicates, thresholds = DEFAULT_THRESHOLDS }) {
  const scores = {
    recallScore:       comparison.recallScore,
    precisionScore:    comparison.precisionScore,
    hallucinationRate: comparison.hallucinationRate,
    topicCoverage:     topicCoverageResult?.topicCoverage    ?? null,
    questionCoverage:  questionCoverageResult?.questionCoverage ?? null,
    categoryAccuracy:  categoryValidation?.categoryAccuracy  ?? null,
  };

  const passes = {
    recallScore:       scores.recallScore       >= thresholds.recallScore,
    precisionScore:    scores.precisionScore    >= thresholds.precisionScore,
    hallucinationRate: scores.hallucinationRate <= thresholds.hallucinationRate,
    topicCoverage:     scores.topicCoverage     === null || scores.topicCoverage     >= thresholds.topicCoverage,
    questionCoverage:  scores.questionCoverage  === null || scores.questionCoverage  >= thresholds.questionCoverage,
    categoryAccuracy:  scores.categoryAccuracy  === null || scores.categoryAccuracy  >= thresholds.categoryAccuracy,
  };

  return {
    overallPass: Object.values(passes).every(Boolean),
    scores, passes, thresholds,
    details: {
      matched:            comparison.matched,
      missing:            comparison.missing,
      hallucinated:       comparison.hallucinated,
      duplicates:         duplicates || [],
      uncoveredTopics:    topicCoverageResult?.uncovered     || [],
      uncoveredQuestions: questionCoverageResult?.uncovered  || [],
      miscategorised:     categoryValidation?.miscategorised || [],
    },
  };
}

function printReport(report, label = 'AI Pipeline Validation') {
  const pct  = (v) => v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`;
  const tick = (p) => p ? '✅' : '❌';
  console.log(`\n${'═'.repeat(60)}\n ${label}\n${'═'.repeat(60)}`);
  console.log(` Overall: ${report.overallPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(` ${tick(report.passes.recallScore)}  Recall:              ${pct(report.scores.recallScore)}  (≥${pct(report.thresholds.recallScore)})`);
  console.log(` ${tick(report.passes.precisionScore)}  Precision:           ${pct(report.scores.precisionScore)}  (≥${pct(report.thresholds.precisionScore)})`);
  console.log(` ${tick(report.passes.hallucinationRate)}  Hallucination:       ${pct(report.scores.hallucinationRate)}  (≤${pct(report.thresholds.hallucinationRate)})`);
  console.log(` ${tick(report.passes.topicCoverage)}  Topic coverage:      ${pct(report.scores.topicCoverage)}  (≥${pct(report.thresholds.topicCoverage)})`);
  console.log(` ${tick(report.passes.questionCoverage)}  Question coverage:   ${pct(report.scores.questionCoverage)}  (≥${pct(report.thresholds.questionCoverage)})`);
  console.log(` ${tick(report.passes.categoryAccuracy)}  Category accuracy:   ${pct(report.scores.categoryAccuracy)}  (≥${pct(report.thresholds.categoryAccuracy)})`);
  if (report.details.missing.length)      { console.log(`\n Missing (${report.details.missing.length}): ${report.details.missing.join(', ')}`); }
  if (report.details.hallucinated.length) { console.log(` Hallucinated (${report.details.hallucinated.length}): ${report.details.hallucinated.join(', ')}`); }
  if (report.details.duplicates.length)   { console.log(` Duplicates: ${report.details.duplicates.map(g => g.join(' ≈ ')).join('; ')}`); }
  console.log(`${'═'.repeat(60)}\n`);
}

module.exports = {
  normalise, tokenise, similarity, isMatch, findBestMatch,
  compareSkills, validateCategories, validateTopicCoverage,
  validateQuestionCoverage, findDuplicateSkills,
  buildScoringReport, printReport,
  DEFAULT_THRESHOLDS, MATCH_THRESHOLD,
};