# Verification ledger

Environment: Windows PowerShell, Node/npm installed locally; Edge/SwiftShader via repository Playwright configuration. Date: 2026-11-18 Asia/Saigon.

Base: 07ecea2498258390db0259de1d37c1df74337c73. Clean worktree at task start. Fetch and branch creation required sandbox escalation and succeeded. No backend/DB commands.

## Baseline and implementation runs

- Baseline `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`: PASS, combined exit 0; 67 files / 425 unit tests, 6.85 s; Vite build 49.75 s. Existing >500 kB chunk warning.
- Baseline browser attempt in sandbox: FAIL to launch Edge (Crashpad/pipe sandbox restriction), 3 launch failures, 2 non-browser camera checks passed. No product conclusion from launch failures.
- Unsandboxed production-preview camera/Collection baseline: 5 PASS, exit 0, 23.6 s.
- New search unit helper initially RED (missing module), then 10 PASS after implementation. One fixture expectation corrected because ceramics description legitimately contains “hiện vật”; query made specific to removed exhibit 1.
- First search browser test RED on original build: missing Search this room button. Implementation run: 12 PASS, exit 0, 3.4 min, Edge + SwiftShader, production preview.
- Implementation typecheck/lint/build PASS. Full unit suite 68 files / 435 tests PASS, 66.16 s (run concurrently with software WebGL, high CPU contention).
- First affected regression: 75 PASS / 2 FAIL, exit 1, 13.0 min. Genuine overlap at 320×568 prevented closing details. Fixed by bounding the rail above mobile details. Existing 700 ms sprint comparison observed zero frames under concurrent browser runs; rerun unchanged in isolated final regression, do not weaken assertions.

## Independent review and reproduced defects

One fresh read-only reviewer, no product edits. Five findings, each reproduced by a failing browser test before fixing:

1. Previous ordinary autofocus cancels search B (observed `cancelled` instead of `arrived`). Suppress autofocus for any active explicit search request.
2. Detail B's 2D link follows paused tour A. Always bind detail link to selected exhibit; tour bar retains its own continuation.
3. Empty HUD wrapper intercepts visible scene (`elementFromPoint(100,550)` returned DIV). Content-sized rail with viewport max-height.
4. Search accepts requests before Canvas/camera owner exists. Hold ResizeObserver callbacks: search was still visible. Gate availability on MuseumControls readiness.
5. Render-failed GLB uses absent model bounds (fallback look alignment 0.994253 vs required >0.999). Exclude failed checksum when choosing search asset normalization.

Additional own review RED→fix: Escape from focused canvas did not close search, Clear left a target marker, hotspot takeover left search concealing story, 640×480 detail/rail overlap and hidden opener after collapse. Scoped host Escape handler respects nested modal event paths; Clear cancels target; story takeover collapses; narrow landscape columns separate; focus scrolls opener back into view.

Pure intent reducer tests: repeated same exhibit/new identity, A→B stale arrival/blocked, cancellation and restart. 3 PASS plus 10 search helper tests, exit 0.

## Final frontend quality gates

Windows PowerShell, Node 24.8.0, npm 11.6.0. Commands ran from `front-end/` after the review fixes. The gate runner stopped on a nonzero exit. All four commands exited 0.

| Command | Result | Elapsed |
| --- | --- | ---: |
| `npm run typecheck` | PASS | 17.72 s |
| `npm run lint` | PASS | 13.39 s |
| `npm run test:unit` | PASS, 438 tests in 69 files | 13.40 s |
| `npm run build` | PASS, existing Vite chunk-size warning | 60.63 s |

Final browser verification is tracked separately from the earlier diagnostic runs.

Ruling: user explicitly requests plan → implementation without stopping, so no separate design approval gate. Single task branch in clean checkout satisfies requested isolation; no extra worktree is necessary.
Ruling: use supplied display order for deterministic ranking; no translated alphabetical sort.

