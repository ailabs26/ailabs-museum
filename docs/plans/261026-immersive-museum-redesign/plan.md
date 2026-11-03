# Immersive Museum Redesign Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task; execute inline as explicitly requested, with atomic commits. The supplied task is the design/spec authority. Do not stop after planning or request another design approval.

**Goal:** Deliver a fullscreen, accessible tour and a materially richer contemporary Vietnamese cultural gallery.

**Architecture:** MuseumPage continues to own validated CMS data and URL selection. A portal shell owns immersive lifecycle; MuseumScene remains the single lazy Canvas owner. Existing navigation, XR, model loading, normalization, picking, recovery and photo owners remain in place. Extend the room finishes with locally authored PBR textures and instanced architecture; use bounded shadows and demand rendering.

**Tech Stack:** React 18, Mantine 7, React Three Fiber 8, Three 0.170, TypeScript, Vitest, Playwright. No new runtime dependency.

**Spec:** User-provided “Immersive Fullscreen 3D + Photorealistic Museum Redesign”, sections 1–11 (2026-10-26).

## Current behavior and invariants

- Baseline: origin/dev `5eba476`, clean working tree; task branch `feat/immersive-museum` in the requested checkout. The referenced `front-end/docs/coding-conventions.md` is absent; actual conventions are `docs/architecture/fe/coding-conventions.md`.
- MuseumPage owns open state and exhibit query parameter; its viewport/stage and MuseumScene.canvasFrame constrain Canvas. Detail uses a grid column and therefore shrinks the scene.
- MuseumControls is the sole web camera controller; attachNavigationInput binds only the focused canvas, clears keys/capture on blur and unmount. XR temporarily disconnects web events and restores the camera after session end.
- Models are owned above Canvas, normalize to plinth height 1.14 m, dispose on room close; preserve errors/retry, hotspot transforms and API selection validation.
- Room shell is 14 × 16 × 5 m; API positions, footprints, label dimensions and navigation proxies must remain unchanged.
- Existing entrance starts outside the shell: correct this while retaining immediate cancellation and reduced motion.
- Unit baseline: 28 files / 160 tests pass. Capture baseline browser profile and screenshot before product changes.

## Approaches and decisions

1. Extend the constrained card: insufficient for immersive and detail-overlay requirements.
2. Portal overlay with optional native fullscreen: selected; preserves providers, selection, fallback and a single scene. Native denial does not block opening.
3. Replace scene/navigation/XR or add postprocessing framework: unnecessary lifecycle and compatibility risk.

Art direction selected by implementer from the supplied palette: pale natural limestone, lime plaster, recessed walnut display bays, restrained bronze framing, architectural ceiling light wells, warm exhibition accents, soft physical shadows. Original procedural texture assets avoid external licensing and runtime downloads. No invented historical objects: geometric substitutes remain explicitly identified.

## Global constraints

- No database, backend, migrations, API or .env changes. No push, PR creation or merge.
- One task branch from latest origin/dev; Conventional Commits; stage explicit paths only.
- Preserve CMS transforms, real GLB priority, navigation and XR. No continuous idle rendering.
- Fullscreen request must happen in the opening user gesture; denial/absence uses the same overlay.
- Escape priority: real report modal → XR session → selected exhibit → tour; native fullscreen exit always reconciles the shell. Browser-reserved Escape may exit native fullscreen directly.
- Closing restores focus/scroll, removes listeners, resets input, ends XR and retires renderer; no duplicated Canvas.

## Review focus

1. Native rejection and late resolution after closing: no reopening or orphan fullscreen.
2. Modal/XR Escape and browser-reserved fullscreen exit: no double handling or stale UI.
3. Selection, detail, room changes and fallback: preserve URL/2D access; Canvas never shrinks with detail.
4. Resize, touch, portrait/landscape and repeated close/open: controls reachable and resources bounded.
5. Textures/shadows/context restoration: dispose owned assets, bounded maps and identical recovery/XR lifecycle.

## Tasks / progress

- [x] Phase 01: fullscreen lifecycle and lifecycle regression tests.
- [x] Phase 02: immersive HUD, responsive detail overlay and accessible controls.
- [x] Phase 03: gallery architecture, original surface assets and plinth finishes.
- [x] Phase 04: lighting, PBR renderer settings and bounded shadow quality.
- [x] Phase 05: safe cinematic entrance and adaptive rendering.
- [x] Phase 06: complete focused regression suite, production gates, visual review and delivery evidence.

See the phase documents for steps, interfaces, risk handling and acceptance gates; see commit-plan.md for atomic boundaries. Update execution evidence in verification.md. Review the entire diff before final delivery.
