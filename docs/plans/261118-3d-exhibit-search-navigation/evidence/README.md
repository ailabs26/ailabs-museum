# Search and navigation evidence

Production Vite preview, Edge `157.0.4341.60` with SwiftShader, and mocked public museum data. The local paths below are under `front-end/tmp/` and excluded from Git; use [the recorded commands](../verification.md) to regenerate the evidence.

| Evidence | Local path under `front-end/tmp/` |
| --- | --- |
| Playwright report, including test durations and two regression traces | `search-handoff-report.json` |
| Desktop after arrival at 640×480 | `search-handoff/museum-exhibit-search-E06--22883-latest-explicit-target-wins/search-arrived-desktop.png` |
| Touch viewport at 390×844 | `search-handoff/museum-exhibit-search-E11--05b80-ols-arrival-reveals-details/search-mobile.png` |
| 270 sampled camera positions | `search-handoff/search-trajectory.json` |
| Focused unchanged navigation tests | `search-handoff-focused.json` |
| Large fixture input latency and renderer lifecycle | `search-handoff-latency.json` |

Both search screenshots were inspected. At 640×480, the collapsed search and the arrived exhibit detail were visible in separate columns. At 390×844, the search panel and action were above the joystick. The touch test confirmed the detail panel appeared below the collapsed search after tapping, with no horizontal overflow. The existing 320×568 regression confirmed the detail close button remained reachable.

## Camera, GLB and renderer

The live trajectory test sampled 270 frames, from `[0, 2.6, 5.8]` to approximately `[0, 2.278, -2.661]`. The direct segment intersects the fixture obstruction. Every consecutive segment passed the existing navigation safety predicate, the samples traveled around the pedestal, and the final direction dot product with the target exceeded `0.999`. After switching from A to B during motion, only B appeared in the URL and detail panel. This verifies motion and final framing on the fixture, without inferring device frame rate.

The GLB fixture loaded four healthy models and rejected one corrupt model. The per-URL request counts were unchanged after three queries and navigation to the corrupt model's plinth. A separate parsed-but-unrenderable GLB test verified that the camera frames the visible fallback. The navigation and search tests observed a stable frame count over a one-second idle interval. The fullscreen test verified zero live museum renderers after each of three open/close cycles; the large fixture additionally verified `1 → 0` after an active search. These probes confirm context and canvas release in the browser, without measuring heap retention over a long session.

## Search latency

A Node 24.8.0 microbenchmark indexed 1,000 fixture exhibits with Vietnamese title, description and two hotspot labels. First index build: 113.810 ms. After 60 warm-up calls, 300 calls over six queries took 0.210 ms median, 0.432 ms p95 and 11.597 ms maximum. This measures filtering separately from React and WebGL.

A supplemental Playwright check used 250 entries (five positioned in 3D and 245 with 2D details only). It alternated three result groups and checked the visible list after every input. After six warm-up inputs, 30 samples from a capturing `input` listener to the result list's `MutationObserver` callback had median 4.05 ms, p95 6.60 ms and maximum 6.60 ms. This includes React's DOM update; it excludes hardware input delivery and display paint. Run from `front-end` with `PLAYWRIGHT_PREVIEW=1`: `npx playwright test --config=tmp/search-handoff-perf.config.ts --workers=1 --output=tmp/search-handoff-perf --reporter=list,json`. The diagnostic config and spec are local ignored files. PASS (one test), exit `0`, 14.3 s.

**PARTIAL:** Hardware GPU/headset, physical touch and screen-reader behavior, paint latency and long-session heap retention were not measured. The WebXR results use the repository's headset simulation; the browser-level WebGL loss checks use an actual lost context under SwiftShader.
