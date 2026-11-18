# 3D Exhibit Search & Navigation Implementation Plan

**Goal:** Search published exhibits in the current immersive room and reach them through safe camera routes.
**Architecture:** Local immutable search index, explicit cancellable request identity, existing MuseumControls routed motion owner. No API, database, engine or dependency changes.
**Tech stack:** React, TypeScript, Mantine, R3F, Three.js, Vitest, Playwright.
**Spec:** User task supplied on 2026-11-18; design in architecture.md, search-design.md and camera-navigation-design.md.

## Audit and constraints

- Clean checkout; fetched origin/dev; base `07ecea2498258390db0259de1d37c1df74337c73`.
- Branch `feat/3d-exhibit-search-navigation`; no push, PR or merge authorized.
- Reviewed recent PRs: #203 hotspot storytelling merged, #204 documentation merged. Existing global search remains untouched.
- Read public search service/schema/localization, scene/rendering, camera/pathfinding, guided tour, hotspots, XR, model lifecycle and requested regression tests.
- `front-end/docs/coding-conventions.md` is absent; canonical conventions are `docs/architecture/fe/coding-conventions.md`.
- mapRoomDisplays sorts displayOrder then ID; room schema checks membership, unique IDs and public model routes. MuseumControls owns web transforms. attachNavigationInput consumes keys only on canvas and clears input on blur.
- No database migrations, backend, auth, permissions, storage contracts, postprocessing or new camera owner.

## Review focus

Repeated same target; stale A completion after B; held WASD then input focus; late model bounds/locale updates; XR/context recovery must never revive cancelled motion.

## Tasks

- [ ] 1. Baseline quality gates and focused browser regression; record commands, exits and limits in verification.md.
- [ ] 2. Add helper tests for normalization, ranking, field boundaries, localization and room changes; implement createExhibitSearchIndex/searchExhibits.
- [ ] 3. Add browser search/navigation tests that initially fail because the feature is absent.
- [ ] 4. Add useExhibitSearchNavigation intent binding and extend existing routed motion union in MuseumControls. Actual arrival alone updates URL selection; blocked routes keep the current selection.
- [ ] 5. Add compact ExhibitSearchPanel with localized copy, normal semantic list/buttons, Enter-first-result and scoped Escape. Add primitive rings and minimap outlines for matches/target.
- [ ] 6. Wire page takeover: pause guided tour, clear hotspot, latest explicit intent wins; renderer readiness and scope changes cancel requests.
- [ ] 7. Run required frontend gates and affected browser suites; inspect desktop/mobile screenshots, trajectory samples, GLB requests and idle frames.
- [ ] 8. Review complete diff, fix evidenced defects, create atomic local commits, finish verification/handoff. Do not push/open PR/merge.

Implementation proceeds directly under the user's explicit instruction to continue after planning. Progress and rulings are recorded in verification.md.
