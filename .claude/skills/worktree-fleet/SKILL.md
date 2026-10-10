---
name: worktree-fleet
description: Multi-agent Git worktree fleet orchestration. Creates isolated filesystem worktrees for parallel agent development, separating backend, frontend, and test workflows to eliminate branch collisions and dirty workspace states.
metadata:
  origin: community
---

# worktree-fleet — Parallel Git Worktree Orchestration

`worktree-fleet` provides a systematic protocol for orchestrating parallel agent execution across independent Git worktrees. Inspired by modern Agent Development Environments (`orca`), this pattern isolates parallel tasks (e.g. C# API development vs. Angular UI components vs. E2E tests) into dedicated filesystem sandboxes, eliminating dirty working directories, file-lock collisions, and cross-branch contamination.

---

## When to Use

- **Parallel Full-Stack Development**: Simultaneously implementing backend CQRS handlers in one worktree and frontend components in another without git stash or branch juggling.
- **Experimental Prototyping / Spikes**: Testing an alternate database schema, library version, or architectural pattern without disturbing the clean main worktree.
- **Isolated Quality Assurance & E2E**: Running end-to-end tests or long builds in a background worktree while continuing coding in the primary workspace.
- **Multi-Agent Coordination**: When dispatching parallel subagents via `@dispatching-parallel-agents` or `@team-builder`.

### When NOT to Use
- **Single-File Changes**: Quick edits or direct bug fixes in the active branch.
- **Repositories Not Using Git**: Worktrees require a valid Git repository root.

---

## Fleet Topology & Directory Structure

Worktrees are created inside a dedicated `.worktrees/` directory at the repository root. Ensure `.worktrees/` is added to your root `.gitignore`.

```
<project-root>/                     (Primary worktree: main / develop)
├── .gitignore                      (Includes: /.worktrees/)
├── .worktrees/
│   ├── be-api/                     (Branch: feature/be-personnel-query)
│   ├── fe-ui/                      (Branch: feature/fe-personnel-table)
│   └── qa-e2e/                     (Branch: feature/qa-personnel-verify)
```

---

## Step-by-Step Orchestration Workflow

### 1. Provision Fleet Worktrees
Create an isolated branch and worktree from the latest base commit:

```powershell
# Create backend worktree
git worktree add -b feature/be-personnel .worktrees/be-api HEAD

# Create frontend worktree
git worktree add -b feature/fe-personnel .worktrees/fe-ui HEAD
```

### 2. Execute Work in Isolation
Agents perform edits, builds, and tests strictly inside their assigned worktree:

* **Backend Agent** operates inside `.worktrees/be-api`:
  ```powershell
  # Build and test backend
  dotnet build .worktrees/be-api/api/Education.sln
  ```

* **Frontend Agent** operates inside `.worktrees/fe-ui`:
  ```powershell
  # Verify Angular build
  npm --prefix .worktrees/fe-ui/src/app run build
  ```

### 3. Pre-Merge Verification Gate
Before merging back into the integration branch:
1. Verify that all worktrees compile cleanly with 0 errors.
2. Ensure no lint regressions or uncommitted artifacts remain.
3. Commit clean, descriptive messages on each sub-branch:
   ```bash
   git -C .worktrees/be-api commit -am "feat(hrm): add GetHrmPersonnelQuery CQRS handler"
   git -C .worktrees/fe-ui commit -am "feat(hrm): add personnel table component and service"
   ```

### 4. Integration & Merge
Merge the isolated feature branches into the main integration branch:

```powershell
# From the primary repo root:
git checkout feature/hrm-personnel-feature
git merge --no-ff feature/be-personnel -m "merge: integrate backend CQRS handler"
git merge --no-ff feature/fe-personnel -m "merge: integrate frontend personnel UI"
```

### 5. Fleet Teardown & Cleanup
Once merged, cleanly remove the worktrees and delete temporary branches:

```powershell
# Remove worktree folders
git worktree remove .worktrees/be-api
git worktree remove .worktrees/fe-ui

# Prune administrative metadata
git worktree prune

# Delete temporary sub-branches
git branch -d feature/be-personnel
git branch -d feature/fe-personnel
```

---

## Windows & PowerShell Best Practices

1. **Process Locking**: Before calling `git worktree remove`, ensure no background `dotnet.exe`, `node.exe`, or `ng serve` processes have open file handles inside the `.worktrees/` directory.
2. **Path Lengths**: Keep worktree subfolder names short (e.g. `be`, `fe`, `qa`) to avoid Windows `MAX_PATH` (260 characters) limitations in deeply nested `.NET` or `node_modules` paths.
3. **Fail-Closed Cleanup**: Always verify `git worktree list` before starting a new task to ensure stale worktrees from aborted previous runs are pruned.
