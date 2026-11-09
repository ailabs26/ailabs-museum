# State integration

Core commands and `steps` remain authoritative. A request identity changes when step or running/readiness state changes. Camera callbacks carry that identity, and the coordinator accepts only the current request. Geometry, lens or loaded bounds changes cancel and replan the current request within MuseumControls and emit a moving signal that suspends dwell. MuseumControls clears residual manual velocity when beginning guided motion and suppresses selection auto-focus throughout an active session.

The coordinator owns one dwell deadline. Arrival updates URL selection once with replace semantics and starts 15 seconds of dwell. Its cleanup preserves remaining time. Pause cancels camera motion and deadline. Resume replans from the actual camera pose, then continues the remaining dwell. Next/Previous reset dwell for the new exhibit. The last deadline calls the core's existing NEXT completion transition once.

URL selection is an output of arrival. It does not issue core commands. External selection exits first. This prevents a URL/step feedback loop. Room refetch reconciles IDs through the core, and old IDs never resolve against a different room. The adapter pauses on missing scene readiness and hidden document. Exit/unmount cancels callbacks and timer.

XR request pauses before entering. MuseumControls also checks renderer.xr.isPresenting before writing any transform. Existing XR restoration retains ownership of restoring the web pose. Recovery leaves the tour paused until explicit Resume. Reduced-motion preference changes replace movement with a validated immediate arrival.

DOM reset/focus/navigation commands use a synchronous handler ref bound by MuseumControls and cleared on teardown. Keyboard/touch actions use that same owner. Manual input timestamps are compared with the parent scene's selection issue time, so a delayed React/R3F selection commit cannot recreate a focus transition after newer manual input. This preserves late GLB reframing when manual takeover has not occurred.

## PR review follow-up

Camera navigation receives a locale-independent display mapping memoized by validated exhibit data and room ID. Localized displays continue to drive meshes, labels and details. Changing locale therefore preserves the current path and motion profile. Placement, model bounds and lens changes still replan through the existing camera owner.

Guided Tour controls provide bundled defaults for vi, en, fr, zh, ko and ja through the existing translation lookup. Published CMS keys override these defaults. Missing keys and translation-request failures retain usable controls in the selected locale.

Pause clears the live coordinator request synchronously before dispatching the core pause command. MuseumControls checks request validity before writing a guided frame, closing the interval between the DOM action and the R3F prop commit. The same cancellation handles manual takeover, scene readiness loss, hidden documents and teardown. The core remains the session owner. Resume at an already arrived pose uses progress 1 when duration is zero, with the existing rotation rate limit applying if orientation still needs adjustment.
