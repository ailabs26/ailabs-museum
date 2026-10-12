# Museum tour — Days 1–2 of 4

ACTIVE_DAY = 1. Branch: `feat/museum-scene-day1`. Base: `ca7a334` (`origin/dev`).

## Verified architecture and design

- React 18 + TypeScript + Vite 6 SPA, Mantine 7, React Router 6. R3F 8 and Three 0.170 are already declared; no additional runtime library needed.
- `main.tsx` mounts `AppProviders` and `AppRouter` at `#root`. `PublicLayout` owns public navigation. `/tour` is a placeholder; no `tour.html` exists. `MuseumPage`, `MuseumScene`, `MuseumLayout` are empty scaffold.
- Add `tour.html` as a second Vite HTML input using the same main entry. Both `/tour` and `/tour.html` render `MuseumPage` under existing `PublicLayout`. This preserves other routes and makes the requested HTML a real build artifact.
- `MuseumPage` owns the start/stop choice and accessible sample catalogue. Lazy `MuseumScene` owns Canvas, room, lighting and controls; sample display props contain no API/auth logic. Existing shared `ErrorBoundary` protects only the scene, leaving DOM content available.
- One enclosed 14 × 16 × 5 m gallery; pale limestone, warm plaster, bronze details, five lightweight geometric studies. Y up, positions in metres. Orbit camera around the central display, bounded inside the room; mouse/touch orbit and focused keyboard controls, with reset and zoom buttons.
- Render on demand, DPR capped at 1.5, no textures/GLB/network assets, no dynamic shadows or postprocessing. Dispose manually owned controls/listeners; R3F owns declarative geometry/materials.
- Backend source now uses `modules/rooms` and revision-based exhibits; old frontend architecture documents describe earlier endpoints. Day 2 must verify current public DTOs and validate responses through the existing HTTP client + Zod before passing view data to the scene. Day 1 sample objects are explicitly labelled samples, never API fallback data.
- Graphify was unavailable during initial analysis. Its tools became available later; file-neighbor/impact queries and even `list_workspaces` returned `403 no_workspace`. Graph analysis could not run; source references were traced with repository search and independently reviewed. Demo is inspiration only; no source copied.

## Four-day roadmap

1. **Day 1:** HTML/route mount, accessible shell, lightweight room, camera, lights, lazy lifecycle, fallback, browser smoke checks.
2. **Day 2 (not implemented):** agree public room/exhibit DTOs; service + Zod validation; loading/error/empty states; replace sample view data with API data.
3. **Day 3 (not implemented):** artifact assets and interactions according to agreed scope; preserve DOM equivalents.
4. **Day 4 (not implemented):** measured performance tuning, device QA and final polish.

## Implementation plan / ledger

Use `superpowers:executing-plans` inline, `test-driven-development` for behavior, and `verification-before-completion`. This document is the requested design, plan and persistent ledger. User explicitly requests immediate implementation after the architecture summary; no additional design approval round. Work in the prepared clean checkout on the task branch.

- [x] 1. Establish runnable frontend baseline and browser smoke tooling. Existing R3F/Three dependency versions remain unchanged; Playwright is development-only.
- [x] 2. Add `tour.html` build entry and `MuseumPage` route. Direct navigation, home and admin login smoke passed.
- [x] 3. Define typed sample display data and render the same titles/descriptions in DOM. No server contract invented.
- [x] 4. Lazy Canvas, explicit start/stop and scene-only fallback. Tests passed for no scene request before start, rejected chunks and unavailable WebGL.
- [x] 5. Build floor/walls, ceiling/details, sample plinths and geometry, then lighting as meaningful independent visual units. Each unit passed typecheck. Desktop/mobile screenshots inspected; ceiling panel winding corrected after visual inspection.
- [x] 6. Bounded camera controls, focused keyboard navigation, reset and zoom. Mouse, keyboard/reset, safe zoom saturation and resize checks passed.
- [x] 7. Handle context loss and reduced motion. Real WebGL context-loss extension, reduced motion, repeated mount/unmount and route exit passed. Drawing buffer capped at 1.5 on emulated DPR 3; idle draw calls stopped.
- [x] 8. Run frontend typecheck/lint/build and browser suite; review complete diff; document actual commits and results. PR publication recorded in the Git delivery section below.

