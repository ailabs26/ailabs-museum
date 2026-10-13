# Museum tour — Days 1–3 of 4

ACTIVE_DAY = 3. Branch: `feat/museum-visual-day3`. Fresh base: `929f6c8` (`origin/dev`). Historical Day 1/2 records below are retained. Day 2 was merged through PR #28 at `801ef6d`, preserving its seven original commits.

Day 1 historical record: branch `feat/museum-scene-day1`, base `ca7a334`. The following Day 1 sections record the implementation and evidence at that time.

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
2. **Day 2 (frontend implemented; populated live acceptance pending):** public room/exhibit DTOs verified; validated service, query selection and loading/error/empty handling replace production sample data.
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
3. [x] **Switching and lifecycle proof.** Test rapid switches with delayed responses, cancellation on switch/route exit, no stale catalogue/Canvas after invalid/failed selection, reuse of cached room requests, missing media labelling and multiple shapes. Update existing Day 1 browser tests with explicit API fixtures; keep camera/lifecycle/fallback assertions. Run production test suite after build completes.
4. [x] **Verify and deliver.** Run FE typecheck/lint/build and all browser tests. Inspect screenshots and full diff; one fresh-context review; record commit SHAs, evidence and live blockers; push task branch and create PR with base `dev`. Do not merge automatically.

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
- Initial final review (`994c896..922e504`): no Critical; one Important — finite backend positions can place accepted exhibits outside the opaque fixed room, silently hiding them. Ruling: preserve supplied coordinates, mark these displays for DOM reading, omit their geometry from the bounded scene, and visibly identify affected catalogue entries. Share fixed room dimensions with shell/bounds checks; no coordinate clamp, guessed room size or new camera mode. RED mapping/UI regressions → GREEN 11 mapping/API tests; FE typecheck/lint passed.
- Review Minor coverage: added delayed list + detail refresh followed by room switch, cancellation observation, late-response completion, retained chosen room and safe return; 1 focused test passed (3.7s). No runtime race identified. Visitor labels now use plain Vietnamese rather than implementation API/media terms.

### Day 2 final evidence and delivery

