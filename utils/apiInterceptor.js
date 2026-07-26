// utils/apiInterceptor.js
/**
 * ApiInterceptor — captures HyreFast AI API responses during a Playwright session.
 *
 * Usage in a test:
 *   const interceptor = new ApiInterceptor(page);
 *   interceptor.start();
 *   // ... trigger AI generation ...
 *   const skills = await interceptor.waitForSkillsResponse();
 *   interceptor.stop();
 *
 * URL patterns are based on observed network traffic from HyreFast staging.
 * Update the PATTERNS object if endpoint paths change.
 */

const PATTERNS = {
  // Skills extraction response (Step 2)
  skills:    /\/client\/api\/v1\/mastra\/recruiter\/jd\/skills-intelligence\/(async|status)/i,
  // Topics generation response (Step 3)
  topics:    /\/client\/api\/labs\/prompt-config\?key=analysis\.topics|\/topics/i,
  // Question generation response (Step 4)
  questions: /\/api\/.*question|\/questions\/generate|\/interview.*question/i,
  // JD generation (Step 1)
  jd:        /\/client\/api\/v1\/mastra\/recruiter\/jd\/(?!skills-intelligence).*/i,
};

class ApiInterceptor {
  constructor(page) {
    this.page      = page;
    this._captured = {};    // pattern name → last captured body
    this._handlers = {};    // pattern name → handler function
    this._active   = false;
  }

  // ── Lifecycle ──────────────────────────────────────────
  start() {
    if (this._active) return;
    this._active = true;

    this._routeHandler = async (route, request) => {
      const url = request.url();
      let response;
      try {
        response = await route.fetch({ timeout: 120_000 });
      } catch (error) {
        console.warn(`[ApiInterceptor] route.fetch failed for ${url}: ${error.message}`);
        await route.continue();
        return;
      }

      for (const [name, pattern] of Object.entries(PATTERNS)) {
        if (pattern.test(url)) {
          try {
            const body = await response.json();
            this._captured[name] = { url, body, timestamp: Date.now() };
            console.log(`[ApiInterceptor] Captured ${name} response from ${url}`);
          } catch {
            // Response is not JSON (e.g. streaming or non-JSON) — skip capture.
          }
        }
      }

      await route.fulfill({ response });
    };

    this.page.route('**/*', this._routeHandler);
  }

  stop() {
    if (!this._active) return;
    this._active = false;
    this.page.unroute('**/*', this._routeHandler);
  }

  // ── Wait helpers ───────────────────────────────────────

  /**
   * Wait until a response matching `patternName` has been captured.
   * @param {'skills'|'topics'|'questions'|'jd'} patternName
   * @param {number} timeoutMs
   * @returns {Promise<Object>}  The parsed JSON response body
   */
  async waitForResponse(patternName, timeoutMs = 60_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this._captured[patternName]) return this._captured[patternName];
      await this.page.waitForTimeout(500);
    }
    throw new Error(`[ApiInterceptor] Timed out waiting for "${patternName}" API response after ${timeoutMs}ms`);
  }

  async waitForSkillsResponse(timeoutMs = 90_000) {
    return this.waitForResponse('skills', timeoutMs);
  }

  async waitForTopicsResponse(timeoutMs = 60_000) {
    return this.waitForResponse('topics', timeoutMs);
  }

  async waitForQuestionsResponse(timeoutMs = 60_000) {
    return this.waitForResponse('questions', timeoutMs);
  }

  // ── Parsers ────────────────────────────────────────────

  /**
   * Extract a flat { mustHave, goodToHave, bonus } object from captured skills response.
   * Handles common HyreFast API response shapes.
   */
  parseSkillsFromResponse(responseBody) {
    const body = responseBody?.body ?? responseBody;

    // Shape 1: { skills: { must_have: [], good_to_have: [], bonus: [] } }
    if (body?.skills) {
      return {
        mustHave:   (body.skills.must_have    || body.skills.mustHave    || []).map(s => s.name || s),
        goodToHave: (body.skills.good_to_have || body.skills.goodToHave  || []).map(s => s.name || s),
        bonus:      (body.skills.bonus        || []).map(s => s.name || s),
      };
    }

    // Shape 2: { data: { must_have: [], ... } }
    if (body?.data) {
      return this.parseSkillsFromResponse(body.data);
    }

    // Shape 2b: wrapper objects used by HyreFast AI jobs
    if (body?.success !== undefined && typeof body.success === 'boolean') {
      if (body?.result) return this.parseSkillsFromResponse(body.result);
      if (body?.jobResult) return this.parseSkillsFromResponse(body.jobResult);
      if (body?.payload) return this.parseSkillsFromResponse(body.payload);
      if (body?.data) return this.parseSkillsFromResponse(body.data);
    }

    // Shape 3: flat array with category field
    if (Array.isArray(body)) {
      const result = { mustHave: [], goodToHave: [], bonus: [] };
      for (const item of body) {
        const cat  = (item.category || item.type || '').toLowerCase().replace(/[-_ ]/g, '');
        const name = item.name || item.skill || item;
        if (cat.includes('musthave') || cat === 'must')   result.mustHave.push(name);
        else if (cat.includes('goodtohave') || cat === 'good') result.goodToHave.push(name);
        else if (cat === 'bonus')                         result.bonus.push(name);
      }
      return result;
    }

    console.warn('[ApiInterceptor] Unknown skills response shape:', JSON.stringify(body).slice(0, 200));
    return { mustHave: [], goodToHave: [], bonus: [] };
  }

  /**
   * Extract topic names + associated skill lists from captured topics response.
   * Returns [{ name, skills: [] }]
   */
  parseTopicsFromResponse(responseBody) {
    const body = responseBody?.body ?? responseBody;
    const raw  = body?.topics || body?.data?.topics || body || [];
    if (!Array.isArray(raw)) return [];

    return raw.map(t => ({
      name:   t.name || t.title || t.topic || '',
      skills: (t.skills || t.related_skills || t.tags || []).map(s => s.name || s),
      text:   [t.name, t.title, t.description, ...(t.skills || []).map(s => s.name || s)]
                .filter(Boolean).join(' '),
    }));
  }

  /**
   * Extract question strings from captured questions response.
   * Returns string[]
   */
  parseQuestionsFromResponse(responseBody) {
    const body = responseBody?.body ?? responseBody;
    const raw  = body?.questions || body?.data?.questions || body || [];
    if (!Array.isArray(raw)) return [];
    return raw.map(q => q.question || q.text || q.content || q).filter(q => typeof q === 'string');
  }

  /** Return the raw captured object (for debugging) */
  getCaptured(patternName) {
    return this._captured[patternName] || null;
  }

  clearCapture(patternName) {
    delete this._captured[patternName];
  }
}

module.exports = { ApiInterceptor, PATTERNS };