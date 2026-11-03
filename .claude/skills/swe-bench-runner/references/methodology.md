# SWE-Bench Evaluation Methodology

## 1. Instance Structure
A standard SWE-bench instance consists of:
- `instance_id`: Unique identifier (e.g. `django__django-11099`).
- `repo`: Target repository.
- `base_commit`: Commit SHA before the defect resolution.
- `problem_statement`: Issue text, reproduction steps, or bug report.
- `test_patch`: Patch adding reproducing tests (`FAIL_TO_PASS`).
- `golden_patch`: Reference human solution (for comparative eval).

## 2. Execution Constraints
1. **Sandboxing**: Runs in an isolated container or virtual environment with exact dependencies pinned.
2. **Deterministic Timeouts**: Test commands must be bounded by a wall-clock timeout (default 300s).
3. **Receipt Generation**: Generate JSON execution report containing:
   - `instance_id`
   - `model_name`
   - `patch_hash`
   - `test_results` (PASSED / FAILED / TIMEOUT)
   - `verdict` (RESOLVED / UNRESOLVED / REGRESSION)
