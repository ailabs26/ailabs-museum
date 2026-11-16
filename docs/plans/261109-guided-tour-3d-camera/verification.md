# Verification ledger

## Environment

Windows, Node v24.8.0, npm 11.6.0, React 18/R3F 8/Three r170. Base 521423bd7e5fd20164ed88ad633102356bafc34c. Browser configuration uses Microsoft Edge with SwiftShader unless explicitly stated otherwise. All API and GLB writes in tests are browser fixtures.

## Initial inspection

Working tree clean. Fetch and task branch creation succeeded through sandbox escalation. Frontend conventions found at docs/architecture/fe/coding-conventions.md. Impeccable context launcher could not install its engine into its restricted cache, so incumbent CSS/components are the UI reference.

## Baseline and dependencies

Initial unit run had 305 passes and one failure in exhibitQr.test.ts because node_modules lacked qrcode, already declared in the dev lockfile. Sandboxed npm ci failed through its restricted cache/network. Escalated npm ci restored exactly the lockfile, with no package or lockfile diff. Final frontend gates passed with 325 unit tests in 53 files, typecheck, lint and build. The new path helper has 19 tests. Build retains the >500 kB chunk warning. Main chunk is 1,093.34 kB, MuseumScene 84.53 kB, R3F 820.69 kB and chart chunk 543.94 kB.

## RED to GREEN evidence

- Missing guided path implementation failed eight of nine initial behavior tests. Safe framing/path/motion plus existing navigation then passed 18/18.
- A 1 cm route reproduced infinite duration. Adding an interior acceleration sample made the focused test pass.
- Combined horizontal travel and 2 m vertical reframing reproduced speed above 1.25 m/s. Conservative simultaneous-axis duration bounds made the 120 Hz resultant-speed test pass.
- Initial browser acceptance failed because the guided region/Start did not exist. Integration now exposes core status, request phase, stable exhibit ID and arrival selection through accessible DOM.
- Late canvas-label translation reproduced a permanently moving request in production. Label updates now update the DOM attribute without detaching navigation. Its browser regression passed.
- Historical GLB render failure reproduced a blocked replacement after the replacement visibly loaded 5/5. Failure checks now compare the current checksum. Its production regression passed.
- Exit test measuring quaternion reproduced an unwanted selection refocus. The active-session auto-focus guard now remembers the selection ID while disabling auto-focus. Its production regression passed.
- Reset measured inside the actual DOM action reproduced a delayed pose update. The old state/effect command queue could clear a newer held key. A synchronous ref bridge now dispatches directly to the camera owner, and selection issue time prevents stale focus from overriding newer input. Eight focused browser cases covering reset, movement, sprint, late GLB, resize and translation passed.
- Forced 4 cm proxy clearance tests the narrow-route fallback planner. A boundary-following polyline whose every rounded corner enters an obstacle tests the explicit unrounded fallback. The shared rounding helper is exercised both directly and through buildGuidedPath.
- Finite-difference vector acceleration at 60/120 FPS reproduced overshoot while simultaneously accelerating and turning. Reserving 0.6/0.4 m/s² for tangent/turning acceleration and shortening rounded chords to 0.005 m made all six 30/60/120 FPS cases pass, with zero/one metre vertical travel. Assertions allow only 0.000001 m/s² numerical tolerance. The final 19-helper-test suite passed.

## Integration checkpoints

First production run passed normal collision detour/pause/Next/manual ownership, XR/context loss and CMS reorder/removal. Two timer failures came from installing Playwright's clock after a performance.now deadline had already started, and from freezing RAF before the next React commit. Timer tests now initialize the clock before deadlines, explicitly pause virtual time and step RAF after observable core changes. Synthetic pointerdown did not own a native pointer for setPointerCapture. The mobile test now uses an actual tap.

Second focused production run passed 4/4 covering deterministic remaining dwell/completion, real mobile touch takeover, late label translation and repeated native fullscreen close/reopen. Separate empty/single-room close/reopen test passed. Geometry checks inspect actual camera samples against room and collider limits, independent of screenshots.

A broad intermediate run passed 70/74. Failures were a one-frame hover idle assertion, a stretched idle bar at 320×568, delayed manual focus and the queued reset/sprint race. The hover and 320×568 assertions passed in the unchanged focused rerun. The input race received the synchronous command/selection-order fixes above. The six-case focused run additionally passed actual quaternion angular-step bounds, zero roll and Previous during dwell. One Shift case still failed in that six-case run, then passed in the eight-case input-order run after the root fix. No existing test or assertion was changed.

Dev/React StrictMode passed 7/7 through guided-tour-core.spec.ts and selected guided-tour-camera.spec.ts cases, including provider boundary/persistence, remaining dwell, mobile Previous/takeover, late translations, Exit pose and synchronous reset.

