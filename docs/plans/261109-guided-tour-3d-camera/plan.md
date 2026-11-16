# Guided Tour 3D camera implementation plan

## Goal

Deliver user-started automatic visits in validated CMS order, safe smooth walking, arrival-driven details and 15-second dwell, with interruption, XR and readable fallback.

## Architecture

Guided Tour Core owns session/order. `useGuidedCameraTour` coordinates requests, arrival, dwell and route selection in MuseumPage. MuseumControls remains the sole web camera owner. Pure `guidedCameraPath` helpers reuse the existing visibility graph, body envelope and exhibit framing. No backend or dependency changes.

## Source and execution

Base `521423bd7e5fd20164ed88ad633102356bafc34c`, fetched origin/dev on 2026-11-09. Branch `feat/guided-tour-3d-camera`. Initial checkout clean. Work in the existing checkout on the requested task branch. User explicitly requests continued implementation after planning, so execute inline through verification and local atomic commits.

Source audit covers the core provider/reducer/selectors/builders, MuseumControls, museumCamera, museumNavigation, cinematicIntro, attachNavigationInput, MuseumScene, MuseumPage, ImmersiveTour, NavigationHud, mapRoomDisplays, useRoomModels, artifactHotspots and existing tour/navigation/camera/XR tests. Coding conventions moved to `docs/architecture/fe/coding-conventions.md`.

## Decisions

- Choose quadratic corner rounding with exact validation of every rendered chord. A dense arc-length polyline is the actual camera route. Global Catmull–Rom would require additional overshoot proofs.
- Prefer routing with extra clearance, fall back to the existing minimum-clearance planner when necessary. Reduce rounding radius and retain safe polyline corners where rounding fails.
- Manual movement pauses. External exhibit selection exits the session before applying URL selection. Closing details pauses. Resume replans from actual pose, including after manual movement.
- Scene loss, XR request, hidden tab and closed 3D pause. Recovery never resumes automatically. Room switch exits. Confirmed removed room invalidates the core.
- Unsafe steps show a translated failure and select readable DOM details, waiting for Next or Exit. Failed GLBs retain existing placeholder/error isolation.
- Reduced motion jumps to the validated viewing point and keeps arrival/dwell behavior.

## Tasks

- [x] Write path/framing/motion tests and observe RED. Implement safe framing, rounded route, cumulative-distance/time profiles and bounded orientation. Verify and commit together.
- [x] Write browser acceptance tests and observe missing Start behavior. Implement coordinator, camera-owner integration, localized controls, pause/takeover and scene lifecycle. Verify and commit together.
- [x] Extend browser coverage for lifecycle, CMS updates, empty/single rooms, reduced motion, XR and mobile. Run frontend gates and affected suites, inspect desktop/mobile images, review complete diff.
- [x] Record evidence, limitations and commit ledger, commit handoff.

## Delivery

Implementation and verification are complete for the fixture-backed browser scope. See verification.md for 325 unit tests, 75 production regressions, 12 final-profile Guided Tour cases, 7 dev/StrictMode cases and the limits of screenshot-based visual QA. Keep the task branch local for review as explicitly requested. Hardware comfort/FPS and a manual live-API walkthrough remain unverified.

## Review focus

Stale arrival after Next or unmount, paused dwell after manual motion, late GLB bounds, locale-only refresh, XR entry while moving. Tests must exercise the owning boundary. Build path preprocessing only on request changes, with no React state updates per frame.
