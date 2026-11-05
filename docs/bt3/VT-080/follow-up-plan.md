# VT-080 follow-up plan for PR #137

Recorded before this follow-up's test and harness edits. Starting branch head: `5696c3a`.

## Prompt and scope

User request: finish the VT-080 assignment evidence in **the same PR** and use PR #133 as a reference for PR presentation. The code-planning scope is the `users` module: its existing delete/restore service, repository, controller, and tests. Repository conventions and the assignment are constraints. The subsequent risk review may inspect the existing HTTP guard test because module-only context cannot establish global authorization behavior.

The first phase of PR #137 had already read broader repository context, as its README discloses. A follow-up cannot retroactively make that first phase strictly module-only. This plan records the boundary and the resulting missing-context risk without claiming otherwise.

## Assumptions to check

- The existing `user:read` and `user:delete` decorators and global guards reject a caller before any private user lookup or restore write.
- Restore operations share a management lock, so a useful simulated load experiment should include serialization rather than 100 independent timers.
- No migration can be run without database-owner approval. A preexisting PostgreSQL integration test may remain unavailable in this run.

## Planned files and steps

1. Extend `back-end/src/common/tests/rbac-http.integration.spec.ts` with a targeted other-user marker and two negative API checks: unauthorized detail/trash read and unauthorized restore. Confirm the response contains no marker and the service is not invoked. Run that test first and review whether it proves only guard behavior.
2. Update `back-end/src/modules/users/tests/users-restore-load.ts` to simulate the shared transaction lock, keeping 100 distinct operations and a fixed asynchronous write delay. Record p95 and compare it with 3,000 ms without claiming a real database result.
3. Add reproducible red/mutation/green/coverage/load command logs under `docs/bt3/VT-080/evidence/`, update the test map and AI usage log, and prepare a 250–350 word reflection draft for student review. Leave the PDF and personal declaration to the student.
4. Run focused tests, backend typecheck/lint/build, and the full backend suite. Review the complete diff, push the same branch, then rewrite PR #137 in the concrete format used by PR #133. Do not merge.

## Repository review of this plan

- Rejected a new restore endpoint: `UsersController` already exposes `POST /users/bulk-restore` with `@Permissions(USER_DELETE)` and audit. A second route adds risk without changing the contract.
- Rejected running the existing PostgreSQL trash test as a gate: its setup calls `runMigrations()`, while `AGENTS.md` requires explicit database-owner approval before any migration run. Keep its coverage gap visible.
- Kept the targeted HTTP check: the existing RBAC suite uses real global guards but a service double. A private marker makes the no-leak assertion explicit; it still cannot prove database row isolation.

Stop condition: PR #137 has runnable risk-focused tests, honest load and mutation evidence, a usable PDF source draft, and no unreviewed database action.
