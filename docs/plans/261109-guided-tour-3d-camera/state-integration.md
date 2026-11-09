# State integration

Core commands and `steps` remain authoritative. A request identity changes when step, running state, room geometry or scene readiness changes. Camera callbacks carry that identity, and the coordinator accepts only the current request. MuseumControls cancels old movement before building a new route, clears residual manual velocity, and suppresses selection auto-focus throughout an active session.

The coordinator owns one dwell deadline. Arrival updates URL selection once with replace semantics and starts 15 seconds of dwell. Its cleanup preserves remaining time. Pause cancels camera motion and deadline. Resume replans from the actual camera pose, then continues the remaining dwell. Next/Previous reset dwell for the new exhibit. The last deadline calls the core's existing NEXT completion transition once.

URL selection is an output of arrival. It does not issue core commands. External selection exits first. This prevents a URL/step feedback loop. Room refetch reconciles IDs through the core, and old IDs never resolve against a different room. The adapter pauses on missing scene readiness and hidden document. Exit/unmount cancels callbacks and timer.

XR request pauses before entering. MuseumControls also checks renderer.xr.isPresenting before writing any transform. Existing XR restoration retains ownership of restoring the web pose. Recovery leaves the tour paused until explicit Resume. Reduced-motion preference changes replace movement with a validated immediate arrival.
