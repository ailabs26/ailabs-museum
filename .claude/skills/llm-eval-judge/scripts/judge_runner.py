#!/usr/bin/env python3
"""
Lightweight LLM-as-a-judge score aggregator and pairwise comparator.
"""
import argparse
import json
import sys

def evaluate_pairwise(score_a, score_b, threshold=0.2):
    diff = score_a - score_b
    if abs(diff) < threshold:
        return "TIE"
    return "MODEL_A" if diff > 0 else "MODEL_B"

def main():
    parser = argparse.ArgumentParser(description="LLM Judge Result Evaluator")
    parser.add_argument("--score-a", type=float, help="Score for candidate A (1-5)")
    parser.add_argument("--score-b", type=float, help="Score for candidate B (1-5)")
    parser.add_argument("--rubric", default="code-gen", help="Rubric name")
    args = parser.parse_args()

    if args.score_a is not None and args.score_b is not None:
        winner = evaluate_pairwise(args.score_a, args.score_b)
        result = {
            "rubric": args.rubric,
            "candidate_a": args.score_a,
            "candidate_b": args.score_b,
            "verdict": winner
        }
        print(json.dumps(result, indent=2))
    else:
        print("Usage: python judge_runner.py --score-a <num> --score-b <num>")

if __name__ == "__main__":
    main()
