# Commit plan

1. Document the audited baseline, design and acceptance gates.
2. Deliver visitor story selection, native controls, marker feedback and ordered content with browser regressions.
3. Integrate safe focus and guided takeover with camera proof.
4. Integrate in-headset story selection and regression coverage.
5. Record verification and handoff.

Review the staged diff and run `git diff --check` for each change. Combine directly coupled work when a standalone intermediate commit would break the shared UI or tests.
