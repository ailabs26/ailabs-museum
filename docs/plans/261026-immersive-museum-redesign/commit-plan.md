# Atomic commit strategy

1. `docs: add immersive museum implementation plan` — complete plan before any product source change.
2. `feat(tour): add immersive fullscreen lifecycle` — portal/native fallback, Escape/focus/scroll cleanup and regression tests as one coherent lifecycle change.
3. `feat(tour): redesign immersive gallery HUD` — compact responsive controls, dock/map/help/detail layout with tests.
4. `feat(scene): add limestone and walnut gallery architecture` — original local texture assets, lifecycle/material sharing, room and plinth visual design.
5. `feat(scene): add balanced exhibition lighting and soft shadows` — renderer PBR/shadow configuration and material casting/grounding.
6. `fix(scene): keep cinematic entrance inside navigation bounds` — safe short intro, focus/input cancellation, reduced motion tests.
7. `perf(scene): bound immersive rendering quality` — only if quality selection is not required together with lighting correctness; otherwise include in lighting commit and document.
8. `test(tour): verify immersive compatibility and resource budgets` — cross-cutting acceptance tests/budget justification after rendering settled.
9. `docs: record immersive museum verification` — actual checks, visual/performance evidence, limitations and completed phase status.

Boundaries may combine only when code correctness requires it. Never add empty/artificial commits. Each code commit: focused tests/typecheck, review diff, explicit `git add <paths>`, commit. Final typecheck/lint/build and affected regressions are mandatory. Do not stage .env, unrelated changes, generated build outputs or temporary test artifacts. No push/PR/merge.
