# Headset disconnect protocol

## Deterministic simulation

`installXrSimulation` replaces the browser XR API boundary. The actual R3F scheduler, Three r170 WebXRManager, stereo camera and software WebGL renderer still run. Physical-headset certification requires the hardware protocol below and corresponding evidence.

- `disconnect()` removes sources and dispatches inputsourceschange. It keeps the session active and does not change device availability. The existing gaze test exercises this separately.
- `terminateHeadset('end-first' | 'device-first')` invokes the simulated UA termination directly. It marks the session ended, dispatches native end, changes availability to false and dispatches XRSystem devicechange in the selected order. It never calls the application's Exit VR handler or session.end().
- `setAvailable(true)` dispatches devicechange. It leaves entry to a user click. Each request creates a fresh Session, with old sessions retained by the fixture solely for deliberate stale-event assertions.
- `visibility('visible-blurred')` retains the session while disabling interaction. Current product policy exits on hidden. Visible restores interaction after a temporary blur.
- `holdRequest`, `holdCompatibility` and `holdBinding` expose resolver functions. Wait for the function to exist, inject the fault, then resolve it. Do not substitute wall-clock sleeps for these boundaries.
- A new requestReferenceSpace on a UA-ended session rejects with InvalidStateError. An already pending simulated binding can finish late to exercise the existing adapter.

Listener counts are tracked per event type/capture flag using the native EventTarget registration and delivery implementation. The fixture stores no production telemetry. Native and application end calls are counted separately. Three-cycle healthy disconnect tests require zero remaining session listeners and only one live context, then zero after tour close.

Partial Three binding failure deliberately retires the Canvas under the current adapter policy. The failed manager's unsafe end handler is suppressed and the renderer is disposed. A failed simulated session can retain manager listeners in the fixture's strong diagnostic references until the page is destroyed. Healthy native termination has the stronger zero-listener assertion. These two cleanup contracts are reported separately.

## Physical prerequisites

Record operator, date/time, headset model/firmware, controller model, OS, runtime, browser/version, GPU/driver where applicable, build SHA and serving URL. Serve through HTTPS or a secure localhost workflow supported by the device. Confirm immersive-vr support before running immersive cases. Keep the user in a clear, seated or manufacturer-supported safe play area.

Use [the existing performance protocol](../261104-real-device-3d-performance-audit/measurement-protocol.md) for GPU identity, power/thermal conditions and performance measurement. Reuse its evidence conventions rather than copying performance conclusions into this correctness audit.

## Physical steps and pass criteria

1. Start screen/video capture and browser remote console if available. Load a published room with five valid GLBs, open tour and select a named exhibit. Record request counts and camera entry point.
2. Enter VR with a deliberate action. Confirm stereo scene and perform select plus teleport or snap turn. Record selected exhibit and phase=active before interruption.
3. End the immersive session using the OS/headset Exit control. Capture actual event order, XR state and recovery. Expect web navigation or accessible 2D if the renderer fails, preserved selection and no unexpected model fetches.
4. Start a fresh session. Trigger a manufacturer-supported standby/sleep or session termination. Distinguish temporary visibility/tracking interruption from native session end. Record whether devicechange occurs and the observed isSessionSupported result. Availability remaining true after end can be legitimate browser behavior.
5. Reconnect or wake the headset using its supported controls. Confirm no automatic VR entry. Explicitly re-enter, verify a fresh session and repeat three cycles. Record context/renderer counts where diagnostics permit and watch for a persistent black view.
6. Disconnect a controller separately using supported controls. Confirm the headset session remains active and head-gaze details/Exit remain accessible. Reconnect the controller and check for duplicate select actions.
7. Close the tour, reopen it, change room, exercise Escape/fullscreen/keyboard/touch as supported and confirm usable catalogue and 2D links. Export logs/video with timestamps and scenario IDs.

Never remove power or deliberately disrupt tracking while a person wears the headset. If the browser cannot expose a genuine native disconnect safely, record that scenario as NOT RUN and retain the simulation result separately.

## Evidence form

For every attempt record F-ID, expected/actual result, PASS/FAIL/BLOCKED/NOT RUN, method (`physical headset`), environment/build SHA, native event order, renderer/context counts if observable, errors/unhandled rejections, model requests, selection before/after, camera/navigation recovery, evidence path and reproduction notes. A skip is never a PASS.

Current hardware acceptance is `BLOCKED — PHYSICAL HEADSET REQUIRED`. Fill [the device matrix](device-matrix.md) and append real evidence before changing that status.
