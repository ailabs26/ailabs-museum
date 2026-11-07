# Evidence index

All artifacts were collected locally on 6 November 2026. Test fixtures provide public API responses and valid GLBs. Browser tests use production preview and real WebGL contexts. WebXR is API-simulated with actual Three WebXRManager. Physical headset acceptance requires separate hardware evidence.

## Canonical delivery

- `build-manifest.json` records base, runtime/test revisions, SHA-256 hashes and environment settings.
- `results.json` contains the final Playwright case results and decoded JSON attachments. It includes session timelines, listener counts, requests, renderer/context resource samples, page errors and unhandled rejections.
- `playwright-final.log` retains the complete final command output. Match this run to `results.json`.
- `unit-baseline.log` records 255 original unit tests. `unit.log` records the extended suite. `typecheck.log`, `lint.log` and `build.log` record the other frontend gates.
- `host-discovery.json` records OS/GPU and available connected target discovery. `slow-run-host.json` records CPU/RAM pressure during a slower earlier attempt. It does not establish the unique cause of every timeout.
- `hardware-results.json` and `hardware-desktop.log` record three passing Edge cases with hardware audit mode. `hardware-capabilities.json` records an independent same-options WebGL2 probe identifying the Intel Iris Xe/D3D11 renderer, matching the host CIM inventory.
- `review-notes.md` records independent findings, changes to assertions and review of the minimal production fix.

## RED and corrective verification

| Artifact | Observed result and interpretation |
| --- | --- |
| `f17-red-lifecycle.json`, `f17-red.json`, `regression-red.log` | Real product defect. A pending request bound after DOM Canvas removal. Timeline contains binding:start before app:end. |
| `f17-green.log`, `f17-green-lifecycle.json` | F17 close/room cases PASS 2/2 after the isConnected guard. Application ends the late session with no binding:start. |
| `xr-initial.log` | 8/9 passed. Initial room-switch test incorrectly expected no Canvas in a valid empty room. Corrected to check old Canvas ownership. |
| `xr-focused.log` | 9/10 passed. An already-ended simulated session incorrectly accepted a new reference-space request. Fixture corrected to reject InvalidStateError. |
| `xr-pre-review.log` | 21/22 passed. The original floor teleport test dispatched a synchronous trigger before scene input registration. Added listener-readiness gate. |
| `playwright-pre-review.log` | 71/71 passed before subsequent independent-review assertion strengthening. Historical proof only. |
| `edge-slow-run.log` | 72/75 passed on fixed runtime. Fullscreen cold scene, five-artifact picking and one multi-cycle test hit their former runner deadlines. |
| `chrome-focused.log` | 0/4 passed before local readiness corrections. Includes test-target occlusion in alternate raw hotspot rays. |
| `chrome-readiness-and-occluded-targets.log` | Existing fullscreen/picking cases PASS 2/2 with documented local readiness budgets. Two reconnect cases still used occluded raw targets. |
| `xr-label-green.log` | Reconnect cases PASS 2/2 using real rendered-label positions and native ray select, alternating exhibit 5 → 3 → 5. |
| `cold-scene-preconditions-red.log` | 73/75 passed. Two existing GLB cases asserted fault UI or Canvas before cold scene startup. Added an explicit Canvas-ready precondition and matched existing 15s readiness. All fault-isolation assertions are retained. |

Earlier failure logs are kept as failure evidence. They are not counted as successful delivery runs. Browser traces remain in the referenced ignored `front-end/tmp/` directories on this machine. JSON and logs in this directory provide repository-contained evidence.

## Images

Delivery images show the recovered viewport after native headset termination. They are browser screenshots of fixture content. The final report records the image paths and observed visual checks.

- `headset-end-first-recovered.png`
- `headset-device-first-recovered.png`

## Reproduction

Use the commands in [the report](../fallback-test-report.md). Run a fresh build before production-preview verification. Global runner timeout and product recovery policies follow the repository configuration. The report explicitly records local cold-start and multi-cycle test-budget corrections.
