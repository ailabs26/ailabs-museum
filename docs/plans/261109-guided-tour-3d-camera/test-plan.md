# Test plan

Unit proofs cover direct and obstructed routes, multiple barriers, wall endpoints, blocked destinations, coincident endpoints, unreachable rooms, finite output, exact endpoints, collision-safe rounded chords, monotonic arc-length/time tables, bounded speed/acceleration, 30/60/120 FPS and large delta handling. Framing tests cover normalization size, unsafe placement and occlusion.

Browser tests use the existing production preview, fixture API and test-only renderer probe. Observe phase/step/selection rather than fixed sleeps for arrival. Sample actual camera poses geometrically against colliders. Cover E01–E16 in the request, including manual input, paused travel/dwell, stale callbacks, explicit XR pause, context loss, CMS reconciliation, single/empty room, close/reopen and reduced motion. Existing core/navigation/camera/fullscreen/immersive/XR/GLB/mobile suites remain regression gates.

Final commands from front-end are `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` and focused Playwright with `PLAYWRIGHT_PREVIEW=1`. Capture desktop/mobile images and traces on failures. Hardware comfort/FPS requires a real device and must be reported separately from Edge/SwiftShader.
