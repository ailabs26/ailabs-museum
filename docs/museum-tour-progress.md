# Museum tour — interactive hotspots and dynamic GLB delivery

## Follow-up review and merge request (2026-10-17)

After initial publication, the user explicitly requested review and merge of PR #57 into `dev`. A fresh independent read-only review found one P2 defect: a parsed skinned mesh could reference a nonexistent joint, pass sanitization, then break normalization for its otherwise healthy sibling meshes. Genuine GLB regressions reproduced the failure before the fix.

Fix `635eba6` (`fix(tour): quarantine invalid skin bindings before normalization`) validates joint/weight layouts, skeleton binding, finite inverse/bind matrices, bone/ancestor transforms and joint-index ranges before normalization. Invalid skins are quarantined under the existing resource owner. Real parsed valid-skin controls remain rendered, healthy siblings retain finite bounds, and disposal ownership is preserved. The reviewer independently reproduced both valid and invalid cases against the fix and reported no remaining confirmed blockers.

Fresh review gates: frontend **52/52 unit tests** (including seven additional skin cases), typecheck/lint/build passed; backend typecheck/lint/build and **10/10 model tests** passed. The initial PR-head browser build passed **64/64** regressions. After the skin fix, the unchanged actual-backend five-GLB test passed **1/1** in 1.6 minutes, including normalization, mesh picking, focus and emulated mobile. Logs: frontend `tmp/premerge-skin-{typecheck,lint,unit,build}.log`, `tmp/hotspot-premerge.log`, `tmp/hotspot-premerge-live-final.log`; backend `tmp/premerge-{typecheck,lint,build,models}.log`.

Two trace-recorded live attempts first timed out at 3/5 and 4/5, with incomplete jar binary transfers. A direct request through NestJS then downloaded all 22,282,920 jar bytes in 10.3 seconds with the expected SHA-256; its GLB has no skin and does not use the new validation path. The final browser run disabled trace recording, kept all assertions/timeouts unchanged, and passed with all five models and desktop/mobile screenshots. The failed attempt logs remain at `tmp/hotspot-premerge-live{,-retry}.log`; no production configuration, Storage asset or timeout was changed to obtain a pass.

This follow-up supersedes the initial no-merge instruction below. GitHub has no configured PR checks or protected-branch requirements for `dev`; local verification and independent review are the gates. Merge uses the existing PR and preserves the atomic commits. The final merge result is recorded in GitHub PR #57 and its merge commit.

## Interactive hotspots and artifact recovery (2026-10-17)

Branch `feat/interactive-hotspots` starts at freshly fetched `origin/dev` commit `7edf335`. This task extends the existing tour; the dynamic-GLB sections below remain historical implementation evidence. No database, schema, migration, Storage object, bucket policy or `.env` was changed. Publication is one pull request into `dev`, with no merge or deployment.

### Architecture and metadata

`MuseumScene → ExhibitionDisplay → ArtifactModel` remains the rendering path. `RoomModelAssets` remains the sole room-scoped loader/cache/resource owner, with two concurrent jobs and checksum deduplication. Selection still uses the existing artifact ID and page state shared by mesh picking, catalogue, details and camera focus. There is no second raycaster, loader, frontend Storage client or selection store.

`mapRoomDisplays` now preserves room identity and the API's ordered hotspot IDs, labels, bodies and positions. Each annotation creates a depth-tested native R3F marker; artifacts without annotations get a stable default derived from their own ID and current title/description. Hover changes only local marker state and creates a short canvas-texture tooltip. Selection changes its color; there is no continuous animation. Native buttons below Canvas provide Enter/Space/touch access when geometry occludes a marker. Stop-propagation and the existing sticky pointer-drag flag prevent bubbling and selection after a camera drag, including an out-and-back drag.

Read-only Supabase verification found private bucket `museum-assets`, five ready published GLB mappings in room `bo-suu-tap-glb`, and **zero authored hotspot rows**. The five real artifacts are the Đông Sơn drum, celadon pouring vessel, Bạch Đằng stake, Chăm Shiva statue and Chăm king statue listed below. Live tests therefore prove computed defaults against actual metadata; multiple configured coordinates are proven with validated API fixtures. Existing image/audio/transcript fields remain available through the current details flow; no invented category, dimensions or media fields were added. Graphify returned no authorized workspaces, so dependencies were traced directly in source.

### Coordinates and bounds

The API has coordinates but no coordinate-space discriminator. The documented authoring convention is **GLB source-model local**: apply normalization offset, uniform scale, pedestal top Y=1.14, then exhibit placement. Primitive annotations use display-local metres, Y up. Metadata refresh updates labels/details without downloading unchanged model descriptors.

