#!/usr/bin/env python3
"""
Lightweight SWE-bench evaluation runner shim for local agent testing.
"""
import argparse
import subprocess
import json
import sys
import time

def run_tests(test_cmd, timeout=300):
    start = time.time()
    try:
        proc = subprocess.run(
            test_cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        duration = time.time() - start
        return {
            "exit_code": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "duration": duration,
            "passed": proc.returncode == 0
        }
    except subprocess.TimeoutExpired:
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": "Execution timed out",
            "duration": timeout,
            "passed": False
        }

def main():
    parser = argparse.ArgumentParser(description="SWE-Bench Test Harness Runner")
    parser.add_argument("--test-command", required=True, help="Test command to verify patch")
    parser.add_argument("--instance-id", default="local-eval", help="Evaluation instance ID")
    parser.add_argument("--timeout", type=int, default=300, help="Test timeout in seconds")
    args = parser.parse_args()

    print(f"Running SWE-bench verification for instance: {args.instance_id}")
    result = run_tests(args.test_command, timeout=args.timeout)

    report = {
        "instance_id": args.instance_id,
        "verdict": "RESOLVED" if result["passed"] else "UNRESOLVED",
        "result": result
    }
    print(json.dumps(report, indent=2))
    sys.exit(0 if result["passed"] else 1)

if __name__ == "__main__":
    main()