### Verification focus

Test direct production HTML entry, lack of WebGL, failed lazy chunk, context loss, keyboard events outside canvas, camera bounds, mobile layout, and repeated start/stop. Browser tests exercise real R3F/WebGL where supported; simulated capability failures are explicitly identified. No claims of physical-device/VR testing.

### Baseline observations

- Initial working tree clean. Latest remote fetched before branch creation.
- PowerShell blocks `npm.ps1`; use `npm.cmd` without changing machine policy.
- Existing `node_modules` is stale after pulling dev (Mantine/router packages missing). Restore from lockfile with `npm.cmd ci` before assessing baseline gates.
- After lockfile install, baseline typecheck/lint/build passed. Existing main bundle warning: about 624 kB uncompressed.
- Vite initially reloaded the page when lazy 3D dependencies were first discovered. Trace showed a changed optimized-dependency hash; explicit `optimizeDeps.include` resolved this. This pre-bundles on the dev server, not in the browser before user action.
- Camera screenshot assertions mask the DOM toolbar/focus outlines so they compare scene output rather than hover/focus styling.

## Actual commits

Recorded below as development proceeds; final documentation commit is discoverable with `git log origin/dev..HEAD` (cannot contain its own SHA).

```text
0d63918 docs(tour): record verified architecture and Day 1 plan
45d802a feat(tour): mount museum page at HTML and SPA entries
a8a75c2 feat(tour): add typed sample catalogue with accessible content
8bb3b67 feat(tour): lazy mount demand-rendered Canvas with DOM fallback
9f42dc1 feat(tour): build limestone floor and enclosed gallery walls
b40cd24 feat(tour): add ceiling light rails and gallery detailing
5d7f436 feat(tour): render sample sculptures from shared display props
7c011db feat(tour): light gallery with warm key and soft fill
7e1ffff feat(tour): add bounded orbit controls with demand invalidation
426cd1b feat(tour): support focused keyboard navigation and view reset
b5da211 fix(tour): release lost WebGL context and focus DOM fallback
ff60789 feat(tour): respect reduced motion in camera controls
131daed fix(tour): preserve focus across scene start and stop
3a45938 fix(tour): face ceiling light panels into the gallery
879ea83 test(tour): verify idle rendering and repeated scene cleanup
fec9ba4 test(tour): allow software-rendered zoom checks to finish
```

## Results, limitations and Day 2 handoff

### Verified gates

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed. Emits both `dist/index.html` and `dist/tour.html`.
- `$env:PLAYWRIGHT_PREVIEW = '1'; npm.cmd test`: **14 passed (34.3s)** against a newly started production preview server. Covers direct HTML/SPA routes, home/admin-login regression smoke, lazy start/stop, camera mouse/keyboard/reset/zoom bounds, focus, reduced motion, context loss, unavailable WebGL, failed chunk, responsive resize, DPR cap, idle drawing, repeated lifecycle and route exit.
- First full production run: 13 passed, zoom test exceeded its 30-second total budget under software rendering. Trace showed completed clicks and successful boundary assertions; increased only that test's budget to 60 seconds, kept all assertions. Full rerun passed; final lint also passed. No product workaround was added.
- Production output at code commit `879ea83`: main 630.95 kB / 198.57 kB gzip; lazy MuseumScene 845.82 kB / 226.31 kB gzip. Vite warns about chunks above 500 kB. Scene is not requested before the start action; deeper bundle tuning belongs to Day 4.
- Browser: installed Edge/Chromium with SwiftShader. Desktop and 390 × 844 viewport screenshots inspected. These are emulation/software-renderer checks, not physical GPU/touch/VR certification.

### Independent review