Defaults sit above normalized model bounds; missing source bounds use a consistent 0.8 × 1 × 0.8 m envelope with center Y=0.5. Explicit nonfinite/out-of-room coordinates fall back to safe computed positions. Multiple defaults are spaced locally. Failed models never need their invalid geometry to place a marker or focus the camera. Markers use normal depth testing, so walls/models can occlude them; native controls preserve access. There is no per-frame projection/raycast loop or global overlap solver.

### Failure isolation and retry

- Async download, GLB validation/checksum, parse, mesh validation and normalization errors stay in the existing asset owner. State is queued/loading/ready/error, with independent checksum attempts and abort-on-room-teardown. Synchronous loader throws and late completions are contained. Healthy assets are retained during another asset's retry.
- Each ready model has an `ArtifactModelBoundary` for clone/React-render failures. Pedestal, hotspot and selection remain outside that boundary. Boundary identity includes model version and retry attempt; failure state from an old version cannot poison current focus bounds. React boundaries do not catch arbitrary async, shader, GPU or driver failures; scene-wide context loss still uses the established readable 2D fallback.
- `sanitizeModel` checks parsed object transforms, vertex/morph/index data, material values/groups and instanced transforms before bounds calculation. Invalid subtrees are quarantined while valid siblings render. Detached resources remain owned until the room owner disposes them once, including shared materials/textures. If no usable mesh remains, the whole artifact falls back. Three's valid physical-material `attenuationDistance = Infinity` sentinel is preserved. A failed GLTF parse cannot yield recoverable individual meshes; partial parser allocations are not exposed for guaranteed cleanup.
- `ArtifactFallback3D` is a lightweight ring/faceted symbol with an explicit loading or unavailable caption on the existing pedestal. It preserves artifact ID, placement, raycast selection, metadata, hotspot and focus without changing neighboring displays. It is never shown instead of a healthy ready model.
- Manual load retries are limited to three per open room: first immediately, subsequent failed attempts wait 1/2 seconds. Repeated clicks during loading are ignored; no automatic request loop exists. Render retries remount from the loaded cache without downloading. A binary retry uses the existing NestJS endpoint, which signs a fresh private Storage URL on every request. No signed URL reaches or persists in the browser.
- Diagnostics whitelist artifact/room identity, stage, category and attempt; partial mesh quarantine reports once per load. Raw errors, request configurations, credentials and signed tokens are excluded.

### Verification and review

| Gate | Evidence |
| --- | --- |
| Frontend unit/typecheck/lint/build | **45/45 unit tests passed**; typecheck, lint and production build passed; scene chunk 918.73 kB / 249.40 kB gzip, existing size warning remains |
| Backend Storage/model tests | **10/10 passed**, including expired authorization followed by fresh server signing; backend typecheck/lint/build passed |
| Live private GLB acceptance | **3/3 passed** in Edge/SwiftShader through the actual NestJS API and private Storage, with no Storage mutation |
| Five-model live behavior | All five render/normalize/pick/focus; metadata-bound controls work on desktop and emulated mobile |
| Live controlled failure | One browser-intercepted request yields four real models and one selectable placeholder; retry restores the fifth, keeps healthy object UUIDs, and requests healthy assets once / failed asset twice |
| Live reopening/resources | Two cycles release old contexts and each reports 85 geometries, 19 textures, 89 calls and 831383 triangles before the final decorative-marker reduction |
| Performance/resource closing checks | All four performance/resource cases passed; sample room measured 42 calls, 40 geometries, 58 materials, retaining limits 55/55/60; stable room switches, texture identity and demand rendering checked |
| Hotspot closing suite | **16/16 passed** in 1.7 minutes (`tmp/hotspot-ready.log`), covering 403/404/5xx/network/header corruption, actual GLTFLoader parser rejection, malformed mesh, render/clone failure, independent retry, mobile/keyboard, multiple coordinates, metadata refresh and demand/texture lifecycle |

Local ignored evidence: `front-end/tmp/hotspot-live-final.log`, `front-end/tmp/hotspot-live-final/` screenshots and JSON, `front-end/tmp/hotspot-ready.log`, `front-end/tmp/hotspot-verified/` resource profile, frontend `tmp/hotspot-final-{typecheck,lint,unit}.log`, `tmp/hotspot-budget-build.log`, and `back-end/tmp/hotspot-storage-renewal.log`. Overview, mobile, final hotspot/tooltip and failed-artifact screenshots were visually inspected. These are test outputs, not committed production assets.

Independent review found two P2 issues: unchecked instance matrices and out-and-back drags selecting a hotspot. Both were reproduced with failing regressions and corrected. The closing browser gate also detected 63 materials against the existing 60-material sample-room budget. Removing each marker's decorative second mesh/material preserves its spherical marker, hover tooltip and selected feedback while saving one draw call and one material per annotation. The original resource budget is retained.

