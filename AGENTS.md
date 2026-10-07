# Repository instructions

These instructions apply to the entire repository. More specific instructions in a nested `AGENTS.md`, when present, take precedence for that subtree.

## Branch workflow

- Start every task from the latest `origin/dev`.
- Use one branch and one pull request per task.
- Use `feat/<short-name>` for features, `fix/<short-name>` for bug fixes, `docs/<short-name>` for documentation, `chore/<short-name>` for maintenance, and `refactor/<short-name>` for behavior-preserving restructuring.
- Open task pull requests against `dev`.
- Do not push task commits directly to `dev`.
- Never merge a task branch directly into `main`.
- `main` receives release pull requests from `dev` only.

## Before editing

- Read the relevant implementation, README files, plans, and coding conventions before changing code.
- Trace the current behavior and identify the layer that owns the requested change.
- Keep the change within the task scope and preserve unrelated team or user changes.
- Do not add speculative features, unrelated cleanup, broad renames, or premature abstractions.
- Do not claim behavior or test results without current evidence.

## Frontend

- Follow `front-end/docs/coding-conventions.md`.
- The frontend communicates with the NestJS API, not directly with PostgreSQL, Supabase, or storage.
- Validate external API responses before application code consumes them.
- Preserve accessible DOM and fallback behavior alongside 3D and WebXR behavior.
- For frontend changes, run the relevant gates from `front-end/`:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

## Backend

- Follow `back-end/docs/coding-conventions.md`.
- Keep public content endpoints read-only unless authenticated admin behavior is explicitly requested.
- Keep TypeORM `synchronize` disabled.
- Do not generate, run, revert, edit, or delete database migrations without explicit approval from the database owner.
- For backend changes, run the relevant gates from `back-end/`:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

## Verification and pull requests

- Verify the task's acceptance conditions with the smallest sufficient proof.
- Run checks for every affected application. Run repository-wide checks only when the change crosses application boundaries or shared behavior.
- Review the complete diff before committing and again before merging.
- Use a concise commit message that describes the completed change.
- Confirm that the pull request base is `dev`.
- Do not merge while required checks or acceptance conditions are failing.
- Merge into `dev` only after the pull request has been reviewed and the task is complete.
- For database, authentication, authorization, security, privacy, or potentially destructive changes, stop at the pull request and request human review before merging.

## Completion report

Report the branch, commit, pull request URL, material changes, verification results, merge result, and any remaining risks or omissions.
