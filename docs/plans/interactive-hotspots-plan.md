# Interactive hotspots and fault-tolerant models

**Goal:** A failed exhibit must retain its metadata, selection, hotspot and camera focus while every healthy exhibit stays mounted.
**Spec:** User attachment, “Interactive 3D Hotspots & Fault-Tolerant GLB Rendering”, 2026-10-17.
**Architecture:** Extend MuseumScene → ExhibitionDisplay → ArtifactModel and the existing room-scoped RoomModelAssets owner. No new loader, selection store, Storage client, database writes or migrations. R3F markers use normal depth testing and events; matching native buttons provide keyboard access outside the canvas. Keep demand rendering and source-resource ownership.
**Execution:** Implement inline, with tests before behavior and review before publication. User explicitly requested implementation immediately after the architecture note; no additional design approval gate.
**Base:** origin/dev 7edf335; branch feat/interactive-hotspots.

## Verified contracts

- Public room schema already validates hotspot positions, but mapRoomDisplays drops them. No coordinate-space discriminator exists. Document source-model local coordinates for GLB annotations; apply the exact normalization offset/scale, then plinth offset and exhibit placement. Non-GLB coordinates are display-local metres, Y up. Unavailable source bounds use safe computed annotation positions; never guess raw-to-normalized transforms.
- Existing API signs a fresh 120-second private Storage URL for each binary request. Frontend never receives that URL. Existing retries therefore renew authorization without adding client signed-URL caching.
- Asset requests are deduplicated per checksum, two concurrent, abort on room teardown, no global rejected cache. Extend this owner with bounded manual retry/cooldown and safe diagnostics; never reload healthy assets.
- Healthy instances share asset geometry/materials, clone hierarchy/bones. Only room owner disposes shared assets. Mesh quarantine retains detached resources in ownership until teardown.
- Supabase read-only inspection: museum-assets private; five published model mappings ready; hotspot table empty. Graphify reports no authorized workspaces; direct source tracing substitutes.

## Work and proof

- [ ] Position/metadata binding: unit tests for normalization, explicit coordinates, missing coordinates, floor/room safety and stable IDs; preserve all API hotspot fields in mapper.
- [ ] Mesh validation: unit tests for bad transforms, geometry/index/attributes/materials and valid siblings; sanitize only parsed scenes before bounds calculation; reject all-invalid scenes.
- [ ] Error lifecycle: extend owner tests for HTTP/network/parser errors, retry limits/cooldown, sync throws, late promises, shared assets and sanitized diagnostics.
- [ ] Placeholder: reusable geometry and common fallback bounds; raycast ID remains at exhibit root; show explicit unavailable/loading status.
- [ ] Artifact boundary: isolate model clone/React render errors, reset by asset attempt; preserve marker/pedestal; report render failures without disposing healthy/shared instances early.
- [ ] Hotspot UI: depth-tested R3F marker, local hover/selected feedback, real metadata tooltip, shared onSelect, drag guard; matching native keyboard buttons, no animation/render loops.
- [ ] Integration: focus uses real or fallback bounds; per-artifact retry remains accessible; metadata-only refresh must not reload GLBs.
- [ ] Browser fixtures: five valid GLBs plus 403/404/5xx/network/corrupt/malformed mesh/render error injections; verify healthy object identity, selection, request counts and restoration.
- [ ] Live scene: existing five-GLB suite plus read-only hotspot/failure/retry acceptance against backend, software WebGL desktop/mobile; no Storage mutations.
- [ ] Final: frontend unit/typecheck/lint/build + relevant browser regressions, full diff review, progress and commit ledger, one PR into dev; no merge.

## Review focus

Shared-checksum artifacts; source pivots/transforms; failed clone cleanup; invalid mesh resources retained for disposal; stale promises after unmount; drag versus click; hidden markers behind room walls; no per-frame React updates; metadata refresh without asset teardown; no signed URLs/errors in logs.

## Baseline

23/23 frontend unit tests pass on 2026-10-17. Use npm.cmd on Windows because execution policy blocks npm.ps1. Git operations need sandbox escalation because .git is read-only in the workspace profile.
