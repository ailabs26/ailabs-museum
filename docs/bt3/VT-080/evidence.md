# VT-080 engineering evidence

All rows belong to [PR #137](https://github.com/ailabs26/ailabs-museum/pull/137), branch `feat/vt080-user-restore`, base `dev`. The original baseline is `795103d`; the follow-up plan is `50b140c`.

| ID | AC / risk | Level | Precondition / input | Expected | Priority | Test file | Commit | Current result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | AC1 soft delete | unit | active ordinary user | deleted marker and session revocation | P1 | `users-service.spec.ts` | baseline | passed in full suite |
| T02 | AC1 prevent deleting admin | unit | admin role | rejection, no write | P1 | `users-service.spec.ts` | baseline | passed in full suite |
| T03 | AC2 restore live roles | integration | deleted user with live/deleted roles | only live-role links remain | P1 | `trash-restore.integration.spec.ts` | baseline | **not run**: migration approval required |
| T04 | AC2 invalid ID | integration | batch with live and deleted IDs | 409; deleted row unchanged | P1 | `trash-restore.integration.spec.ts` | baseline | **not run**: migration approval required |
| T05 | AC2/AC4 batch property | unit/property | 100 seeded unique ID batches; full or partial affected count | success iff all rows affected; cleanup only on success | P1 | `users-restore.spec.ts` | `4852e13` | 4/4 focused passed |
| T06 | AC3 other-user read | HTTP/API | actor ID differs from target; no `user:read` | detail/trash 403, no private email or service call | P0 | `rbac-http.integration.spec.ts` | `39b5288` | 67/67 HTTP passed; privacy mutation killed |
| T07 | AC3 other-user restore | HTTP/API | actor ID differs from target; no `user:delete` | 403, no service call | P0 | `rbac-http.integration.spec.ts` | `39b5288` | 67/67 HTTP passed |
| T08 | AC3 unauthenticated | HTTP/API | no token, users endpoint | 401, no user data | P0 | `rbac-http.integration.spec.ts` | baseline | 67/67 HTTP passed |
| T09 | AC4 zero update | unit | repository reports `affected=0` | reject, no success/role cleanup | P0 | `users-restore.spec.ts` | `4852e13` | passed; success mutation killed |
| T10 | AC4 partial update | unit/property | `affected < ids.length` | reject within transaction, no cleanup | P0 | `users-restore.spec.ts` | `4852e13` | passed; success mutation killed |
| T11 | AC4 persistence throws | unit | update rejects | error propagates, no success | P0 | `users-restore.spec.ts` | `4852e13` | passed |
| T12 | workflow | E2E | admin deletes, opens trash, restores, views active list | restored user appears only after success | P2 | planned manual check | — | **not run**; UI unchanged |
| T13 | AC4 repository adapter | unit | TypeORM result has `affected=2` or omits it | repository returns 2 or 0 | P1 | `users-restore.spec.ts` | `5696c3a` | passed; constant-count mutation killed |

Property data: deterministic xorshift32 seeds 1–100, unique UUID-shaped IDs, batch sizes including both 1 and 100, and affected counts from 0 to `ids.length`. Each failure includes its seed for replay. The test checks the service's batch outcome and whether role cleanup can run; it does not prove database rollback or unrelated-row isolation.

Unit tests cover restoration outcomes and failure paths; HTTP tests exercise real global guards and route decorators with a service double. The existing PostgreSQL integration covers real role links and atomicity when database-owner approval permits running migrations. A new browser E2E duplicates established trash UI coverage and would not make the affected-row contract more observable, so it is not added here. The final risk-based E2E scenario remains explicitly unrun.

## Test-first timeline

Baseline `795103d9f5b28af248e11023d55e18538fc6f221`. Before the production patch, the original run failed as captured in [red-baseline.txt](evidence/red-baseline.txt):

```text
node -r reflect-metadata -r ts-node/register --test src/modules/users/tests/users-restore.spec.ts
tests 1; pass 0; fail 1
AssertionError: Missing expected rejection (InternalServerErrorException).
```

The original run's raw stdout was not redirected at the time; `red-baseline.txt` transparently records the tool-output excerpt. For independent replay, run `git apply --unidiff-zero -R docs/bt3/VT-080/evidence/restore-production.patch` in a scratch checkout while keeping the new test, then run it; apply the patch again to restore the code. [red-baseline-replay.log](evidence/red-baseline-replay.log) shows **1/4 pass, 3/4 fail** on the baseline implementation (`undefined !== 2` and two missing rejections). The production files were restored and `git diff --exit-code` confirmed they match the branch. The failure is the intended behavior gap: `restoreMany` returned success after a zero-row update. After the patch:

```text
node -r reflect-metadata -r ts-node/register --test src/modules/users/tests/users-restore.spec.ts
tests 4; pass 4; fail 0 — evidence/green-restore.log
node -r reflect-metadata -r ts-node/register --test src/common/tests/rbac-http.integration.spec.ts
tests 67; pass 67; fail 0 — evidence/green-privacy-http.log
npm.cmd test
tests 1965; pass 1965; fail 0 — evidence/backend-suite.log
npm.cmd run typecheck / lint / build
all exit 0 — evidence/typecheck.log, lint.log, build.log
```

The full-suite log also shows that the PostgreSQL trash/restore suite was skipped because `CORE_TEST_DATABASE_URL` was absent. Node's final `skipped 0` counts individual test cases, not this skipped suite. No migration was run.

Diff review before `4852e13`: only `UsersRepository.markRestored` returns `affected ?? 0`; `UsersService.restoreMany` rejects unequal counts within the existing transaction; new test uses a service fake for the database boundary. No controller/API/schema change. The explicit `InternalServerErrorException` follows Nest's existing 500 error path. The later HTTP test changes no production code.

## Mutation experiment

Temporary commit `b1b7cfd` changed the service condition to `if (false && restored !== ids.length)`, deliberately allowing a zero-row update to return success. It is absent from the PR branch. The exact mutation is kept as [mutation-success.patch](evidence/mutation-success.patch); applying it in a scratch checkout and running the focused test reproduces [mutation-success.log](evidence/mutation-success.log):

```text
tests 4; pass 2; fail 2
rejects a zero-row update: Missing expected rejection (InternalServerErrorException)
property test: Missing expected rejection (InternalServerErrorException): seed=1
```

The persistence-throws test still passed, showing that checking only thrown errors would miss the mutation. The temporary commit was removed with `git reset --mixed 4852e13`, the one-line mutation was reverted, and the focused tests passed again. A later direct repository test also killed a temporary `return ids.length` mutation (3/4 passed, `2 !== 0`). Its first run failed for an incomplete test double (`target` missing); that setup error was corrected before counting mutation evidence.

An additional privacy mutation removed `@Permissions(USER_READ)` from `UsersController.getById`. Apply [mutation-privacy.patch](evidence/mutation-privacy.patch) with `git apply --unidiff-zero` in a scratch checkout. [mutation-privacy.log](evidence/mutation-privacy.log) shows **64/67 pass, 3 fail**, including the new other-user test (`expected 403, got 200`). Both mutation patches were reversed; `git diff --exit-code` confirmed the service and controller match their committed versions.

## Coverage, flakiness, and performance

The targeted Node coverage run (`users-restore.spec.ts` + `users-service.spec.ts`) passed 32/32. `users.service.ts`: **98.61% line, 94.62% branch**; `users.repository.ts`: **46.26% line, 66.67% branch**; all included users files: **78.79% line, 86.45% branch**. The low repository coverage reflects that no PostgreSQL integration ran. AC1 has existing unit tests. AC2's real role-link preservation and mixed-ID atomicity have existing PostgreSQL integration tests that were **not run**; new unit tests check the count and cleanup sequence only. AC3 has HTTP guard tests with a service double. AC4 has the new unit/property/repository tests; real DB rollback and end-to-end p95 remain unproven. Coverage percentages alone do not establish those risks.

Flaky checks: [flaky-check.cjs](evidence/flaky-check.cjs) was run from `back-end/`, with output in [flaky-check.log](evidence/flaky-check.log). The restore test passed **10/10 isolated repetitions**. Restore + HTTP tests passed with `TZ=UTC` and `TZ=Asia/Ho_Chi_Minh`, and with both file orders. This probes time-zone dependence, seeded-random repeatability, and test order/shared state. It does not prove absence of flakiness under network delay or real database concurrency. The HTTP test temporarily sets `JWT_ACCESS_SECRET` and restores it in `after` within its process.

`node -r reflect-metadata -r ts-node/register src/modules/users/tests/users-restore-load.ts` launched **100 concurrent service operations** with unique fake IDs. The fake transaction queue serializes each operation to model the existing management lock, and the fake repository waits **10 ms per write**. [load-100-serialized.json](evidence/load-100-serialized.json) reports **p95 1,136.53 ms**, total 1,192.29 ms, versus the **3,000 ms** objective. This passes only the simulated service harness. It does not include HTTP, guards, real transactions, PostgreSQL locks, network, or production data volume, so the 100-user/API p95 objective remains unverified. The earlier no-lock timer result (13.91 ms) was rejected as an unrealistic model of this code path.

## AI usage and critical review

| Tool / prompt | Output used | Correction and evidence |
| --- | --- | --- |
| Codex; user assignment + module-scoped planning prompt in README | Candidate plan and file list | Rejected schema/migration and new endpoint after reading source; kept affected-count fix. Initial AI context was wider than strictly allowed, disclosed in README. |
| Codex; “write a test for zero affected rows, observe RED, add minimal repository/service check” | `users-restore.spec.ts`, `4852e13` | Original RED 0/1, replay RED 1/4, GREEN 4/4; two-file production diff inspected before commit. |
| Codex; “mutate the success check, run detecting test, remove mutation” | temporary `b1b7cfd`, reproducible patch/log | 2 tests killed the required mutation; temp commit absent from PR. |
| Codex; follow-up prompt in `follow-up-plan.md` committed as `50b140c` | Other-user HTTP test, serialized load model, evidence artifacts | Rejected new restore route and migration gate; HTTP test committed `39b5288`, load model `ff69e9b`. |
| Codex; “check whether missing `user:read` exposes another user's email” | Private marker fixture + privacy mutation patch/log | Test failed `expected 403, got 200` under removed decorator; 67/67 passed after restoration. |
| Codex; “measure 100 concurrent restores with the shared lock modeled” | `users-restore-load.ts`, JSON result | Rejected initial no-lock p95 13.91 ms; serialized fake p95 1,136.53 ms, with real-load limit stated. |

Two plausible but untrusted AI outputs: (1) a new restore route and migration looked like a complete feature, yet duplicated existing API/schema and would violate the migration approval rule; (2) the property test with a fake repository looks broad over 100 cases, yet cannot prove real transaction rollback or another user's database isolation. The first load harness similarly returned a deceptively low p95 because it omitted the shared lock; the follow-up replaced that model. The HTTP guard double cannot prove real database isolation either.

The table above is the AC/risk → case → file → commit/PR → result traceability map. AC2 has a real-database proof gap because T03/T04 were not executed; AC3 has a database-isolation proof gap because its HTTP test uses a service double. These gaps matter more than the aggregate coverage percentages.

An AI-assisted [337-word reflection draft](reflection-draft.md) covers confidence gained, remaining proof gaps, and the next high-value test. The student must review and personalize it before signing the PDF declaration. The PDF itself remains the student's separate deliverable.
