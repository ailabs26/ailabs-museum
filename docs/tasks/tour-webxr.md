# Immersive WebXR tour — 21 October 2026

The tour now shares one museum between immersive VR, ordinary web 3D and a functional semantic 2D catalogue. XR unavailability or refusal keeps web 3D running; only renderer failure enters 2D. Room queries and selection stay outside the renderer. No backend, migration, environment, seed, Storage policy or dependency changes were made.

## Ownership and changed modules

| Owner | Responsibility |
| --- | --- |
| `MuseumPage`, `mapRoomDisplays`, `ExhibitImage`, catalogue/detail, `SceneFallback` | Validated NestJS room/exhibit metadata, published images with image-error placeholders, shared selection, contextual 2D links and two deliberate page-level 3D retries. |
| `MuseumScene`, `MuseumControls` | One Canvas; switch input ownership, retain room GLB owner, suspend web movement/focus during XR/recovery, restore camera and responsive projection without autofocus. |
| `xrSession` | Separate capability and session phase; secure-context/API checks, devicechange refresh, synchronous user-gesture request, single-flight entry, local-floor/local reference space, serialized exit and pending-request/unmount cleanup. |
| `MuseumXr`, `xrInteraction`, floor/hover tags | Origin locomotion, native target-ray poses, occluded picking, shared artifact selection/hover, two tracked pointers, head-gaze fallback, teleport and profile-checked snap turn. |
| `XrDetailsPanel` | In-world paginated published text and Previous/Next/Exit targets. Canvas texture is disposed on update/unmount. Placement uses reference-space coordinates consistently beneath the origin. |
| `xrRendererBinding` | Adapt Three r170 partial initialization cleanup; defer runtime end during native binding and retire a rejected partial renderer. |
| `webglRecovery`, `SceneLifecycle` | Canvas loss/restore listeners, rendering pause, deadline/budget and actual submitted-frame verification. |
| Helper unit tests, `museum-xr.spec.ts`, `fixtures/museumXr.ts`, updated tour/fallback tests | Lifecycle, geometry/input math, native manager integration, actual software-WebGL loss/restore and stable 2D. |

## Integration and lifecycle

Installed React 18.3, React Three Fiber 8.17 and Three.js 0.170 already provide a compatible integration. Native `WebXRManager` owns stereo cameras, runtime poses and XR animation. R3F's existing `sessionstart`/`sessionend` bridge schedules its normal scene on the XR frame loop. No additional XR dependency, second VR renderer, duplicated museum scene or custom animation loop was added.

Capability is `checking / ready / unavailable`; session phase is `idle / requesting / active / ending`. Renderer availability is independent (`ready / recovering / verifying / failed`). Enter VR invokes `requestSession('immersive-vr', { optionalFeatures: ['local-floor'] })` synchronously from the button click. The reference space falls back to `local`, with an eye-height origin offset. `local-floor` uses runtime floor height. Neither mode edits the headset's tracked pose for locomotion.

Before binding, web input disconnects and the web camera's transform/lens is saved. The camera becomes a child of the XR origin. Native/system end, the in-world or DOM Exit action, hidden XR session, pagehide, renderer loss and unmount end ownership. Exit waits for pending native binding, removes XR listeners, restores the web camera and input, and preserves artifact selection. No automatic immersive request occurs after exit or recovery. Capability changes are observed through `devicechange`; request failures are caught with a retryable message.

Three r170 has an initialization edge case: its native end listener assumes its animation context exists, although `setSession()` still awaits reference space. A browser regression first reproduced its null `cancelAnimationFrame` error. The adapter observes preflight end, defers end dispatch while native binding is pending, then delivers it after successful binding. A rejected partial manager cannot be safely reused through public `setSession(null)` or `dispose()`: only Canvas is retired. R3F 8 disposes its unmounted root after 500 ms; replacement waits 650 ms. The mounted `MuseumScene/useRoomModels` owner retains decoded assets. Two such renderer resets are allowed before stable 2D. Ordinary request refusal, entry/exit and context restoration keep the same Canvas.

## Controller interaction and comfort

- Native `selectstart`/`selectend` track input state; only `select` commits an action. Sources are checked against the session at dispatch time. Disconnect and visibility changes clear transient input. No mouse-event emulation or squeeze dependency.
- Rays come from each source's `targetRaySpace` pose, transformed through the origin. A visible laser/reticle and shared artifact/hotspot hover show the target. Sprite intersection receives the native XR viewing camera. Existing artifact IDs drive the same selection callback and metadata; no second selection store.
- Straight floor teleport requires a safe endpoint and a clear segment through the shared room/plinth collision proxies, within 8 m. It rejects occupied, outside-room and non-floor targets. The origin moves horizontally so the current head lands on the chosen point while runtime-relative tracking is retained. Invalid floor targets have a distinct marker. No smooth locomotion or automatic camera focus in VR.
- Right-hand snap turn is 30°, with a 0.65 dead zone, release latch and 350 ms cooldown. It requires `gamepad.mapping === 'xr-standard'` and a known profile whose horizontal thumbstick is axis 2: `oculus-touch`, `oculus-touch-v2`, `oculus-touch-v3`, `meta-quest-touch-plus`, `meta-quest-touch-pro`, `valve-index`, `microsoft-mixed-reality`. Unknown profiles and missing axes/gamepad retain native select teleport without guessed mapping.
- Zero, one or two controllers are supported. With no native source, 1.5-second gaze dwell selects metadata/panel controls, including Exit. Dwell never teleports. The headset UI contains paginated title, description, transcript and published hotspot text; ordinary DOM remains available outside the headset.

