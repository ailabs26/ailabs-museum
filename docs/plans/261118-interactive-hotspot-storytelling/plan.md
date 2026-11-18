# Interactive Hotspot Storytelling

Baseline `cd0155d4756996ad6a0309f0577772e56dc3a5d8` (`Merge pull request #201 from ailabs26/feat/public-seo-metadata`). Fetched from `origin/dev` on 18 November 2026. The prior working tree was clean and had no unpushed commits.

The public tour already validates and localizes published hotspot copy, places depth-tested markers and provides native buttons. The markers expose two IDs in Three.js, but the DOM, mouse and XR commit paths select only the exhibit. The details panel renders all annotations together. The camera already supports ordinary focus and a bounded, collision-checked guided path.

- [ ] Wire exact selection from the 3D marker, native control and readable details. Add ordered story navigation and preserve ordinary exhibit selection.
- [ ] Use the rendered placement and model normalization to derive an authored world target. Route focus through the existing camera owner and pause the guided camera adapter.
- [ ] Carry exact identity through XR controller and gaze selection. Reuse the existing in-headset panel and clear stories on XR teardown.
- [ ] Run the [test plan](test-plan.md), inspect the feature diff and record results in [verification](verification.md) and [handoff](handoff.md).

The frontend conventions now live at `docs/architecture/fe/coding-conventions.md`. Source audit follows the render chain from `MuseumPage` through `MuseumScene`, legacy/slotted displays, the marker and caption. It also covers the public schema/mapping, CMS editor and preview, native controls, navigation and guided paths, room asset ownership, WebGL recovery and XR hit testing. See [architecture](architecture.md), [interaction](interaction-design.md), and [camera focus](camera-focus-design.md) for the resulting contracts.
