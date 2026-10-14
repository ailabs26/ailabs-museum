# Day 4 — measured museum performance and final verification

> **For agentic workers:** Execute inline with superpowers:executing-plans; review the whole branch independently before delivery.

**Goal:** Keep the Day 3 appearance and interactions while reducing avoidable initialization, resource allocation and draw work; verify cleanup, API behavior and final acceptance honestly.

**Architecture:** Preserve MuseumPage → lazy MuseumScene → R3F ownership, validated museumService and TanStack Query. Optimize existing owners: static gallery batches, plaque texture lifecycle, render boundaries, public query lifecycle, mobile CSS. Profiling stays in Playwright utilities, not production globals.

**Tech stack:** Existing React 18, R3F 8, Three 0.170, Vite, Mantine, Playwright/Edge/SwiftShader and CDP. No new runtime dependencies.

**Spec:** User attachment `ae2a213a-a7b1-415c-9251-31d371a505c7/Pasted text.txt`, ACTIVE_DAY=4; acceptance and four-day ledger in `docs/museum-tour-progress.md`.

## Constraints and rulings

- Base `777b583` from freshly fetched origin/dev; one branch `feat/museum-performance-day4`, one PR into dev. No automatic merge/history rewrite. Existing font fixes remain intact.
- Target meaningful atomic commits (user goal 20, maximum 30); never split empty or invented work to reach a count.
- Reuse current lazy start, demand rendering, DPR 1.5 cap, abort signals and fallback. No walking/GLB/audio/XR features. Public mapper still returns model/image/audio null; no speculative asset URLs or loader/cache subsystem.
- No database writes, seeds or migrations. Local read-only API startup is already authorized.
- Graphify rank-files and list-workspaces both returned 403 no_workspace; use source and installed-dependency tracing.
- User explicitly requests implementation after inspection; continue in the prepared clean checkout on the task branch, preserving the previous inline workflow.
- Baseline found public room requests repeated when initial auth recovery clears all query caches. Any fix must retain cancellation/removal of private queries and receive human review at the PR; this task already stops at PR.

## Review focus

1. Shared GPU resources must survive a sibling unmount and be released by their actual owner, including StrictMode replay.
2. Public query preservation must not retain session/private data; stale/publication changes must remain refreshable.
3. Demand rendering must update selection, changed content, keyboard movement and reduced-motion transitions.
4. Static batching must preserve placement, normals, colors, picking and visible annotations.
5. Repeated switching/remounting must leave one live context at most, then zero after teardown; no old-room objects or delayed response overwrite.

## Execution tasks

### 1. Reproducible baseline and instrumentation
- [x] Add test-only `tests/fixtures/museumProbe.ts` using Three's existing devtools observation event and WeakRef; inspect renderer.info, object/material counts, frame timestamps, contexts and CDP heap.
- [x] `tests/museum-performance.spec.ts`: assert no WebGL before start, idle stops, interaction renders, four start/stop cycles release contexts. Save JSON and canvas screenshot; record cold request counts, including duplicates.
- [x] Run baseline production build, unit/lint and profile against an isolated test server. Commit passing measurement tooling.

### 2. Label allocation and text work
- [x] Add regression asserting selection preserves plaque texture identity (RED before fix).
- [x] Update `ExhibitLabel.tsx` so effect-owned canvas/texture persist for one mounted label, redraw only when title/selection changes, dispose on unmount, invalidate demand rendering. Preserve current Vietnamese font.
- [x] Bound title fitting work with measured-text binary search and preserve Unicode code points/ellipsis width; unit-test long text and empty/fitting titles.
- [x] Verify texture identity, selection visuals and lifecycle in production and StrictMode; commit independent fixes.

### 3. Static gallery and exhibit resource reuse
- [x] Use baseline counts to define a meaningful resource budget test that fails before changes.
- [x] Batch repeated static gallery parts with installed Three InstancedMesh, retaining dimensions/materials. R3F owns declarative geometry/material disposal; instance transforms set in a layout effect, with bounding volumes refreshed.
- [x] Reuse fitting repeated exhibit/plinth geometries only where ownership stays simple; avoid global GPU caches and avoid disposing resources still used by siblings.
- [x] Re-measure geometry/material/draw counts and inspect matched screenshots; commit each independently verified optimization.

### 4. Render boundaries and initialization
- [x] Trace parent updates and add stable callbacks/memo boundaries only where they prevent measured unrelated scene work.
- [x] Assess initial bundle (baseline main 1,378.74 kB; lazy scene 851.31 kB). Restrict bundle changes to an existing owner if a safe bounded split has a clear benefit; preserve routes/guards/fallback.
- [x] Confirm lazy chunk and zero contexts before explicit scene start, and updates still invalidate after content changes.

### 5. API lifecycle and bounded caching
- [x] Reproduce duplicate public requests with failed initial session restoration and show the regression before fixing.
- [x] Preserve explicitly public room queries across session reset at the responsible cache boundary; retain private cancellation/removal. Verify with private-cache and public-request tests.
- [x] Check current-room-only requests, rapid switching, abort on departure, refresh failures/recovery, and inactive cache lifetime; change cache policy only with a justified bound.

### 6. Final mobile polish
- [x] RED test at 320×568: viewport height at least 440px, no horizontal overflow.
- [x] Move mobile viewport override after base declaration in `MuseumPage.module.css`; preserve fonts/colors. Run responsive/touch/font tests and inspect screenshot.

### 7. Final proof and delivery
- [x] Repeat the same profile and lifecycle conditions; report measured results and limits (software GPU, emulated touch; heap observations do not prove physical GPU memory or all-device leak freedom).
- [x] FE typecheck/lint/build/unit, complete production browser suite, real API integration (no interception/database writes), and targeted StrictMode lifecycle.
- [x] Independent full-branch review, fix blockers with regression proof, review final diff, commit evidence and update `docs/museum-tour-progress.md` with four-day architecture/endpoints/commits/demo/limitations.
- [x] Push task branch, open one PR with base dev, confirm publication. PR #52: https://github.com/ailabs26/ailabs-museum/pull/52. Stop before merge for user testing/review.

## Final decisions and evidence

Checked optimization items include assessment, not an assertion that every optional technique was added. Existing plinth ownership stays unchanged: gallery instancing already reduced calls 77→39 and geometry 75→37; a global cache adds unnecessary ownership complexity. No additional memo boundaries were justified by measured work. Query GC retains the installed browser default of five minutes; public request duplication was fixed at the session cleanup owner. No model/media loading subsystem was added while public media fields remain null.

Final production source `9d705af`: typecheck/lint/build pass, 13 unit tests pass, 84 production browser tests pass/4 intentional live skips, 2 actual-API museum tests pass, 2 focused dev/StrictMode tests pass. Independent review found no Critical/Important issue. Human auth review remains required before merge. Detailed baseline/final metrics, prior failures and limitations are in `docs/museum-tour-progress.md`; especially, released heap growth does not prove JS leak freedom. Seven code/planning commits plus final documentation are intentionally below the aspirational 20, without artificial splitting.
