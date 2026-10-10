---
name: checkpoint-resume
description: Long-horizon task management, state checkpointing, and progressive session recovery. Enables agents to serialize multi-phase execution state into structured checkpoints and resume interrupted work seamlessly.
metadata:
  origin: community
---

# checkpoint-resume — Long-Horizon Task Checkpointing & Recovery

`checkpoint-resume` provides a structured checkpointing protocol for complex, long-running agent tasks (such as full-stack feature implementations, large migrations, or multi-step refactoring). Inspired by autonomous long-horizon harnesses (`deer-flow`), it prevents work duplication and context loss across session boundaries by serializing task state into `.tasks/{task-slug}.checkpoint.json`.

---

## When to Use

- **Multi-Phase Implementations**: Tasks spanning both Backend (.NET) and Frontend (Angular), requiring database migration, API changes, and UI updates.
- **High-Token / Long-Horizon Workflows**: Tasks where conversation context window limits might trigger summarization or interruption.
- **Session Resumption**: Continuing a complex debugging or implementation session from a previous day or prompt.
- **Verification Gates**: Checkpointing immediately after tests pass (e.g. backend compiles successfully) before starting the next risk phase.

### When NOT to Use
- **Simple / Single-File Edits**: Quick bug fixes or one-line changes do not need checkpointing overhead.
- **Pure Q&A or Survey Tasks**: Conceptual research without state modification.

---

## Checkpoint File Schema (`.tasks/{task-slug}.checkpoint.json`)

All checkpoints are saved in the project-local `.tasks/` directory (git-ignored if needed):

```json
{
  "taskSlug": "hrm-personnel-retirement-report",
  "title": "Báo cáo sắp nghỉ hưu - Phân hệ HRM",
  "version": "1.0.0",
  "updatedAt": "2026-09-26T10:35:00Z",
  "status": "in_progress",
  "currentPhase": "frontend_implementation",
  "completedPhases": [
    "discovery_and_schema_review",
    "backend_cqrs_query"
  ],
  "steps": [
    {
      "id": "step-1",
      "description": "Viết GetHrmPersonnelRetirementQuery và Handler",
      "status": "completed",
      "artifacts": [
        "api/Education.Application/Features/Hrm/HrmPersonnels/Queries/GetHrmPersonnelRetirementQuery.cs"
      ],
      "verification": "dotnet build api/Education.sln PASSED"
    },
    {
      "id": "step-2",
      "description": "Tạo giao diện RetirementReportComponent trên Angular",
      "status": "in_progress",
      "artifacts": [
        "src/app/main/hrm/retirement-report/retirement-report.component.ts"
      ]
    },
    {
      "id": "step-3",
      "description": "Kiểm thử Playwright E2E và xác thực giao diện",
      "status": "pending"
    }
  ],
  "contextAnchors": {
    "targetBranch": "feature/hrm-retirement-report",
    "slnPath": "api/Education.sln",
    "angularApp": "education_dh",
    "keyDecisions": [
      "Tính tuổi nghỉ hưu theo lộ trình tăng tuổi BHXH (Nam 62, Nữ 60)",
      "Sử dụng nz-table với virtual scroll cho danh sách trên 1000 cán bộ"
    ]
  }
}
```

---

## Agent Checkpoint Workflow

### Phase 1: Task Initialization & Checkpoint Probe
Before starting a complex task:
1. Check if `.tasks/{task-slug}.checkpoint.json` already exists.
2. If found, load the file, summarize completed phases to the user, and announce:
   ```markdown
   🔄 **Resuming task from checkpoint: `{task-slug}` (Phase: {currentPhase})...**
   ```
3. Verify that the git branch and file state match the checkpoint before continuing.

### Phase 2: Progressive Checkpoint Updates
At every milestone:
1. Run local build/test to verify the milestone.
2. Update the checkpoint JSON with the new step status, modified files, and test output.
3. Commit the code or update the task snapshot.

### Phase 3: Failure Recovery
If a tool call fails, a compile error occurs, or the session is halted:
1. Record the exact blocker and error message in the checkpoint under `"blockers": [...]`.
2. Do not rollback already-verified prior steps.
3. Upon restart, jump directly to resolving the recorded blocker.

### Phase 4: Task Completion & Archive
When all steps pass verification:
1. Mark `"status": "completed"`.
2. Move the checkpoint to `.tasks/archive/{task-slug}.completed.json` (or delete if configured).
3. Trigger `@auto-memory-compaction` to extract permanent conventions into `.agents/memory/`.

---

## Best Practices & Safety

1. **Keep Checkpoints Lean**: Do not store entire file contents inside the checkpoint JSON; store relative file paths and concise verification strings.
2. **Deterministic Statuses**: Status values must be strictly: `pending`, `in_progress`, `blocked`, `completed`.
3. **No Sensitive Tokens**: Never write connection strings, passwords, or authentication bearer tokens into checkpoint files.
