# Handoff: 3D Exhibit Search & Navigation

Branch: `feat/3d-exhibit-search-navigation`. Base: `07ecea2498258390db0259de1d37c1df74337c73` (`origin/dev` at task start). Published as [PR #206](https://github.com/ailabs26/ailabs-museum/pull/206) into `dev`. Review requested an isolated Shift comparison; the results are in the verification ledger.

Collection still owns cross-room API search. Immersive search uses the current room’s validated, localized display data. An immutable index normalizes case, spacing and Vietnamese diacritics, including `đ`. Results rank exact title, title prefix, other title match, description, then hotspot label. Published display order breaks ties. Outside-room exhibits keep their 2D detail link. Scene rings and minimap outlines share the result IDs and distinguish the active target.

`MuseumControls` remains the sole owner of camera movement and reuses the existing routed motion and colliders. Each explicit request has a new identity. A stale, cancelled or blocked request cannot select an exhibit. Arrival changes the selected URL ID after the camera reaches and faces its destination. Search pauses Guided Tour and clears old hotspot motion; Resume, hotspot selection, and direct input can take over. WebXR owns its pose. Canvas loss, room changes and exit cancel unsupported or stale requests.

Code is grouped by responsibility: `helpers/exhibitSearch*` for indexing and ranking, `useExhibitSearchNavigation` and its reducer for intent, `MuseumControls` for route execution, and `MuseumScene`/`MuseumPage` plus the search panel, gallery slots and minimap for UI. Browser coverage is in `front-end/tests/museum-exhibit-search.spec.ts`. No backend, migration, dependency or public API changes.

## Review checklist for a future PR

- Compare the branch against `dev` and review the complete diff. Keep production output, browser artifacts and environment files out of Git.
- Verify request identity and invalidation, collision segments and final view, manual/Guided Tour/hotspot takeover, and search availability across XR and WebGL recovery.
- Check focus order and overlap with the detail panel, navigation controls and joystick on real touch devices. Confirm the 2D detail link follows the selected exhibit when another exhibit is paused in Guided Tour.
- Run the commands in [verification.md](verification.md), and review the evidence and remaining device/performance limits in [evidence/README.md](evidence/README.md) before merging.

## Local commits and gate status

| Commit | Scope |
| --- | --- |
| `f2c76b3` | Plan, design, test and delivery records |
| `672abec` | Vietnamese-aware search index and unit tests |
| `8484066` | Search UI, highlights, camera intent integration and reducer coverage |
| `49b933d` | 18 browser search and takeover journeys |
| This commit | Final verification, evidence index and handoff |

Frontend typecheck, lint, 438 unit tests and production build passed. All 18 search browser cases passed. The full affected browser batch had 93/95 passes. One failure (delayed GLB in portrait) reproduced on baseline with the same extent. The Shift wall-clock assertion can fail with fewer render frames on either revision, while matched frames show identical acceleration. The full batch remains red. Review the comparison and delayed GLB finding before merge. The separate 250-entry fixture passed and observed 4.05 ms median to update the result DOM, idle rendering and renderer release on exit. Hardware/physical-device coverage remains partial; see the [verification ledger](verification.md) for exact scope and commands.