Fresh-context review of `ca7a334..879ea83`: no Critical or Important findings. Reviewer confirmed controls/listener ownership and R3F teardown in the installed dependency source.

Minor deferred: Playwright permits reusing an existing server on port 4173. Stop any old server before production tests; README documents this. Final production verification uses a newly launched preview server (observed WebServer startup), not a reused dev server.

Review boundaries/rulings: main agent owns final gate evidence and PR state; physical devices/non-Chromium/screen-reader/VR behavior is not claimed; draw-call and repeated-usability checks do not prove quantitative GPU/RAM leak freedom; backend DTO compatibility is deferred to Day 2. Wrong assumptions in those areas require device QA, profiling or API integration work, not an inferred Day 1 pass.

### Limitations and Day 2 handoff

- Only Day 1 implemented. Data is explicitly sample geometry; no room/exhibit API, GLB, selection/hotspots, audio, guided tour or WebXR.
- Orbit navigation, not free walking. Fixed room dimensions; changing room geometry requires revisiting camera bounds and display positions.
- Global pre-existing AuthProvider calls `/api/auth/me`; with backend stopped this logs a connection failure, handled by the existing provider. Tour still works. No auth code changed.
- Failed lazy module imports remain cached by React; reload the page to retry a failed chunk. Context-loss fallback does not auto-remount.
- Day 2: verify current published-room/revision DTOs, use `core/api/http-client` plus Zod, then map valid data into shared DOM/scene props. Preserve loading/error/empty distinctions and never substitute samples for API failure.
- Backend/migrations untouched; no backend gates needed for this frontend-only task.

### Files changed

- Entry/tooling: `front-end/tour.html`, `front-end/vite.config.ts`, `front-end/package.json`, `front-end/package-lock.json`, `front-end/playwright.config.ts`.
- Integration: `front-end/src/app/router.tsx`, `front-end/src/pages/MuseumPage.tsx`, `front-end/src/pages/MuseumPage.module.css`, `front-end/src/components/MuseumScene.tsx`.
- Scene/DOM: `front-end/src/components/museum/{MuseumRoom,GalleryArchitecture,ExhibitionDisplay,MuseumLighting,MuseumControls,MuseumCatalogue,SceneFallback,SceneLifecycle}.tsx`, `front-end/src/components/museum/sampleDisplays.ts`, `front-end/src/interfaces/museumScene.ts`.
- Tests: `front-end/tests/museum-tour.spec.ts`, `front-end/tests/museum-lifecycle.spec.ts`.
- Documentation: `front-end/README.md`, `docs/museum-tour-progress.md`.

### Git delivery

- One task branch: `feat/museum-scene-day1`, forked from freshly fetched `origin/dev` at `ca7a334`.
- One pull request targeting `dev`; its URL is included in the delivery message after publishing.
- No merge performed, no direct push to `dev`/`main`, no force push, empty commit, timestamp change or history rewrite.
- 16 code/test/planning commits listed above, followed by the final documentation commit. Total 17 meaningful commits; no artificial split to reach 20.

## Day 2 — verified contracts and implementation plan

ACTIVE_DAY = 2. Branch: `feat/museum-api-day2`. Base: `994c896` (fresh `origin/dev`). Day 1 was restored via merge PR #26; its 17 original commits remain ancestors. Day 2 will have one PR into `dev`, without automatic merge or squash.

### Contract discovery (source is authoritative)