The wide regression run initially passed 63/64, with only that material-budget failure. Closing runs exposed test synchronization issues: a projected click used the old panel-width camera/Canvas bounds, and initial model/retry readiness used a 5-second default while lazy scene startup sometimes exceeded it. The tests now wait for panel removal, stable layout and matching camera aspect, and use the existing 15-second asset-readiness convention. Actual mouse picking subsequently passed three consecutive runs (`tmp/hotspot-picking-final.log`). These test harness corrections do not relax interaction, cooldown, failure-isolation or resource assertions.

### Changed files and commit ledger

Production changes are confined to `front-end/src/components/MuseumScene{.tsx,.module.css}`, museum components `ArtifactCaption`, `ArtifactFallback3D`, `ArtifactHotspot`, `ArtifactHotspotControls`, `ArtifactModelBoundary`, `ExhibitionDisplay`, `ModelLoadingStatus`, helpers `artifactHotspots`, `loadMuseumModel`, `mapRoomDisplays`, `modelDiagnostics`, `roomModelAssets`, `sanitizeModel`, hook `useRoomModels`, interface `museumScene`, and `MuseumPage.module.css`. Tests cover these helpers plus `tests/fixtures/museumGlb.ts`, `museum-hotspots.spec.ts`, `museum-hotspots-live.spec.ts` and the existing backend `public-models.spec.ts`. Documentation is this report, `front-end/README.md` and `docs/plans/interactive-hotspots-plan.md`. No dependency was added.

| Commit | Completed unit |
| --- | --- |
| `a3de1a8` | docs(tour): trace hotspot and failure ownership |
| `1bf1461` | feat(tour): bind hotspot positions to normalized artifact bounds |
| `add78f3` | feat(tour): quarantine invalid parsed meshes before normalization |
| `abedefb` | feat(tour): classify asset failures without logging credentials |
| `5761778` | fix(tour): contain loader throws and bound per-asset retries |
| `e6c090f` | fix(tour): sanitize parsed assets and retain quarantined resources |
| `a1f7612` | feat(tour): add interactive three-dimensional model fallback |
| `c475942` | feat(tour): add depth-tested hotspots and keyboard controls |
| `a4e9dc8` | feat(tour): isolate model rendering and preserve hotspot selection |
| `df6b9e1` | feat(tour): report sanitized failures with room and artifact identity |
| `14d4322` | fix(tour): keep hotspot and retry controls visible on small screens |
| `c7818eb` | test(tour): prove healthy models survive asset and render failures |
| `99c4c95` | fix(tour): preserve valid physical-material attenuation defaults |
| `4e8808d` | fix(tour): scope render failure focus bounds to model version |
| `3b7ae8b` | fix(tour): quarantine malformed GPU instance transforms |
| `03188ce` | feat(tour): report partial mesh failures without hiding valid models |
| `e04e02a` | docs(tour): document hotspot coordinates and artifact recovery |
| `b547931` | test(tour): verify fresh Storage signing after expired authorization |
| `1fb2318` | test(tour): verify live private GLB failure and isolated recovery |
| `6a2fdd8` | perf(tour): keep hotspot markers within existing resource budgets |
| `5cadb7b` | fix(tour): reject returning drags and verify hotspot recovery |
| `96530db` | docs(tour): record hotspot architecture and acceptance evidence |