## Final production-preview browser run

Windows / Edge `157.0.4341.60`, headless, SwiftShader, mocked museum API, `PLAYWRIGHT_PREVIEW=1`, one worker. The original final run was interrupted without a report; the rerun below used the same post-review source and build. It wrote `front-end/tmp/search-handoff-report.json` and `front-end/tmp/search-handoff/` (both ignored).

```powershell
$env:PLAYWRIGHT_PREVIEW = '1'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'tmp/search-handoff-report.json'
npx playwright test museum-exhibit-search.spec.ts museum-immersive-ui.spec.ts museum-navigation.spec.ts museum-camera.spec.ts guided-tour-camera.spec.ts museum-hotspot-storytelling.spec.ts museum-xr.spec.ts museum-fullscreen.spec.ts tour-2d-fallback.spec.ts collection-global-search.spec.ts public-tour-navigation.spec.ts --workers=1 --output=tmp/search-handoff --reporter=list,json
```

| Suite | Passed / run |
| --- | ---: |
| Exhibit Search | 18 / 18 |
| Navigation | 8 / 10 |
| Museum Camera | 2 / 2 |
| Guided Tour Camera | 13 / 13 |
| Hotspot Storytelling | 12 / 12 |
| WebXR | 12 / 12 |
| Immersive UI | 5 / 5 |
| Fullscreen | 8 / 8 |
| 2D Fallback | 10 / 10 |
| Collection Global Search | 3 / 3 |
| Public Tour Navigation | 2 / 2 |
| **Total** | **93 / 95** |

Aggregate result: **FAIL**, exit `1`, 747.6 s, zero skipped. The affected 320×568 close-button test passed. Two existing navigation tests failed:

- `museum-navigation.spec.ts:73`: the Shift trial moved 0.615 m, below the 0.666 m required by its relative threshold. It passed 3/3 in the focused rerun.
- `museum-navigation.spec.ts:117`: the selected GLB's projected portrait extent was `1.488521603610249`, above the `< 1` threshold. It passed 2/3 in the focused rerun; the failure had the same measured extent.

The focused rerun used the same production build, `npx playwright test museum-navigation.spec.ts --grep 'Shift increases|selected delayed GLB' --repeat-each=3 --workers=1 --output=tmp/search-handoff-focused --reporter=list,json`. Result: **5 passed, 1 failed**, exit `1`, 32.4 s. Assertions and timeouts were unchanged.

### Baseline control for the two failures

Exported the tracked `front-end` tree from `07ecea2498258390db0259de1d37c1df74337c73` into ignored `front-end/tmp/search-verify-base-4ee38cf8/`, reused the installed dependencies, and ran `npx vite build` (exit `0`, 42.55 s). With the same preview, Edge/SwiftShader, assertions and timeout, the focused command above was run with `--repeat-each=8 --output=tmp/search-baseline-navigation` and JSON output `tmp/search-baseline-navigation.json`. Result: **15 passed, 1 failed**, exit `1`, approximately 90 s.

- Delayed GLB framing: **baseline reproduces** (7/8 passed). The baseline failure has the identical projected extent, `1.488521603610249`. The ordinary focus case already fails intermittently before immersive search. Search-specific fallback framing and arrival tests passed.
- Shift speed: **PARTIAL**. Baseline passed 8/8, and the candidate passed 3/3 in isolation. The full run still failed. Both revisions use the unchanged 50 ms per-frame movement cap and the test compares two fixed 700 ms wall-clock windows, so different frame delivery can affect the result. These runs do not isolate that cause or prove the failure is baseline. Preserve the observed failure for review.
- Regression assertions and timeouts were kept unchanged. `git diff` against the base is empty for `museum-navigation.spec.ts` and the shared movement math.

### PR #206 follow-up: Shift speed under uneven frame delivery

