---
name: swe-bench-runner
description: Benchmark, reproduce, isolate, patch, and verify software engineering defects following SWE-bench evaluation methodology.
version: 1.0.0
category: verification
---

# SWE-Bench Runner

Use this skill to benchmark, reproduce, and verify bug fixes against standard SWE-bench patterns and defect harnesses.

## The SWE-Bench Evaluation Loop

```
Problem Description (Issue) 
       │
       ▼
1. Isolate Environment & Base Commit
       │
       ▼
2. Write / Run Failing Test (FAIL_TO_PASS)
       │
       ▼
3. Synthesize Minimal Patch
       │
       ▼
4. Run Test Harness (Verify FAIL_TO_PASS passes & PASS_TO_PASS remains green)
       │
       ▼
5. Output Evaluation Receipt & Diff
```

## Core Protocol

### 1. Test Categorization
- **FAIL_TO_PASS**: Tests that currently fail on the base commit and must pass after applying the candidate patch.
- **PASS_TO_PASS**: Regression test suite that passed on the base commit and must continue passing without breakage.

### 2. Patch Isolation Guidelines
- Produce only minimal unified diffs (`git diff`).
- Do NOT touch unrelated files, formatting, comments, or styling.
- Ensure the patch addresses the root cause rather than patching symptoms.

### 3. Evaluation Verdicts
- **RESOLVED**: All FAIL_TO_PASS tests pass AND all PASS_TO_PASS tests pass.
- **UNRESOLVED**: One or more FAIL_TO_PASS tests still fail.
- **REGRESSION**: One or more PASS_TO_PASS tests failed after the patch.
- **ERROR**: Test harness or environment execution crashed before test suite finished.

## Helper Script

Run the lightweight evaluation harness:
```bash
python scripts/eval_harness.py --test-command "pytest tests/test_bug.py" --instance-id "issue-101"
```

## References
- See `references/methodology.md` for benchmark dataset construction, docker isolation, and submission formats.