Publication: [PR #57](https://github.com/ailabs26/ailabs-museum/pull/57), `feat/interactive-hotspots` → `dev`, opened after verification and left for human review. No merge was performed. Commit count follows meaningful completed units; no empty commits or artificial splitting to reach the suggested 30. This publication record and the completed checklist are included in the same PR.

### Remaining limits

No physical GPU/phone/VR or screen-reader certification; browser tests use Edge/SwiftShader and mobile emulation. Explicit authored markers can overlap or be occluded. No claim of recovery from unsuccessful GLB parsing or absolute JS/GPU leak freedom. Existing large scene chunk warning, model transfer size, unverified curatorial metadata/licenses/dimensions and pre-existing database RLS concern in the historical report remain. No database/security-policy change, migration, external deployment or merge was performed.

## Current GLB implementation (2026-10-15–16)

Branch `feat/dynamic-glb-tour` started from fresh `origin/dev` commit `9c14548` after fetch. One PR targets `dev`; no merge, force push, migration or policy change. Earlier Day 1–4 sections below are historical and their null-model statements no longer describe the current tour.

### Data and asset pipeline

`GET /api/rooms/:slug` → approved published revision and ready/undeleted model media → stable NestJS model descriptor → Zod (including room/exhibit/checksum binding) → room display mapping → explicitly opened lazy R3F scene → room-owned two-slot load queue → binary HTTP client → GLB header/self-contained-resource validation + SHA-256 → GLTFLoader → world-bounds normalization → nested-mesh picking → shared selection/details → bounds-based camera focus.

`GET /api/rooms/:slug/exhibits/:id/model?version=<sha256>` rechecks publication on every request. The backend alone uses the configured server key to sign the private object for 120 seconds and stream it with backpressure, size checks, a 90-second upstream deadline and disconnect cancellation. StreamableFile bypasses the JSON success envelope; controlled errors retain the normal envelope. Redirects/unexpected signed paths are refused, upstream error bodies are redacted, and neither credentials nor signed URLs reach the frontend. A retry signs again, so expiring URLs are not stored as model identities. The binary endpoint uses `private, no-store`; loaded GLBs are cached only inside the open room.

Actual project `ailabs-museum` (`bnghfbntegbziyljzazu`), bucket `museum-assets`, **private**. All five GLB 2 files were downloaded completely and hashed. All images/buffers are embedded; no Draco, Meshopt or KTX2 is required. The stake uses `KHR_materials_specular`, supported by the installed GLTFLoader. Keep original PBR materials and textures. Supabase changelog/access-control documentation checked; the announced November 10 CBC TLS cipher retirement needs no legacy cipher workaround in the current Node runtime.

### Verified artifact mapping

All artifacts below belong to room `bo-suu-tap-glb` (`74b719c0-4828-49d1-bb7b-000000000000`). Media is ready and published revisions approved. Paths are relative to `museum-assets`; full SHA-256 values and media/revision IDs are in `back-end/src/database/seeds/storage-model-content.ts`.

| Artifact ID | Name from supplied file | Storage path | Bytes | Actual browser load / normalize / pick / focus |
| --- | --- | --- | ---: | --- |
| `74b719c0-4828-49d1-bb7b-000000200001` | Trống đồng Đông Sơn | `models/trong_dong_dong_son.glb` | 16529444 | PASS |
| `74b719c0-4828-49d1-bb7b-000000200002` | Bình rót men ngọc | `models/binh_rot_men_ngoc.glb` | 22282920 | PASS |
| `74b719c0-4828-49d1-bb7b-000000200003` | Cọc gỗ Bạch Đằng | `models/coc_go_bach_dang.glb` | 3562172 | PASS |
| `74b719c0-4828-49d1-bb7b-000000200004` | Tượng thần Shiva Chăm Pa | `models/tuong_than_shiva_champa.glb` | 28901752 | PASS |
| `74b719c0-4828-49d1-bb7b-000000200005` | Tượng vua Chăm Pa | `models/tuong_vua_champa.glb` | 18291744 | PASS |

The additive transaction seed created a dedicated room + five media + five exhibit/revision pairs; original five sample exhibits remain. A second real run returned `{ created: 0, skipped: 5 }`. Concurrent seeds serialize through an advisory lock; collisions roll back; later edits, hidden/deleted state and publication pointers are preserved. Two task-owned statue placements were moved from X ±2.5 to ±4.3 after inspecting the first overview, with exact ID/media/original-position predicates; no other content was updated. Names are derived from filenames, with explicit unverified historical information in the descriptions. This is a verified technical model mapping, not a curatorial authentication or licensing claim.

### Normalization and layout

Update the complete source world transform hierarchy, then use precise Box3 geometry bounds. Reject empty/nonfinite/zero/unsafe bounds. For dimensions `(w,h,d)`, auto scale uniformly by `min(1.8/(w||1), 2.2/(h||1), 1.8/(d||1))`, within `1e-6..1e6`; a zero extent uses a unit denominator to avoid division by zero. The pure normalizer supports a verified uniform display scale; none of these assets has verified real-size metadata, so all five use auto-fit. Their heights remain proportional to their aspect ratios; no nonuniform geometry deformation occurs.

Hierarchy: exhibit placement → plinth-top wrapper at Y=1.14 → uniform scale → offset `(-centerX,-minY,-centerZ)` → original cloned GLB hierarchy. Original geometry/materials are shared. This centers X/Z and grounds the lowest vertex on the plinth. Focus center is the normalized center transformed by exhibit placement; radius is half the normalized bounding diagonal. API positions are preserved; missing positions use a deterministic grid with 3.6 m spacing for models, derived from the 1.8 m model envelope and 3 m pedestal footprint. Displays outside room capacity remain explicitly accessible in the DOM instead of overlapping or being silently moved.

### Interaction and camera

R3F mesh events bubble to the exhibit root ID through all GLB child meshes. Hover/selection changes the lightweight pedestal ring/plaque, leaving PBR materials untouched. Plaque priority, drag rejection, touch, keyboard catalogue/details and context-loss fallback remain. A background click clears selection; background drags do not. Missing/loading/error markers are never counted as loaded GLBs. DOM progress reports successful models and exposes per-model retry.

Keep OrbitControls, mouse/touch/keyboard bindings, reduced-motion support, bounded zoom/polar angles and demand rendering. Focus derives distance from normalized radius, FOV and viewport aspect, uses a room-facing direction and a 550 ms smooth transition. User input cancels it. Manual navigation/reset also revokes deferred auto-focus for the current selection, so completing a download does not take control back; another selection or explicit focus permits focus again. Wall-crossing orbit steps restore the last valid camera position, avoiding a fight between wall clamping and minimum zoom radius. Camera animation only invalidates while moving; subscriptions and controls are disposed.

### Ownership and performance

- No GLB downloads before opening 3D, and no downloads of other rooms. Two concurrent fetch/parse jobs, deduplicated by checksum; refreshing identical descriptors or selecting another model does not reload the assets.
- Hierarchies/bones are cloned for instances; shared geometry/material/texture resources have a single room owner. Instance skeletons release their own GPU textures. Late parse success after cancellation is disposed immediately; teardown aborts work and disposes room resources after primitives detach. Late progress cannot replace ready state and lose disposal ownership.
- Keep DPR 1–1.5, one WebGL context, static lights/contact patches, no shadow maps or postprocessing. Entire original textures are retained; aggregate GLB transfer is 89,568,032 bytes (~85.4 MiB), so this is not a low-bandwidth asset set.

### Verification, review and limitations

- Baseline before implementation: frontend 13 unit tests and backend 485 exhibit tests passed. Required typecheck/lint/build passed for both applications during implementation. Current frontend unit suite: **23 passed**. Backend: **471 general tests**, **492 exhibit tests**, **9 Storage/seed tests** passed (Storage tests overlap with the exhibit count).
- Actual signed backend streaming verified, then live browser acceptance loaded exactly five successful GLB requests, inspected all five normalized world bounds, selected each via scene coordinates and focused each correctly; repeated selection made no further model requests. Screenshots of overview and all five focused assets inspected. Final expanded mobile/full-bounds/resource-cycle gate is recorded below after it completes.
- Review independently found two Important camera issues (wall/render loop and deferred focus overriding manual intent). Both reproduced and fixed with installed-OrbitControls and delayed real-GLB browser regressions. The reviewer found no public binary authorization bypass or shared-resource ownership defect. No Critical findings or deferred Minor findings.
- First broad browser run: 105 passed, eight live tests skipped, one 5-second scene readiness timeout. Trace showed the local lazy scene chunk alone taking 3.5 seconds; the readiness gate now uses the existing project's 15-second convention. Delayed drag comparison initially used exact coordinates; real OrbitControls retains ~4 mm sub-EPS inertia after idle. The test now waits for idle and allows 1 cm, while the original refocus bug moved ~2 m and still fails that gate.
- Existing public database tables have RLS disabled; Storage bucket/object RLS is enabled with no public policies found. This pre-existing security risk is not remediated here. Database owner must review grants/Data API exposure and RLS separately before production. No schema, RLS or bucket visibility changes were made.
- No physical phone/GPU/VR QA, no claim of absolute JS heap leak freedom, and no model re-authoring/compression/texture downsampling. Unsupported compression/external glTF resources and unsafe model sizes fail per artifact. Artifacts with no verified real dimensions use display normalization. Physical room capacity is finite. The custom NestJS JWT/RBAC flow is unchanged.

### Run and inspect

Configure backend `.env` server Storage values as described in `back-end/README.md`; run `npm.cmd run seed:models` only when setting up the supplied verified assets. Start backend with `npm.cmd run dev` (or build + `start:prod`) and frontend with `npm.cmd run dev`. Open `http://localhost:5173/tour.html?room=bo-suu-tap-glb`, click **Mở phòng 3D**, wait for **Đã tải 5/5 mô hình 3D**, then select/focus/reset or use the accessible catalogue.

For actual-backend acceptance from `front-end/`: set `MUSEUM_LIVE_TEST=1`, `PLAYWRIGHT_PREVIEW=1`, then `npm.cmd test -- museum-glb-live.spec.ts --output=tmp/glb-live-final`. Screenshots/profile JSON are ignored local evidence, not committed binaries or signed URLs.

### Final gate results (2026-10-16)

| Gate | Result |
| --- | --- |
| Frontend typecheck / lint / production build | PASS; existing Vite >500 kB chunk warning remains |
| Frontend Vitest | 23 passed |
| Full production browser regression | 108 passed, 8 explicitly opt-in live tests skipped; `tmp/glb-full-final.log` |
| Actual Supabase five-model + mobile/touch/full-bounds + two resource cycles | 2 passed (1.3m), no API/model interceptions; `tmp/glb-live-final/` |
| Dev / React StrictMode cancellation + delayed real-GLB drag/reset | 3 passed (14.3s); `tmp/glb-strict-verified/` |
| Backend typecheck / lint / production build | PASS |
| Backend general / exhibit / focused Storage+seed suites | 471 / 492 / 9 passed; overlapping focused tests are not added to the exhibit total |
| Seed idempotence on real DB | created 0, skipped 5 on second run |
| Source/independent review | 2 Important camera findings fixed; no outstanding Critical/Important findings identified |

Cold dev initially reached the queue assertion before Vite finished opening the scene (zero requests rather than two); the test now awaits scene readiness before measuring the loading queue. The rerun passed all three StrictMode checks. No product change or hidden retry was used to mask that test precondition.

Edge 155 / SwiftShader, desktop 1280×720, actual supplied assets: click-to-all-five-ready **17,731 ms** in this single run. Exactly **five** successful model downloads; no extra requests from five selections. Settled overview: **79 draw calls, 829,343 submitted triangles, 75 uploaded geometries, 19 uploaded textures, 55 materials, 146 scene objects**. Two complete mount/stop cycles both reported **75 geometries / 19 textures / 79 calls / 829,343 triangles**; one live context while open and zero after each stop. Demand frames stopped when idle. Independent vertex traversal confirmed all five lowest vertices at Y≈1.14, centered X/Z at published positions; every selected world-bound box fit the viewport with margin, including mobile, and actual touch picked the statue.

Scripted keyboard-input frame cadence was **2.48 frames/s** on SwiftShader. This includes browser automation pacing and software rendering, is not a hardware GPU benchmark, and does not establish smooth performance on phones or physical GPUs. The original high-resolution assets remain heavy; GPU/device profiling and asset optimization may be needed for low-end devices. We did not measure physical GPU RAM or establish absolute JS heap leak freedom. Resource counts prove bounded uploads for the tested cycles only.

Final main JS **831.88 kB** minified / **254.62 kB** gzip; lazy scene **909.29 kB** / **246.23 kB** gzip. GLTFLoader stays out of initial startup; no new runtime dependency was installed. Overview, all five focused screenshots and full mobile screenshot were visually inspected. Shader/model appearance and labels remain intact; camera orbit can change the default room-facing focus angle.

### Changed files

```text
back-end/.env.example
back-end/README.md
back-end/package.json
back-end/src/common/interceptors/response.interceptor.ts
back-end/src/database/seeds/seed-storage-models.spec.ts
back-end/src/database/seeds/seed-storage-models.ts
back-end/src/database/seeds/storage-model-content.ts
back-end/src/modules/exhibits/controllers/exhibits.controller.ts
back-end/src/modules/exhibits/exhibits.module.ts
back-end/src/modules/exhibits/services/exhibits.service.ts
back-end/src/modules/exhibits/services/public-models.service.ts
back-end/src/modules/exhibits/tests/public-models.spec.ts
back-end/src/modules/media/dto/public-model.dto.ts
back-end/src/modules/media/services/model-storage.service.ts
docs/museum-tour-progress.md
docs/plans/dynamic-glb-tour-plan.md
front-end/README.md
front-end/src/components/MuseumScene.tsx
front-end/src/components/museum/ArtifactModel.tsx
front-end/src/components/museum/ExhibitDetailPanel.tsx
front-end/src/components/museum/ExhibitionDisplay.tsx
front-end/src/components/museum/ModelLoadingStatus.tsx
front-end/src/components/museum/MuseumCatalogue.tsx
front-end/src/components/museum/MuseumControls.tsx
front-end/src/helpers/glbAsset.test.ts
front-end/src/helpers/glbAsset.ts
front-end/src/helpers/isDisplayOutsideRoom.ts
front-end/src/helpers/loadMuseumModel.ts
front-end/src/helpers/mapRoomDisplays.ts
front-end/src/helpers/modelCamera.test.ts
front-end/src/helpers/modelNormalization.test.ts
front-end/src/helpers/modelNormalization.ts
front-end/src/helpers/museumCamera.ts
front-end/src/helpers/roomModelAssets.test.ts
front-end/src/helpers/roomModelAssets.ts
front-end/src/hooks/useRoomModels.ts
front-end/src/interfaces/museumScene.ts
front-end/src/pages/MuseumPage.tsx
front-end/src/services/museum.service.ts
front-end/src/validations/roomSchema.ts
front-end/tests/fixtures/museumProbe.ts
front-end/tests/museum-glb-live.spec.ts
front-end/tests/museum-glb.spec.ts
front-end/tests/museum-tour.spec.ts
front-end/tests/room-contract.spec.ts
front-end/vitest.config.ts
```

### GLB commit ledger

| SHA | Message |
| --- | --- |
| `3c16612` | docs(tour): analyze storage and plan dynamic GLB pipeline |
| `3f1d429` | feat(tour): serve published GLBs through private Storage authorization |
| `5ee3b7d` | feat(tour): validate GLBs and normalize nested model bounds |
| `0c24aad` | feat(tour): queue and cache GLBs for the active room lifecycle |
| `4ccd399` | feat(tour): render GLBs with artifact picking and bounds-based camera focus |
| `a7294c2` | feat(tour): seed verified Storage models into a dedicated gallery |
| `331023b` | fix(tour): harden model contracts and preserve loading ownership |
| `45b4379` | fix(tour): preserve camera intent and settle wall-constrained orbits |
| `ce75224` | test(tour): verify five private GLBs and live resource lifecycle |

Final verification/runbook and publication commits follow this table; obtain the complete current ledger with `git log --reverse --oneline 9c14548..HEAD` or the PR commits tab. Fewer than the aspirational 50 commits is intentional: no empty commits or artificial splitting.

Verification/runbook commit: `e6ecb97` — `docs(tour): record verified GLB delivery and operational runbook`. Publication: [PR #55](https://github.com/ailabs26/ailabs-museum/pull/55), **open into dev**, base confirmed `9c14548`, not merged. [Complete commit history](https://github.com/ailabs26/ailabs-museum/pull/55/commits) includes this final publication record. AGENTS.md requires human review of Storage authorization/database mapping before merge. Backend and frontend were left running locally for the demo; no external deployment was performed.

---

# Historical four-day delivery

ACTIVE_DAY = 4. Current branch: `feat/museum-performance-day4`; base `777b583` from origin/dev. Day 3 PR #43 was subsequently merged at `cf32dd4`. Day 4 stops at one PR into dev, without merge or history rewriting. Earlier sections below are historical records, including their then-current statuses.

## Day 4 final architecture and implementation

`tour.html` and `/tour` mount the same SPA → MuseumPage → useMuseumRooms → museumService → shared HTTP client → Zod validation → display mapping. The selected room feeds both accessible DOM catalogue/detail and explicitly started, lazy MuseumScene (R3F/Three). NestJS owns database access; frontend never connects directly to storage or PostgreSQL.

Day 1 established the room/camera/lights/HTML entry/fallback. Day 2 replaced sample content with validated published room/exhibit data. Day 3 added gallery finishes, picking, linked detail panel, camera focus and responsive accessible controls. Day 4 preserves those behaviors while reducing resource and startup costs:

- Batch repeated gallery geometry with component-owned InstancedMesh; R3F disposes declarative geometry/materials, Three releases instance buffers. No global GPU cache.
- Allocate plaque CanvasTexture in a committed layout effect, redraw/invalidate on selection instead of replacing textures, and dispose on unmount. Binary-search title fitting bounds long-title measurement while preserving Unicode and ellipsis width.
- Defer the existing admin chart library until a chart renders; fixed-height skeleton and local error fallback preserve dashboard usability.
- Preserve explicitly public queries when anonymous session recovery fails, preventing duplicate room requests. Private requests are cancelled/removed; ending an existing session still clears all queries and mutations. **Human auth review required before merge.**
- Correct mobile CSS rule order so 320×568 retains a 440px gallery viewport.
- Reuse existing lazy scene start, demand rendering, DPR cap 1.5, bounded camera controls, no shadow maps/postprocessing, AbortSignal cancellation and query staleTime 30s/gcTime 5min. No speculative memo/cache/loader subsystem.

Actual read endpoints: `GET /api/rooms`, `GET /api/rooms/:slug` (includes exhibits), and `GET /api/health`. There is no separate public artifact fetch for this tour. Public `model/image/audio` remain null, so the UI explicitly presents geometric placeholders. There are no external model/texture downloads to progressively load or deduplicate; missing-media DOM feedback remains available.

## Day 4 measurements

Same production fixture, 1280×720, Edge 155.0.4283.45 with SwiftShader. Baseline `777b583`; final production source `9d705af`. Counts are from the same settled initial view; resource uploads depend on visibility.

| Measurement | Baseline | Final |
| --- | ---: | ---: |
| Draw calls | 77 | 39 |
| Uploaded geometries | 75 | 37 |
| Materials / scene objects | 95 / 119 | 53 / 66 |
| Uploaded textures | 3 | 3 |
| Submitted triangles | 4624 | 4672 |
| Initial public room requests | 4 | 2 |
| Main JS, minified kB | 1378.74 | 826.97 |
| Main JS, gzip kB | 400.24 | 252.91 |
| Lazy scene, minified kB | 851.31 | 851.97 |
| Observed click-to-canvas ms | 819 | 341 |
| Observed interaction FPS | 32.72 | 37.50 |
| Heap before / mounted bytes | 5705204 / 9931932 | 5080212 / 8751664 |

The new deferred chart chunk is 543.94 kB (143.80 kB gzip). Group culling explains slightly more submitted triangles despite fewer draw calls. Timing/FPS/heap are single observations, not benchmark guarantees: an earlier optimized run measured 300ms and 25.94 FPS under different machine load. No physical GPU RAM measurements or device performance claims.

Released JS heap over four cycles: baseline 9621644, 10029964, 10336784, 10557204 bytes; final 9005900, 9470816, 9738160, 9957728 bytes. These increase, so they do **not** establish JS heap leak freedom. Each stop released the live WebGL context; seven alternating room selections retained stable per-room resource counts, one live context while open and zero after close. Idle frames stopped; interaction resumed rendering; selection retained plaque texture identity. No known GPU resource leak was found in this scope.

Local ignored evidence: `front-end/tmp/day4-baseline-red/` and `day4-full-production/` contain profile JSON and scene screenshots. Final mobile/detail, desktop and live screenshots were inspected; geometry appearance, typography and DOM detail layout remain intact. Evidence is local, not committed binary artifacts.

## Day 4 verification and limitations

- Required frontend typecheck, lint and production build passed; unit tests **13 passed**. Vite still warns about chunks over 500 kB.
- Full production browser suite: **84 passed, 4 intentionally skipped live tests** (4.0m). Covers startup, charts and failure fallback, API contracts/races/refresh/cancellation, camera, selection, fonts, mobile/touch, missing media, context loss, resource budgets and lifecycle.
- Separate actual-backend museum suite: **2 passed (6.6s)**, no API interceptions, seeds, migrations or database writes. API returned two public rooms; populated first-room interaction was verified. Repeated two-room stress uses deterministic fixtures, not a claim of repeated live switching.
- Regression RED/GREEN: short mobile viewport, selection texture replacement, long-title fitting, resource budget, duplicate anonymous-bootstrap requests and initial bundle size. Two initial dashboard tests had incorrect label selectors; corrected selectors passed.
- Earlier broad dev runs hit 15s canvas readiness limits while Vite transformed modules (individual requests took 7–9s); corresponding production tests passed. Initial sandbox live/dev runners stalled after workers exited and were terminated. Outside-sandbox reruns passed: live **2/2**, focused dev/StrictMode **2/2 (50.2s)** with the existing 15s readiness assertions, covering idle rendering, four mount/stop cycles and stable selection textures. Evidence: `tmp/day4-live-verified/`, `tmp/day4-strict-verified/`.
- Independent whole-branch source/dependency review through `9d705af`: no Critical/Important issues. Minor remaining coverage gap: helper tests cover full logout cache removal, but no provider integration assertion specifically verifies authenticated-to-logout public-cache removal. Human auth review remains required.
- Graphify returned 403 no_workspace for both ranking and workspace discovery; source and installed-dependency tracing substituted. No physical phone/GPU/VR QA, GLB/audio/WebXR features or production asset-service validation. Backend source/config/dependencies and ignored credentials are unchanged.

## Four-day commit summary and Day 4 ledger

Day 1: 17 original commits (restored through PR #26). Day 2: seven original task commits (PR #28, integration history preserved). Day 3: 28 task commits including premerge verification fix (PR #43). All original histories remain ancestors; no squash, rebase or force push.

| Day 4 SHA | Message |
| --- | --- |
| `89c5d6c` | docs(tour): plan measured Day 4 optimization |
| `188d01d` | fix(tour): preserve gallery height on short mobile screens |
| `d50e910` | perf(tour): reuse effect-owned plaque textures with lifecycle probes |
| `510afe2` | perf(tour): bound long plaque title measurement work |
| `858a54f` | perf(tour): instance repeated gallery geometry and finishes |
| `e27b7ec` | fix(tour): preserve public queries during anonymous session recovery |
| `9d705af` | perf(tour): defer admin chart engine until a chart is rendered |
| `bb6c93f` | docs(tour): record Day 4 measurements and final verification |

Final evidence/publication commits follow this ledger; retrieve their SHAs with `git log --oneline 777b583..HEAD`. Fewer than the aspirational 20 commits are intentional: no padding or invented optimization to reach a count; maximum 30 respected.

Publication: [PR #52](https://github.com/ailabs26/ailabs-museum/pull/52), base `dev`, head `feat/museum-performance-day4`. **Open, not merged** at delivery. Eight implementation/evidence commits plus this publication record total **nine meaningful Day 4 commits**. Human review/testing precedes any merge; preserve original commits when integration is later authorized.

## Run and demo

Use existing ignored local env files. In `back-end/`, `npm.cmd run dev` starts port 3001; do not seed/migrate. In `front-end/`, `npm.cmd run dev` starts port 5173. Open `http://localhost:5173/tour.html`, select a published room, open 3D, drag/zoom or use keyboard, select an exhibit, inspect its details, switch rooms and stop 3D. DOM content stays usable before starting or after renderer failure.

Reproduction commands and environment separation are in the frontend README. Run production and live browser suites sequentially with fresh servers; profile JSON is emitted by `museum-performance.spec.ts`. Source artifacts/test tools are committed; ignored screenshots/logs must be regenerated on other machines.

---

## Historical Days 1–3 record

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
