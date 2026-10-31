# VT-081 Public Report Rate Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public report requests-per-minute value adjustable through one validated deployment setting, while preserving real per-IP throttling and admin RBAC.

**Architecture:** Add a validated `PUBLIC_REPORT_RATE_LIMIT` value to the existing backend configuration flow and expose it under the `reports` namespace. Configure Nest Throttler from `ConfigService`, remove the route-local duplicate limit, and prove effective behavior through HTTP tests with the real throttler.

**Tech Stack:** Existing NestJS 10, `@nestjs/config`, `@nestjs/throttler`, class-validator, Node test runner, Supertest. No dependency changes.

**Spec:** `docs/tasks/vt081-report-rate-config/spec.md`

## Global Constraints

- Default: 5 public report requests per IP per 60 seconds.
- Accepted setting range: integer 1–100 inclusive.
- Keep `POST /public/reports` public and rate-limited; retain permission checks for admin report routes.
- No migrations, new dependencies or framework changes.
- Test observable report creation and state, not only HTTP status.
- Performance target: p95 ≤1.5 seconds for 40 concurrent tasks; label the in-memory harness limits.

## Review Focus

- Boundary values and malformed strings must fail before serving traffic — pin with config tests at 0, 1, 100, 101 and a fractional value.
- Each client IP must have an independent quota — load test with 40 distinct forwarded client IPs in the harness.
- The accepted request must create exactly one report and the blocked request must create none — assert fake service call counts and returned report data.
- Missing admin permission must prevent the report state transition — assert 403, unchanged state, and zero service calls.
- Test clocks, order and shared counters must not leak between cases — use a fresh app/throttler storage per test and no sleeps.

---

### Task 1: Validate the business setting

**Files:**
- Modify: `back-end/src/config/env.validation.ts`
- Modify: `back-end/src/config/tests/config.spec.ts`
- Modify: `back-end/.env.example`
- Create: `back-end/src/config/reports.config.ts`
- Modify: `back-end/src/config/index.ts`
- Modify: `back-end/src/app.module.ts`

**Interfaces:**
- Environment input/output: `PUBLIC_REPORT_RATE_LIMIT: number`, default `5`, min `1`, max `100`.
- Config namespace: `reports.publicRateLimit: number`.

- [x] Add config tests for default 5, boundaries 1 and 100, and rejection of 0, 101 and non-integer input; initial run failed at TypeScript compile because the environment field did not exist.
- [x] Add class-validator bounds and `reports` namespace; list the variable in `.env.example` and load the namespace in `AppModule`.
- [x] Re-run `npm run test:core`: 311 passed, 0 failed, 0 skipped.

### Task 2: Apply the configured limit to the public API

**Files:**
- Modify: `back-end/src/modules/content-reports/content-reports.module.ts`
- Modify: `back-end/src/modules/content-reports/controllers/public-reports.controller.ts`
- Create: `back-end/src/modules/content-reports/tests/content-reports-rate-limit-http.spec.ts`
- Create: `back-end/src/modules/content-reports/tests/content-reports-config.spec.ts`

**Interfaces:**
- Consume: `reports.publicRateLimit` from `ConfigService`.
- Keep route contract: `POST /public/reports`, `ttl=60_000`, per-IP bucket.

- [x] Add an API test that runs the real `ThrottlerGuard` with configured limit 2; assert two reports are created and returned, then the third request is rate-limited and creates no report.
- [x] Run the new test and confirm it fails against the hard-coded route limit: expected 429, received 201.
- [x] Wire `ThrottlerModule.forRootAsync` to the validated namespace, test the exact 60-second options mapping, and remove the route-local `@Throttle({ limit: 5 })` duplicate.
- [x] Run `npm run test:reports`: 21 passed, 0 failed, 0 skipped; 40 simulated IPs created 40 reports, latest p95 130.5 ms. HTTP cases cover absent-setting default 5 (sixth blocked), custom limit 2, and invalid-body 400 with zero creations.

### Task 3: Prove authorization and 40-client performance

**Files:**
- Create: `back-end/src/modules/content-reports/tests/content-reports-authorization-http.spec.ts`
- Modify: `back-end/src/modules/content-reports/tests/content-reports-service.spec.ts` (failure path proves no report creation)
- Modify: `back-end/src/modules/content-reports/content-reports.module.ts` (testable options factory)

- [x] Add an HTTP test using the real `PermissionsGuard` on `POST /reports/:id/resolve`; a caller without `report:resolve` must get 403, leave the report open, and make zero resolve calls.
- [x] Run the test and confirm it passes on current code.
- [x] On temporary local branch `codex/vt081-mutation` from baseline `4c2a6d0`, remove `@Permissions(PERMISSIONS.REPORT_RESOLVE)` from the resolve route; the HTTP test failed as expected (201 instead of 403). Restore the decorator, switch back to the submission branch, and rerun the test successfully. The mutation branch was not pushed.
- [x] Add a no-database API harness case for 40 concurrent distinct client IPs using limit 100; assert 40 successful creations and measured p95 ≤1500 ms. Keep app setup outside the timed interval and report this as harness evidence only.
- [x] Run `npm run test:reports`: all 40 report creations succeeded; latest p95 sample 130.5 ms.

### Task 4: Prepare evidence and reviewable handoff

**Files:**
- Create: `docs/tasks/vt081-report-rate-config/README.md`
- Create locally only: `output/pdf/BT3_23001943_VT-081.pdf`

- [x] Add a short README with the focused commands, configuration bounds, branch/baseline and test limitations.
- [x] Capture the RED results (missing environment field; expected 429 but got 201; auth mutation expected 403 but got 201), green suite totals (311 core; 21 reports), 40/40 creations and latest p95 130.5 ms. Check flake risks: each HTTP scenario uses a fresh app/storage; the timed interval excludes app setup and uses 40 unique IPs, without sleeps or shared database state.
- [ ] Build an original 10-case risk matrix, traceability table, AI Usage Log, two untrusted AI suggestions and a 250–350-word reflection in the PDF.
- [ ] Render and inspect every PDF page; keep the PDF out of Git staging.
- [x] Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:core`, `npm run test:reports` and native coverage; all passed. Coverage: 86.71% lines, 71.55% branches (Node test coverage, report-slice source files).
- [ ] Review the complete diff, commit the branch, publish it as a PR targeting `dev`, and stop before merge for human review.
