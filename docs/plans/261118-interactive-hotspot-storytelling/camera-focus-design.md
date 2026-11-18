# Hotspot camera focus

The gallery has translation-only ancestors above each hotspot. Legacy positions come from the display. Gallery Template positions are snapped by the room mapper to the same slot translation used in rendering. Use the marker projection in `getArtifactHotspots` for GLB-local offset, scale and the pedestal's Y offset. The camera adds the gallery translation once. Invented fallback positions keep markers selectable while loading or after failures and carry no focus target.

Use the existing framed-view search, preferring the side of the exhibit facing the authored annotation. Keep bounds-based stand-off, room margins, gallery colliders and the target sightline to other exhibit proxies. Reuse the validated sampled path and turn-rate-limited interpolation already used for guided motion. If the target or route is invalid, keep the current view and show the story.

The page pauses the existing tour adapter before selecting a hotspot. The camera may then process a hotspot request while the tour is paused. An explicit tour move takes over and reuses the same motion slot. Manual input, replacement, disabled rendering and XR cancel camera work. Reduced motion finishes at the safe destination without a flight. Requests follow user selections and are not reissued by locale changes or renderer recovery.
