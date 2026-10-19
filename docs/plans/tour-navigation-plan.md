# Desktop and touch museum navigation

Goal: complete first-person exploration in the existing R3F tour without competing camera writers or breaking accessible selection, models, and focus.

## Evidence and design

- Base: latest `origin/dev`, `8ffd808`; clean working tree; 52 baseline unit tests pass.
- `MuseumControls` alone currently owns OrbitControls and focus transitions. Canvas renders on demand. `MuseumScene` guards clicks with one pointer record, which cannot track simultaneous touches reliably.
- Room geometry uses `MUSEUM_ROOM_SIZE` (14 × 16 × 5); API has no variable room geometry contract. Derive navigation bounds from that same rendered shell, not exhibit spread. Every room currently shares this shell.
- Replace orbit with one camera writer in `MuseumControls`: explore → focusing → inspect. Manual input interrupts focus; closing details cancels it without moving the camera. Keep F/Home, arrows and zoom buttons accessible.
- Choose drag-to-look for desktop and touch so pointer lock never competes with artifact picking or nonmodal details. Tap remains selection; movement beyond 5 px suppresses the entire gesture, even if it returns to its start. Separate pointer IDs for joystick/look; suppress selection for multitouch.
- Shared ref inputs feed camera-relative planar velocity, exponential damping, capped delta and bounded substeps. Conservative expanded XZ artifact/plinth proxies work for normalized GLBs and fallback shapes without triangle raycasts.
- One R3F frame callback owns movement and focus; invalidate only while motion continues. No additional animation loops or per-frame React state.

## Implementation checklist

- [x] Add failing unit tests for planar movement, damping/time, yaw/pitch, joystick and collision; implement shared helpers.
- [x] Add lifecycle-tested desktop input and pointer gesture ownership; implement touch joystick and HUD using refs.
- [x] Integrate a single camera pipeline with collision-safe focus/reset/interruption and existing selection.
- [x] Add real WebGL browser tests for keyboard, drag/tap, simultaneous touch, focus, collision, interruption, room switching and idle cleanup.
- [x] Run frontend unit tests, typecheck, lint, build and affected browser regressions; inspect desktop/mobile screenshots; fix demonstrated failures.
- [ ] Review full diff, document measured evidence and limitations, commit meaningful units, publish one PR into `dev`; do not merge.

## Review focus

Lost focus while holding input; returning drags; multitouch release order; focus/model updates after manual interruption; obstructed focus destinations and late model loads. These receive regression coverage in the owning unit/browser tests.

## Execution decisions

User explicitly requested immediate end-to-end implementation after a short plan; execute inline without additional design-approval gates. Work on one feature branch in the clean existing checkout. No backend, storage, migration, dependency, or env changes. Graphify list calls failed with no authorized workspace; use direct source tracing.
