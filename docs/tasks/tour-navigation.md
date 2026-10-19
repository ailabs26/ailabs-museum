# Desktop WASD and mobile touch navigation — 19 October 2026

## Architecture and controls

`MuseumScene` owns shared ref input and a pointer-ID gesture gate. Canvas keyboard/mouse/touch events and the DOM joystick write into that input. `MuseumControls` is the sole camera owner and consumes input in one R3F `useFrame`; OrbitControls was removed from the running scene and Vite prebundling.

- Desktop: focus the canvas, WASD walks relative to horizontal camera yaw, Shift sprints (2 / 3.6 m/s). Hold the primary mouse button and drag to look. Arrow keys look, F focuses, Home resets, +/− or wheel moves forward/back. No pointer lock is requested; Escape closes details and Tab leaves the canvas. Shortcuts/modifiers and editable controls outside Canvas remain available.
- Touch: 116 px joystick at lower left, 38 px travel, 12% dead zone, analog strength, clamped radius, safe-area offsets. Swipe the scene to look; the right side remains available while the left thumb moves. Each control owns its pointer ID. Native pointer capture and cancellation/blur/visibility cleanup stop stuck gestures. Joystick thumb uses a DOM ref, not per-frame React state.
- Mouse/touch sensitivity is 0.003 / 0.005 radians per pixel. YXZ orientation keeps the camera upright; pitch clamps to ±1.35 radians. Look smoothing and movement share one camera pipeline.
- Diagonals normalize. Exact exponential velocity integration gives equivalent acceleration at 30–120 FPS; update delta caps at 50 ms. Walking smoothly settles at 1.7 m eye height from the existing initial/focus vantage. Initial/reset overview stays `[0, 2.6, 5.8]` when free.

## Modes, selection and safety

Selection remains owned by `MuseumPage`. Selecting an artifact/hotspot uses existing bounds framing and starts `focusing`; completion enters `inspect`. WASD, joystick, deliberate drag or explicit look/zoom action interrupts into `explore`. Closing details cancels focus without resetting the camera. Reset explicitly returns to a free initial location. Neutral key/joystick release, blur or viewport resize does not disable automatic model/aspect reframing. Late model completion cannot override an earlier intentional manual move or reset.

The gesture gate retains every pointer's origin until release. Movement beyond 5 px suppresses click selection for the entire gesture, including a drag returning to its start. Simultaneous touches suppress selection until the next single-pointer gesture. Joystick overlay events do not reach raycasting. Existing hotspot/label priority, DOM catalogue and fallback remain intact.

Bounds derive from `MUSEUM_ROOM_SIZE`, the actual 14 × 16 × 5 m shell used by every current room. API has no independent room geometry dimensions. Wall margin is 0.45 m, including wall decoration and body clearance. Collision expands conservative XZ plinth/sculpture boxes by a 0.25 m body radius. Rendered plinth footprint constants are shared with collision; the icosahedron overhang is included. Normalized 1.8 m GLB envelopes fit within their 2.44 m bases, so loading/render-error placeholders and later healthy models share stable proxies.

Movement uses ≤8 cm swept axis steps to prevent tunneling and allow wall sliding. Focus computes a visibility graph around expanded obstacle corners once per command, then follows its safe path; no triangle raycasts or physics engine. Occupied focus destinations choose a free surrounding viewpoint; unreachable targets leave the camera in place. If refreshed placement occupies the camera, recovery chooses the nearest free proxy boundary. An occupied reset/spawn uses the nearest free location.

## Rendering and cleanup

Canvas retains `frameloop="demand"`, capped DPR, existing GLB loading/cache/disposal and DOM fallback. Movement, residual damping or focus request `invalidate`; the settled camera stops requesting frames. No extra RAF loops, per-frame camera React state, or hot-path Vector3/Quaternion construction. HUD updates React state only for interaction/mode changes. All installed input listeners and pointer capture release on cleanup.

## Verification

