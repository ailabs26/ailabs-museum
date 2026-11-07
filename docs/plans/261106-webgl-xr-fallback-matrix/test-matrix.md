# Fallback scenario matrix

Run from `front-end/` against a fresh production build with `PLAYWRIGHT_PREVIEW=1` and `CI=1`. Fixtures serve validated public API data and genuinely parsed, self-contained GLBs. No live API is required. Final run results and evidence are in [the report](fallback-test-report.md).

| ID | Fault and expected result | Automated proof owner |
| --- | --- | --- |
| F01 | No WebGL, readable DOM catalogue and contextual 2D route | `tour-2d-fallback.spec.ts`, `museum-xr.spec.ts` |
| F02 | Real context loss, recovering → verifying → ready after a submitted frame, same Canvas and cached models | `museum-xr.spec.ts` actual context restores test, structured transition evidence |
| F03 | No successful restore within 8000 ms, stable 2D and aborted downloads | `tour-2d-fallback.spec.ts` unrecovered context, `webglRecovery.test.ts` |
| F04 | Third context loss or third partial-binding failure exhausts the corresponding two-recovery budget | Existing repeated actual loss test and new Canvas reset exhaustion test |
| F05 | Invalid header, checksum mismatch, truncation, only the affected artifact gets placeholder | Extended `museum-hotspots.spec.ts` failure table, `glbAsset.test.ts` |
| F06 | 401/403/404/500/502, network failure or timed-out network abort, four healthy GLBs retained, controlled retry succeeds | Extended `museum-hotspots.spec.ts`; existing bounded cooldown test and `roomModelAssets.test.ts` |
| F07 | Genuine parser/accessor rejection, malformed optional mesh quarantine or model clone/render failure, detail remains available | Existing `museum-hotspots.spec.ts`; `loadMuseumModel.test.ts` |
| F08 | Missing navigator.xr or unsupported immersive-vr, hide VR and preserve web navigation | Existing browser and `xrSession.test.ts` capability tests |
| F09 | Refused request, preserve Canvas/selection and permit retry | Existing `museum-xr.spec.ts` refusal test |
| F10 | Unexpected native end, once-only release, restore web navigation | New mid-session disconnect tests and existing controller unit end test |
| F11 | Native UA end plus availability=false/devicechange in either order | New `museum-xr-disconnect.spec.ts`, both event orders, actual XR select before termination |
| F12 | Controller/input-source removal while headset stays active, head gaze can Exit | Existing controller-free gaze browser test, distinct from `terminateHeadset()` |
| F13 | visible-blurred suppresses input and snap turn, visible resumes, hidden follows current policy and exits | New visibility browser test |
| F14 | End during compatibility or setSession, duplicate end, late completion, no resurrected session | New two browser boundary tests, existing binding failure test, extended binding/controller unit tests |
| F15 | Real WEBGL_lose_context concurrent with native end, both active and pending binding, native-first and processed context-first | Four new browser races and existing active-XR context loss test |
| F16 | Capability returns, no auto-entry, explicit click creates a different session | New disconnect cycles, unit stale capability-response test |
| F17 | Close or change room while request is pending, late old session never presents in new room | New two pending-request browser tests, existing model queue abort test |
| F18 | Repeated reconnect/entry/exit retains one renderer and stable geometry/texture counts, no registered session listeners after healthy release | New three-cycle tests, final teardown, reset budget exhaustion and unit disposal tests |

## Additional order and ownership assertions

Old-session duplicate end after a fresh session becomes active cannot end the fresh session. Pending bind completion blocks fresh entry until settled, then an old event is inert. A restored event at 7999 ms cannot extend the deadline and restoration after failure cannot revive 3D. These latter cases use controlled promises and fake timers at helper boundaries. Browser GPU loss always uses the real extension. The unit EventTarget tests establish state-machine behavior only.

Network `timedout` is a controlled browser request-abort reason. It does not measure wall-clock server timeout or carrier network behavior. Per-artifact render coverage uses a controlled model clone/construction exception, while the real loader handles the accessor failure. Driver-level render faults remain hardware QA.

Legacy `[F02]`–`[F04]` labels embedded in `tour-2d-fallback.spec.ts` belong to an older task. Match by test title and this table, not by those legacy prefixes.
