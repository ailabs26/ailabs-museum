# VT-081: Configurable public report rate limit

## Intent

Let the museum team adjust how many public content reports one client IP may submit per minute through deployment configuration, without changing code in multiple places. Keep the current default of 5.

## Goals and non-goals

- Add `PUBLIC_REPORT_RATE_LIMIT`, default 5, accepted range 1–100 reports per minute.
- Apply the configured value to `POST /public/reports` and reject invalid configuration at startup.
- Preserve per-IP throttling, public report validation and the permission checks on admin report routes.
- Do not add an admin UI, database storage, migration, dependency or framework.

## Acceptance criteria

1. With the variable absent, the public route accepts up to 5 valid reports from one IP in a 60-second window and rejects the next request.
2. Values 1 and 100 are accepted; 0, 101 and non-integer values are rejected at startup.
3. API tests assert report creation/count and throttling outcome, not just status codes.
4. Admin report resolution still requires `report:resolve`; a caller without that permission receives 403 and cannot change report state.
5. A 40-client API harness accepts 40 valid reports and measures p95 at most 1.5 seconds using an in-memory service; this is a harness result, not production/database capacity proof.

## Non-functional constraints

- API p95 target: at most 1.5 seconds for 40 concurrent tasks.
- Rate limiting is process-local and per IP, as in the existing throttler; horizontal deployments need shared storage before relying on a cluster-wide quota.
- No new runtime dependency and no database migration.

## Invariant

Only requests within the configured per-IP window reach report creation, and every admin report mutation remains protected by the declared RBAC permission.

## Approaches

- **Deployment environment setting (selected):** follows the existing validated environment and namespaced config pattern, keeps the 5/minute behavior by default and avoids database work. Changing it requires a service restart.
- **Database-backed admin setting:** supports live changes but requires persistent schema, migration approval, and an admin editing flow outside this assignment's smallest slice.
- **Central code constant:** removes duplicated literals but still requires a code change and redeploy to adjust the business value.

The environment setting is the smallest option that meets the request and repository constraints. The user approved this direction on 2026-10-31.

## Baseline and scope

- Repository: `ailabs26/ailabs-museum`; base `origin/dev`, baseline `4c2a6d0`.
- Current implementation: `ContentReportsModule` and `PublicReportsController` hard-code 5 requests per 60 seconds; configuration already uses `Environment` validation and namespaced Nest config.
- Change scope: backend env validation/config, report throttler wiring, focused API/config tests, concise run instructions and local assignment evidence PDF.
