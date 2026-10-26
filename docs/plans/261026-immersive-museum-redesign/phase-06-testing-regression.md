# Phase 06 — Testing and visual verification

## Goal / scope
Prove acceptance criteria using focused browser, unit and production evidence; report unsupported physical-device scenarios honestly.

## Files
New museum-fullscreen/immersive UI tests, relevant existing museum test adaptations, resource budget assertions, verification.md and original frontend README if behavior documentation changes.

## Steps / dependencies
- [ ] During each owning phase, add/execute failing behavior test before implementation, then verify green.
- [ ] Update existing tests that interact with background controls: use shell room selector/exit/catalogue while immersive; background is intentionally inert. Do not weaken camera/selection/resource assertions.
- [ ] Run `npm.cmd run test:unit`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` from front-end.
- [ ] Run focused Playwright fullscreen, tour, lifecycle, interaction, navigation, camera, hotspots, model loading/failure, XR, resource and recovery specs against production preview.
- [ ] Review before/after screenshots on desktop, mobile portrait/landscape, selected detail overlay and close-up materials. Use browser tool or rendered screenshot viewer; no aesthetic conclusion from tests alone.
- [ ] Capture comparable profile JSON: draw calls/triangles/resources, initialization, observed drag FPS and released contexts. Explain changed budgets with measured shadow/architecture cost; do not silently weaken old budgets.
- [ ] Record exact commands/outcomes/skips, visual observations, capability limitations, residual model limitations and commit history; check full diff/working tree.

## Risks / mitigation
Headless native fullscreen differs by browser: deterministic shims plus real API test and explicit limitation. Fixtures prove dynamic contracts, not production DB content. Software GPU/mobile emulation does not prove real phone/headset performance. No DB writes to make tests pass.

## Acceptance / tests
All eight technical acceptance conditions plus visual QA evidence and qualified performance report. No source/backend/secret changes outside scope. User-requested no push/PR/merge respected.

## Commits
Tests accompany their owning changes; final independent updates: `test(tour): verify immersive compatibility and resource budgets`, `docs: record immersive museum verification`.
