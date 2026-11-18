# Architecture

Before: Collection has cross-room API search; immersive catalogue directly selects URL exhibit and automatic focus. Guided and hotspot requests already share MuseumControls routed motion.

After: immersive search indexes only localized validated `displays`. Query/match IDs live in MuseumScene, keeping GLB owner and camera inputs stable. Page owns explicit navigation binding and URL selection. SearchPanel owns only disclosure, input and result presentation. MuseumControls remains the sole web camera transform owner and uses its existing routed animation.

Intent phase transitions live in the small pure exhibitSearchNavigationReducer, with unit tests rejecting stale outcomes. The hook adds room/data/readiness and browser lifecycle guards. MuseumControls publishes readiness only after its canvas input/command binding exists; search is unavailable before then. Failed GLB render checks choose fallback bounds as well as failed downloads.

Approach: extend existing request/motion seams. A separate controller would violate ownership; remote search would add latency and change scope. Neither is appropriate. No third-party search dependency.

Independent states: query matches; request/target with moving/arrived/blocked/cancelled outcome; selected URL exhibit. Results never select simply by typing. Published outside-room entries remain searchable with a 2D link.

Priority: XR pose > manual input > latest explicit search/hotspot > guided > automatic focus. Search request pauses guided while retaining resume. Guided resume cancels search. Hotspot selection cancels search; search clears story. No automatic storytelling or tour resume.

Risks: DOM overlays in small viewports, renderer asynchronous effects, bounds changes during motion. Address with bounded disclosure sizing, request reference checks every frame, cancellation on published placement changes and no route replay after arrival.