## WebGL and asset recovery

Loss is handled on the actual Canvas with `preventDefault()`. Rendering/web input pause, XR exits, and the visible recovery state leaves the catalogue usable. The original Canvas remains mounted so browser/Three lifecycle can restore GPU resources. A restored event enters verification, requests a frame, and returns to web 3D only after the native renderer reports a newer submitted frame with a live context. The same eight-second deadline includes this verification. There are two recoveries per mounted scene; a third loss or timeout enters stable 2D, without an automatic retry loop. Two user-clicked page-level retries can start a fresh 3D scene.

The existing room asset owner keeps parsed models across ordinary XR transitions and successful recovery. Existing per-artifact parse/render boundaries, safe model normalization and manual model retries remain intact. The browser verifies five binary GLBs requested exactly once through entry, selection, teleport, exit, re-entry and successful restoration, including Canvas-only retirement after native bind failure. Private model URLs continue to resolve through the existing backend binary service; no signed URL or secret is added to frontend code. A final 2D teardown releases the asset owner and aborts pending models.

## Verification and limits

Commands run from `front-end/`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
$env:PLAYWRIGHT_PREVIEW = '1'
npm.cmd test -- museum-xr.spec.ts tour-2d-fallback.spec.ts museum-navigation.spec.ts museum-hotspots.spec.ts museum-glb.spec.ts museum-interaction.spec.ts museum-camera.spec.ts museum-lifecycle.spec.ts museum-switching.spec.ts museum-tour.spec.ts museum-session.spec.ts museum-resource-budget.spec.ts museum-performance.spec.ts museum-startup.spec.ts --reporter=line --trace=off --output=tmp/webxr-final
```

Final gates: **93/93 unit tests, 98/98 affected production-browser tests, typecheck, lint and production build passed**. Logs: `front-end/tmp/xr-unit-final.log`, `xr-typecheck-final.log`, `xr-lint-final.log`, `xr-build-final.log`, `webxr-final.log`. The focused native binding adapter tests passed 5/5. Earlier runs reproduced both review findings before the fixes; the corrected XR/tour set passed 23/23. The initial broader run passed 95/96: its remaining old test expected immediate 2D on context loss and was updated to assert recovering, then the eight-second timeout, while preserving focus/catalogue checks. No backend checks were run because backend/shared contracts were unchanged.

Browser evidence uses Edge/SwiftShader, actual parsed fixture GLBs, the real Three/R3F integration and `WEBGL_lose_context`. The custom API simulation exercises two eye cameras, native select, single-controller disconnect, controller-free gaze Exit, teleport, snap-turn latch, native/system Exit, re-entry, interrupted initialization and real context loss while XR is active. It is **not an installed WebXR emulator or hardware certification**. Recovery checks compare Canvas identity, submitted geometry, selection, web controls and binary request counts. The restored scene screenshot `front-end/tmp/xr-restored.png` was visually inspected. Logs and generated screenshots are local ignored evidence, not product assets.

No headset, physical phone/GPU or supported immersive runtime was available. Stereo optics, guardian/room-scale behavior, controller ergonomics, comfort and sustained headset frame rate need real-device QA over HTTPS or trusted localhost. Physical walking remains runtime-owned; virtual collision proxies do not replace the device guardian. API mocks cannot prove every browser/driver's recovery. Existing signed-URL expiry and GLB isolation tests still cover the backend-mediated asset contract; this task did not mutate or certify live private Storage. Graphify was unavailable (FORBIDDEN/no selected workspace), so source tracing and tests established ownership. Playwright tracing was disabled for these GPU-loss gates after context-loss trace teardown hung; normal assertions and logs remained enabled. Vite still reports its existing large scene-chunk advisory.

## Git delivery

Branch: `feat/tour-webxr`, started from freshly fetched `origin/dev` at `663081d`. One task branch/PR into `dev`; no merge or direct push to dev/main. Independent code review's panel-coordinate and native-partial-binding findings were fixed with regression proof; follow-up review reported no remaining important finding. Meaningful commits are used without artificial splitting to reach 30.

```text
078a719 docs(tour): plan WebXR lifecycle and renderer recovery
5eb10a2 feat(tour): own immersive session capability and lifecycle
b433940 feat(tour): bound WebGL recovery and verify restored frames
cdadbc6 feat(tour): resolve XR targets and safe origin locomotion
2b12ce5 fix(tour): serialize exit with pending XR renderer binding
c05a874 feat(tour): complete image catalogue and bounded 3D retry
35e47d5 fix(tour): isolate interrupted native XR renderer binding
8bf8511 fix(tour): face XR details toward the headset in origin space
72267dd feat(tour): suspend web camera ownership during XR and recovery
fa725fe feat(tour): integrate immersive controls and recoverable museum Canvas
9235c58 test(tour): verify bounded recovery before readable 2D fallback
7cd6bcd docs(tour): record WebXR architecture verification and device limits
```

Published [PR #64 — immersive WebXR, controller navigation and resilient fallback](https://github.com/ailabs26/ailabs-museum/pull/64). GitHub confirmed OPEN, base `dev`, head `feat/tour-webxr`, mergeable and **not merged**. `dev` advanced during implementation to `7ec2946` with separate CMS/admin-media work; no overlapping files or conflicts required a merge/rebase. Local gates describe the task branch, not the newer dev's unrelated CMS functionality. No direct push to dev/main, force push or automatic merge.

The publication-record commit follows these twelve commits, for thirteen meaningful task commits. Its SHA is the branch HEAD in git log and the final handoff. Hardware QA remains explicitly outstanding before claiming device certification.
