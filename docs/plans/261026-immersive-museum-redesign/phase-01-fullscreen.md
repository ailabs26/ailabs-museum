# Phase 01 — Fullscreen lifecycle

## Goal / scope
Own the immersive presentation independently of the page card without changing CMS selection ownership.

## Files / interfaces
- Create `hooks/useImmersiveTour.ts`: expose `{ isOpen, containerRef, open, close }`; open synchronously mounts the portal before requesting native fullscreen.
- Create `components/museum/ImmersiveTour.tsx` and CSS: portal dialog, focus containment, background inertness, scroll lock, accessible exit and Escape dispatch.
- Modify MuseumPage, and MuseumScene only for XR Escape/status coordination; optional portal target in PublicReportModal keeps a true modal inside the native fullscreen subtree.
- Create `tests/museum-fullscreen.spec.ts` with browser capability shims for deterministic rejection/change/races plus a real browser API check.

## Steps / dependencies
- [x] Write regression assertions first: viewport-filling bounds; Escape exit; focused opener/scroll restoration; three reopens with one live renderer; native rejection and external native exit; selection closes before overlay in fallback mode.
- [x] Run tests and observe expected baseline failure (missing immersive shell).
- [x] Implement open via React flushSync + requestFullscreen; handle missing method, synchronous throw and rejected/late promises. Only exit fullscreen owned by this shell.
- [x] Lock background via inert and overflow, trap Tab within shell, restore exact previous properties/focus on cleanup. Keep existing pointer/key cleanup through scene unmount.
- [x] One Escape decision at the shell; give report modal and XR precedence. Native fullscreenchange reconciles outside browser exits; ignore XR's browser presentation transition.
- [x] Route failure back to readable DOM fallback; retry opens immersive again. Preserve selection in URL on tour close.
- [x] Run targeted Playwright lifecycle/selection tests, typecheck, review and commit.

## Risks / mitigation
Fullscreen cannot guarantee that Escape is delivered to JS; document native browser exit behavior. Fullscreen promises can resolve late: close only the owned element, never other fullscreen content. StrictMode cleanup must be idempotent. Portal modal must remain visible in native fullscreen.

## Acceptance / tests
No parent card bounds, one Canvas, real modal precedence, cleanup on route/unmount, opener focus and unchanged scroll after close. Test browser-native and overlay paths separately; XR regressions in phase 06.

## Commit
`feat(tour): add immersive fullscreen lifecycle` (include lifecycle tests).
