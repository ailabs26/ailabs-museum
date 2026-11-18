# Test plan

| Proof | Target |
| --- | --- |
| Unit | Real and synthetic marker coordinates, invalid/fallback coordinates, CMS order and tie-break, collision-safe views and paths. |
| Browser fixture | Marker identity and active styling, keyboard and focus restoration, previous/next boundaries, rapid replacement, guided pause and no dwell advancement, content refresh/removal, failed GLB, reduced motion, renderer recovery, room and immersive lifecycle. |
| Camera probe | Measure world-space marker projection, safe camera positions and sampled route, bounded orientation steps and settled demand rendering. |
| Browser layout | Check 390×844, 768×1024 and 1280×720. Exercise story controls and immersive exit. |
| Existing suites | Hotspots, navigation, camera, guided tour, XR and disconnect, GLB, lifecycle, fullscreen, CMS preview and 2D fallback. |

Use the existing Playwright API fixtures and renderer/XR probes. Test the fixture suite on the production preview after the build. Live and physical-headset coverage require a separate environment.