The broad production gate passed 75/75 in 10.8 minutes on the command/input-order revision. After the final acceleration-budget/chord refinement in f7a9c7c, frontend gates passed again and all 12 Guided Tour production cases passed in 3.2 minutes. Dev/StrictMode passed 7/7 in 1.2 minutes before that pure motion-profile refinement. Logs remain in ignored front-end/tmp, including guided-final-unit.log, guided-strict-mode.log, guided-delivery-playwright.log and guided-final-profile.log. The normal travel case attaches guided-camera-samples.json with trajectory and quaternion samples. No test was skipped in these final browser runs.

| Final gate | Result |
| --- | --- |
| npm run typecheck | PASS, exit 0 |
| npm run lint | PASS, exit 0 |
| npm run test:unit | PASS, 325/325, 53 files |
| npm run build | PASS, existing large-chunk warning |
| Production affected suites | PASS, 75/75 |
| Final motion-profile Guided Tour suite | PASS, 12/12 |
| Dev/StrictMode core and lifecycle | PASS, 7/7 |
| Diff scope and whitespace | Reviewed, git diff --check clean |

## Review

A fresh review-only agent inspected the implementation and identified the late-label, replacement-checksum and combined-speed issues above. All three were reproduced and fixed with behavior tests. The author reviewed the complete diff, including subsequent command ordering and layout fixes. Scope consists of frontend camera integration, its tests and this plan package.

## Visual QA

Author inspected 1280×720 desktop and 390×844 touch screenshots. Layout reserves the joystick lane, moves mobile help above the guided bar and keeps the detail panel scrollable. Native fullscreen exit and existing toolbar/dock remain reachable in these captures. The 320×568 regression additionally caught an idle-bar top/bottom constraint that stretched the hit area. That case now passes after an explicit bottom:auto fix.

Reviewable images are evidence/desktop.png and evidence/mobile.png. Motion is verified numerically by real camera samples and pure geometric assertions. Screenshot inspection is the manual visual QA performed here.

## Acceptance coverage

| Requested scenario | Owning proof |
| --- | --- |
| E01, E15 order, 15-second dwell, completion, no wrap | Arrival/CMS-order browser cases, paused virtual clock, additional 60 seconds after completion |
| E02 spatial order differs from CMS order | CMS order/unsafe-step browser case and existing core builder/reducer units |
| E03 collision-safe movement | Actual camera samples, exact chord intersection tests, forced narrow corridor and explicit smoothing fallback |
| E04 pause/resume | Frozen camera pose, actual manual displacement, resume jump bound, remaining dwell deadline |
| E05 Next during travel | Normal travel skips first pending request, observes only current arrival selection |
| E06 Previous during inspection/completed | Mobile Previous/Next while viewing, completion Previous returns paused |
| E07 manual takeover | WASD and native touch takeover, navigation drag/capture regressions, command ordering test |
| E08, E09 XR | Guided pause, unchanged XR origin over multiple real rendered frames, explicit resume after exit, existing stereo/restore suite |
| E10 recovery/fallback | Guided actual context loss pauses, existing XR/context suite exhausts recovery into readable 2D |
| E11 responsive controls | 390×844 touch capture and 320×568/1440×900 immersive regressions |
| E12 reduced motion | Immediate safe arrival, dynamic preference change during travel, existing reduced-motion focus/intro tests |
| E13 data refresh/reload | Stable-ID reorder/removal browser case, provider reload test, late model and checksum replacement tests |
| E14 zero/one exhibit | Empty Start disabled with reason, one-exhibit completion after explicit resume |
| E16 teardown/reopen | Native fullscreen repeated reopen, existing three-cycle renderer cleanup and scene/XR lifecycle tests |

## Commands

