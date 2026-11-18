# Selection and ownership

| Owner | Contract |
| --- | --- |
| Public room schema and `mapRoomDisplays` | Already validate IDs and coordinates, localize content, order by CMS displayOrder and stable ID, and resolve slotted placement. |
| `MuseumPage` | Holds one session story identified by room, exhibit and hotspot IDs. Derives current content from the validated selected display. `selectExhibit(id)` and `selectHotspot(exhibitId, hotspotId)` have distinct behavior. |
| `ExhibitDetailPanel` and `HotspotStory` | Render current text and step controls in the existing panel. Ordinary content remains readable throughout. CMS preview keeps its current read-only annotation list. |
| `MuseumScene` and gallery renderers | Forward validated IDs, carry one active marker and resolve geometry when available. Room model ownership remains checksum-based. |
| `MuseumControls` | Resolves safe views, arbitrates manual, guided and hotspot motion and owns web camera transforms. |
| `MuseumXr` and `XrDetailsPanel` | Resolve XR input through the existing hit priority and display the selected story in the existing texture-backed UI. Existing page controls paginate long text. |

An ordinary selection, an exhibit or room change, an authoritative removal, explicit scene exit or XR lifecycle boundary clears the story. The same IDs across refetch and locale changes resolve to the latest copy. The active story is independent of rendering and is readable during WebGL recovery or in the fallback view on the tour page.

The URL still records `room` and `exhibit`. Selecting a hotspot on a new exhibit updates the exhibit through the existing replace behavior. Back/Forward can change the room or exhibit, which clears the session story. A reload begins with ordinary details.
