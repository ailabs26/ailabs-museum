---
name: auto-memory-compaction
description: Continuous learning and automatic post-task memory consolidation. Distills durable conventions, bug root-causes, and architectural decisions from sessions into .agents/memory/ without polluting context.
metadata:
  origin: community
---

# auto-memory-compaction — Continuous Learning & Session Memory

`auto-memory-compaction` enables an agent to systematically capture, distill, and consolidate durable project knowledge at the end of significant tasks. Inspired by autonomous memory architectures (`claude-mem`, `mem0`), this skill ensures that valuable discoveries, fixed edge-cases, and architectural choices persist across agent sessions without manual effort.

---

## When to Use

- **Task Completion Checkpoint**: After successfully completing a complex bug fix, refactor, or new feature.
- **Correction Event**: Whenever the user corrects an assumption, naming style, or workflow requirement.
- **Architectural Discovery**: When uncovering undocumented project conventions, database quirks, or API contracts.
- **Session Wrap-up**: Before completing a major milestone to ensure the next session resumes with zero context loss.

### When NOT to Use
- **Simple Question/Answer Sessions**: Do not write memory for trivial queries or basic explanations.
- **Transient Failures**: Do not store temporary network glitches or momentary syntax typos.

---

## The Compaction Filter (Signal vs. Noise)

To prevent context bloat and memory pollution, apply the **Strict Compaction Filter**:

| ✅ SAVE (Durable Knowledge) | ❌ DISCARD (Ephemeral Noise) |
| :--- | :--- |
| Root cause of subtle bugs & verified fixes | Full error stack traces and raw terminal logs |
| Hard project conventions ("Angular 20 uses Zoneless Signals") | Code snippets that already exist in git history |
| User workflow preferences ("Always write tests using AAA pattern") | Transcripts of conversational banter |
| Breaking changes in dependencies or DB migrations | Temporary test values, scratch file names |
| Workaround for OS/compiler quirks (e.g. Windows pwsh escapes) | Intermediate failed hypotheses |

---

## Memory Vault Mapping (`.agents/memory/`)

In the AG Kit ecosystem, memories are stored in categorized plain-text Markdown files under `.agents/memory/`:

1. **`project-conventions.md`**:
   - Technology stack versions, coding conventions, naming rules, folder structures.
   - Example: `- [frontend] Angular v20 Standalone components with signals required; Zone.js is disabled.`

2. **`tech-decisions.md`**:
   - Architectural decisions, library choices, performance trade-offs.
   - Example: `- [db] EF Core SQLite uses custom ValueConverter for ISO-8601 DateTime strings.`

3. **`user-preferences.md`**:
   - User interaction styles, preferred language, documentation verbosity.
   - Example: `- [comm] User prefers explanations in Vietnamese with English technical symbols.`

4. **`MEMORY.md`**:
   - The master index table loaded at session start. Keep this file lean (< 30 lines) pointing to topic files.

---

## Step-by-Step Compaction Workflow

When concluding a non-trivial task:

### Step 1: Self-Audit & Distill
Ask:
1. *What did I learn in this session that I didn't know at the start?*
2. *Will future agents fail or waste time if they don't know this fact?*

### Step 2: Formulate Concise Bullet Points
Formulate each finding as a single, actionable bullet point:
`[domain] Short statement of fact → concrete implication or fix`

### Step 3: Append to Memory File
Check if the fact already exists in `.agents/memory/`. If not, append it cleanly to the relevant file:

```markdown
- [domain] Key finding or decision (Date: YYYY-MM-DD)
```

### Step 4: Index in `MEMORY.md` (If New Domain)
If a new critical domain or high-priority rule was established, add a one-line reference in `.agents/memory/MEMORY.md`.

---

## Safety & Hygiene Rules

1. **Atomic & Idempotent**: Never duplicate existing memory entries.
2. **Deterministic Over Heuristic**: Only record facts that were verified by passing tests or user confirmation.
3. **No Secrets**: Never save API keys, passwords, bearer tokens, or PII into memory files.
4. **Git Friendly**: All memory updates must be clean, human-readable markdown compatible with git version control.
