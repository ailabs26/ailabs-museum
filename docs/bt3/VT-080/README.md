# BT3 VT-080 — user trash/restore vertical slice

Student: Đinh Bá Thi (23001942) · SE2026-T20 · 3D-WEB-03

Baseline: `795103d9f5b28af248e11023d55e18538fc6f221` (`origin/dev`, fetched 2026-11-01)

Branch: `feat/vt080-user-restore` · PR base: `dev`

## Specification

**Problem.** A successful restore response must mean every requested deleted user was actually restored, while related roles and access remain consistent. An incomplete write must not be reported as success. User records and the trash must remain available only to authorized administrators.

**Invariant.** For each accepted bulk restore, either every requested user has `isDeleted=false`, `deletedAt=null`, and no link to a deleted role in one committed transaction, or the transaction fails and none is restored. A caller without `user:read`/`user:delete` must not see/restore another user's record.

| ID | Testable acceptance criterion |
| --- | --- |
| AC1 | Soft delete hides a user from active queries and revokes that user's refresh sessions in the same transaction. |
| AC2 | Restore accepts only deleted IDs, clears deletion markers for the whole batch, drops links to deleted roles, and keeps live roles. Mixed valid/invalid batches change nothing. |
| AC3 | A caller without `user:read` cannot list or fetch users; without `user:delete` cannot restore. Unauthorized responses reveal no other user's details. |
| AC4 | If the database reports fewer updated rows than requested, restore rejects; it never returns `{ids}` or runs role cleanup as though the write succeeded. |

Constraints: preserve Controller → Service → Repository and existing API/RBAC; no schema migration; use a seeded, reproducible property-based test; test 100 simultaneous operations against a p95 ≤ 3.0 s objective, clearly distinguishing a simulated harness from database/API load.

## AI-assisted plan and repository review

**Module-scoped planning prompt recorded for this Codex run:** “Using `back-end/src/modules/users/` (controller, service, repositories, entity, DTO, tests), propose a small test-first vertical slice for VT-080: soft delete/restore consistency, property-based tests, unauthorized-user risk, and a mutation that returns success after persistence fails. Do not edit code yet. List assumptions and intended files.” The user also supplied the assignment and repository rules. Repository review then read the task document and existing common HTTP/integration tests to challenge the plan; the AI context was therefore not strictly limited to the module throughout the whole run.

Candidate assumptions in that module-limited plan: add deletion columns with a migration; add `POST /users/:id/restore`; return success after `markRestored` without checking its result. Candidate files: `users.service.ts`, `users.repository.ts`, `users.controller.ts`, `user.entity.ts`, a migration, and tests.

Repository review corrected the plan:

1. `User` already has `isDeleted`/`deletedAt`; `UsersService.softDelete` and `restoreMany` exist. `docs/tasks/admin-trash-restore.md` and the existing PostgreSQL test confirm the feature. Adding columns/migration would duplicate schema and violate the repository's explicit migration approval rule. **Rejected.**
2. `UsersController` already exposes audited, permission-protected `POST /users/bulk-restore`. A single-ID endpoint adds surface with no required behavior. **Rejected.**
3. `UsersRepository.markRestored` discards TypeORM `UpdateResult.affected`; `UsersService.restoreMany` can therefore return `{ids}` when the update matched zero rows. **Retained as the narrow defect to fix.** This is a failure contract; normal restore already locks deleted rows, so a zero-row update is not the expected normal concurrency path.

**Missing-context risk:** Looking only at `users/` cannot prove how global guards execute or how the response envelope handles errors. The API risk check must read the existing `common/tests/rbac-http.integration.spec.ts` and run that HTTP test. It proves guard behavior with a service double, not database isolation under a real concurrent deployment.

**Implementation plan (before patch):**

1. Write a focused test that makes `markRestored` report zero affected rows; verify the service rejects and skips deleted-role cleanup. Run it and retain the expected failing output.
2. Make the repository report the affected count and have the service reject an incomplete count inside the existing transaction. Re-run the focused test.
3. Add seeded property-based cases for batch composition and related role invariants, plus negative and failure-path cases. Run module tests and the HTTP RBAC test.
4. Temporarily mutate restore to return success after persistence failure; run the detecting test, then revert the mutation. Run coverage, two flaky-risk checks, and a 100-operation concurrent harness. Record actual evidence and limitations below.

## Run tests

From `back-end/`:

```sh
node -r reflect-metadata -r ts-node/register --test src/modules/users/tests/users-restore.spec.ts
node -r reflect-metadata -r ts-node/register --test src/common/tests/rbac-http.integration.spec.ts
node -r reflect-metadata -r ts-node/register src/modules/users/tests/users-restore-load.ts
npm run typecheck
npm run lint
npm run build
```

The existing PostgreSQL `trash-restore.integration.spec.ts` requires a local test database and runs migrations in its setup. It is **not** run for this assignment without database-owner approval. The full suite skips it without `CORE_TEST_DATABASE_URL`.

## Evidence and limits

Results, traceability, mutation, coverage, flakiness and load observations are recorded in [evidence.md](evidence.md). This PR is left unmerged for team review because it touches user data and authorization-related behavior.
