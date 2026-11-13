# Independent review record

A read-only reviewer inspected the working tree against base `c10ffa9884f54e45203522e1b57d8bd01a1cf0f8`. The reviewer launched no tests and changed no files.

## Findings and resolution

1. F17 called native termination immediately after resolving a pending request. This could pre-end the session before application cleanup and make the end-call count insufficient proof. The test now resolves the request alone and requires exactly one application end call, one termination, application-end before native-end and no renderer binding start.
2. Reconnect cycles kept exhibit 5 selected after cycle zero. The same selection assertion could pass with broken input in a new session. The final tests select actual rendered exhibit labels in order 5 → 3 → 5 with native XR rays, requiring a fresh selection change per session.
3. The original recovery assertions checked saved camera and enabled controls without exercising web input. Each cycle now presses ArrowRight on the recovered Canvas, requires quaternion change and an additional submitted web frame, then resets with Home.
4. The first F15 tests exercised native-end before processing context-lost. Added context-first order while waiting for the actual recovering state, in both active and pending-binding cases.

The reviewer confirmed the simulation distinguishes controller removal from native session termination, retains actual WebXRManager behavior and accurately discloses unavailable physical devices. Final test outcomes for the strengthened assertions are recorded in `playwright-final.log` and `results.json`.

## Production fix review

The strengthened F17 exposed actual stale binding after DOM Canvas removal. The reviewer inspected the two-line `MuseumXr.attach` fix separately and reported no important finding. The isConnected guard executes before camera, input and renderer mutations, preserves connected requests and existing generation checks, and closes the asynchronous DOM/R3F teardown gap. The reviewer required GREEN verification, recorded in `f17-green.log` and the final run.

## Final harness review

After recorded deadline failures, the reviewer also inspected local 15s cold Canvas readiness and 60s five-artifact/multi-cycle budgets. These match measured work and existing suite patterns, preserve assertions, and leave global runner config plus product 8000 ms policies intact. The reviewer found no important false positive or scope issue. The host snapshot establishes resource pressure but cannot prove that CPU/RAM alone caused every timeout.

## Review scope

This review covers regression quality and evidence claims. It supplies no physical-headset certification or heap-retention proof. Final whole-diff review also checks staged scope and whitespace before each local commit.