Run from front-end.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
$env:CI = '1'
$env:PLAYWRIGHT_PREVIEW = '1'
node node_modules/@playwright/test/cli.js test guided-tour-camera.spec.ts museum-navigation.spec.ts museum-camera.spec.ts museum-fullscreen.spec.ts museum-immersive-ui.spec.ts museum-xr.spec.ts museum-glb.spec.ts museum-hotspots.spec.ts --reporter=line --output=tmp/guided-camera-delivery
Remove-Item Env:PLAYWRIGHT_PREVIEW
node node_modules/@playwright/test/cli.js test guided-tour-core.spec.ts guided-tour-camera.spec.ts -g 'persists across|missing MuseumProvider|arrival selects|late translated|Exit keeps|reset command finishes|mobile guided' --reporter=line --output=tmp/guided-strict-mode
```

## Limits

Browser evidence uses Edge/SwiftShader and simulated XR. Real-device FPS, headset comfort and physical mobile GPU behavior remain unmeasured. Collision safety follows the existing conservative XZ plinth/model proxies and rectangular room shell. Renderer-frame delta is capped at 50 ms, so slow software rendering increases wall-clock travel duration. Media text/audio retain existing user-driven behavior. GLBs can initially use existing fallback bounds and reframe after normalization arrives.

The local public API probe at localhost:3001/api/rooms timed out after three seconds. A manual walkthrough against live API data was therefore not completed. Manual visual review used the captured desktop/mobile scenes, while interactions and trajectories were verified by Playwright. One intermediate hover-idle assertion observed one extra late frame under load, and its unchanged focused and final broad reruns passed.

## Handoff

Branch feat/guided-tour-3d-camera remains local, based on origin/dev at 521423bd7e5fd20164ed88ad633102356bafc34c. All runtime changes, tests and this package are committed. No remote push, PR creation or merge was requested. If a PR is later opened, its base is dev. Commit ledger is in commit-plan.md, with the final documentation SHA included in the handoff response.

## PR #175 review follow-up

The user subsequently requested a PR, then requested fixes for dinhtienn's three findings on head 76c71fc. This section supersedes the initial local-only handoff. The existing feature branch and PR into dev are retained. Latest dev at ac6a481 was merged without conflicts before the review fixes.

### Findings and regression evidence

- Missing CMS keys now use bundled Guided Tour defaults for all six supported locales. CMS keys retain precedence. Browser cases cover all six control flows, CMS override and translation-request failure.
- Locale changes now retain stable navigation data and guided bounds. The regression reproduced a velocity drop from approximately 8.7 cm to 0.24 cm over a 100 ms interval before the fix. It checks continued movement and translated exhibit copy after changing locale.
- Zero-duration Resume now reaches viewing on its first frame when already aligned. The normal-motion regression failed the original one-second denominator fallback and passed after treating duration zero as progress 1.
- An intermediate broader run passed 27/28 and exposed one additional guided frame after DOM Pause. Synchronous coordinator cancellation and a live validity check in the camera owner now preserve the exact paused pose. The original equality assertion remains intact.

### Browser reruns and test timing

The subsequent production run passed 19/22. Two failures were software-renderer timing limits. Its attached normal-travel trace contained only 142 samples over more than 90 seconds while frame delta was capped at 50 ms. The normal travel and reset regressions now select the existing low tier at 640 by 480 with four reported CPU cores. All collision, orientation, exact-pose and movement assertions remain intact.

The third failure occurred before changing locale. Installing the fake clock after R3F had already scheduled native RAF left the renderer stationary during virtual time. The unchanged focused rerun reproduced it. Installing the clock before renderer creation fixed the test. Both new virtual-time motion cases use that ordering.

The final focused production run passed 4/4 in 2.9 minutes, covering normal collision detour/Pause/Next/manual takeover, synchronous reset, first-frame zero-duration Resume and locale continuity. Together with the other 19 passing cases, all 22 affected Guided Tour camera/locale scenarios passed on the pause-cancellation implementation. Logs are retained under ignored front-end/tmp as pr175-review-final.log, pr175-review-motion-rerun.log and pr175-review-motion-final.log. Earlier focused review regressions passed 10/10 before the additional Pause fix.

Dev/React StrictMode public locale and Guided Tour Core regressions passed 10/10 in 37.2 seconds. The log is pr175-review-dev.log. Final browser commands ran sequentially from front-end so each server completed teardown before the next run.

After the final runtime and test changes, npm run typecheck, npm run lint, npm run test:unit and npm run build all exited 0. Unit results were 325/325 across 53 files. Production build retained the existing large-chunk warning, with main at 1,096.02 kB and MuseumScene at 84.65 kB. The complete review-follow-up diff was reviewed and git diff --check passed before commits.

```powershell
$env:CI = '1'
$env:PLAYWRIGHT_PREVIEW = '1'
node node_modules/@playwright/test/cli.js test guided-tour-camera.spec.ts guided-tour-locale.spec.ts --reporter=line --output=tmp/pr175-review-final
node node_modules/@playwright/test/cli.js test guided-tour-camera.spec.ts guided-tour-locale.spec.ts -g 'normal travel detours|reset command finishes|locale-only updates|resume at an arrived' --reporter=line --output=tmp/pr175-review-motion-final
Remove-Item Env:PLAYWRIGHT_PREVIEW
node node_modules/@playwright/test/cli.js test public-locale.spec.ts guided-tour-core.spec.ts --reporter=line --output=tmp/pr175-review-dev
```

Real-device FPS, physical headset comfort and mobile GPU behavior remain unmeasured. Browser evidence uses Edge/SwiftShader and simulated XR. Existing build chunk warnings remain.
