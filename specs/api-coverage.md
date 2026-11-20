# API Test Coverage

The API project calls the test backend directly. Its bearer token comes from the same `auth/send_otp_2fa` route used by the app. The incorrect AI API case `TC_AIP_003` is intentionally excluded.

Run with `npm run test:api:test`, or set `API_BASE_URL` and run `npm run test:api` for another environment.

## Current API coverage

| Existing suite | API checks |
|---|---|
| Authentication | `TC_AUTH_001` valid login, `TC_AUTH_002` logout, `TC_AUTH_003` invalid login, `TC_AUTH_004` protected profile |
| Job creation | `TC_JD_API_001` saves a draft through the wizard's draft-save API, verifies the persisted values, and soft-deletes the test job |
| Candidate Explorer | `TC_CEF_001–013`, `TC_CEF_015`: application list query by linked candidate/job/company IDs, status, active state, added-by, pagination, sort, and reset |
| Reports & Trackers | `TC_RPT_001–009`, `TC_RPT_014`: application list feed, company/job/stage/date/candidate filters, pagination, sort, and reset |
| Jobs and dashboard | Authenticated job list/count, job-status stats, credit balance |
| Applications and interviews | Workflow/filter configuration, application list, response list |
| Settings and RBAC | Workspace teams, roles, members, pending invites, company CRUD, user profile |
| Templates | Report template create/update/list/delete and interview-round template list APIs |

The app performs some Candidate Explorer searches in the browser, then sends linked record IDs to the API. The API cases check the server-side ID and status filters; they do not test browser search controls.

## Response value validation

API assertions now verify returned values against the corresponding data expectations in the existing browser cases: candidate identity/status fields and filter results, report rows and sort order, profile values after update, and company/template fields across create, list, update, and delete. These checks validate the API data behind the UI expectations; they do not replace visual assertions or prove that the browser rendered the values correctly.

## Remaining work

The repo had 153 browser tests across its Chromium and interview projects before these API additions. This is a first API coverage pass, not a conversion of every browser test. The job API check covers draft creation; full JD generation and publication are still untested at the API level. Other API equivalents still need to be added for candidate upload and import, team CRUD, invites and role changes, resume screening, interview execution, report export/email, signup, and password reset. Visual-only checks (page layout, menus, dialogs, clipboard, and navigation) have no API assertion of their own.
