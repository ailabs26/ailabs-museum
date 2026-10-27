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

## Executed commits (oldest first)

| SHA | Message | Purpose |
| --- | --- | --- |
| `ea06204` | docs: add immersive museum implementation plan | Plan before product code. |
| `f09bcbe` | feat(tour): add immersive fullscreen lifecycle | Portal/native fallback, Escape, focus and scroll lifecycle. |
| `4ee698c` | feat(tour): redesign immersive gallery HUD | Compact HUD, minimap, catalogue and detail overlay. |
| `bdafc61` | feat(scene): add limestone and walnut gallery architecture | Original local textures, shared materials and instanced room architecture. |
| `02902c3` | feat(scene): add exhibition lighting and bounded rendering quality | Bounded lights, shadows, PMREM and quality tiers. |
| `4bbcf72` | fix(scene): keep cinematic entrance inside navigation bounds | One safe camera entrance owner, cancellation and reduced motion. |
| `377ff09` | fix(tour): preserve fullscreen while rooms load | Keep the fullscreen host mounted across room loading. |
| `f86cd60` | feat(scene): refine geometric exhibit illustrations | Refined honest geometric substitutes for missing GLBs. |
| `b6289ab` | fix(scene): exclude contact shadows from artifact picking | Contact occlusion must not steal artifact/floor picking. |
| `6dbacaf` | fix(tour): release XR state and keep Escape reachable during loading | Release XR ownership and keep Escape reachable during loading. |
| `9ea4b41` | feat(scene): adapt camera framing to portrait viewports | Bounded portrait FOV without changing CMS coordinates or XR projection. |
| `b5925f5` | fix(tour): preserve modal Escape priority and compact mobile controls | Modal Escape priority and reachable controls at small sizes. |
| `9f94d9c` | fix(scene): guard rendering during native WebGL context loss | Guard driver rendering failures during native context loss. |
| `61020cc` | test(tour): add immersive interaction and idle helpers | Active-portal selectors and settled idle measurement. |
| `c63fc99` | fix(xr): teleport from the current head pose through floor joints | Event-frame head pose and decorative-floor teleport regression. |
| `cd2bc34` | fix(scene): repaint decoded gallery finishes in demand mode | Committed async surface updates, fallback colors and texture/resource tests. |
| `801f122` | fix(tour): keep room recovery controls unobstructed | Expose retry when detail data is missing. |
| `27e6152` | test(tour): verify immersive navigation and compatibility | Adapt existing model/navigation/fallback/accessibility checks to immersive UI. |
| `673ecf2` | test(tour): measure restored scroll at fullscreen activation | Capture scroll at the opening activation, retaining exact pixel equality. |

Final documentation commit: `docs: record immersive museum delivery evidence`. Its SHA is supplied in the final delivery message, together with the final working-tree status. No push, PR or merge.
