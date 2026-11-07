# Commit plan

1. `docs(test): plan WebGL and WebXR fallback matrix` records source inventory, scope and gates.
2. `test(xr): cover native headset disconnect and lifecycle races` extends the shared simulation and regression assertions together.
3. `test(fallback): extend GLB isolation and recovery regressions` covers remaining fault matrix gaps.
4. Production fixes, if reproduced, receive separate `fix(...)` commits with RED evidence.
5. `docs(test): deliver fallback evidence and device QA protocol` records actual final results, matrices and hardware handoff.

Before each commit review diff, staged paths and focused test results. Final report lists actual SHAs. No push, PR or merge is authorized by this task.
