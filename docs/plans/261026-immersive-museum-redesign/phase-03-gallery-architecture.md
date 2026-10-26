# Phase 03 — Gallery architecture and materials

## Goal / scope
Create a coherent architectural space with authored surface variation rather than more arbitrary decoration.

## Files
GalleryArchitecture, MuseumRoom, ExhibitionDisplay, ExhibitLabel; new local gallery surface hook/helper and `public/textures/gallery/` assets; reproducible asset-authoring script with provenance/license README.

## Steps / dependencies
- [ ] Record baseline scene metrics/screenshots before edits; retain API geometry/collider and model tests.
- [ ] Generate deterministic seamless limestone albedo/roughness/normal, plaster surface and walnut finishes locally. Document original authorship, sizes, repeats and memory. No external images or hotlinks.
- [ ] Load once per room, share maps across architecture/plinths; set sRGB only on color maps, repeat wrapping, anisotropy capped by device, mipmaps. Dispose in the committed room owner.
- [ ] Keep exact shell dimensions/floor and plinth footprints. Add recessed side bays, bronze trim, walnut ribbing and ceiling light wells inside existing decorative wall depth; no new floor obstacles.
- [ ] Redesign focal wall as contemporary museum identity (no fabricated historical emblems). Add unified stone/walnut plinth finishes and crisp label typography without changing label bounds/picking.
- [ ] Reuse instancing for repeated ribs/trim, shared textures/materials where appropriate. Keep fallback shape identity and CMS color; do not fabricate historic models.
- [ ] Typecheck/build; inspect desktop/mobile screenshots and draw/resource counts; review and commit.

## Risks / mitigation
Overly strong texture repeats or yellow palette: visual review at opening and close-up angles. GPU ownership under StrictMode: allocate/dispose from committed effect; no global unbounded cache. Surface load failure keeps flat PBR base colors.

## Acceptance / tests
Substantial visible architecture/material improvement; no placement/model/hotspot changes; authored assets local with provenance; stable texture counts across reopens and selection. Existing navigation/resource probes plus visual review.

## Commit
`feat(scene): add limestone and walnut gallery architecture` (assets and material ownership together).