- `ExhibitsController` is `@Public()` and read-only. `GET /api/rooms` returns an **unpaginated array** of active, non-deleted rooms: `id` (UUID), `slug`, `name`, nullable `description`, plus entity metadata. It is not `Page<T>`.
- `GET /api/rooms/:slug` returns `{ id, slug, name, description, exhibits }`. There is no separate public exhibit-list endpoint. Select by slug, not room UUID.
- `ExhibitsService` + `ExhibitsRepository` include only visible/non-deleted exhibits with an APPROVED published revision, sorted by `displayOrder`, then `id`. Public fields: UUID `id/roomId`, integer `displayOrder`, `name/description`, finite numeric `positionX/Y/Z`, nullable `transcript`, `placeholderShape/Color`, sorted `hotspots`, and **`model/image/audio: null`**.
- The write DTO enumerates `box/sphere/cylinder/cone/torus`; color is hex. Revision content owns position, name and description. Public responses expose no rotation, scale, room dimensions or media URLs. Existing room shell and default sculpture sizes remain; do not invent missing transforms.
- Media entities store `storageKey`, kind and processing state, but the public mapper deliberately returns null even when relations exist. `main.ts` serves `/media` from `back-end/public/media`; this is not a public media DTO. No guessed URLs, GLB loader, audio or storage connection.
- `ResponseInterceptor` wraps data as `{ success, data, message, meta? }`; not-found slug is HTTP 404 through the global exception filter. Guards bypass these public routes. Existing Axios instance supplies base URL, auth/cookies, timeout and error handling.
- Frontend default: `VITE_API_BASE_URL=http://localhost:3001/api`. Reuse `http.raw` from the shared client to validate both success envelope and payload without changing the shared unwrap/auth behavior. Strip unknown entity fields at this boundary.
- Graphify `list_workspaces` again returned 403 `no_workspace`. Traced `tour.html → main.tsx → AppRouter → MuseumPage → MuseumScene` and public controller/service/repository/revision/media source using `rg` and direct reads.

### Design and invariants

Bounded integration into the existing tour flow. `museum.service.ts` validates responses using Zod before application code consumes them. `useMuseumRooms` owns React Query list/detail requests, consumes AbortSignal and caches by slug. `MuseumPage` owns URL selection (`?room=slug`), accessible status/retry/refresh, and explicit scene start/stop. `mapRoomDisplays` converts validated exhibits into shared DOM/scene data with stable IDs.

- No requests for unselected rooms, no asset preloading, no demo fallback. A room response must match the requested slug and room identity; exhibit room IDs and identifiers must be consistent/unique.
- Missing all three coordinates uses a deterministic layout ordered by displayOrder + ID. Partial/malformed coordinates fail validation. Supplied coordinates are preserved, including zero; they anchor the existing display group in metres (Y up). No clamp or guessed scale.
- Both API identity errors and request errors hide previous room content. Switching keys cancels obsolete requests and resets the Canvas/fallback boundary by room ID; late responses cannot replace current-room data.
- Missing media stays labelled “hình khối thay thế”; catalogue remains readable without WebGL. Empty room list and empty exhibits are distinct. Valid empty rooms can still open the room shell.
- Stop condition: source-compatible frontend integration, focused tests and required FE gates, progress evidence and one PR; **no Day 3 interactions/GLB/audio/WebXR, no backend/migration changes**.

### Tasks (executing-plans inline; TDD for behavior)

1. [x] **Validate/map public content.** Create `validations/roomSchema.ts`, `helpers/mapRoomDisplays.ts`; extend `interfaces/museumScene.ts` and existing display cylinder support. Tests `tests/room-contract.spec.ts`: envelope/payload validity, duplicate/cross-room identity, nullable descriptions/media, complete or absent transforms, finite values, exact supplied coordinates, deterministic layout/order and backend shapes. RED → implement → GREEN; commit independently verified schema/mapping units.
2. [x] **Fetch and select rooms.** Create `services/museum.service.ts`, `hooks/useMuseumRooms.ts`; modify `MuseumPage.tsx` and `museum/MuseumCatalogue.tsx`. Consumes validated `RoomSummary/RoomDetail`, produces `MuseumDisplay[]` props. `tests/museum-api.spec.ts` first verifies API room names/exhibits, only selected detail fetched, encoded slug, refresh/error/empty/404 and runtime validation. Use the existing Axios client; `retry: false` permits explicit retry without automatic request storms. RED → implement → GREEN; split only coherent units.
3. [ ] **Switching and lifecycle proof.** Test rapid switches with delayed responses, cancellation on switch/route exit, no stale catalogue/Canvas after invalid/failed selection, reuse of cached room requests, missing media labelling and multiple shapes. Update existing Day 1 browser tests with explicit API fixtures; keep camera/lifecycle/fallback assertions. Run production test suite after build completes.
4. [ ] **Verify and deliver.** Run FE typecheck/lint/build and all browser tests. Inspect screenshots and full diff; one fresh-context review; record commit SHAs, evidence and live blockers; push task branch and create PR with base `dev`. Do not merge automatically.

