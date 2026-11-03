# Rubric Templates for LLM Judge

## 1. Code Generation Rubric (1-5)

| Score | Criteria |
|---|---|
| 5 | Fully correct, idiomatic, optimal complexity, edge cases handled, clear typing. |
| 4 | Correct and functional, minor non-idiomatic style or slight sub-optimality. |
| 3 | Mostly working but fails an edge case, or contains subtle logic flaws. |
| 2 | Major logic bugs, syntax errors, or incomplete implementation. |
| 1 | Irrelevant, completely broken, or hallucinated APIs. |

## 2. Technical Explanation Rubric (1-5)

- **Factual Accuracy**: Are assertions backed by standard documentation?
- **Conciseness & Signal**: Does it directly address the prompt without unnecessary fluff?
- **Actionability**: Can an engineer immediately execute the guidance?

## 3. JSON Output Schema
```json
{
  "evaluation": {
    "rationale": "Detailed rationale with exact quotes...",
    "score": 5,
    "pass": true
  }
}
```