Compared base `07ecea2` and PR code `58b60a8` on the same Windows host, Edge `157.0.4341.60` with SwiftShader, the same room fixture, a 390×844 viewport and one Playwright worker. Tested production previews sequentially in base → PR → PR → base order. Each run used the existing `npx playwright test museum-navigation.spec.ts --grep 'Shift increases' --workers=1 --repeat-each=3` with its original assertions and timeout.

| Build | Unchanged 700 ms test | Walk after 4 capped frames | Shift + walk after 4 capped frames |
| --- | ---: | ---: | ---: |
| Base `07ecea2` | 6/6 | 0.248453 m | 0.447215 m |
| PR `58b60a8` | 5/6 | 0.248453 m | 0.447215 m |

The unmodified PR test failed once with zero displacement in both windows. To isolate the speed calculation, a local diagnostic reset the camera to the same pose, waited for idle, imposed a minimum 65 ms animation-callback interval to exercise the existing 50 ms movement cap, and recorded camera X before each render. It held each input until four moving samples and compared the first four corresponding positions. Both builds passed (exit `0`; 13.8 s base, 13.0 s PR) and produced the same positions and 1.80× Shift/walk ratio. No application or tracked test code changed.

A separate 700 ms diagnostic reproduced the original assertion's failure mechanism on both builds. With unequal frame delivery, one base sample moved 0.160883 m walking (3 moving frames) and 0.150358 m sprinting (2), below its 0.217192 m threshold. One PR sample had the same 3-vs-2 result. At the second corresponding frame on both builds, walking had moved 0.083532 m and sprinting 0.150358 m (1.80×). Even the original 0.614936 m sprint result is numerically identical to five capped 50 ms steps at 3.6 m/s with damping 12 from rest. The original run did not record per-trial frame counts, so that last correspondence is supporting evidence, not a measured frame count.

**Conclusion:** The wall-clock assertion can fail even when Shift acceleration is correct; it compares displacement over unequal amounts of simulated movement. The diagnostic reproduces that mechanism on base and PR, while at matched simulation steps no speed regression was observed. This does not establish identical rendering throughput or turn the 93/95 suite result green. The original regression test and its threshold were left intact. Ordinary delayed GLB portrait framing remains a separate baseline issue.

### Acceptance and remaining proof

| Area | Status | Evidence |
| --- | --- | --- |
| Current-room scope; title, description and hotspot ranking; Unicode, case, whitespace and locale mapping | PASS | Search unit tests plus E01–04, refresh/removal and room-switch cases. API request probe observed no per-query search calls. |
| Readable results, matching 3D rings/minimap, clear, empty, keyboard/Enter/Escape, touch layout, reduced motion | PASS | Search Playwright cases and inspected desktop/touch screenshots. Physical accessibility and touch devices are untested. |
| New and repeated request identity, safe live detour, exact arrival, stale A → B rejection, blocked and outside-room 2D fallback | PASS | Reducer tests; E05–07, E12–13; 270 camera samples, safety checks, final facing alignment and selected URL. |
| Guided pause/resume, manual or hotspot takeover, XR pose ownership and unchanged public 2D search | PASS in test environment | E08–10, E13–14 and corresponding regression suites. WebXR uses simulated sessions, controllers and gaze. |
| Render failure, actual WebGL loss/recovery, no replay, failed GLB plinth and stable healthy GLB requests | PASS for search | Dedicated search, XR and 2D fallback cases. Ordinary delayed portrait GLB framing has a reproduced baseline failure. |
| Search/filter latency, route motion, idle frames and renderer release | PASS for fixtures | [Evidence](evidence/README.md): UI/Node measurements, sampled segments, idle frame counts and released contexts. |
| Entire affected Playwright batch | FAIL | 93/95. Baseline GLB failure and intermittent Shift speed case are recorded above. |
| Hardware GPU/headset, physical mobile/screen reader, paint latency and long-session heap retention | PARTIAL | Software/simulated checks only. |
