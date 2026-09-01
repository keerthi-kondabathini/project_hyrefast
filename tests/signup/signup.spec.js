// tests/signup/signup.spec.js
/**
 * Sign Up Test Suite
 *
 *  TC_SGN_001  Sign up → Recruiting mode workspace setup
 *  TC_SGN_002  Sign up → Agency mode selected at workspace setup
 *  TC_SGN_003  Sign up → Recruiting mode selected → switch to Agency via toggle
 *
 * Each test generates a fresh YopMail address so there is no cross-test
 * contamination and every run produces a new account.
 */
const { test, expect }  = require('../../utils/authFixture');
const { SignupPage }    = require('../../pages/SignupPage');
const { YopMailPage }   = require('../../pages/YopMailPage');
const { generateYopMailUser, faker, getEnv } = require('../../utils/helpers');
const testData = require('../../data/testData.json');

const SU = testData.signup;

// ─── Shared helper: fill signup form ────────────────────────────────────────
function randomPhone() {
  // 10-digit number that looks valid
  return `9${Math.floor(Math.random() * 900_000_000 + 100_000_000)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TC_SGN_001 — Sign Up + Recruiting Mode
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_SGN_001 — Sign Up with Recruiting Mode', () => {

  test('New user signs up, activates via email, chooses Recruiting mode workspace', async ({
    browser
  }) => {
    const user                   = await generateYopMailUser();
    const { email, yopUsername } = user;
    const timeouts = testData.timeouts;

    // ── Open signup page (fresh context — not logged in) ──
    const context   = await browser.newContext();
    const page      = await context.newPage();
    const signup    = new SignupPage(page);

    await test.step('Navigate to HyreFast login/signup page', async () => {
      await signup.navigate();
      await signup.assertLoginPageVisible();
    });

    await test.step('Open Sign Up tab and verify page elements', async () => {
      await signup.openSignUpTab();
      await signup.assertSignUpPageElements(SU.expectedCredits);
    });

    await test.step(`Fill and submit sign-up form (${email})`, async () => {
      await signup.fillAndSubmitSignUp({
        fullName: `Test User ${yopUsername.slice(-4).toUpperCase()}`,
        phone:    randomPhone(),
        email:    email,
        password: getEnv(SU.passwordEnvKey, 'password'),
      });
    });

    await test.step('Assert account created confirmation', async () => {
      await signup.assertAccountCreated();
    });

    // ── Open YopMail in a second context ─────────────────
    const yopContext = await browser.newContext();
    const yopPage    = await yopContext.newPage();
    const yopMail    = new YopMailPage(yopPage);

    await test.step(`Open email inbox: ${email}`, async () => {
      await yopMail.openInbox(user);
    });

    await test.step('Verify activation email is received', async () => {
      let found = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        const visible = await yopMail.mailFrame()
          .getByText('Activate Your HyreFast')
          .isVisible()
          .catch(() => false);
        if (visible) { found = true; break; }
        console.log(`Activation email not yet received (attempt ${attempt}) — retrying...`);
        await yopMail.refreshInbox();
        await yopPage.waitForTimeout(timeouts.activationEmail);
      }
      expect(found, `Activation email not received in ${email} after 4 attempts`).toBe(true);

      // Also verify the tagline
      await expect(
        yopMail.mailFrame().locator('div').filter({
          hasText: /^Automate interviews\. Analyze candidates\. Hire with confidence\.$/
        })
      ).toBeVisible({ timeout: 10_000 });
    });

    // ── Click activation link → opens page2 ──────────────
    let activationPage;
    await test.step('Click "Activate My Account →" link', async () => {
      const popup = yopContext.waitForEvent('page');
      await yopMail.mailFrame()
        .getByRole('link', { name: 'Activate My Account →' })
        .click();
      activationPage = await popup;
      await activationPage.waitForLoadState('networkidle');
    });

    // ── Workspace setup on activation page ───────────────
    const setupPage = new SignupPage(activationPage);

    await test.step('Assert workspace mode selection screen', async () => {
      await setupPage.assertWorkspaceSetupScreen();
    });

    await test.step('Select Recruiting mode and continue', async () => {
      await setupPage.selectRecruitingMode();
    });

    await yopContext.close();
    await context.close();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_SGN_002 — Sign Up + Agency Mode (selected at setup)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_SGN_002 — Sign Up with Agency Mode (direct selection)', () => {

  test('New user signs up, activates via email, chooses Agency mode at workspace setup', async ({
    browser
  }) => {
    const user                   = await generateYopMailUser();
    const { email, yopUsername } = user;
    const timeouts = testData.timeouts;

    const context = await browser.newContext();
    const page    = await context.newPage();
    const signup  = new SignupPage(page);

    await test.step('Sign up with a fresh YopMail account', async () => {
      await signup.navigate();
      await signup.openSignUpTab();
      await signup.fillAndSubmitSignUp({
        fullName: `Agency User ${yopUsername.slice(-4).toUpperCase()}`,
        phone:    randomPhone(),
        email:    email,
        password: SU.password,
      });
      await signup.assertAccountCreated();
    });

    const yopContext = await browser.newContext();
    const yopPage    = await yopContext.newPage();
    const yopMail    = new YopMailPage(yopPage);

    await test.step('Open activation email in inbox', async () => {
      await yopMail.openInbox(user);
      let found = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        const visible = await yopMail.mailFrame()
          .getByText('Activate Your HyreFast')
          .isVisible().catch(() => false);
        if (visible) { found = true; break; }
        await yopMail.refreshInbox();
        await yopPage.waitForTimeout(timeouts.activationEmail);
      }
      expect(found, `Activation email not found in ${email}`).toBe(true);
    });

    let activationPage;
    await test.step('Click activation link', async () => {
      const popup = yopContext.waitForEvent('page');
      await yopMail.mailFrame()
        .getByRole('link', { name: 'Activate My Account →' })
        .click();
      activationPage = await popup;
      await activationPage.waitForLoadState('networkidle');
    });

    const setupPage = new SignupPage(activationPage);

    await test.step('Assert workspace setup screen', async () => {
      await setupPage.assertWorkspaceSetupScreen();
    });

    await test.step('Select Agency mode directly and verify company directory', async () => {
      await setupPage.selectAgencyModeDirectly();
    });

    await yopContext.close();
    await context.close();
  });

});

//// ─────────────────────────────────────────────────────────────────────────────
////  TC_SGN_003 — Sign Up + Recruiting mode → switch to Agency via toggle
//// ─────────────────────────────────────────────────────────────────────────────
//test.describe('TC_SGN_003 — Sign Up: Recruiting mode then switch to Agency via toggle', () => {

//  test('New user picks Recruiting mode then enables Agency mode via the switch on Company Profile page', async ({
//    browser
//  }) => {
//    const { email, yopUsername } = generateYopMailUser();
//    const timeouts = testData.timeouts;

//    const context = await browser.newContext();
//    const page    = await context.newPage();
//    const signup  = new SignupPage(page);

//    await test.step('Sign up with a fresh YopMail account', async () => {
//      await signup.navigate();
//      await signup.openSignUpTab();
//      await signup.fillAndSubmitSignUp({
//        fullName: `Switch User ${yopUsername.slice(-4).toUpperCase()}`,
//        phone:    randomPhone(),
//        email:    email,
//        password: SU.password,
//      });
//      await signup.assertAccountCreated();
//    });

//    const yopContext = await browser.newContext();
//    const yopPage    = await yopContext.newPage();
//    const yopMail    = new YopMailPage(yopPage);

//    await test.step('Open activation email in YopMail', async () => {
//      await yopMail.openInbox(yopUsername);
//      let found = false;
//      for (let attempt = 1; attempt <= 4; attempt++) {
//        const visible = await yopMail.mailFrame()
//          .getByText('Activate Your HyreFast')
//          .isVisible().catch(() => false);
//        if (visible) { found = true; break; }
//        await yopMail.refreshInbox();
//        await yopPage.waitForTimeout(timeouts.activationEmail);
//      }
//      expect(found, `Activation email not found in ${email}`).toBe(true);
//    });

//    let activationPage;
//    await test.step('Click activation link', async () => {
//      const popup = yopContext.waitForEvent('page');
//      await yopMail.mailFrame()
//        .getByRole('link', { name: 'Activate My Account →' })
//        .click();
//      activationPage = await popup;
//      await activationPage.waitForLoadState('networkidle');
//    });

//    const setupPage = new SignupPage(activationPage);

//    await test.step('Select Recruiting mode → lands on Primary Company Profile', async () => {
//      await setupPage.assertWorkspaceSetupScreen();
//      await setupPage.selectRecruitingMode();
//    });

//    await test.step('Toggle Agency mode switch → confirm → verify Agency mode active', async () => {
//      await setupPage.enableAgencyModeViaSwitch();
//    });

//    await yopContext.close();
//    await context.close();
//  });

//});