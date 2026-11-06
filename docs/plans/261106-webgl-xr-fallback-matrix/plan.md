# WebGL and WebXR fallback verification plan

Goal is to extend regression evidence for F01–F18 using the existing lifecycle owners. User supplied the detailed task on 6 November 2026. Execute inline through verification and local atomic commits.

## Baseline and architecture

- Branch `chore/webgl-xr-fallback-matrix`, freshly fetched `origin/dev` at `c10ffa9884f54e45203522e1b57d8bd01a1cf0f8`. Working tree was clean.
- `MuseumPage` owns room and selection outside Canvas. `MuseumScene` owns room model cache, Canvas retirement and two renderer resets. `MuseumControls` owns web camera input.
- `XrSessionController` serializes requests, generation invalidation, capability checks and cleanup. `bindXrRenderer` handles Three r170 partial initialization. Keep actual Three WebXRManager in browser tests.
- `SceneLifecycle` pauses rendering on real context loss. `watchWebglRecovery` permits two recoveries, each with an 8000 ms deadline including successful-frame verification.
- `RoomModelAssets` owns two concurrent downloads, checksum cache, three manual retries with backoff, abort and disposal. `loadMuseumModel` validates header/checksum, parses, sanitizes and normalizes. Artifact boundaries isolate render exceptions.
- Frontend conventions are actually located at `docs/architecture/fe/coding-conventions.md`. The older frontend README path is stale.

## Coverage inventory and gaps

Existing browser tests cover unavailable WebGL/XR, refusal, real context restore/exhaustion/timeout, valid GLBs, controller-free gaze, ordinary XR exit, one async end and one partial-binding reset. Unit tests cover controller serialization, model disposal/retry and recovery budgets. `museumXrFixture.disconnect()` removes input sources only.

New coverage targets native headset termination with devicechange in both orders, reconnect with a fresh session, duplicate end, visibility interruption, preflight/binding promises, close/room change while pending, context loss during binding, reset exhaustion, GLB failure isolation with four healthy peers and successful retry. Existing tests are rerun rather than copied. Historical F-labels in tour-2d-fallback.spec.ts predate this matrix and have different meanings.

## Tasks and acceptance

- [ ] Extend `tests/fixtures/museumXr.ts` with native termination, availability, visibility, request/compatibility/binding gates and listener/event snapshots. Preserve controller disconnect semantics.
- [ ] Add `tests/museum-xr-disconnect.spec.ts` for F10–F18. Assert active entry, actual select, web camera restore, same Canvas, cached GLBs, listener teardown, no errors and deliberate fresh-session reconnect. Use controllable boundaries for races.
- [ ] Extend helper regressions for ordered capability checks, stale sessions and post-timeout restore. Run targeted Vitest.
- [ ] Add `tests/museum-fallback-matrix.spec.ts` for GLB fault variants, successful isolated retries and renderer reset exhaustion. Reuse valid GLB fixture.
- [ ] Any production change requires an observed failing regression, diagnosis and minimal owner-layer fix with its own commit.
- [ ] Run typecheck, lint, full unit suite, build, then required Playwright suites on strict production preview. Preserve result logs and structured evidence in `evidence/`.
- [ ] Review complete diff and commit the actual completed pieces. Record hardware limitations and final acceptance honestly.

## Constraints and review focus

Frontend/tests/docs only. Preserve 8000 ms policy, two recovery/reset budgets, selection and accessibility. No backend/database changes. Local commits only. Review stale async completion, duplicate lifecycle delivery, devicechange order, cleanup ownership and partial renderer retirement. Physical device acceptance requires actual hardware.

## Related work

Use the existing [performance audit](../261104-real-device-3d-performance-audit/performance-audit-report.md) and [measurement protocol](../261104-real-device-3d-performance-audit/measurement-protocol.md) for GPU/performance methodology. See [XR architecture](../webxr-immersive-tour-plan.md) and [immersive UI verification](../261026-immersive-museum-redesign/verification.md). This task measures fallback correctness, with software WebGL explicitly identified.
