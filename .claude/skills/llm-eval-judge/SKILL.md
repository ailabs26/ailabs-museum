---
name: llm-eval-judge
description: Multi-model evaluation harness using LLM-as-a-judge patterns with rubric scoring, pairwise comparisons, and position bias mitigation.
version: 1.0.0
category: verification
---

# LLM Eval Judge

Use this skill to evaluate model outputs, agent reasoning traces, or code generations using structured rubric scoring and pairwise judge protocols.

## Core Evaluation Modes

### 1. Direct Rubric Scoring (Single Answer)
Scores a candidate response on an explicit 1–5 or 1–10 scale across well-defined criteria (e.g., Correctness, Completeness, Conciseness, Instruction Following).
- Each score must be defended with an explicit evidence quote from the evaluated text before the numeric score is rendered.

### 2. Pairwise Comparison (Model A vs. Model B)
Presents two candidate responses to the judge model to determine:
- `Winner: Model A`
- `Winner: Model B`
- `Tie`
- **Critical Requirement**: Always run two passes with flipped positions (A/B and B/A) to cancel position bias.

## Bias Mitigation Checklist
- [ ] **Position Bias**: Flip order of responses across iterations.
- [ ] **Verbosity Bias**: Penalize fluffy explanations that lack factual substance.
- [ ] **Self-Enhancement Bias**: Do not reveal model provenance to the judge.
- [ ] **Chain-of-Thought First**: Demand rationale and quotes *before* final score.

## Evaluation Protocol

1. Load rubric template from `references/rubric-templates.md`.
2. Format judge prompt with system instructions, user query, reference answer (if available), and candidate outputs.
3. Execute evaluation via `scripts/judge_runner.py`.
4. Parse structured JSON output and calculate aggregate metrics.

## Helper Script

```bash
python scripts/judge_runner.py --rubric "correctness" --input "sample_eval.json"
```
