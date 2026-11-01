# VT-080 engineering evidence

The table is the risk map. `4852e13` is the patch/test commit; `7b3ff9e` adds the documentation and simulated load harness. Both belong to `feat/vt080-user-restore`, targeted at `dev`.

| ID | AC / risk | Level | Precondition / input | Expected | Priority | Test file |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | AC1 soft delete | unit | active ordinary user | deleted marker and session revocation | P1 | `users-service.spec.ts` (existing) |
| T02 | AC1 prevent deleting admin | unit | admin role | rejection, no write | P1 | `users-service.spec.ts` (existing) |
| T03 | AC2 restore live roles | integration | deleted user with live/deleted roles | only live-role links remain | P1 | `trash-restore.integration.spec.ts` (existing; not run here) |
| T04 | AC2 invalid ID | integration | batch with live and deleted IDs | 409; deleted row unchanged | P1 | `trash-restore.integration.spec.ts` (existing; not run here) |
| T05 | AC2/AC4 batch property | unit/property | 100 seeded unique ID batches; affected = full or partial count | success iff all rows affected; role cleanup only on success | P1 | `users-restore.spec.ts` |
| T06 | AC3 read privacy | HTTP/API | token lacks `user:read`, target is another user | 403, service not called | P0 | `rbac-http.integration.spec.ts` (existing) |
| T07 | AC3 restore privacy | HTTP/API | token lacks `user:delete`, another user's ID | 403, service not called | P0 | `rbac-http.integration.spec.ts` (existing) |
| T08 | AC3 unauthenticated | HTTP/API | no token, users endpoint | 401, no user data | P0 | `rbac-http.integration.spec.ts` (existing) |
| T09 | AC4 zero update | unit | repository reports `affected=0` | reject, no success/role cleanup | P0 | `users-restore.spec.ts` |
| T10 | AC4 partial update | unit/property | `affected < ids.length` | reject within transaction, no role cleanup | P0 | `users-restore.spec.ts` |
| T11 | AC4 persistence throws | unit | update rejects | error propagates, no success | P0 | `users-restore.spec.ts` |
| T12 | workflow | E2E | admin deletes, opens trash, restores, views active list | restored user appears only after success | P2 | Manual future check; no new browser E2E for this repository-layer slice |
| T13 | AC4 repository adapter | unit | TypeORM result has `affected=2` or omits it | repository returns 2 or 0 | P1 | `users-restore.spec.ts` |

Property data: deterministic xorshift32 seeds 1–100, unique UUID-shaped IDs, batch sizes including both 1 and 100, and affected counts from 0 to `ids.length`. Each failure includes its seed for replay. The test checks the service's batch outcome and whether role cleanup can run; it does not prove database rollback or unrelated-row isolation.

Unit tests cover restoration outcomes and failure paths; existing HTTP tests exercise real global guards and route decorators. The existing PostgreSQL integration covers real role links and atomicity when database-owner approval permits running migrations. A new browser E2E duplicates established trash UI coverage and would not make the affected-row contract more observable, so it is not added here.

## Test-first timeline

Baseline `795103d9f5b28af248e11023d55e18538fc6f221`. Before the production patch:

```text
node -r reflect-metadata -r ts-node/register --test src/modules/users/tests/users-restore.spec.ts
tests 1; pass 0; fail 1
AssertionError: Missing expected rejection (InternalServerErrorException).
```

The failure is the intended behavior gap: `restoreMany` returned success after a zero-row update. After the patch:

```text
node -r reflect-metadata -r ts-node/register --test src/modules/users/tests/users-restore.spec.ts
tests 4; pass 4; fail 0 (after direct repository test)
node -r reflect-metadata -r ts-node/register --test src/common/tests/rbac-http.integration.spec.ts
tests 66; pass 66; fail 0
npm.cmd test
tests 1964; pass 1964; fail 0
npm.cmd run typecheck, npm.cmd run lint, npm.cmd run build: all exit 0
```

Diff review before `4852e13`: only `UsersRepository.markRestored` returns `affected ?? 0`; `UsersService.restoreMany` rejects unequal counts within the existing transaction; new test uses a service fake for the database boundary. No controller/API/schema change. The explicit `InternalServerErrorException` follows Nest's existing 500 error path.

## Mutation experiment

Temporary commit `b1b7cfd` changed the service condition to `if (false && restored !== ids.length)`, deliberately allowing a zero-row update to return success. The focused test output was:

