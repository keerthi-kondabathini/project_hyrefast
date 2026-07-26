# HyreFast Automation Framework

> Playwright + JavaScript | Page Object Model | Data-Driven | Multi-Environment

---

## Project Structure

```
hyrefast-automation/
├── playwright.config.js          # Central Playwright config
├── package.json                  # Scripts & dependencies
│
├── .env.staging                  # Staging credentials (fill in)
├── .env.production               # Production credentials (fill in)
│
├── data/
│   └── testData.json             # All test data — drives every test scenario
│
├── pages/                        # Page Object Models
│   ├── BasePage.js               # Shared helpers (fill, wait, assert, counter)
│   ├── LoginPage.js              # Login page interactions
│   ├── DashboardPage.js          # Dashboard — counters, logout, nav
│   └── JDCreationPage.js         # Full 5-step JD creation wizard
│
├── utils/
│   ├── helpers.js                # Date utils, faker, env readers
│   └── authFixture.js            # Custom Playwright fixture (loggedInPage)
│
├── tests/
│   ├── auth/
│   │   └── login.spec.js         # TC_AUTH_001–004: Login / Logout
│   └── jd/
│       └── jdCreation.spec.js    # TC_JD_001–002 + smoke: JD creation
│
└── reports/
    └── html/                     # Auto-generated HTML report
```

---

## Setup

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Configure environments

Fill in your credentials in `.env.staging` and `.env.production`:

```env
# .env.staging
BASE_URL=https://staging.hyrefast.ai
USER_EMAIL=your@email.com
USER_PASSWORD=yourpassword
USER_FULL_NAME=Your Full Name
WORKSPACE_NAME=staging workspace
WORKSPACE_SLUG=staging-workspace
HEADLESS=true
```

```env
# .env.production
BASE_URL=https://app.hyrefast.ai
USER_EMAIL=prod@email.com
USER_PASSWORD=prodpassword
USER_FULL_NAME=Your Full Name
WORKSPACE_NAME=prod workspace
WORKSPACE_SLUG=prod-workspace
HEADLESS=true
```

---

## Running Tests

### By environment

```bash
# Run all tests on staging (default)
npm run test:staging

# Run all tests on production
npm run test:production
```

### By feature

```bash
# Auth tests only (staging)
npm run test:staging:auth

# JD creation tests only (staging)
npm run test:staging:jd

# Auth tests only (production)
npm run test:production:auth

# JD creation tests only (production)
npm run test:production:jd
```

### Debug / Headed mode

```bash
# Open browser visually (good for local debugging)
npm run test:headed

# Step-by-step debug mode
npm run test:debug
```

### View report

```bash
npm run report
```

---

## Test Cases

### Authentication (`tests/auth/login.spec.js`)

| ID           | Description                                      | Expected |
|--------------|--------------------------------------------------|----------|
| TC_AUTH_001  | Successful login shows correct dashboard         | Pass     |
| TC_AUTH_002  | Successful logout returns to login page          | Pass     |
| TC_AUTH_003  | Invalid credentials show error                   | Pass     |
| TC_AUTH_004  | Login page loads with all required elements      | Pass     |

### JD Creation (`tests/jd/jdCreation.spec.js`)

| ID              | Description                                         | Expected |
|-----------------|-----------------------------------------------------|----------|
| tc_jd_001       | Create & publish a .NET developer JD                | Count +1 |
| tc_jd_002       | Create & save-as-draft a React developer JD         | No count change |
| TC_JD_SMOKE_001 | Create Job button opens JD wizard                   | Pass     |

---

## Adding New Test Scenarios

### Option A — Add data (zero code change)

Open `data/testData.json` and add a new object to `jdCreation.scenarios`:

```json
{
  "id": "tc_jd_003",
  "description": "Create a QA Engineer JD as draft",
  "jobTitle": "qa engineer",
  "workspaceEnvKey": "WORKSPACE_NAME",
  "employmentType": "Full-time",
  "workMode": "Remote",
  "locationQuery": "hyderabad",
  "locationOption": "Hyderabad Telangana, India",
  "publishAction": "Save as Draft",
  "closingDateOffsetDays": 60,
  "platforms": [
    { "name": "LinkedIn", "label": "LinkedIn" }
  ],
  "extraSkill": {
    "type": "Must Have",
    "name": "Selenium",
    "proficiency": "L3 — Intermediate",
    "aliases": "selenium webdriver",
    "rationale": "Core automation skill for QA"
  }
}
```

The test loop in `jdCreation.spec.js` picks it up automatically — no code changes needed.

### Option B — Add a new feature POM

1. Create `pages/FeaturePage.js` extending `BasePage`
2. Create `tests/feature/feature.spec.js`
3. Import and use `authFixture` for login

---

## Key Design Decisions

### Page Object Model
Each page/wizard step is encapsulated in its own POM. Tests never use raw `page.locator()` calls — all selectors are defined once in the POM.

### Data-Driven via JSON
All test inputs (job titles, locations, skill configs, platform links) live in `data/testData.json`. Swap data, run different scenarios without touching test code.

### Multi-Environment via `.env` files
`TEST_ENV=staging` or `TEST_ENV=production` selects the right `.env.*` file. Credentials, base URLs, and workspace names are all environment-specific. Tests are identical across environments.

### Custom Fixture (`loggedInPage`)
`authFixture.js` provides a `loggedInPage` fixture that logs in before the test and logs out after — eliminating login/logout boilerplate from every spec file.

### AI Step Timeouts
HyreFast has heavy AI generation steps (JD generation, skill generation, question bank). All timeouts are centralized in `data/testData.json` under `timeouts` — easy to tune without editing test code.

---

## Planned Test Coverage (Future Sprints)

| Area                   | File (planned)                         |
|------------------------|----------------------------------------|
| Resume Analysis        | `tests/resume/resumeAnalysis.spec.js`  |
| Interview Analysis     | `tests/interview/interviewAnalysis.spec.js` |
| Candidate Flow         | `tests/candidate/candidateInterview.spec.js` |
| Role-Based Access      | `tests/rbac/roleAccess.spec.js`        |
| JD Edit / Delete       | `tests/jd/jdManagement.spec.js`        |
| Score Evaluation       | `tests/evaluation/scoreEval.spec.js`   |
