---
name: claude-mem
description: >
  Persistent memory and context compression system for Claude Code, Antigravity, and AI agents.
  Captures observations across sessions, provides 3-layer progressive disclosure (search -> timeline -> get_observations),
  and retains cross-session continuity without context window exhaustion.
license: Apache-2.0
metadata:
  author: thedotmack
  version: "15.9.0"
  category: productivity-memory
  tags: "memory, context-compression, progressive-disclosure, persistence, mcp, claude-mem"
---

# Claude-Mem Persistent Memory & Context Compression

Claude-Mem seamlessly preserves context across sessions by automatically capturing tool usage observations, generating semantic summaries, and providing token-efficient retrieval via MCP tools.

## Architecture Overview

1. **Lifecycle Hooks**: Automatically capture observations across session boundaries (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`).
2. **Worker Service & Database**: Local SQLite (FTS5 full-text search) and optional Chroma vector store for hybrid semantic recall.
3. **Progressive Disclosure Retrieval**: 3-layer query model saving up to 10x tokens by filtering before full hydration.

---

## The 3-Layer Workflow Pattern

Always retrieve memory using the 3-layer progressive disclosure pattern:

```
Step 1: search (Compact Index, ~50-100 tokens/result)
   │
   ▼
Step 2: timeline (Chronological Context around candidate IDs)
   │
   ▼
Step 3: get_observations (Hydrate full details ONLY for filtered IDs, ~500-1000 tokens)
```

### 1. `search`
Search the memory index with text queries and optional filters:
- Filter by category (`decision`, `bugfix`, `feature`, `architecture`, `discovery`)
- Filter by date range or project path
- Returns concise records with unique observation IDs and token estimates

### 2. `timeline`
Inspect the chronological sequence surrounding an observation or time window:
- Understand cause-and-effect and preceding agent actions
- Determine which observation IDs are relevant before requesting full details

### 3. `get_observations`
Fetch the complete detail, diffs, or session transcripts for identified IDs:
- Always batch requests with an array of IDs rather than querying one-by-one
- Avoid hydrating unneeded observations to preserve prompt budget

---

## MCP Server Configuration

Configured under `.claude/mcps/productivity/claude-mem.json`:

```json
{
  "mcpServers": {
    "claude-mem": {
      "description": "Claude-Mem Persistent Memory & Context Compression MCP Server",
      "command": "npx",
      "args": ["-y", "claude-mem", "mcp"],
      "env": {}
    }
  }
}
```

---

## CLI & Setup Commands

To install and initialize Claude-Mem globally or for specific IDE harnesses:

```bash
# Standard interactive installation
npx claude-mem install

# Headless / CI installation without online account prompts
npx claude-mem install --provider host

# Specific IDE harnesses
npx claude-mem install --ide antigravity
npx claude-mem install --ide opencode
npx claude-mem install --ide t3code
```

---

## Privacy & Best Practices

- **Private Content Exclusion**: Wrap confidential credentials, keys, or personal data in `<private>...</private>` tags; Claude-Mem automatically strips these before storing observations.
- **Durable Knowledge vs Transcripts**: Focus memory searches on architectural decisions, bug roots, and repository conventions.
- **Memory Review**: Local review viewer is available at the worker URL output at startup (default `http://localhost:3773/viewer`).

