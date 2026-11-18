# Camera navigation

Request `{ exhibitId, requestId, issuedAt }` is a fresh object per click; hook captures navigation displays scope and readiness. Ref checks reject stale completion synchronously; scope/readiness/scene changes invalidate requests. The binding is an intent lifecycle, never a camera controller.

Extend MuseumControls RoutedMotion with searchRequest, using planRoutedMotion/getGuidedView/buildGuidedPath and existing sampled acceleration/rotation. Target bounds come from loaded model normalization or getArtifactFocusBounds fallback. Errors may navigate to fallback plinth. No direct display.position destination.

Moving request may replan on resize/bounds; arrived/cancelled request never restarts. Reduced motion uses the existing safe destination jump on a renderer frame. Arrival waits for actual endpoint and orientation. Blocked returns a readable failure with a 2D detail link, leaves camera/selection unchanged. Repeated same exhibit creates a new identity.

Manual input cancels search before frame work. Hotspot/guided takeover clears active search; no old callback can select. XR/readiness loss disables DOM search and cancels, without moving headset pose. Unmount cancels in existing effect cleanup. Browser visibility loss cancels motion.
