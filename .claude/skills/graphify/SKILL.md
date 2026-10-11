---
name: graphify
description: Turn codebases, schemas, configs, and documentation into a queryable deterministic AST knowledge graph without vector databases. Maps dependencies, call hierarchies, and architectural edges for multi-file refactoring.
metadata:
  origin: community
---

# graphify — Deterministic Codebase Knowledge Graph

`graphify` analyzes codebases, SQL schemas, and config files using deterministic Abstract Syntax Tree (AST) parsing (via Tree-sitter / language parsers) instead of fuzzy vector databases. It produces an explicit, queryable relationship graph that tells an agent exactly what calls what, which classes implement which interfaces, and which files will break if a contract changes.

---

## When to Use

- **Pre-Refactoring Impact Analysis**: Before modifying a function, DTO, interface, or database schema, query all upstream and downstream references.
- **Multi-Tier Traceability**: Tracing flow across full-stack boundaries (e.g. Angular Service `HttpClient.get` → ASP.NET Core Controller `[HttpGet]` → MediatR Handler → EF Core Entity).
- **Dead Code & Unused Export Detection**: Locating functions, classes, or types that have 0 inbound edges in the AST graph.
- **Architectural Audits**: Verifying adherence to Clean Architecture boundaries (e.g. Domain layer must have 0 imports from Infrastructure).

### When NOT to Use
- **Simple Single-File Edits**: Directly use regex or string replace (`grep_search` / `replace_file_content`).
- **Semantic Conceptual Search**: If looking for vague ideas or business concepts, use natural language search or docs lookup.

---

## Core Architecture & Graph Topology

Unlike vector RAG (which uses embeddings that may miss subtle dependencies), `graphify` models code as an explicit directed graph:

```
[UI Component / View] ──(imports/calls)──► [Angular Service]
                                                  │
                                          (HTTP Endpoint)
                                                  ▼
[EF Core Entity] ◄──(queries)── [API Controller / Handler]
```

### Graph Node Types
- `FILE`: Source file path and module metadata.
- `TYPE`: Classes, interfaces, structs, enums, records.
- `FUNCTION`: Methods, standalone functions, lambda endpoints.
- `SCHEMA`: Database tables, columns, relations, EF Core DbSet models.
- `ROUTE`: API route templates and HTTP verbs (`GET /api/v1/hrm/...`).

### Graph Edge Types
- `CALLS`: Function A calls Function B.
- `IMPLEMENTS`: Class C implements Interface I.
- `INHERITS`: Class D extends BaseClass B.
- `IMPORTS`: File X imports from File Y.
- `MUTATES`: Handler modifies Schema / Entity E.

---

## Practical Agent Workflow

### Step 1: Generate or Query Code Graph
When working in a complex multi-project workspace, check for existing graph index or run a targeted AST discovery:

```bash
# Example AST extraction for symbols and imports
# Using built-in tool or node script
node scripts/extract-ast-graph.cjs --target src/
```

### Step 2: Query Impact Surface (Before Editing)
Before editing any shared type (e.g. `EmployeeDto`, `IEmployeeService`):

1. **Find Declarations**: Locate the symbol definition.
2. **Find Inbound References**: Identify all consumers (`CALLS`, `IMPORTS`, `IMPLEMENTS`).
3. **Cluster Dependent Files**: List all files that must be updated synchronously to prevent compilation drift.

### Step 3: Enforce "All-or-Nothing" Synchronized Updates
Never edit the producer without simultaneously updating all consumers identified by the graph:
- If a C# API endpoint parameter changes → Update Angular model and service call in the same step.
- If a database migration alters a column → Update Entity, DTO, and validation rules simultaneously.

---

## Best Practices & Rules

1. **Deterministic Over Heuristic**: Trust exact AST nodes and compiler symbol tables over heuristic text searches.
2. **Path Awareness**: Always map paths relative to workspace root using standard POSIX forward slashes `/`.
3. **No Hallucinated Edges**: If a call graph edge cannot be proven through imports, dependency injection, or route matching, mark it as `POTENTIAL_LINK` and prompt for verification.
4. **Cache & Invalidation**: Store graph artifacts in `.graphify/` or `.cache/` and re-index when project files change.
