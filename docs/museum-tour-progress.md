# Museum tour — Day 1 of 4

ACTIVE_DAY = 1. Branch: `feat/museum-scene-day1`. Base: `ca7a334` (`origin/dev`).

## Verified architecture and design

- React 18 + TypeScript + Vite 6 SPA, Mantine 7, React Router 6. R3F 8 and Three 0.170 are already declared; no additional runtime library needed.
- `main.tsx` mounts `AppProviders` and `AppRouter` at `#root`. `PublicLayout` owns public navigation. `/tour` is a placeholder; no `tour.html` exists. `MuseumPage`, `MuseumScene`, `MuseumLayout` are empty scaffold.
- Add `tour.html` as a second Vite HTML input using the same main entry. Both `/tour` and `/tour.html` render `MuseumPage` under existing `PublicLayout`. This preserves other routes and makes the requested HTML a real build artifact.
- `MuseumPage` owns the start/stop choice and accessible sample catalogue. Lazy `MuseumScene` owns Canvas, room, lighting and controls; sample display props contain no API/auth logic. Existing shared `ErrorBoundary` protects only the scene, leaving DOM content available.
- One enclosed 14 × 16 × 5 m gallery; pale limestone, warm plaster, bronze details, five lightweight geometric studies. Y up, positions in metres. Orbit camera around the central display, bounded inside the room; mouse/touch orbit and focused keyboard controls, with reset and zoom buttons.
- Render on demand, DPR capped at 1.5, no textures/GLB/network assets, no dynamic shadows or postprocessing. Dispose manually owned controls/listeners; R3F owns declarative geometry/materials.
- Backend source now uses `modules/rooms` and revision-based exhibits; old frontend architecture documents describe earlier endpoints. Day 2 must verify current public DTOs and validate responses through the existing HTTP client + Zod before passing view data to the scene. Day 1 sample objects are explicitly labelled samples, never API fallback data.
- Graphify is not connected. Source references were traced with repository search. Demo is inspiration only; no source copied.

## Four-day roadmap

1. **Day 1:** HTML/route mount, accessible shell, lightweight room, camera, lights, lazy lifecycle, fallback, browser smoke checks.
2. **Day 2 (not implemented):** agree public room/exhibit DTOs; service + Zod validation; loading/error/empty states; replace sample view data with API data.
3. **Day 3 (not implemented):** artifact assets and interactions according to agreed scope; preserve DOM equivalents.
4. **Day 4 (not implemented):** measured performance tuning, device QA and final polish.

## Implementation plan / ledger

Use `superpowers:executing-plans` inline, `test-driven-development` for behavior, and `verification-before-completion`. This document is the requested design, plan and persistent ledger. User explicitly requests immediate implementation after the architecture summary; no additional design approval round. Work in the prepared clean checkout on the task branch.

- [ ] 1. Establish runnable frontend baseline and browser smoke tooling. Existing R3F/Three dependency versions must remain compatible with React 18.
- [ ] 2. Add `tour.html` build entry and `MuseumPage` route. Verify direct navigation, home and admin routes; commit the independently working shell.
- [ ] 3. Define typed sample display data and render the same titles/descriptions in DOM. No server contract invented.
- [ ] 4. Lazy Canvas, explicit start/stop and scene-only fallback. Verify no scene request before start, rejected chunks and WebGL failure preserve catalogue.
- [ ] 5. Build floor/walls, ceiling/details, sample plinths and geometry, then lighting as meaningful independent visual units. Typecheck each unit and inspect the rendered room.
- [ ] 6. Bounded camera controls, focused keyboard navigation, reset and zoom. Verify movement, bounds, resize and listener cleanup in real browser.
- [ ] 7. Handle context loss and reduced motion; verify repeated mount/unmount and DOM access.
- [ ] 8. Run frontend typecheck/lint/build and browser suite; review complete diff; document actual commits and results; open one PR targeting dev.

### Verification focus

Test direct production HTML entry, lack of WebGL, failed lazy chunk, context loss, keyboard events outside canvas, camera bounds, mobile layout, and repeated start/stop. Browser tests exercise real R3F/WebGL where supported; simulated capability failures are explicitly identified. No claims of physical-device/VR testing.

### Baseline observations

- Initial working tree clean. Latest remote fetched before branch creation.
- PowerShell blocks `npm.ps1`; use `npm.cmd` without changing machine policy.
- Existing `node_modules` is stale after pulling dev (Mantine/router packages missing). Restore from lockfile with `npm.cmd ci` before assessing baseline gates.

## Actual commits

Recorded below as development proceeds; final documentation commit is discoverable with `git log origin/dev..HEAD` (cannot contain its own SHA).

## Results, limitations and Day 2 handoff

Implementation and verification in progress. No Day 2–4 functionality is claimed.
