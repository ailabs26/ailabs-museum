# Dynamic GLB tour implementation plan

**Goal:** Display and interact with at least five real Supabase GLBs in one existing museum room.
**Spec:** User attachment “Full Implementation: Dynamic GLB Loading, Model Normalization, Raycasting & Camera Controls”, 2026-10-15.
**Architecture:** Extend the published `/api/rooms/:slug` contract with a nullable model descriptor. A read-only backend endpoint rechecks publication and streams the private Storage asset through server authorization. The frontend only calls NestJS. Retain the existing room, demand rendering, selection/detail state and OrbitControls.
**Stack:** NestJS / TypeORM / native fetch; React / R3F / Three GLTFLoader; node:test, Vitest, Playwright.

## Constraints and decisions

- Branch `feat/dynamic-glb-tour`, base `9c14548` (fresh origin/dev). No migrations, policy changes, overwrite of sample exhibits, merge or force push.
- Existing published revisions already own modelMedia references and media owns storageKey/checksum/size; reuse these tables.
- Real assets verified by connector: private `museum-assets`, five `models/*.glb`, 3.6–28.9 MB. No media mappings yet. Server Storage credentials are absent; user asked to configure ignored backend env while independent work continues.
- Preserve PBR/nested transforms; normalize using wrappers and world bounds. Reject invalid/zero bounds. Uniform scale, ground on plinth, bounded dimensions.
- Room-scoped asset owner: two concurrent downloads, deduplicate repeated media, abort on room/scene teardown, dispose geometry/material/texture once after all instances detach. No unbounded global GLTF cache.
- Actual GLB headers/extensions must be inspected before adding decoders. Block external glTF dependencies; assets must be self-contained GLB.
- Real physical dimensions are absent. Auto-fit maximum extent to the available display envelope; do not invent historical measurements or descriptions.
- Aspirational 50 commits does not override meaningful atomic changes; never pad history.
- User explicitly requests plan then immediate full implementation; execute inline without extra design-approval rounds.

## Review focus

1. Hidden/deleted/unapproved media must never be served by public binary routes, including cached requests.
2. Teardown during fetch/parse, StrictMode effect replay and duplicate assets must not leak or dispose live shared resources.
3. Expired private URLs / permission denial / invalid GLB must fail per artifact with retry and readable DOM status.
4. Nested or extreme model bounds must preserve aspect ratio, center X/Z and keep minimum Y on the plinth.
5. Portrait viewport, rapid selection and interrupted camera movement must preserve framing and user control.

## Tasks

- [x] 1. Capture source/storage investigation and baseline tests; commit documentation.
- [x] 2. Add public model descriptor and publication-checked binary route; test metadata, authorization, storage failures and path validation before implementation. Check backend types/lint/build/tests, commit.
- [x] 3. Add pure GLB validation, resource disposal and normalization with RED/GREEN unit tests; commit.
- [x] 4. Add room-scoped queued/deduplicated loader and error/retry/status UX; test cancellation, concurrency and malformed files; integrate with actual scene; commit.
- [x] 5. Extend nested-mesh raycast selection and background clearing; retain accessible catalogue/details. Verify drag threshold, touch and missing models; commit.
- [x] 6. Extend camera focus with normalized bounds, FOV/aspect framing, room-safe positions and interruption; unit/browser verification; commit.
- [x] 7. Inspect all five real binaries, calculate checksums and create verified additive media/exhibit mapping in a dedicated room using a repeatable seed (no schema change). Preserve old records. Commit seed and verification evidence.
- [x] 8. Run both applications' required checks and relevant/full browser regressions. Inspect real scene screenshots, each GLB selection/focus, reset, mobile, mount/room cleanup, idle frames and renderer resource counts. Fix task regressions; commit.
- [ ] 9. Whole-branch review, update `docs/museum-tour-progress.md` with honest evidence, limitations and commit ledger; commit and open one PR into dev. Stop for human review, no merge.

## Execution ledger

- Investigation: clean working tree on dev; fetched fresh origin/dev and created feature branch. Graphify exposes no workspaces, so local source tracing used.
- Verified current pipeline: ExhibitsController → ExhibitsService → ExhibitsRepository.findByRoom (approved published revision + visible/nondeleted exhibit) → null model → Zod room schema → mapRoomDisplays → geometric ExhibitionDisplay. Existing scene already handles demand rendering, hover, raycast click/drag discrimination, detail selection and smooth OrbitControls focus.
- Storage policies: no pg_policies rows for public/storage; storage buckets/objects have RLS. Public tables have RLS disabled; record as pre-existing security risk, do not modify access policies within this task.
- Baseline launcher: PowerShell blocks npm.ps1; use npm.cmd without changing machine execution policy.
- Baseline proof: frontend 13 unit tests; backend 485 exhibit tests passed. Server Storage key configured by user in ignored `.env`; only bucket name appended locally, never key output or committed.
- Task 2: `3f1d429`, native REST signing + StreamableFile proxy; tested against a local upstream server and actual signed private Storage stream. Additional authorization/redaction/envelope tests bring focused Storage/seed suite to 9 passed. Backend final typecheck/lint/build passed; general suite 471 and exhibit suite 492 passed.
- Tasks 3–4: `5ee3b7d`, `0c24aad`, `331023b`; bounds/validation/room queue RED→GREEN. Added late-progress ownership regression RED (ready overwritten by loading) → GREEN. Current unit suite 23 passed.
- Tasks 5–6: `4ccd399`, `45b4379`; actual five-model raycast/focus gate passed. Independent whole-branch reviewer found no Critical issues, two Important camera findings. Both were reproduced, fixed and covered by 1000-update OrbitControls settling and delayed real-GLB reset/drag browser cases. Former deferred focus moved ~2 m; remaining <1 cm inertia is allowed in the meaningful no-refocus assertion.
- Task 7: `a7294c2`; all five binary headers, embedded resources/extensions and SHA-256 verified. Additive seed created five mappings; second real run skipped all five. Placement-only adjustment to the two new task-owned statues improves overview visibility; old sample content unchanged.
- Final review: two Important findings fixed; no Minor findings. Reviewer declined live visuals/browser GPU/StrictMode/full-suite judgment because parent owns those running checks; parent is verifying those explicitly, not treating source review as visual proof.
- Broad browser regression after fixes: 108 passed, 8 opt-in live tests skipped. Earlier 5-second lazy-scene readiness failure was diagnosed from trace (3.5-second chunk request); aligned that test with the existing 15-second scene readiness convention. Expanded actual live and dev/StrictMode checks remain the final gate.
- Task 8 final: actual Supabase five-model/mobile/touch/full-bounds and two complete resource cycles 2/2 passed; dev/StrictMode cancellation and delayed real GLB reset/drag 3/3 passed. Initial cold-dev queue case measured before scene readiness; explicit existing readiness gate fixes the test precondition. All six final scene screenshots and mobile image inspected. Settled real model resources stable over two mounts; no live context after stop. Full actual numbers/limits in museum-tour-progress.md; SwiftShader scripted keyboard cadence 2.48 frames/s is not a physical GPU performance guarantee.
- Ruling: Independent reviewer declined live/browser judgments because parent owns those checks; parent completed actual browser, visual, lifecycle and StrictMode evidence. Cost if wrong: device-specific rendering/performance can still differ; physical GPU/phone/VR QA remains explicitly unverified.