Review focus: large/out-of-shell backend positions; null media contract versus future URL payloads; cancellation transformed by the existing error interceptor; cached data after a refresh failure; changing room selection while a refresh is in progress. Required invariants take precedence over convenience.

### Initial live evidence / blockers

- Read-only probes for `/api/health` and `/api/rooms` failed to connect at localhost:3001, both inside and outside sandbox. `back-end/.env` does not exist. No live backend/database credentials were supplied; no migrations, seeds or DB writes run.
- Fixtures in tests will mirror the observed public contract and be explicitly identified as test inputs. Passing them proves frontend handling, not a live database integration.
- Media URLs are unavailable in the current public response. Preserve the null contract and label placeholders; public media exposure belongs to a separately authorized backend task.

### Day 2 execution ledger

Pre-flight: existing HTTP/auth/query-client interfaces remain unchanged; public room list is unpaginated and detail includes exhibits. Work in the prepared clean task checkout (as Day 1), without creating another worktree. The user's explicit immediate-implementation instruction supersedes additional skill approval handoffs; this requested progress document carries design/plan/ledger.

Actual task results and commits will be appended after verification. Final documentation commit cannot contain its own SHA; discover it in the branch log.

- Task 1 validation: RED missing schema → GREEN 4 contract tests; FE typecheck/lint passed. `dcb6b41 feat(tour): validate public room and exhibit responses`.
- Task 1 mapping: RED missing mapper → GREEN 7/7 contract + mapping tests; FE typecheck/lint passed. Backend cylinder is supported; box maps to cube; supplied zero/nonzero coordinates preserved, missing coordinates use deterministic sorted grid. New shape extends only scene view data; no shared HTTP/auth changes.
- Live setup: user supplied local configuration and authorized backend startup. Both `.env` files are Git-ignored. Existing BE node_modules lacked lockfile dependencies; restored with `npm.cmd ci`, without package/lock changes. No migration/seed execution. Install reports pre-existing audit findings; no dependency upgrades made in this scope.
- Task 2: RED empty API list still displayed samples → GREEN 6 browser API tests (29.1s); FE typecheck/lint passed. Service validates both envelope/payload and requested identity, hook consumes signals with keyed queries, page uses native room selection and shared DOM/scene mapping. Tests also prove switching without reload, cache reuse, no preload, 404, malformed data, empty room/list and manual retry.
- Live backend now starts successfully after lockfile restore. Read-only `/api/health` returns `{status:"ok"}` and `/api/rooms` returns `[]` inside a success envelope. No public rooms currently available; populated-room/media acceptance remains a live-content limitation, not a substituted demo success.
- `f8c2298 feat(tour): map public exhibits to stable scene displays`; `07f3f4a feat(tour): load and switch public rooms through validated API`.
- Task 3: 20/20 browser scene + switching tests passed (56.3s) against dev server. Added focused coverage for pending list/detail, real request cancellation on switch and route exit, delayed responses, failed refresh hiding cached data, removed public rooms, and encoded slugs. Existing 14 Day 1 assertions now use clearly labelled API fixtures instead of production sample data; no scene navigation/lifecycle/fallback assertions removed.
- Live browser: `$env:MUSEUM_LIVE_TEST='1'; $env:CI='1'; npm.cmd test -- museum-live.spec.ts` → 1 passed (3.4s). Uses real localhost:3001 API with no interception; frontend on localhost:5173 matches existing BE CORS. Observed empty-list state, no sample content or start button, no API alert. This does not prove populated live rooms/exhibits. Normal fixture gates explicitly skip this external-dependency test.