- **Status:** source-compatible frontend integration implemented; live empty-list integration verified. Full populated-room/exhibit live acceptance is **pending public content**, and asset integration is **blocked by null public media**. Neither limitation is concealed by sample content.
- **Data flow:** `tour.html / /tour → MuseumPage → useMuseumRooms → museumService → shared http.raw → NestJS ExhibitsController → ExhibitsService → room table / ExhibitsRepository → APPROVED publishedRevision → success envelope → Zod identity/content validation → mapRoomDisplays → MuseumCatalogue + lazy MuseumScene`. The pre-existing backend service accesses the Room repository directly; Day 2 makes no backend architecture changes.
- **Final gates:** FE `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` passed. Dedicated production preview: **36 passed (25.5s), 1 intentionally skipped** external live test. Separate final live run: **1 passed (3.4s)** with no network interceptions and real API on localhost:3001. All final code tests ran after the review fix; build completed before the preview tests started.
- **Visual proof:** desktop and 390 × 844 screenshot inspection passed for room selector, fixed gallery and catalogue; no horizontal overflow. Software Edge/SwiftShader and emulated DPR only; no physical-device/VR/screen-reader/profiling claims.
- **Build:** both HTML entries emitted. Main 690.41 kB (212.96 kB gzip), lazy scene 846.01 kB (226.41 kB gzip); Vite large-chunk warning remains. No new dependencies. Scene remains demand-rendered with DPR cap and is not requested before explicit start.
- **Review:** fresh-context whole-branch review found one Important bounds-notice gap, fixed with RED→GREEN regression proof. Follow-up review of `922e504..8997e67` found no remaining Critical/Important issues. Minor concurrent-refresh coverage and README corrections were completed. Future URL contracts, populated live data, Day 3–4 features and physical GPU evidence were explicitly outside review proof.
- **Scope:** all tracked changes are frontend/tests and task documentation. Local user-provided BE/FE `.env` files remain ignored; no credentials committed. Backend was only started/read, with no migrations, seeds, database writes, auth changes or package-lock changes.
- **Git:** [PR #28](https://github.com/ailabs26/ailabs-museum/pull/28), base `dev`, task branch `feat/museum-api-day2`. **Open, not merged** at delivery. Preserve atomic commits with **Create a merge commit** after human testing/review; no squash, rebase or force push performed. Seven coherent commits including final docs, rather than artificial splits to reach 25.

```text
077733f docs(tour): trace Day 2 public API contracts and plan
dcb6b41 feat(tour): validate public room and exhibit responses
f8c2298 feat(tour): map public exhibits to stable scene displays
07f3f4a feat(tour): load and switch public rooms through validated API
922e504 test(tour): prove API switching cancellation and scene lifecycle
8997e67 fix(tour): identify exhibits outside the bounded 3D room
<final documentation SHA in git log> docs(tour): record Day 2 verification and live limitations
```

### Remaining acceptance / Day 3 handoff

- The configured real database currently exposes **zero active public rooms**. A database/content owner must publish approved content before real populated-room selection, exhibit placement and live detail responses can be verified. No test fixtures or seed writes were inserted into that database.
- Public `model/image/audio` fields are always null in current backend source. Day 3 needs a reviewed public media contract and usable URLs before assets/interactions can consume them. Do not derive storage URLs from entity keys or call Supabase from the frontend.
- Backend room dimensions/rotation/scale are not exposed. The fixed Day 1 shell and view sizes remain. Bounds checks conservatively include current sculpture/plinth extents; changing geometry requires checking those extents alongside camera/room constraints. Deterministic fallback layout is ordered by displayOrder + ID, stable for the same exhibit set.
- No Day 3/4 implementation: no GLB, selection/hotspots, audio, guided tour, walking or WebXR. Existing scene chunk-failure/context-loss limitations from Day 1 remain; room changes reset the scene boundary.
- Read `front-end/README.md` for fixture versus live commands; stop the previous server on the configured test port. `CI=1` prevents accidentally reusing an old preview server.

### Integration after upstream revert (12 October 2026)

- User explicitly requested checking conflicts and merging PR #28 into `dev` if stable, preserving every original Day 2 commit. This supersedes the earlier no-automatic-merge instruction for this integration only.
- Updated `origin/dev` is `1ee2f41` (PR #29). Its net difference from the Day 2 base `994c896` is removal/reversion of **23 Day 1 tour frontend/documentation files**. The underlying revert `328dcf4` also reverted backend CRUD, but the newest dev backend already matches the Day 2 backend baseline. No new backend content should be reinstated here.
- Merged `origin/dev` into the existing Day 2 task branch without rewriting history. Resolved 12 conflicted paths and the cleanly deleted Day 1 dependencies by retaining exactly those 23 paths from `d60c749`. Before this integration note, both index and working tree were byte-for-byte identical to the reviewed Day 2 tree. Backend remains identical to newest `origin/dev`; no unrelated upstream change is discarded.
- Fresh gates after resolution: FE typecheck, lint and build passed; dedicated production preview **36 passed (34.8s), 1 intentionally skipped live test**. Separate live check **1 passed (3.9s)** using the existing local FE/BE servers, with no interceptions. Populated live room/media limitations remain as described above.
- Independent read-only resolution review confirmed the exact tree/index match, preserved upstream backend, no unresolved entries/conflict markers, and no Critical/Important findings. PR must use **Create a merge commit**; all seven original Day 2 SHAs and the Day 1 history are retained. Final merge SHA/status is recorded in the delivery message after GitHub confirms it.

## Day 3 — visual quality and interaction plan (13 October 2026)

**Goal:** polish the existing public tour as a warm modern gallery, with selectable exhibits, real published detail and bounded camera focus. Implement Day 3 only; stop at one PR into dev, without merging.

**Architecture:** keep the validated API/query layer intact. MuseumPage owns room-scoped selection shared by catalogue, scene and a nonmodal detail panel. MuseumControls owns navigation/transition/listener cleanup. Existing room dimensions, backend coordinates, renderer lifecycle and explicit lazy start remain invariants. No runtime dependencies are needed.

**Preparation:** clean checkout; fetched origin/dev at 929f6c8. Graphify graph_stats/list_workspaces returned 403 no_workspace; dependencies traced from current source. Reference demo README reviewed for gallery layout/interaction direction only; no source copied. Public mapper still returns model/image/audio null. No backend, auth, migration, seed or database changes authorized by this task.

**Design:** warm plaster and limestone, bronze accents, inset wall panels, coffered ceiling, restrained floor joints; round vitrines for vessel forms and square plinths for angular sculptures. Soft key/fill lighting with no shadow maps or postprocessing. Local canvas-texture labels and one cheap contact/accent patch per exhibit; no external fonts/textures/assets. A selected item has explicit DOM pressed state and visible 3D highlight. Detail uses backend name, description, transcript and hotspot text, never fabricated curatorial data. Side-by-side panel on desktop, below scene on narrow screens; catalogue remains usable without WebGL.

**Camera:** orbit remains the existing navigation mode. Focus an in-room exhibit using a safe target/viewpoint; constrain every orbit/zoom frame to the room interior. Short demand-rendered transition, instant under reduced motion; user input cancels transition. Outside-room items retain DOM details but cannot move the camera outside the shell. Escape closes detail and focus returns to its surviving trigger.

**Execution:** using writing-plans and executing-plans inline; user explicitly requests immediate implementation, so no additional design approval round. Reuse the clean local checkout on the single task branch (no secondary worktree). This requested progress file is the persistent plan/ledger. Behavioral additions follow RED → GREEN browser/pure tests. Reversible visual material/layout units use typecheck and screenshot inspection rather than tests that mirror constants.

### Atomic work / verification

- [x] 1. Record current contracts/design and prove baseline; docs commit.
- [x] 2. Refine room shell/floor materials; typecheck, scene inspection.
- [x] 3. Add architectural depth/coffers/wall panels; typecheck, scene inspection.
- [x] 4. Shape-appropriate exhibition plinths; typecheck, scene inspection.
- [x] 5. Balance sculpture PBR finishes; typecheck, scene inspection.
- [x] 6. Soft gallery key/fill/exposure; typecheck, scene inspection.
- [x] 7. Cheap local accent/contact lighting; typecheck, scene inspection.
- [x] 8. Preserve published transcript/hotspot text in display mapping; room-mapping RED/GREEN.
- [x] 9. Room-scoped catalogue selection with keyboard pressed state; interaction RED/GREEN.
- [x] 10. Nonmodal backend detail panel and focus return; interaction RED/GREEN.
- [x] 11. Scene pointer selection/hover highlight; real WebGL picking RED/GREEN.
- [x] 12. Readable billboard exhibit labels; scene visual check, texture cleanup.
- [x] 13. Safe focus viewpoint/bounds helper; literal edge/corner cases RED/GREEN.
- [x] 14. Camera focus transition and cancellation; real rendered camera RED/GREEN.
- [x] 15. Accessible explicit focus/close controls and reduced-motion handling; focused browser proof.
- [x] 16. Museum page/selector/catalogue visual polish; typecheck, screenshots.
- [x] 17. Consistent museum loading/empty/error presentation; existing API regression tests.
- [x] 18. Mobile panel/toolbar/layout touch targets; narrow/zoom browser checks.
- [x] 19. Interaction/lifecycle regression and visual evidence; complete FE gates, production tests, independent review.
- [x] 20. Final progress/README, real commit ledger and one PR into dev; no merge.

Review focus: near-wall focus positions; rapid selection while transition runs; room switches/refresh removal must hide old detail; selection/fallback without WebGL; reduced-motion changes, pointer drag versus click and cleanup during pending motion. Keep Day 1/2 cancellation and identity tests. Final FE commands: npm.cmd run typecheck, npm.cmd run lint, npm.cmd run build, npm.cmd run test:unit, CI=1 PLAYWRIGHT_PREVIEW=1 npm.cmd test. Screenshots from actual software WebGL at desktop/mobile sizes; no physical-device/FPS/GPU certification. Deep performance optimization, GLB/audio/guided-tour/WebXR and final Day 4 device QA remain outside scope.

Baseline: production build/typecheck passed; initial dev suite 50 passed, 3 live skipped, 5 failed (one first-load timeout, four stale navigation locators from upstream header/footer redesign). Updated only tour regression locators to banner and current homepage heading; all assertions retained. Initial desktop screenshot inspected: flat ceiling, uniform cylindrical plinths and no interaction/labels. Mapping RED passed four old cases and failed the new published-text case as expected.

### Day 3 execution ledger

- Baseline production rerun: 55 passed (2.1m), 3 external live tests skipped. Updated stale tour locators after upstream public-layout change; no product navigation modified. Lockfile install unchanged; no new dependency.
- Tasks 2–7: room/material/coffer/plinth/lighting/contact units each passed typecheck. Actual desktop/mobile screenshots in front-end/tmp/day3-architecture inspected; no rendering/layout errors. No shadow maps, texture downloads or additional per-exhibit dynamic lights.
- Task 8: new published transcript/hotspot mapping assertion RED (missing fields) → GREEN 5 mapping cases; null/empty details remain explicit. Coordinates/identity/order retained.
- Tasks 9–11: catalogue selection RED → GREEN; detail panel RED → GREEN 3 cases (backend text, escaped HTML, focus return, refresh failure/room switch); real scene picking/hover RED → GREEN 4 interaction cases. Nonmodal panel and DOM catalogue remain independent of renderer availability.
- Task 12: system-font plaque textures are 512×128 and explicitly disposed on replacement/unmount. Desktop/mobile screenshot inspection passed. Radius check updated to include plaque envelope without moving backend coordinates.
- Task 13: camera helper assertions RED against an unconstrained stub → GREEN 7 camera/mapping cases. Ruling: inset the orbit anchor for near-wall exhibits, not their backend positions, so the entire allowed orbit fits. This costs slight off-centre framing near walls but preserves usable navigation and the room shell.
- Task 14: real pixel camera-focus assertion RED (reset did not differ) → GREEN 17 interaction/tour tests (55.1s). 550ms demand-rendered focus, instant reduced motion, cancel on manual input; dynamic spherical distance bounds keep every orbit inside the shell. Typecheck/lint passed. Controls/listeners/transitions disposed on scene exit.
- Tasks 15–18: button/F refocus and outside-room disable RED → GREEN 6 interaction cases; catalogue/API polish 13 passed; museum loading/pending/cancellation 7 passed. Narrow layout RED identified controls overlaying the canvas; GREEN 320px test checks controls below canvas, 44px targets, panel below scene and doubled text reflow. Real touch event picking, drag without selection, normal focus settling/idle draws, manual cancellation, reduced-motion change and unmount are covered by browser tests.
- Independent whole-branch review: no Critical, two Important. Rotating plaque exceeded +z wall despite old radius check; focused detail could be offscreen after choosing a lower card. Both reproduced by assertions against production build (RED), fixed in responsible placement/focus layers (GREEN 3 cases including camera bounds). Shared billboard dimensions now define asymmetric front-wall extent; browser focus reveals panel and returning trigger. Follow-up review: no remaining Critical/Important findings.
- Dev-server limitation observed, not concealed: several 5s scene-ready assertions failed while outer Suspense still showed loading. Trace recorded MuseumScene transform 3.77s and optimized dependencies pending; a separate concurrent live dev run recorded three.js taking 17.7s. Production all-suite first run had 70 passes and one pre-existing home loading test total-timeout (main JS request 6.5s, room fixture response 11.6s) under concurrent dev testing. No app workaround or assertion/time budget weakening. Separate production suite rerun: 71 passed (2.0m), 4 external tests skipped; live compiled-build checks: 2 passed (6.6s). Playwright now honours PLAYWRIGHT_PREVIEW for live mode too, retaining localhost:5173 for existing CORS.
- Live local API: one public room `phong-lich-su-quan-su-viet-nam`, five APPROVED published development exhibits labelled `[Mẫu]` by their actual backend content. Read-only health/list/detail probes and browser checks; no interception, inserted fixtures, seed, migration, schema/auth/backend edits. BE dependency installation synchronized the latest dev lockfile after missing dev packages blocked initial compile. BE/FE manifests and locks remain unchanged; local env files and logs are ignored.
- Visual inspection of the populated live gallery found a selected plaque partially hidden by the plinth at an oblique focus angle. Selected billboard annotations need a legible rendering layer; final visual refinement and verification recorded below. Full-page screenshots are captured at document top so fixed offscreen skip links do not appear as misleading screenshot artifacts; keyboard functionality is retained.
- Final annotation refinement: billboards draw over plinth geometry with no depth writes; R3F's default event manager filter gives marked label hits the same visual priority, retaining nearest-first ordering inside each layer. Review reproduced a far-label/near-plinth mismatch; real WebGL regression RED selected the wrong ID → GREEN selected the visible label ID. Default event/listener cleanup remains unchanged; follow-up review found no Critical/Important issues.
- Auto dark-mode review: the new page ink initially had H1 contrast 1.36 on dark background (RED). Reused existing public theme variables at page root and warm-surface ink for intro/cards/panel. Actual DOM H1/intro/detail contrast case GREEN; screenshot inspected. This targeted check is not a full WCAG certification; full screen-reader/contrast audit remains device QA.

### Day 3 final evidence

- **Implemented:** consistent inset/coffer gallery, limestone/plaster/bronze finishes, shape-appropriate stepped plinths, soft key/fill/one broad accent, cheap contact patches, system-font annotations, pointer hover/selection, keyboard catalogue selection and published detail panel. Room identity/coordinates/query cancellation/cache/error semantics preserved.
- **Camera:** safe room-contained orbit/focus; 550ms eased demand transition, immediate reduced motion, manual-input cancellation, F/button refocus and Home/reset. Listeners, controls, transition references and label textures release on unmount. No walking, guided tour, GLB/audio or XR added.
- **UX:** desktop panel beside scene, mobile panel beneath it, controls outside canvas, 44px touch targets, short instructions, museum loading and accessible DOM fallback; offscreen selection/return focus reveals its target. Dark-page and warm-card text retained.
- **Required FE gates:** npm.cmd run typecheck, npm.cmd run lint, npm.cmd run build passed after final code changes. npm.cmd run test:unit: 6 passed. New production build emitted both HTML entries. Sequential dedicated production preview: **73 passed (2.4m), 4 intentionally skipped external live cases**. Separate real-API production preview: **2 passed (6.6s)**, no interceptions or DB setup. Final code commit fe3c55e; tests were run on the exact eventual committed code/test tree before staging.
- **Visual artifacts (local, ignored):** front-end/tmp/day3-final/museum-tour-gallery-resize-ff3c0-and-caps-the-drawing-buffer/gallery-desktop.png and gallery-mobile.png; museum-interaction-narrow--5b517-e-scene-and-detail-below-it/day3-mobile-detail.png; museum-interaction-touch-i-e0b72-ile-detail-remains-readable/day3-touch-detail.png; museum-interaction-desktop-4e2b1-d-long-published-text-wraps/day3-desktop-detail.png; museum-interaction-automat-b18fd-ur-and-warm-detail-surfaces/day3-dark-detail.png. Populated real-API image: front-end/tmp/day3-live-final/museum-live-live-published-f8f98--use-actual-backend-content/day3-live-gallery.png. Logs: front-end/tmp/day3-final.log and day3-live-final.log. Desktop/mobile/touch/dark/live inspected; Edge/SwiftShader and touch emulation only.
- **Build size:** main 1,322.71 kB / 383.29 kB gzip; lazy scene 851.30 kB / 228.11 kB gzip. Existing Vite large-chunk warning remains; the added scene delta is about 5.3 kB raw over Day 2. Day 3 preserves lazy start, on-demand rendering, DPR cap and no shadow maps/postprocessing; these are implementation facts, not an FPS/memory guarantee.
- **Review:** whole-branch review plus narrow follow-ups. Room plaque bounds, visible-focus return and annotation picking gaps fixed with RED/GREEN proof. No remaining Critical/Important findings at final follow-up; tests/gates confirmed by main executor.
- **Scope/invariants:** only frontend, focused tests/tooling and task docs changed. Back-end and both app dependency manifests/locks match origin/dev; ignored env files were not read into commits. No seeds/migrations/database writes, history rewrite, squash, direct dev/main pushes, or merges. All seven original Day 2 SHAs and Day 1 history remain ancestors.
- **Remaining for Day 4:** real-device/browser/GPU and screen-reader QA; full contrast audit including small badges; measured FPS/memory/bundle/load budgets and density stress with larger content sets. API media is still null, so no image/GLB/audio asset claim. Development exhibits remain visibly `[Mẫu]`; no authenticity/curation claim. Deep optimization and final platform certification were not done early.

### Day 3 files changed

Entry/API query/auth code unchanged. Changed files:
- docs/museum-tour-progress.md
- front-end/README.md
- front-end/playwright.config.ts
- front-end/src/components/MuseumScene.module.css
- front-end/src/components/MuseumScene.tsx
- front-end/src/components/museum/ExhibitDetailPanel.module.css
- front-end/src/components/museum/ExhibitDetailPanel.tsx
- front-end/src/components/museum/ExhibitLabel.tsx
- front-end/src/components/museum/ExhibitionDisplay.tsx
- front-end/src/components/museum/GalleryArchitecture.tsx
- front-end/src/components/museum/MuseumCatalogue.module.css
- front-end/src/components/museum/MuseumCatalogue.tsx
- front-end/src/components/museum/MuseumControls.tsx
- front-end/src/components/museum/MuseumLighting.tsx
- front-end/src/components/museum/MuseumLoading.module.css
- front-end/src/components/museum/MuseumLoading.tsx
- front-end/src/components/museum/MuseumRoom.tsx
- front-end/src/helpers/isDisplayOutsideRoom.ts
- front-end/src/helpers/mapRoomDisplays.ts
- front-end/src/helpers/museumCamera.ts
- front-end/src/interfaces/museumScene.ts
- front-end/src/pages/MuseumPage.module.css
- front-end/src/pages/MuseumPage.tsx
- front-end/tests/museum-camera.spec.ts
- front-end/tests/museum-interaction.spec.ts
- front-end/tests/museum-lifecycle.spec.ts
- front-end/tests/museum-live.spec.ts
- front-end/tests/museum-switching.spec.ts
- front-end/tests/museum-tour.spec.ts
- front-end/tests/room-mapping.spec.ts

### Day 3 commit ledger

```text
ef0d0ad docs(tour): plan Day 3 gallery and interaction work
23fc104 test(tour): align navigation regressions with current dev
f367dfc feat(tour): refine limestone and plaster room finishes
163020f feat(tour): add inset wall panels and ceiling coffers
15e1c59 feat(tour): match stepped exhibition plinths to sculpture forms
4f4dbe2 feat(tour): balance matte and bronze sculpture finishes
d8dde94 feat(tour): soften gallery lighting and balance exposure
5a72723 feat(tour): anchor exhibits with cheap contact and accent patches
07e7178 feat(tour): carry published detail text into shared displays
78c3925 feat(tour): select catalogue exhibits with keyboard feedback
416923a feat(tour): show published exhibit details in an accessible side panel
7ad6749 feat(tour): connect scene picking and exhibit selection feedback
820a35d feat(tour): label exhibits with lightweight local plaques
6f5562b feat(tour): derive room-safe camera focus destinations
58ed2da feat(tour): focus selected exhibits with bounded camera transitions
fc41ffc feat(tour): expose keyboard and button camera refocus controls
4f2185f style(tour): refine gallery typography and room selector layout
6a15333 style(tour): present catalogue as selectable gallery cards
c40bca8 style(tour): unify museum loading indicators with reduced motion
7f10837 fix(tour): keep touch controls and mobile details clear of the canvas
0c865ee fix(tour): include rotating exhibit plaques in room bounds
d2d5002 fix(tour): reveal selected details and returning keyboard focus
6eca7f3 test(tour): verify populated live gallery against production build
1100fb0 fix(tour): keep exhibit annotations legible and correctly selectable
fe3c55e fix(tour): preserve readable gallery text in automatic dark mode
```

The final verification/README documentation commit and PR publication record follow these 25 code/planning/test commits; their SHAs are discoverable in git log. Total stays below 30 meaningful commits. One task branch/one PR into dev; no automatic merge. Publication URL/status is recorded once GitHub confirms it.

### Day 3 Git delivery (13 October 2026)

- PR [#43 — Day 3 gallery and exhibit interaction](https://github.com/ailabs26/ailabs-museum/pull/43), base `dev`, head `feat/museum-visual-day3`. GitHub confirmed OPEN / MERGEABLE / CLEAN. **Not merged**; no push into dev/main. Human testing/review comes before any integration; use Create a merge commit when explicitly authorized.
- Documentation/evidence commit: `9f3fd39 docs(tour): record Day 3 verification and visual evidence`. The final publication-record commit contains this confirmed URL/status and is the branch HEAD in git log. **27 meaningful commits total**, within the maximum 30; all original Day 1/2 ancestors retained, without squash/rebase/force push.
- Local handoff: production preview at http://localhost:5173/tour.html (HTTP 200 confirmed) and read-only API at http://localhost:3001/api. One public room/five published `[Mẫu]` exhibits available. Preview and backend left running for manual testing; no database content created by Day 3 work.

### Day 3 pre-merge review (13 October 2026)

- User explicitly authorized review and merge of PR #43 into `dev` using a merge commit. Independent review found no Critical/Important issues; the mobile viewport height media-rule ordering remains a Minor item for Day 4 polish.
- Fresh production verification exposed two synchronization races in the desktop long-content test: cold scene readiness exceeded its 5-second wait, and canvas geometry was sampled before ResizeObserver applied the detail grid width. Only the test changed: a bounded 15-second readiness wait and condition-based layout retries preserve all original geometry/width/overflow assertions. Independent follow-up review approved this change; the targeted test passed 5 consecutive runs.
- Final gates: typecheck/lint passed after the test correction; the unchanged production code passed build and all 6 unit tests. Full production suite: **73 passed / 4 intentionally skipped live cases** (`front-end/tmp/day3-premerge-final.log`). Separate actual API tests: **2 passed**, after confirming the local preview HTML matches `dist/tour.html` (`front-end/tmp/day3-premerge-final-live.log`). No database writes or migrations.
- One test/evidence commit follows the 27 delivery commits, totaling **28 meaningful task commits**. Preserve every original commit through the PR merge; no squash, rebase, force push, or direct task push into `dev`.
