# Phase 05 — Camera and performance

## Goal / scope
Safe first impression and bounded rendering cost across capability levels, preserving demand/XR behavior.

## Files
CinematicIntro, cinematicIntro helper/tests, MuseumScene and renderer-quality helper/tests; existing navigation safe-point/path helpers.

## Steps / dependencies
- [x] Write failing tests for entrance positions/path inside navigation limits; short duration and reduced-motion/input cancellation. Reuse collision/path helpers, do not create another navigation controller.
- [x] Place start/end inside shell and outside CMS colliders; skip entrance when selected exhibit/unsafe route would compete with focus. End on the exact controller pose; cancel immediately on camera command, selection or gesture.
- [x] Shorten entrance to a subtle, bounded move; honor reduced motion before any animated pose.
- [x] Use low/balanced quality based on constrained hardware/coarse small viewport; DPR cap 1–1.5, bounded shadow maps and anisotropy. Downgrade on sustained slow frames only if measurements justify extra adaptive runtime state; no speculative FPS framework.
- [x] Keep demand frameloop, antialiasing and one renderer. XR uses existing renderer/session owner without added postprocessing.
- [x] Measure settled idle frames, interaction frame times, draw calls, texture counts and repeated cleanup using same fixture/browser as baseline.
- [x] Run unit/navigation/XR/performance tests, review and commit.

## Risks / mitigation
Animation and focus race: selection/commands explicitly cancel intro. Synthetic SwiftShader FPS is not hardware FPS; report environment and avoid a 60 FPS claim. Capability hints can be absent: conservative defaults.

## Acceptance / tests
No wall/plinth crossings, immediate user control, reduced motion static, idle frames stop, one live renderer, memory/resources stable after reopens. No startup scene eager loading.

## Commit
`fix(scene): keep cinematic entrance inside navigation bounds`; `perf(scene): bound immersive rendering quality` if independent from lighting implementation.
