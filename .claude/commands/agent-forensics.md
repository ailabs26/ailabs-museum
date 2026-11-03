---
name: agent-forensics
description: "Inspect recorded session transcripts and traces to verify past agent actions, check test results, and resolve why an agent made a change. Usage: /agent-forensics [question] [--session ID | --trace PATH]"
argument-hint: "[question] [--session ID | --trace PATH]"
---

# /agent-forensics

Systematically inspect what an agent actually did in previous runs using deterministic transcript inspection, rather than relying on LLM memory hallucination.

## Usage

```bash
/agent-forensics "why did you change config.yaml?"
/agent-forensics --session <SESSION_ID>
/agent-forensics --trace <PATH_TO_TRANSCRIPT>
```

## Forensic Workflow

1. **Locate Trace**: Find the session transcript touching the target file or command.
2. **Timeline Reconstruction**: Trace chronological actions (`recorded` vs `inferred` causality).
3. **Claim Verification**: Verify claims against execution logs (e.g. `passed:pytest`, `edited:file`, `read:file`).

## Skill Reference

See skill `agent-run-forensics` (`.claude/skills/agent-run-forensics/SKILL.md` or `.agents/skills/agent-run-forensics/SKILL.md`).