```text
tests 3; pass 1; fail 2
rejects a zero-row update: Missing expected rejection (InternalServerErrorException)
property test: Missing expected rejection (InternalServerErrorException): seed=1
```

The persistence-throws test still passed, showing that checking only thrown errors would miss the mutation. The temporary commit was removed with `git reset --mixed 4852e13`, the one-line mutation was reverted, and the focused tests passed 3/3 again. A later direct repository test also killed a temporary `return ids.length` mutation (3/4 passed, `2 !== 0`), then passed 4/4 after restoring the code. Its first run failed for an incomplete test double (`target` missing); that setup error was corrected before counting mutation evidence. `git log` on the submission branch contains no mutation commit.

## Coverage, flakiness, and performance

The targeted Node coverage run (`users-restore.spec.ts` + `users-service.spec.ts`) passed 32/32. `users.service.ts`: **98.61% line, 94.62% branch**; `users.repository.ts`: **46.26% line, 66.67% branch**; all included users files: **78.79% line, 86.45% branch**. The low repository coverage reflects that no PostgreSQL integration ran. AC1 has existing unit tests. AC2's real role-link preservation and mixed-ID atomicity have existing PostgreSQL integration tests that were **not run**; new unit tests check the count and cleanup sequence only. AC3 has HTTP guard tests with a service double. AC4 has the new unit/property/repository tests; real DB rollback and end-to-end p95 remain unproven. Coverage percentages alone do not establish those risks.

Flaky checks: (1) The new tests assert no wall-clock interval and use no `Date.now()`, so host clock drift cannot change their outcome. (2) The xorshift seeds and fresh harness per case avoid nondeterministic random input and shared mutable state; the focused tests passed before mutation, after mutation removal, and again inside `npm.cmd test`. The HTTP test does temporarily set `JWT_ACCESS_SECRET` and restores it in `after`; concurrent processes sharing an environment are outside this test run.

`node -r reflect-metadata -r ts-node/register src/modules/users/tests/users-restore-load.ts` ran **100 concurrent service operations** with unique fake IDs and an asynchronous **10 ms fake repository write**. Result: **p95 13.91 ms**, total 14.85 ms, versus the **3,000 ms** objective. This passes only the simulated service harness. It does not include HTTP, guards, real transactions, PostgreSQL locks, network, or a production data volume, so the 100-user/API p95 objective remains unverified.

## AI usage and critical review

| Tool / prompt | Output used | Correction and evidence |
| --- | --- | --- |
| Codex; user assignment + module-scoped planning prompt quoted in README | Candidate plan and file list | Rejected schema/migration and new endpoint after reading source; kept affected-count fix. |
| Codex; “write a test for zero affected rows, observe RED, add minimal repository/service check” | `users-restore.spec.ts`, `4852e13` | Red 0/1 → green 1/1; reviewed two-file production diff and full 3/3 test. |
| Codex; “mutate the success check, run detecting test, remove mutation” | temporary `b1b7cfd` | 2 tests killed mutation; commit removed, 3/3 green again. |
| Codex; “measure 100 concurrent simulated restores; label limitations” | `users-restore-load.ts` | p95 13.91 ms with fake 10 ms writes; no claim about real API load. |

Two plausible but untrusted AI outputs: (1) a new restore route and migration looked like a complete feature, yet duplicated existing API/schema and would violate the migration approval rule; (2) the property test with a fake repository looks broad over 100 cases, yet cannot prove real transaction rollback or another user's database isolation. The HTTP guard double likewise cannot prove real database isolation.

Traceability to the branch: AC1 → T01/T02 → `users-service.spec.ts` → baseline `795103d` → passed in full suite; AC2 → T03/T04 → `trash-restore.integration.spec.ts` → baseline → not run without database approval, and T05 → `users-restore.spec.ts` → `4852e13` → passed for count/cleanup sequencing; AC3 → T06–T08 → `rbac-http.integration.spec.ts` → baseline → 66/66 passed; AC4 → T09–T11/T13 → `users-restore.spec.ts` → `4852e13` plus follow-up test commit → 4/4 passed and mutations killed. T12 is a future manual E2E check, not claimed as passed.

Personal reflection (250–350 words) is intentionally left to the student preparing the PDF; this file records reproducible engineering observations rather than claiming a first-person experience for them.