- Baseline: 52 unit tests passed at latest `origin/dev` (`8ffd808`).
- Current frontend: **69 unit tests pass; typecheck, lint and production build pass**. Existing Vite large-chunk warning remains; scene JS is 911.45 kB raw / 249.65 kB gzip on the verified build.
- Independent review found the neutral-HUD-reset focus regression; browser test reproduced `inspect → explore` on resize before the fix. Input cleanup was separated from manual interruption. Overlay focus/pointer-capture and icosahedron collision issues also have RED→GREEN unit evidence.
- Browser regression caught prolonged idle rendering after a discrete arrow command; arrow commands now finish immediately while pointer look retains damping. Reset diagnostics confirmed identical camera position/quaternion: screenshot differences came from the new focus-status HUD being inside the canvas clip. Scene-image comparisons now explicitly exclude this DOM overlay and also assert camera transform restoration.
- Outside-canvas shortcut tests assert the camera transform directly: moving focus can scroll a stationary pointer over scene geometry and change hover pixels without moving the camera. The rendered reset comparison remains in place.
- The first complete 71-case run had 70 passes and one reset assertion reading before the toolbar command's React effect. The assertion now polls for the exact original transform before comparing scene pixels; all original checks remain, and the complete keyboard/reset scenario passed five consecutive runs.
- Fast selection followed by Escape exposed reduced-motion focus waiting for a future demand frame. Reduced-motion focus now completes synchronously after validating a safe destination/path. A browser regression freezes RAF and verifies focus plus immediate detail closure; it passes. The original hotspot mouse-picking scenario also passed five consecutive runs.
- Final production-browser regression: **71/71 passed in 1.8 minutes**, zero skips/failures, output under `front-end/tmp/navigation-final-acceptance/`. Browser uses Edge 155.0.4283.62/SwiftShader and CDP touch emulation. Desktop/mobile full-page screenshots were inspected; joystick/HUD remain within the scene and detail panel remains outside it.
- Final software-renderer profile: initialization 364 ms; observed drag 47.28 FPS; initial 2 demand frames, 42 calls/frame, 5,176 triangles, 40 geometries, 3 textures. Idle frame count remains unchanged and repeated unmount leaves no live renderer. These observations describe this fixture/runner, not physical GPU performance or a guaranteed frame rate. Profile: `front-end/tmp/navigation-final-acceptance/museum-performance-product-3872d-ource-and-lifecycle-profile/profile.json`.
- Initial traced runs encountered local scene chunk transfer of 18.9 seconds. New tests allow bounded 30-second scene startup/60-second total while retaining movement, collision and selection assertions. Final verification disables trace recording to reduce local recording overhead; screenshots are still saved. Partial interrupted runs are not counted as passing suites.

## Files and delivery

Acceptance evidence is split by the behavior's owner:

| Acceptance area | Evidence |
| --- | --- |
| WASD directions, camera-relative yaw, diagonals, frame-rate consistency, sprint, delta cap, damping and eye plane | `museumNavigation.test.ts` plus real-browser walking/sprint/idle cases |
| Mouse direction, upright/clamped pitch, analog joystick radius/dead zone | Shared math unit tests; drag and simultaneous-touch browser cases |
| Keyboard scope, blur/visibility reset, pointer cancellation, capture and listener cleanup | `attachNavigationInput.test.ts`, browser focus loss, cancellation and repeated start/stop |
| Independent joystick/look ownership in both release orders; touch HUD isolation | CDP touch browser tests assert released DOM target, continued remaining control and unchanged camera after tapping HUD |
| Wall/plinth collision, sliding, safe spawn/reset, focus paths and placeholders | Swept-movement/path unit tests; real central-plinth, reset, GLB failure and room-switch browser cases |
| Tap/click versus drag/multitouch, artifact/hotspot selection and DOM fallback | Gesture unit tests and existing interaction/hotspot/tour browser suites |
| Focus interruption, reduced-motion focus, late model/aspect reframing | Navigation tests, including frozen RAF and portrait delayed GLB; existing camera/GLB focus cases |
| Idle demand rendering, resources and layout | Lifecycle/performance browser assertions and visually inspected desktop/mobile screenshots |

