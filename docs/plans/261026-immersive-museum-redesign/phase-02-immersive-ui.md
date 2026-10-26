# Phase 02 — Immersive UI

## Goal / scope
Keep the gallery dominant and every action available through keyboard/touch.

## Files
MuseumPage/CSS, MuseumScene/CSS, ImmersiveTour/CSS, NavigationHud/CSS, SpatialMinimap/CSS, ArtifactDock/CSS; reuse ExhibitDetailPanel, MuseumCatalogue, ModelLoadingStatus and ArtifactHotspotControls.

## Steps / dependencies
- [ ] After phase 01, assert selection does not change Canvas bounds and title/exit/dock are reachable at desktop, 390 × 844 portrait and 844 × 390 landscape.
- [ ] Header: room name left, exit right, room selector within the shell. Full-size Canvas is absolute; detail overlay is independently scrollable on the right (bottom sheet on narrow portrait).
- [ ] Replace enlarged colored dock icons with restrained numbered/name navigation; no layout-changing hover. Keep valid API order and selection state.
- [ ] Compact reset/focus/photo/VR actions; group secondary zoom actions and accessible catalogue/hotspots in collapsible UI. Keep retry messages visible when necessary.
- [ ] Move minimap/help away from header and bottom dock; no pulsing animation or oversized help by default. Preserve keyboard alternatives to all spatial actions.
- [ ] Run relevant interaction/navigation/hotspot tests and typecheck; review and commit.

## Risks / mitigation
Overflowing long CMS titles/dense lists scroll within their controls. Touch controls must not collide with drawer/dock; use separate responsive zones and safe-area insets. Expose room switching inside the overlay because the background is inert.

## Acceptance / tests
Canvas bounds identical before/after selection. At least 44 px DOM touch controls, visible focus, no horizontal page overflow, panel scroll does not move background, keyboard reaches exit and catalogue. Keep named accessible controls for regression tests.

## Commit
`feat(tour): redesign immersive gallery HUD` with matching browser tests.
