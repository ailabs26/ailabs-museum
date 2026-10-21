# WebXR immersive tour implementation plan

**Goal:** One museum remains usable in immersive VR, normal web 3D and semantic 2D, preserving room and artifact selection through session failures and renderer recovery.

**Spec:** User-supplied full WebXR task, 21 October 2026. Execution: inline, end to end as explicitly requested; no additional design approval gate. One branch `feat/tour-webxr`, based on freshly fetched `origin/dev` at `663081d`. No automatic merge.

## Verified architecture and decisions

- `MuseumPage` owns query-backed room data and artifact selection outside the lazy `MuseumScene`. `MuseumCatalogue` and `ExhibitDetailPanel` already work without WebGL. Extend these with published API images and a deliberate bounded retry instead of creating another data layer.
- `MuseumScene` owns one demand-rendered R3F Canvas, room-scoped `useRoomModels`/`RoomModelAssets`, error-isolated GLBs and hotspots. Preserve the model owner during recoverable context loss and XR entry/exit.
- `MuseumControls` is the sole web camera owner. Suspend it throughout XR initialization/presentation/ending and context recovery. Restore its saved camera on exit without triggering artifact autofocus.
- Use installed Three.js 0.170 WebXRManager and R3F 8's existing sessionstart/sessionend XR animation bridge. No additional XR library or dependency is needed: the installed integration already owns stereo tracking and scheduling. Never install a second render loop or renderer.
- `XrSessionController` owns capability and serialized session lifecycle. Call requestSession synchronously from the Enter VR click before any await; optional local-floor, local fallback. Prepare reference space before binding renderer; session end, partial initialization and disposal all clean up.
- `MuseumXr` supplies an origin group for camera tracking and locomotion, target-ray poses from XRFrame, visible rays/reticles, native select events and in-world paginated metadata/exit controls. Selection calls the existing artifact callback. Floor teleport uses shared room/proxy safety and a clear straight segment. Known xr-standard thumbstick profiles support right-hand snap turn with dead zone, release latch and cooldown; unknown profiles retain native select teleport. No smooth movement.
- `SceneLifecycle` keeps the actual Canvas mounted during loss, prevents default, ends XR and pauses input, then verifies a new rendered frame after restoration. Two automatic recoveries per mounted scene, 8-second deadline, stable DOM 2D on exhaustion; manual retry creates one fresh scene and has a page-level budget. Never automatically re-enter VR.

## Global constraints

- No backend, database, migration, Storage policy, seed or env changes. All data/binaries continue through validated NestJS services; private signed URLs stay server-side.
- Preserve desktop/touch navigation, picking, normalization, GLB failure isolation, catalogue/detail semantics and loading/error states.
- No hardware claims from mocks/software WebGL. Graphify list repositories/workspaces both returned FORBIDDEN/no selected workspace; use inspected source and actual tests instead.
- Prefer meaningful completed commits (maximum 50), never artificial splitting merely to reach 30.

## Tasks and proof

1. [x] Capability/lifecycle: add `helpers/xrSession.ts` and unit tests for secure/unavailable/unsupported/rejected/ready checks; synchronous request, duplicate suppression, rejection, partial bind failure, end/re-entry, dispose during pending request, listener cleanup. Verify RED then GREEN; commit.
2. [x] Renderer recovery: add `helpers/webglRecovery.ts` and unit tests for loss prevention, restore deadline, loss budget, duplicate signals and teardown; extend `SceneLifecycle` with rendered-frame verification. Keep models mounted. Verify RED/GREEN; commit.
3. [x] XR interaction math: add `helpers/xrInteraction.ts` and tests using real Three objects for ancestor IDs, occlusion, floor targets, collision bounds, rig teleport and head-centred snap turn/profile mapping. Verify RED/GREEN; commit.
4. [x] XR scene integration: add `MuseumXr`, `XrDetailsPanel` and UI controls; connect one lifecycle controller to the existing renderer, suspend web camera/input, native select only once, connect/disconnect and session cleanup, one-controller and gaze fallback. Add production-browser tests for capability, refusal and end lifecycle when simulation permits. Verify meaningful boundaries and commit completed pieces.
5. [x] Functional 2D/retry: extend existing display mapping/catalogue/details with API images and safe image fallback; bounded user-driven retry in `MuseumPage`/`SceneFallback`; keep selection and queries outside scene. Browser proof for missing WebGL, selection, rooms and retries; commit.
6. [x] Browser recovery: use real `WEBGL_lose_context` on the existing Canvas; prove Canvas identity, rendered pixels, selection, cached model request counts and web navigation after restoration; timeout/repeated loss to stable 2D. Update old immediate-context-failure expectations to the new recovery contract without weakening assertions.
7. [x] Final review/verification/docs: frontend typecheck/lint/build/unit and affected production-browser suites; inspect screenshots. Review whole diff, fix actual regressions with RED/GREEN, update progress/README and SHA ledger. Publication is tracked separately below.
8. [x] Publish one PR into `dev`; do not merge.

## Review focus

- Session resolves after room switch/unmount: end it without binding renderer or restoring stale selection.
- Context loss during async XR bind: invalidate ownership before partial initialization can activate.
- Repeated entry/exit: camera snapshot, event listeners, frame scheduling and model owner remain singular.
- Physical headset translation: tracking stays runtime-owned; teleport respects proxies but cannot replace real-world guardian safety.
- Unsupported profiles/missing gamepads: native select and gaze remain available, no speculative axis mapping.

## Execution ledger

- Baseline: freshly fetched dev; 69/69 frontend unit tests passed. Read tour entry, MuseumPage/Scene/Controls/Room, GLB owner/loader, hotspots, navigation collision helpers, public schema/service and fallback regression tests. Backend media changes on latest dev remain untouched.
- Final gates: 93/93 unit tests; 98/98 affected production-browser tests; typecheck/lint/build pass. Evidence logs: `front-end/tmp/xr-unit-final.log`, `xr-typecheck-final.log`, `xr-lint-final.log`, `xr-build-final.log`, `webxr-final.log`. No backend check was needed because all implementation changes are frontend-only.
- Independent review's two findings reproduced before fixes: translated-origin panel direction and Three r170 runtime end during partial native binding. Added local panel math and an end-deferral/Canvas-retirement adapter, with focused helper and native-browser regression proof. Follow-up review: no remaining important finding.
- Real context loss/restore tested in normal3D and active simulated XR, plus timeout, repeated loss, two manual retries, gaze Exit and controller disconnect. Inspected the restored screenshot. API simulation is not headset validation; real optics/comfort/guardian/frame rate remain device QA.
- Full architecture, limits, SHA ledger and confirmed publication: [delivery report](../tasks/tour-webxr.md).
- Published [PR #64](https://github.com/ailabs26/ailabs-museum/pull/64): OPEN, base `dev`, head `feat/tour-webxr`, mergeable, not merged. `dev` advanced during execution to `7ec2946` with separate CMS/admin-media work; GitHub confirmed clean integration. No merge/rebase or force push was needed. Local test results describe this task branch, not the newer dev's unrelated CMS functionality.