Verification commands run from `front-end/`:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
PLAYWRIGHT_PREVIEW=1 CI=1 npm.cmd test -- museum-navigation.spec.ts museum-interaction.spec.ts museum-hotspots.spec.ts museum-glb.spec.ts museum-lifecycle.spec.ts museum-switching.spec.ts museum-tour.spec.ts museum-camera.spec.ts museum-performance.spec.ts --trace=off --reporter=line --timeout=60000 --output=tmp/navigation-final-acceptance
```

The environment prefix above is shell-neutral notation: PowerShell uses `$env:PLAYWRIGHT_PREVIEW='1'` and `$env:CI='1'` before running npm. Build/typecheck/lint/unit output and browser results were read before reporting. No backend checks are needed for this frontend-only diff.

- Camera/scene: `front-end/src/components/MuseumScene.tsx`, its CSS, `museum/MuseumControls.tsx`.
- HUD: `museum/NavigationHud.tsx` and CSS; shared plinth dimensions: `interfaces/museumScene.ts`, `museum/ExhibitionDisplay.tsx`.
- Input/movement: `helpers/museumNavigation.ts`, `attachNavigationInput.ts`, `navigationGestures.ts`, and their unit tests.
- Browser coverage: `front-end/tests/museum-navigation.spec.ts`; camera-only screenshot comparisons updated in `museum-tour.spec.ts` and `museum-interaction.spec.ts`.
- Usage/build docs: `front-end/src/pages/MuseumPage.tsx`, `front-end/README.md`, `front-end/vite.config.ts`, task plan and progress report.
- Branch: `feat/tour-navigation`, based on latest fetched `origin/dev` (`8ffd808`). [PR #60](https://github.com/ailabs26/ailabs-museum/pull/60) is **OPEN**, base **dev**, head **feat/tour-navigation**, conflict-free when checked. No merge performed.

Verified implementation/test/evidence commits, chronological:

```text
9e2d841 docs(tour): plan unified desktop and touch navigation
ce4f58a feat(tour): add shared planar movement and collision math
2f1ec52 feat(tour): track gesture ownership and reject multitouch picking
d23d311 feat(tour): scope keyboard and pointer input with lifecycle cleanup
ccc0aed feat(tour): route camera focus around exhibit colliders
d832da4 fix(tour): release mouse look when overlay UI takes focus
af5a9ce fix(tour): share plinth footprints and cover sculpture overhangs
8b833a9 feat(tour): add touch joystick and responsive navigation HUD
5e093e2 feat(tour): unify exploration and artifact focus camera ownership
c2883a7 test(tour): verify walking multitouch focus and camera recovery
046519a fix(tour): complete reduced-motion focus before details can close
224a5a6 test(tour): synchronize reset and assert touch HUD isolation
ada947b docs(tour): record navigation controls and verified acceptance
```

The final `docs(tour): record navigation PR publication` commit adds this publication record, bringing the task to **14 meaningful commits**. Its SHA is in the PR commit list and final handoff; a commit cannot contain its own SHA. The requested target of 30 was conditional on independent changes; no empty or artificial subdivisions were created. Full diff and `git diff --check` were reviewed before publication. No squash, amend, force push or direct push to `dev`/`main` was used.

## Premerge review follow-up

Premerge follow-up requested by the user: independent review found no product-code blockers. Fresh typecheck, lint, build and 69 unit tests passed. Browser verification exposed timing assumptions in tests under slow software rendering: a fixed 450 ms WASD hold could end before enough capped-delta frames, loader DOM status could precede the first rendered scene snapshot, and a focus screenshot baseline did not explicitly await completed focus/render. Tests now wait for the unchanged movement threshold while W remains held (with bounded timeout/finally release), for four/five actual scene models before baseline/retry snapshots, and for inspect mode plus a new frame before the focus baseline. Refocus also asserts exact camera position/quaternion/aspect equality; exact pixel comparisons remain. All drift, idle, focus-loss, UUID, placeholder picking and request assertions remain. The WASD scenario passed five repeated runs; all five GLB failure variants passed three runs each (15 passes); the instrumented focus/refocus scenario passed ten repeated runs. These test-only corrections were independently reviewed; product code is unchanged.

Final premerge gate: **71/71 production-browser tests passed in 3.4 minutes**, with artifacts under `front-end/tmp/navigation-reviewed-merge-gate/`; lint and whitespace checks passed on the corrected tests. One additional `test(tour): synchronize premerge browser readiness checks` commit records these corrections and evidence, bringing the PR to 15 task commits. The user subsequently authorized review and merge into `dev`; the OPEN/no-merge publication record above describes the earlier handoff. GitHub PR #60 provides the authoritative merge state and merge SHA.

## Limits and running

Run `cd front-end; npm.cmd run dev`, open `/tour.html` with a configured read-only NestJS API, then choose **Mở phòng 3D**. For automated fixture verification, build and run `PLAYWRIGHT_PREVIEW=1 CI=1 npm.cmd test -- museum-navigation.spec.ts --trace=off` (set environment variables using your shell syntax). Fixtures do not require backend/database writes.

Local backend at `localhost:3001` was unavailable during this task, so no claim is made for live private Storage requests. Existing cached real-GLB integration tests are included where available. No backend, dependency manifests, migrations, seeds, credentials or `.env` were modified. Graphify calls were denied because no authorized workspace was selected; dependencies were traced directly.

Real phones, Safari/iOS pointer behavior, physical GPU FPS and screen-reader certification remain device QA. The current rectangular shell and conservative proxies deliberately do not support stairs, nonrectangular future room geometry or walking on platforms. Dense/overlapping published placements may restrict passage or prevent a focus route; no physics/navmesh system or geometry metadata was invented. Reset and reduced-motion focus intentionally change viewpoint immediately. These are not claims of validation on every device or future layout.
