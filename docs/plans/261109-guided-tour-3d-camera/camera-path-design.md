# Camera path design

Reuse getExhibitView for lens/bounds framing. Validate finite coordinates and room placement. Candidate viewing positions must fit the model sphere, remain outside all expanded colliders, and have an unobstructed sightline against other exhibits. Search around the target when the nominal position fails. Failure leaves the camera in place.

Use the visibility graph around existing AABBs, preferring an additional 0.22 m margin. Endpoints always use the existing room/body clearance. The graph is preprocessed once per request. Greedy visibility pruning removes redundant waypoints.

For each corner choose tangent points at at most 0.55 m and 40% of adjacent segment lengths. Sample a quadratic Bézier at at most 0.025 m control-polygon spacing. Validate every chord using the shared slab test and both endpoints against room bounds. Halve radius on failure, retaining the original corner after bounded attempts. The sampled polyline is the rendered route, so no unsampled spline can leave the validated envelope.

Resample linear sections at at most 0.04 m. Store cumulative distances. Curvature limits speed through curves, sharp fallback corners require a stop. Forward/backward passes enforce 1 m/s² tangential acceleration and a 1.25 m/s speed ceiling. Store cumulative travel times from constant-acceleration segments. Sample by elapsed travel time, solving distance within the segment and looking up position by arc length. Clamp frame delta to 50 ms to prevent background-tab jumps. Route length controls duration.

Look ahead along the route and blend toward exhibit focus within the final 2 m. Rotate quaternion along its shortest arc with a 1.3 rad/s ceiling and Y-up look-at targets. Arrival waits for position and orientation completion. Vertical interpolation uses smoothstep along arc length within validated floor/ceiling limits.
